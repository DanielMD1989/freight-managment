/**
 * Sprint 8: Escrow Management System
 *
 * Automatic fund hold/release on load lifecycle
 * - Hold shipper funds in escrow when load is assigned
 * - Release funds to carrier (minus commission) when load is delivered
 * - Deduct platform commission during release
 */

import { db } from './db';
import { Decimal } from 'decimal.js';
import { calculateCommissionBreakdown } from './commissionCalculation';

export interface EscrowHoldResult {
  success: boolean;
  escrowAmount: Decimal;
  shipperBalance: Decimal;
  error?: string;
  transactionId?: string;
}

export interface EscrowReleaseResult {
  success: boolean;
  carrierPayout: Decimal;
  platformRevenue: Decimal;
  shipperCommission: Decimal;
  carrierCommission: Decimal;
  error?: string;
  transactionId?: string;
}

/**
 * Hold funds in escrow when load is assigned
 *
 * Flow:
 * 1. Calculate total amount needed (fare + shipper commission)
 * 2. Check shipper wallet balance
 * 3. Debit shipper wallet
 * 4. Credit escrow account
 * 5. Update load.escrowFunded = true
 *
 * @param loadId - Load ID to hold funds for
 * @returns EscrowHoldResult with success status and amounts
 */
export async function holdFundsInEscrow(loadId: string): Promise<EscrowHoldResult> {
  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      totalFareEtb: true,
      rate: true,
      escrowFunded: true,
      status: true,
      shipper: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!load) {
    return {
      success: false,
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Check if already funded
  if (load.escrowFunded) {
    return {
      success: false,
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load already funded in escrow',
    };
  }

  // Get total fare (use totalFareEtb if available, otherwise fall back to rate)
  const totalFare = load.totalFareEtb
    ? new Decimal(load.totalFareEtb)
    : new Decimal(load.rate);

  // Calculate commission breakdown
  const breakdown = await calculateCommissionBreakdown(totalFare);

  // Total amount to hold = fare + shipper commission
  // (Shipper pays the commission upfront)
  const escrowAmount = totalFare.add(breakdown.shipperCommission);

  // Get shipper wallet
  const shipperWallet = await db.financialAccount.findFirst({
    where: {
      organizationId: load.shipperId,
      accountType: 'SHIPPER_WALLET',
      isActive: true,
    },
    select: {
      id: true,
      balance: true,
    },
  });

  if (!shipperWallet) {
    return {
      success: false,
      escrowAmount,
      shipperBalance: new Decimal(0),
      error: 'Shipper wallet not found',
    };
  }

  const shipperBalance = new Decimal(shipperWallet.balance);

  // Check sufficient balance
  if (shipperBalance.lessThan(escrowAmount)) {
    return {
      success: false,
      escrowAmount,
      shipperBalance,
      error: `Insufficient balance. Required: ${escrowAmount.toFixed(2)} ETB, Available: ${shipperBalance.toFixed(2)} ETB`,
    };
  }

  // Get or create escrow account
  let escrowAccount = await db.financialAccount.findFirst({
    where: {
      accountType: 'ESCROW',
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!escrowAccount) {
    // Create escrow account if doesn't exist
    escrowAccount = await db.financialAccount.create({
      data: {
        accountType: 'ESCROW',
        balance: 0,
        currency: 'ETB',
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  // Create journal entry for escrow hold
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'ESCROW_FUND',
      description: `Escrow hold for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        totalFare: totalFare.toFixed(2),
        shipperCommission: breakdown.shipperCommission.toFixed(2),
        escrowAmount: escrowAmount.toFixed(2),
      },
      lines: {
        create: [
          // Debit shipper wallet
          {
            amount: escrowAmount,
            isDebit: true,
            accountId: shipperWallet.id,
          },
          // Credit escrow account
          {
            amount: escrowAmount,
            isDebit: false,
            accountId: escrowAccount.id,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  // Update account balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: {
          decrement: escrowAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          increment: escrowAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load escrow status and commission amounts
  await db.load.update({
    where: { id: loadId },
    data: {
      escrowFunded: true,
      escrowAmount: escrowAmount.toNumber(),
      shipperCommission: breakdown.shipperCommission.toNumber(),
      carrierCommission: breakdown.carrierCommission.toNumber(),
      platformCommission: breakdown.platformRevenue.toNumber(),
    },
  });

  return {
    success: true,
    escrowAmount,
    shipperBalance: shipperBalance.sub(escrowAmount),
    transactionId: journalEntry.id,
  };
}

/**
 * Release funds from escrow when load is delivered
 *
 * Flow:
 * 1. Verify load is delivered and POD verified
 * 2. Calculate carrier payout (fare - carrier commission)
 * 3. Debit escrow account
 * 4. Credit carrier wallet (payout)
 * 5. Credit platform revenue (total commissions)
 * 6. Update load.settlementStatus = 'PAID'
 *
 * @param loadId - Load ID to release funds for
 * @returns EscrowReleaseResult with success status and amounts
 */
export async function releaseFundsFromEscrow(loadId: string): Promise<EscrowReleaseResult> {
  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      assignedTruckId: true,
      assignedTruck: {
        select: {
          carrierId: true,
          carrier: {
            select: {
              name: true,
            },
          },
        },
      },
      totalFareEtb: true,
      rate: true,
      escrowFunded: true,
      escrowAmount: true,
      shipperCommission: true,
      carrierCommission: true,
      platformCommission: true,
      podVerified: true,
      status: true,
      settlementStatus: true,
    },
  });

  if (!load) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      shipperCommission: new Decimal(0),
      carrierCommission: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Validation checks
  if (!load.escrowFunded) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      shipperCommission: new Decimal(0),
      carrierCommission: new Decimal(0),
      error: 'Load not funded in escrow',
    };
  }

  if (!load.podVerified) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      shipperCommission: new Decimal(0),
      carrierCommission: new Decimal(0),
      error: 'POD not verified - cannot release funds',
    };
  }

  if (load.settlementStatus === 'PAID') {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      shipperCommission: new Decimal(0),
      carrierCommission: new Decimal(0),
      error: 'Load already settled',
    };
  }

  if (!load.assignedTruck?.carrierId) {
    return {
      success: false,
      carrierPayout: new Decimal(0),
      platformRevenue: new Decimal(0),
      shipperCommission: new Decimal(0),
      carrierCommission: new Decimal(0),
      error: 'No carrier assigned',
    };
  }

  // Get amounts from load (already calculated during hold)
  const totalFare = load.totalFareEtb
    ? new Decimal(load.totalFareEtb)
    : new Decimal(load.rate);
  const shipperCommission = new Decimal(load.shipperCommission || 0);
  const carrierCommission = new Decimal(load.carrierCommission || 0);
  const platformRevenue = new Decimal(load.platformCommission || 0);

  // Carrier payout = fare - carrier commission
  const carrierPayout = totalFare.sub(carrierCommission);

  // Get accounts
  const [escrowAccount, carrierWallet, platformAccount] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        accountType: 'ESCROW',
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    }),
    db.financialAccount.findFirst({
      where: {
        organizationId: load.assignedTruck.carrierId,
        accountType: 'CARRIER_WALLET',
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    db.financialAccount.findFirst({
      where: {
        accountType: 'PLATFORM_REVENUE',
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!escrowAccount) {
    return {
      success: false,
      carrierPayout,
      platformRevenue,
      shipperCommission,
      carrierCommission,
      error: 'Escrow account not found',
    };
  }

  if (!carrierWallet) {
    return {
      success: false,
      carrierPayout,
      platformRevenue,
      shipperCommission,
      carrierCommission,
      error: 'Carrier wallet not found',
    };
  }

  // Create or get platform revenue account
  let platformAccountId = platformAccount?.id;
  if (!platformAccountId) {
    const newPlatformAccount = await db.financialAccount.create({
      data: {
        accountType: 'PLATFORM_REVENUE',
        balance: 0,
        currency: 'ETB',
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    platformAccountId = newPlatformAccount.id;
  }

  // Total amount to release from escrow (fare + shipper commission)
  const escrowReleaseAmount = new Decimal(load.escrowAmount || 0);

  // Check escrow has sufficient balance
  const escrowBalance = new Decimal(escrowAccount.balance);
  if (escrowBalance.lessThan(escrowReleaseAmount)) {
    return {
      success: false,
      carrierPayout,
      platformRevenue,
      shipperCommission,
      carrierCommission,
      error: `Insufficient escrow balance. Required: ${escrowReleaseAmount.toFixed(2)} ETB, Available: ${escrowBalance.toFixed(2)} ETB`,
    };
  }

  // Create journal entry for escrow release
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'ESCROW_RELEASE',
      description: `Escrow release for load ${loadId} - ${load.assignedTruck.carrier.name}`,
      reference: loadId,
      loadId,
      metadata: {
        totalFare: totalFare.toFixed(2),
        carrierPayout: carrierPayout.toFixed(2),
        shipperCommission: shipperCommission.toFixed(2),
        carrierCommission: carrierCommission.toFixed(2),
        platformRevenue: platformRevenue.toFixed(2),
      },
      lines: {
        create: [
          // Debit escrow account (full amount)
          {
            amount: escrowReleaseAmount,
            isDebit: true,
            accountId: escrowAccount.id,
          },
          // Credit carrier wallet (payout)
          {
            amount: carrierPayout,
            isDebit: false,
            accountId: carrierWallet.id,
          },
          // Credit platform revenue (total commissions)
          {
            amount: platformRevenue,
            isDebit: false,
            accountId: platformAccountId,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  // Update account balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          decrement: escrowReleaseAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: carrierWallet.id },
      data: {
        balance: {
          increment: carrierPayout.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: platformAccountId },
      data: {
        balance: {
          increment: platformRevenue.toNumber(),
        },
      },
    }),
  ]);

  // Update load settlement status
  await db.load.update({
    where: { id: loadId },
    data: {
      settlementStatus: 'PAID',
      settledAt: new Date(),
    },
  });

  return {
    success: true,
    carrierPayout,
    platformRevenue,
    shipperCommission,
    carrierCommission,
    transactionId: journalEntry.id,
  };
}

/**
 * Refund escrowed funds back to shipper (e.g., if load is cancelled)
 *
 * @param loadId - Load ID to refund
 * @returns EscrowHoldResult with refund details
 */
export async function refundEscrowFunds(loadId: string): Promise<EscrowHoldResult> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      escrowFunded: true,
      escrowAmount: true,
      status: true,
      shipper: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!load) {
    return {
      success: false,
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  if (!load.escrowFunded) {
    return {
      success: false,
      escrowAmount: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not funded in escrow',
    };
  }

  const escrowAmount = new Decimal(load.escrowAmount || 0);

  // Get accounts
  const [escrowAccount, shipperWallet] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        accountType: 'ESCROW',
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    }),
    db.financialAccount.findFirst({
      where: {
        organizationId: load.shipperId,
        accountType: 'SHIPPER_WALLET',
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    }),
  ]);

  if (!escrowAccount || !shipperWallet) {
    return {
      success: false,
      escrowAmount,
      shipperBalance: new Decimal(0),
      error: 'Accounts not found',
    };
  }

  // Create journal entry for refund
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'REFUND',
      description: `Escrow refund for load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        escrowAmount: escrowAmount.toFixed(2),
        reason: `Load ${load.status}`,
      },
      lines: {
        create: [
          // Debit escrow
          {
            amount: escrowAmount,
            isDebit: true,
            accountId: escrowAccount.id,
          },
          // Credit shipper wallet
          {
            amount: escrowAmount,
            isDebit: false,
            accountId: shipperWallet.id,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  // Update balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: escrowAccount.id },
      data: {
        balance: {
          decrement: escrowAmount.toNumber(),
        },
      },
    }),
    db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: {
          increment: escrowAmount.toNumber(),
        },
      },
    }),
  ]);

  // Update load
  await db.load.update({
    where: { id: loadId },
    data: {
      escrowFunded: false,
      escrowAmount: 0,
      settlementStatus: 'REFUNDED',
    },
  });

  const newBalance = new Decimal(shipperWallet.balance).add(escrowAmount);

  return {
    success: true,
    escrowAmount,
    shipperBalance: newBalance,
    transactionId: journalEntry.id,
  };
}
