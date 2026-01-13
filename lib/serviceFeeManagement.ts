/**
 * Service Fee Management Module
 *
 * Service Fee Implementation - Updated for Dual-Party Fees
 *
 * Calculates and deducts service fees from both shipper and carrier
 * when a trip is completed (status → COMPLETED after POD upload)
 *
 * Flow:
 * 1. Trip completes → carrier uploads POD → status changes to COMPLETED
 * 2. System finds matching corridor based on route
 * 3. Calculate shipper fee: distance × shipperPricePerKm (minus any promo)
 * 4. Calculate carrier fee: distance × carrierPricePerKm (minus any promo)
 * 5. Deduct fees from respective wallets
 * 6. Credit total to platform revenue
 * 7. Store fees on Load record
 */

import { db } from './db';
import { Decimal } from 'decimal.js';
import { ServiceFeeStatus } from '@prisma/client';
import {
  calculateServiceFee,
  findMatchingCorridor,
  calculateFeesFromCorridor,
  calculatePartyFee,
} from './serviceFeeCalculation';

// Result interfaces
export interface ServiceFeeDeductResult {
  success: boolean;
  serviceFee: number; // Legacy: total platform fee
  shipperFee: number;
  carrierFee: number;
  totalPlatformFee: number;
  platformRevenue: Decimal;
  error?: string;
  transactionId?: string;
  details?: {
    shipper: {
      baseFee: number;
      discount: number;
      finalFee: number;
      walletDeducted: boolean;
    };
    carrier: {
      baseFee: number;
      discount: number;
      finalFee: number;
      walletDeducted: boolean;
    };
  };
}

export interface ServiceFeeRefundResult {
  success: boolean;
  serviceFee: Decimal;
  shipperBalance: Decimal;
  error?: string;
  transactionId?: string;
}

// Legacy interfaces for backward compatibility
export interface ServiceFeeReserveResult {
  success: boolean;
  serviceFee: Decimal;
  shipperBalance: Decimal;
  error?: string;
  transactionId?: string;
}

/**
 * Deduct service fees from both shipper and carrier when trip is completed
 *
 * This is the main trigger called when load status changes to COMPLETED
 *
 * @param loadId - Load ID to deduct service fees for
 * @returns ServiceFeeDeductResult with success status and amounts
 */
