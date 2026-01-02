/**
 * Commission Calculation Utility
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Calculates platform commissions for shippers and carriers
 */

import { db } from './db';
import { Decimal } from 'decimal.js';
import { createNotification, NotificationType } from './notifications';

export interface CommissionBreakdown {
  totalFare: Decimal;
  shipperCommission: Decimal;
  carrierCommission: Decimal;
  platformRevenue: Decimal;
  shipperRate: Decimal;
  carrierRate: Decimal;
}

/**
 * Get current active commission rates
 *
 * Returns the latest active commission configuration
 * Default: 5% shipper + 5% carrier
 */
export async function getCurrentCommissionRates(): Promise<{
  shipperRate: Decimal;
  carrierRate: Decimal;
}> {
  const currentRate = await db.commissionRate.findFirst({
    where: {
      isActive: true,
      effectiveFrom: {
        lte: new Date(),
      },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date() } },
      ],
    },
    orderBy: {
      effectiveFrom: 'desc',
    },
  });

  if (currentRate) {
    return {
      shipperRate: currentRate.shipperRate,
      carrierRate: currentRate.carrierRate,
    };
  }

  // Default rates if no configuration exists
  return {
    shipperRate: new Decimal(5.0),
    carrierRate: new Decimal(5.0),
  };
}

/**
 * Calculate shipper commission
 *
 * @param totalFare - Total load fare in ETB
 * @param rate - Commission rate as percentage (e.g., 5.0 for 5%)
 * @returns Commission amount in ETB
 */
export function calculateShipperCommission(
  totalFare: Decimal,
  rate: Decimal
): Decimal {
  return totalFare.mul(rate).div(100);
}

/**
 * Calculate carrier commission
 *
 * @param totalFare - Total load fare in ETB
 * @param rate - Commission rate as percentage (e.g., 5.0 for 5%)
 * @returns Commission amount in ETB
 */
export function calculateCarrierCommission(
  totalFare: Decimal,
  rate: Decimal
): Decimal {
  return totalFare.mul(rate).div(100);
}

/**
 * Calculate platform revenue
 *
 * Platform revenue = shipper commission + carrier commission
 *
 * @param shipperCommission - Shipper commission amount
 * @param carrierCommission - Carrier commission amount
 * @returns Total platform revenue
 */
export function calculatePlatformRevenue(
  shipperCommission: Decimal,
  carrierCommission: Decimal
): Decimal {
  return shipperCommission.add(carrierCommission);
}

/**
 * Calculate complete commission breakdown
 *
 * @param totalFare - Total load fare in ETB
 * @returns Complete commission breakdown
 */
export async function calculateCommissionBreakdown(
  totalFare: number | Decimal
): Promise<CommissionBreakdown> {
  const totalFareDecimal = new Decimal(totalFare);

  // Get current rates
  const rates = await getCurrentCommissionRates();

  // Calculate commissions
  const shipperCommission = calculateShipperCommission(
    totalFareDecimal,
    rates.shipperRate
  );
  const carrierCommission = calculateCarrierCommission(
    totalFareDecimal,
    rates.carrierRate
  );
  const platformRevenue = calculatePlatformRevenue(
    shipperCommission,
    carrierCommission
  );

  return {
    totalFare: totalFareDecimal,
    shipperCommission,
    carrierCommission,
    platformRevenue,
    shipperRate: rates.shipperRate,
    carrierRate: rates.carrierRate,
  };
}

/**
 * Deduct commission from organization wallet
 *
 * Creates journal entry to deduct commission from organization's wallet
 *
 * @param orgId - Organization ID
 * @param amount - Commission amount to deduct
 * @param loadId - Load ID for reference
 * @param commissionType - 'SHIPPER' or 'CARRIER'
 */
export async function deductCommissionFromWallet(
  orgId: string,
  amount: Decimal,
  loadId: string,
  commissionType: 'SHIPPER' | 'CARRIER'
): Promise<void> {
  // Get organization's wallet account
  const walletAccount = await db.financialAccount.findFirst({
    where: {
      organizationId: orgId,
      accountType: commissionType === 'SHIPPER' ? 'SHIPPER_WALLET' : 'CARRIER_WALLET',
      isActive: true,
    },
  });

  if (!walletAccount) {
    throw new Error(`Wallet not found for organization ${orgId}`);
  }

  // Check if sufficient balance
  if (walletAccount.balance.lessThan(amount)) {
    throw new Error(
      `Insufficient balance. Required: ${amount.toString()} ETB, Available: ${walletAccount.balance.toString()} ETB`
    );
  }

  // Get platform revenue account
  const platformAccount = await db.financialAccount.findFirst({
    where: {
      accountType: 'PLATFORM_REVENUE',
      isActive: true,
    },
  });

  if (!platformAccount) {
    throw new Error('Platform revenue account not found');
  }

  // Create journal entry for commission deduction
  await db.journalEntry.create({
    data: {
      transactionType: 'COMMISSION',
      description: `${commissionType} commission for load ${loadId}`,
      reference: loadId,
      loadId,
      lines: {
        create: [
          {
            // Debit: Platform revenue (increase)
            amount: amount,
            isDebit: true,
            accountId: platformAccount.id,
          },
          {
            // Credit: Organization wallet (decrease)
            amount: amount,
            isDebit: false,
            accountId: walletAccount.id,
            creditAccountId: walletAccount.id,
          },
        ],
      },
    },
  });

  // Update wallet balance
  await db.financialAccount.update({
    where: { id: walletAccount.id },
    data: {
      balance: {
        decrement: amount,
      },
    },
  });

  // Update platform revenue balance
  await db.financialAccount.update({
    where: { id: platformAccount.id },
    data: {
      balance: {
        increment: amount,
      },
    },
  });
}

/**
 * Process settlement for a delivered load
 *
 * 1. Calculate commissions
 * 2. Deduct from shipper wallet
 * 3. Deduct from carrier wallet
 * 4. Update load settlement status
 *
 * @param loadId - Load ID
 */