export async function deductServiceFee(loadId: string): Promise<ServiceFeeDeductResult> {
  // Get load with corridor and organization info
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      corridorId: true,
      corridor: true,
      shipperServiceFee: true,
      carrierServiceFee: true,
      shipperFeeStatus: true,
      carrierFeeStatus: true,
      // Trip distance fields - priority: actualTripKm > estimatedTripKm > corridor.distanceKm
      actualTripKm: true,       // GPS-computed actual distance
      estimatedTripKm: true,    // Estimated distance from map
      tripKm: true,             // Legacy trip distance
      // Legacy fields
      serviceFeeEtb: true,
      serviceFeeStatus: true,
      assignedTruck: {
        select: {
          carrierId: true,
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      shipper: {
        select: {
          id: true,
          name: true,
        },
      },
      pickupLocation: {
        select: { region: true },
      },
      deliveryLocation: {
        select: { region: true },
      },
      pickupCity: true,
      deliveryCity: true,
    },
  });

  if (!load) {
    return {
      success: false,
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Check if fees already deducted
  if (load.shipperFeeStatus === 'DEDUCTED' && load.carrierFeeStatus === 'DEDUCTED') {
    return {
      success: false,
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: new Decimal(0),
      error: 'Service fees already deducted',
    };
  }

  // Find or use existing corridor
  let corridor = load.corridor;
  let corridorId = load.corridorId;

  if (!corridor) {
    // Try to find matching corridor
    const originRegion = load.pickupLocation?.region || load.pickupCity;
    const destinationRegion = load.deliveryLocation?.region || load.deliveryCity;

    if (originRegion && destinationRegion) {
      const match = await findMatchingCorridor(originRegion, destinationRegion);
      if (match) {
        corridor = await db.corridor.findUnique({
          where: { id: match.corridor.id },
        });
        corridorId = match.corridor.id;
      }
    }
  }

  // If no corridor found, waive fees
  if (!corridor) {
    await db.load.update({
      where: { id: loadId },
      data: {
        shipperFeeStatus: 'WAIVED',
        carrierFeeStatus: 'WAIVED',
        shipperServiceFee: 0,
        carrierServiceFee: 0,
        // Legacy
        serviceFeeStatus: 'WAIVED',
        serviceFeeEtb: 0,
      },
    });

    return {
      success: true,
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: new Decimal(0),
      error: 'No matching corridor found - service fees waived',
    };
  }

  // Calculate fees for both parties
  // Priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm
  // Use actual GPS-tracked distance when available, fall back to estimates or corridor default
  const distanceKm = load.actualTripKm && Number(load.actualTripKm) > 0
    ? Number(load.actualTripKm)
    : load.estimatedTripKm && Number(load.estimatedTripKm) > 0
      ? Number(load.estimatedTripKm)
      : load.tripKm && Number(load.tripKm) > 0
        ? Number(load.tripKm)
        : Number(corridor.distanceKm);

  const distanceSource = load.actualTripKm && Number(load.actualTripKm) > 0
    ? 'actualTripKm (GPS)'
    : load.estimatedTripKm && Number(load.estimatedTripKm) > 0
      ? 'estimatedTripKm'
      : load.tripKm && Number(load.tripKm) > 0
        ? 'tripKm'
        : 'corridor.distanceKm (fallback)';

  // Shipper fee calculation
  const shipperPricePerKm = corridor.shipperPricePerKm
    ? Number(corridor.shipperPricePerKm)
    : Number(corridor.pricePerKm);
  const shipperPromoFlag = corridor.shipperPromoFlag || corridor.promoFlag || false;
  const shipperPromoPct = corridor.shipperPromoPct
    ? Number(corridor.shipperPromoPct)
    : corridor.promoDiscountPct
      ? Number(corridor.promoDiscountPct)
      : null;

  const shipperFeeCalc = calculatePartyFee(
    distanceKm,
    shipperPricePerKm,
    shipperPromoFlag,
    shipperPromoPct
  );

  // Carrier fee calculation
  const carrierPricePerKm = corridor.carrierPricePerKm
    ? Number(corridor.carrierPricePerKm)
    : 0;
  const carrierPromoFlag = corridor.carrierPromoFlag || false;
  const carrierPromoPct = corridor.carrierPromoPct
    ? Number(corridor.carrierPromoPct)
    : null;

  const carrierFeeCalc = calculatePartyFee(
    distanceKm,
    carrierPricePerKm,
    carrierPromoFlag,
    carrierPromoPct
  );

  const totalPlatformFee = shipperFeeCalc.finalFee + carrierFeeCalc.finalFee;

  // Get wallets
  const carrierId = load.assignedTruck?.carrierId;

  const [shipperWallet, carrierWallet, platformAccount] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        organizationId: load.shipperId,
        accountType: 'SHIPPER_WALLET',
        isActive: true,
      },
      select: { id: true, balance: true },
    }),
    carrierId
      ? db.financialAccount.findFirst({
          where: {
            organizationId: carrierId,
            accountType: 'CARRIER_WALLET',
            isActive: true,
          },
          select: { id: true, balance: true },
        })
      : null,
    db.financialAccount.findFirst({
      where: {
        accountType: 'PLATFORM_REVENUE',
        isActive: true,
      },
      select: { id: true },
    }),
  ]);

  // Create platform account if not exists
  let platformAccountId = platformAccount?.id;
  if (!platformAccountId) {
    const newPlatformAccount = await db.financialAccount.create({
      data: {
        accountType: 'PLATFORM_REVENUE',
        balance: 0,
        currency: 'ETB',
        isActive: true,
      },
      select: { id: true },
    });
    platformAccountId = newPlatformAccount.id;
  }

  // Track deduction results
  let shipperDeducted = false;
  let carrierDeducted = false;
  const journalLines: Array<{
    amount: Decimal;
    isDebit: boolean;
    accountId: string;
  }> = [];

  // Deduct shipper fee if wallet exists and has balance
  if (shipperWallet && shipperFeeCalc.finalFee > 0) {
    const shipperBalance = new Decimal(shipperWallet.balance);
    if (shipperBalance.greaterThanOrEqualTo(shipperFeeCalc.finalFee)) {
      journalLines.push({
        amount: new Decimal(shipperFeeCalc.finalFee),
        isDebit: true,
        accountId: shipperWallet.id,
      });
      shipperDeducted = true;
    }
  } else if (shipperFeeCalc.finalFee === 0) {
    shipperDeducted = true; // No fee to deduct
  }

  // Deduct carrier fee if wallet exists and has balance
  if (carrierWallet && carrierFeeCalc.finalFee > 0) {
    const carrierBalance = new Decimal(carrierWallet.balance);
    if (carrierBalance.greaterThanOrEqualTo(carrierFeeCalc.finalFee)) {
      journalLines.push({
        amount: new Decimal(carrierFeeCalc.finalFee),
        isDebit: true,
        accountId: carrierWallet.id,
      });
      carrierDeducted = true;
    }
  } else if (carrierFeeCalc.finalFee === 0) {
    carrierDeducted = true; // No fee to deduct
  }

  // Credit platform revenue with total deducted fees
  const totalDeducted =
    (shipperDeducted ? shipperFeeCalc.finalFee : 0) +
    (carrierDeducted ? carrierFeeCalc.finalFee : 0);

  if (totalDeducted > 0) {
    journalLines.push({
      amount: new Decimal(totalDeducted),
      isDebit: false,
      accountId: platformAccountId,
    });
  }

  // Create journal entry if there are fees to process
  let transactionId: string | undefined;
  if (journalLines.length > 0 && totalDeducted > 0) {
    const journalEntry = await db.journalEntry.create({
      data: {
        transactionType: 'SERVICE_FEE_DEDUCT',
        description: `Service fees for load ${loadId}: Shipper ${load.shipper.name} (${shipperFeeCalc.finalFee.toFixed(2)} ETB), Carrier ${load.assignedTruck?.carrier?.name || 'N/A'} (${carrierFeeCalc.finalFee.toFixed(2)} ETB)`,
        reference: loadId,
        loadId,
        metadata: {
          shipperFee: shipperFeeCalc.finalFee.toFixed(2),
          carrierFee: carrierFeeCalc.finalFee.toFixed(2),
          totalPlatformFee: totalPlatformFee.toFixed(2),
          corridorId,
          distanceKm,
          distanceSource, // Track which distance field was used
          corridorDistanceKm: Number(corridor.distanceKm),
          shipperPricePerKm,
          carrierPricePerKm,
        },
        lines: {
          create: journalLines.map((line) => ({
            amount: line.amount,
            isDebit: line.isDebit,
            accountId: line.accountId,
          })),
        },
      },
      select: { id: true },
    });
    transactionId = journalEntry.id;

    // Update wallet balances
    const balanceUpdates = [];

    if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
      balanceUpdates.push(
        db.financialAccount.update({
          where: { id: shipperWallet.id },
          data: { balance: { decrement: shipperFeeCalc.finalFee } },
        })
      );
    }

    if (carrierDeducted && carrierWallet && carrierFeeCalc.finalFee > 0) {
      balanceUpdates.push(
        db.financialAccount.update({
          where: { id: carrierWallet.id },
          data: { balance: { decrement: carrierFeeCalc.finalFee } },
        })
      );
    }

    if (totalDeducted > 0) {
      balanceUpdates.push(
        db.financialAccount.update({
          where: { id: platformAccountId },
          data: { balance: { increment: totalDeducted } },
        })
      );
    }

    await Promise.all(balanceUpdates);
  }

  // Update load with fee information
  await db.load.update({
    where: { id: loadId },
    data: {
      corridorId,
      // Shipper fee
      shipperServiceFee: shipperFeeCalc.finalFee,
      shipperFeeStatus: shipperDeducted ? 'DEDUCTED' : 'PENDING',
      shipperFeeDeductedAt: shipperDeducted ? new Date() : null,
      // Carrier fee
      carrierServiceFee: carrierFeeCalc.finalFee,
      carrierFeeStatus: carrierDeducted ? 'DEDUCTED' : 'PENDING',
      carrierFeeDeductedAt: carrierDeducted ? new Date() : null,
      // Legacy fields
      serviceFeeEtb: totalPlatformFee,
      serviceFeeStatus: shipperDeducted && carrierDeducted ? 'DEDUCTED' : 'PENDING',
      serviceFeeDeductedAt: shipperDeducted && carrierDeducted ? new Date() : null,
    },
  });

  console.log(`Service fees calculated for load ${loadId}:`, {
    corridor: corridor.name,
    distanceKm,
    distanceSource,
    corridorDistanceKm: Number(corridor.distanceKm),
    shipper: {
      fee: shipperFeeCalc.finalFee,
      deducted: shipperDeducted,
      pricePerKm: shipperPricePerKm,
    },
    carrier: {
      fee: carrierFeeCalc.finalFee,
      deducted: carrierDeducted,
      pricePerKm: carrierPricePerKm,
    },
    totalPlatformFee,
  });

  return {
    success: true,
    serviceFee: totalPlatformFee, // Legacy
    shipperFee: shipperFeeCalc.finalFee,
    carrierFee: carrierFeeCalc.finalFee,
    totalPlatformFee,
    platformRevenue: new Decimal(totalDeducted),
    transactionId,
    details: {
      shipper: {
        baseFee: shipperFeeCalc.baseFee,
        discount: shipperFeeCalc.promoDiscount,
        finalFee: shipperFeeCalc.finalFee,
        walletDeducted: shipperDeducted,
      },
      carrier: {
        baseFee: carrierFeeCalc.baseFee,
        discount: carrierFeeCalc.promoDiscount,
        finalFee: carrierFeeCalc.finalFee,
        walletDeducted: carrierDeducted,
      },
    },
  };
}

/**
 * Refund service fee to shipper when load is cancelled
 * (Only refunds shipper fee since carrier fee is deducted on completion)
 *
 * @param loadId - Load ID to refund service fee for
 * @returns ServiceFeeRefundResult with refund details
 */
export async function refundServiceFee(loadId: string): Promise<ServiceFeeRefundResult> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      shipperServiceFee: true,
      shipperFeeStatus: true,
      // Legacy
      serviceFeeEtb: true,
      serviceFeeStatus: true,
      shipper: {
        select: { name: true },
      },
    },
  });

  if (!load) {
    return {
      success: false,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'Load not found',
    };
  }

  // Check if there's anything to refund
  const feeToRefund = load.shipperServiceFee
    ? new Decimal(load.shipperServiceFee)
    : load.serviceFeeEtb
      ? new Decimal(load.serviceFeeEtb)
      : new Decimal(0);

  if (feeToRefund.isZero()) {
    // Mark as refunded even if zero
    await db.load.update({
      where: { id: loadId },
      data: {
        shipperFeeStatus: 'REFUNDED',
        serviceFeeStatus: 'REFUNDED',
        serviceFeeRefundedAt: new Date(),
      },
    });

    return {
      success: true,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: 'No fee to refund',
    };
  }

  // Get accounts
  const [platformAccount, shipperWallet] = await Promise.all([
    db.financialAccount.findFirst({
      where: { accountType: 'PLATFORM_REVENUE', isActive: true },
      select: { id: true, balance: true },
    }),
    db.financialAccount.findFirst({
      where: {
        organizationId: load.shipperId,
        accountType: 'SHIPPER_WALLET',
        isActive: true,
      },
      select: { id: true, balance: true },
    }),
  ]);

  if (!platformAccount || !shipperWallet) {
    return {
      success: false,
      serviceFee: feeToRefund,
      shipperBalance: new Decimal(0),
      error: 'Required accounts not found',
    };
  }

  // Create journal entry for refund
  const journalEntry = await db.journalEntry.create({
    data: {
      transactionType: 'SERVICE_FEE_REFUND',
      description: `Service fee refund for cancelled load ${loadId} - ${load.shipper.name}`,
      reference: loadId,
      loadId,
      metadata: {
        serviceFee: feeToRefund.toFixed(2),
        reason: 'Load cancelled',
      },
      lines: {
        create: [
          // Debit platform revenue
          {
            amount: feeToRefund,
            isDebit: true,
            accountId: platformAccount.id,
          },
          // Credit shipper wallet
          {
            amount: feeToRefund,
            isDebit: false,
            accountId: shipperWallet.id,
          },
        ],
      },
    },
    select: { id: true },
  });

  // Update balances
  await Promise.all([
    db.financialAccount.update({
      where: { id: platformAccount.id },
      data: { balance: { decrement: feeToRefund.toNumber() } },
    }),
    db.financialAccount.update({
      where: { id: shipperWallet.id },
      data: { balance: { increment: feeToRefund.toNumber() } },
    }),
  ]);

  // Update load
  await db.load.update({
    where: { id: loadId },
    data: {
      shipperFeeStatus: 'REFUNDED',
      serviceFeeStatus: 'REFUNDED',
      serviceFeeRefundedAt: new Date(),
    },
  });

  const newBalance = new Decimal(shipperWallet.balance).add(feeToRefund);

  return {
    success: true,
    serviceFee: feeToRefund,
    shipperBalance: newBalance,
    transactionId: journalEntry.id,
  };
}