export async function processSettlement(loadId: string): Promise<void> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      podVerified: true,
      settlementStatus: true,
      totalFareEtb: true,
      rate: true,
      shipperId: true,
      assignedTruck: {
        select: {
          carrierId: true,
        },
      },
    },
  });

  if (!load) {
    throw new Error('Load not found');
  }

  if (load.status !== 'DELIVERED') {
    throw new Error('Load must be DELIVERED before settlement');
  }

  if (!load.podVerified) {
    throw new Error('POD must be verified before settlement');
  }

  if (load.settlementStatus === 'PAID') {
    throw new Error('Load already settled');
  }

  if (!load.assignedTruck?.carrierId) {
    throw new Error('Load must have assigned carrier');
  }

  // Get total fare (use totalFareEtb if available, otherwise use legacy rate field)
  const totalFare = load.totalFareEtb || load.rate;

  if (!totalFare || totalFare.isZero()) {
    throw new Error('Load has no fare amount');
  }

  // Calculate commissions
  const breakdown = await calculateCommissionBreakdown(totalFare);

  // Update load with commission amounts
  await db.load.update({
    where: { id: loadId },
    data: {
      shipperCommission: breakdown.shipperCommission,
      carrierCommission: breakdown.carrierCommission,
      platformCommission: breakdown.platformRevenue,
      settlementStatus: 'IN_PROGRESS',
    },
  });

  try {
    // Deduct shipper commission
    await deductCommissionFromWallet(
      load.shipperId,
      breakdown.shipperCommission,
      loadId,
      'SHIPPER'
    );

    // Notify shipper of commission deduction
    const shipperUser = await db.user.findFirst({
      where: { organizationId: load.shipperId, isActive: true },
      select: { id: true },
    });
    if (shipperUser) {
      await createNotification({
        userId: shipperUser.id,
        type: NotificationType.COMMISSION_DEDUCTED,
        title: 'Commission Deducted',
        message: `Commission of ${new Intl.NumberFormat('en-ET', {
          style: 'currency',
          currency: 'ETB',
        }).format(Number(breakdown.shipperCommission))} deducted from your wallet for load settlement.`,
        metadata: { loadId, amount: Number(breakdown.shipperCommission) },
      });
    }

    // Deduct carrier commission
    await deductCommissionFromWallet(
      load.assignedTruck.carrierId,
      breakdown.carrierCommission,
      loadId,
      'CARRIER'
    );

    // Notify carrier of commission deduction
    const carrierUser = await db.user.findFirst({
      where: { organizationId: load.assignedTruck.carrierId, isActive: true },
      select: { id: true },
    });
    if (carrierUser) {
      await createNotification({
        userId: carrierUser.id,
        type: NotificationType.COMMISSION_DEDUCTED,
        title: 'Commission Deducted',
        message: `Commission of ${new Intl.NumberFormat('en-ET', {
          style: 'currency',
          currency: 'ETB',
        }).format(Number(breakdown.carrierCommission))} deducted from load payment.`,
        metadata: { loadId, amount: Number(breakdown.carrierCommission) },
      });
    }

    // Mark as paid
    await db.load.update({
      where: { id: loadId },
      data: {
        settlementStatus: 'PAID',
        settledAt: new Date(),
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'SETTLED',
        description: `Settlement completed. Platform revenue: ${breakdown.platformRevenue.toString()} ETB`,
      },
    });

    // Get load details for notifications
    const loadDetails = await db.load.findUnique({
      where: { id: loadId },
      select: {
        pickupCity: true,
        deliveryCity: true,
        totalFareEtb: true,
        rate: true,
      },
    });

    const settlementAmount = loadDetails?.totalFareEtb || loadDetails?.rate || new Decimal(0);

    // Notify shipper of settlement completion
    if (shipperUser) {
      await createNotification({
        userId: shipperUser.id,
        type: NotificationType.SETTLEMENT_COMPLETE,
        title: 'Settlement Completed',
        message: `Settlement completed for load ${loadDetails?.pickupCity} → ${loadDetails?.deliveryCity}. Total: ${new Intl.NumberFormat('en-ET', {
          style: 'currency',
          currency: 'ETB',
        }).format(Number(settlementAmount))}`,
        metadata: { loadId },
      });
    }

    // Notify carrier of settlement completion
    if (carrierUser) {
      const carrierNet = settlementAmount.minus(breakdown.carrierCommission);
      await createNotification({
        userId: carrierUser.id,
        type: NotificationType.SETTLEMENT_COMPLETE,
        title: 'Settlement Completed',
        message: `Settlement of ${new Intl.NumberFormat('en-ET', {
          style: 'currency',
          currency: 'ETB',
        }).format(Number(carrierNet))} completed for load ${loadDetails?.pickupCity} → ${loadDetails?.deliveryCity}.`,
        metadata: { loadId, netAmount: Number(carrierNet) },
      });
    }
  } catch (error) {
    // Mark as disputed if settlement fails
    await db.load.update({
      where: { id: loadId },
      data: {
        settlementStatus: 'DISPUTED',
      },
    });

    throw error;
  }
}

/**
 * Initialize default commission rates
 *
 * Creates the initial commission rate configuration
 * Only runs if no rates exist
 */
export async function initializeDefaultCommissionRates(): Promise<void> {
  const existingRates = await db.commissionRate.count();

  if (existingRates === 0) {
    await db.commissionRate.create({
      data: {
        shipperRate: new Decimal(5.0),
        carrierRate: new Decimal(5.0),
        isActive: true,
        effectiveFrom: new Date(),
      },
    });
  }
}