/**
 * Reserve service fee from shipper wallet when load is assigned
 * (Legacy function - kept for backward compatibility but no longer used in new flow)
 *
 * @deprecated New flow deducts fees directly on completion
 */
export async function reserveServiceFee(loadId: string): Promise<ServiceFeeReserveResult> {
  // In the new flow, we don't reserve fees upfront
  // Fees are calculated and deducted when trip completes
  return {
    success: true,
    serviceFee: new Decimal(0),
    shipperBalance: new Decimal(0),
    error: 'Reserve flow deprecated - fees are deducted on completion',
  };
}

/**
 * Assign corridor to a load and pre-calculate service fees
 * (Called when load is posted or route is determined)
 */
export async function assignCorridorToLoad(loadId: string): Promise<{
  success: boolean;
  corridorId?: string;
  shipperFee?: number;
  carrierFee?: number;
  totalPlatformFee?: number;
  error?: string;
}> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      pickupLocation: { select: { region: true } },
      deliveryLocation: { select: { region: true } },
      pickupCity: true,
      deliveryCity: true,
      corridorId: true,
    },
  });

  if (!load) {
    return { success: false, error: 'Load not found' };
  }

  if (load.corridorId) {
    return { success: true, corridorId: load.corridorId };
  }

  // Determine regions
  const originRegion = load.pickupLocation?.region || load.pickupCity;
  const destinationRegion = load.deliveryLocation?.region || load.deliveryCity;

  if (!originRegion || !destinationRegion) {
    return { success: true, error: 'No region information available' };
  }

  // Find matching corridor
  const match = await findMatchingCorridor(originRegion, destinationRegion);

  if (!match) {
    return { success: true, error: 'No matching corridor found' };
  }

  // Calculate fees for preview
  const fees = calculateFeesFromCorridor(match.corridor);

  // Update load with corridor (fees will be stored on completion)
  await db.load.update({
    where: { id: loadId },
    data: {
      corridorId: match.corridor.id,
    },
  });

  return {
    success: true,
    corridorId: match.corridor.id,
    shipperFee: fees.shipper.finalFee,
    carrierFee: fees.carrier.finalFee,
    totalPlatformFee: fees.totalPlatformFee,
  };
}
