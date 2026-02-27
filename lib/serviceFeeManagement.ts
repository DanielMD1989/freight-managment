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
 *
 * LEGACY FIELD POLICY (2026-02-07):
 * ----------------------------------
 * AUTHORITATIVE (use these for new code):
 * - shipperServiceFee: Shipper's service fee amount
 * - carrierServiceFee: Carrier's service fee amount
 * - shipperFeeStatus: Shipper fee status enum
 * - carrierFeeStatus: Carrier fee status enum
 * - estimatedTripKm: Map-estimated distance
 * - actualTripKm: GPS-computed actual distance
 *
 * LEGACY (READ-ONLY for backward compatibility):
 * - serviceFeeEtb: Legacy shipper fee (synced from shipperServiceFee)
 * - serviceFeeStatus: Legacy status (synced from shipperFeeStatus)
 * - tripKm: Legacy distance (synced from estimatedTripKm)
 *
 * Write operations sync legacy fields for backward compatibility.
 * New code MUST use authoritative fields.
 */

import { db } from "./db";
import { Decimal } from "decimal.js";
import {
  findMatchingCorridor,
  calculateFeesFromCorridor,
  calculatePartyFee,
} from "./serviceFeeCalculation";

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
export async function deductServiceFee(
  loadId: string
): Promise<ServiceFeeDeductResult> {
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
      actualTripKm: true, // GPS-computed actual distance
      estimatedTripKm: true, // Estimated distance from map
      tripKm: true, // Legacy trip distance
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
      error: "Load not found",
    };
  }

  // Check if fees already deducted
  if (
    load.shipperFeeStatus === "DEDUCTED" &&
    load.carrierFeeStatus === "DEDUCTED"
  ) {
    return {
      success: false,
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: new Decimal(0),
      error: "Service fees already deducted",
    };
  }

  // Find or use existing corridor
  let corridor = load.corridor;
  let corridorId = load.corridorId;

  if (!corridor) {
    // Try to find matching corridor
    const originRegion = load.pickupLocation?.region || load.pickupCity;
    const destinationRegion =
      load.deliveryLocation?.region || load.deliveryCity;

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

  // If no corridor found, waive fees (use transaction for consistency)
  if (!corridor) {
    await db.$transaction(async (tx) => {
      await tx.load.update({
        where: { id: loadId },
        data: {
          shipperFeeStatus: "WAIVED",
          carrierFeeStatus: "WAIVED",
          shipperServiceFee: 0,
          carrierServiceFee: 0,
          // Legacy
          serviceFeeStatus: "WAIVED",
          serviceFeeEtb: 0,
        },
      });
    });

    return {
      success: true,
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: new Decimal(0),
      error: "No matching corridor found - service fees waived",
    };
  }

  // Calculate fees for both parties
  // Priority: actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm
  // Use actual GPS-tracked distance when available, fall back to estimates or corridor default
  const distanceKm =
    load.actualTripKm && Number(load.actualTripKm) > 0
      ? Number(load.actualTripKm)
      : load.estimatedTripKm && Number(load.estimatedTripKm) > 0
        ? Number(load.estimatedTripKm)
        : load.tripKm && Number(load.tripKm) > 0
          ? Number(load.tripKm)
          : Number(corridor.distanceKm);

  const distanceSource =
    load.actualTripKm && Number(load.actualTripKm) > 0
      ? "actualTripKm (GPS)"
      : load.estimatedTripKm && Number(load.estimatedTripKm) > 0
        ? "estimatedTripKm"
        : load.tripKm && Number(load.tripKm) > 0
          ? "tripKm"
          : "corridor.distanceKm (fallback)";

  // Shipper fee calculation
  const shipperPricePerKm = corridor.shipperPricePerKm
    ? Number(corridor.shipperPricePerKm)
    : Number(corridor.pricePerKm);
  const shipperPromoFlag =
    corridor.shipperPromoFlag || corridor.promoFlag || false;
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
        accountType: "SHIPPER_WALLET",
        isActive: true,
      },
      select: { id: true, balance: true },
    }),
    carrierId
      ? db.financialAccount.findFirst({
          where: {
            organizationId: carrierId,
            accountType: "CARRIER_WALLET",
            isActive: true,
          },
          select: { id: true, balance: true },
        })
      : null,
    db.financialAccount.findFirst({
      where: {
        accountType: "PLATFORM_REVENUE",
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
        accountType: "PLATFORM_REVENUE",
        balance: 0,
        currency: "ETB",
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

  // ATOMICITY FIX (2026-02-08):
  // All financial operations MUST be in a single transaction.
  // This ensures journal entry, balance updates, and load updates
  // either ALL succeed or ALL fail together.
  //
  // Previous issue: Journal entry created first, then balance updates
  // in Promise.all. If one balance update failed, state was inconsistent.

  let transactionId: string | undefined;

  if (journalLines.length > 0 && totalDeducted > 0) {
    // Verify balances one more time inside transaction (double-check)
    // This prevents race conditions where balance changed between check and deduct
    const result = await db.$transaction(async (tx) => {
      // Re-verify shipper balance inside transaction
      if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
        const currentShipperWallet = await tx.financialAccount.findUnique({
          where: { id: shipperWallet.id },
          select: { balance: true },
        });
        if (
          !currentShipperWallet ||
          new Decimal(currentShipperWallet.balance).lessThan(
            shipperFeeCalc.finalFee
          )
        ) {
          throw new Error(`Insufficient shipper balance for fee deduction`);
        }
      }

      // Re-verify carrier balance inside transaction
      if (carrierDeducted && carrierWallet && carrierFeeCalc.finalFee > 0) {
        const currentCarrierWallet = await tx.financialAccount.findUnique({
          where: { id: carrierWallet.id },
          select: { balance: true },
        });
        if (
          !currentCarrierWallet ||
          new Decimal(currentCarrierWallet.balance).lessThan(
            carrierFeeCalc.finalFee
          )
        ) {
          throw new Error(`Insufficient carrier balance for fee deduction`);
        }
      }

      // 1. Create journal entry with all lines
      const journalEntry = await tx.journalEntry.create({
        data: {
          transactionType: "SERVICE_FEE_DEDUCT",
          description: `Service fees for load ${loadId}: Shipper ${load.shipper.name} (${shipperFeeCalc.finalFee.toFixed(2)} ETB), Carrier ${load.assignedTruck?.carrier?.name || "N/A"} (${carrierFeeCalc.finalFee.toFixed(2)} ETB)`,
          reference: loadId,
          loadId,
          metadata: {
            shipperFee: shipperFeeCalc.finalFee.toFixed(2),
            carrierFee: carrierFeeCalc.finalFee.toFixed(2),
            totalPlatformFee: totalPlatformFee.toFixed(2),
            corridorId,
            distanceKm,
            distanceSource,
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

      // 2. Update shipper wallet balance (atomic with journal)
      if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
        await tx.financialAccount.update({
          where: { id: shipperWallet.id },
          data: { balance: { decrement: shipperFeeCalc.finalFee } },
        });
      }

      // 3. Update carrier wallet balance (atomic with journal)
      if (carrierDeducted && carrierWallet && carrierFeeCalc.finalFee > 0) {
        await tx.financialAccount.update({
          where: { id: carrierWallet.id },
          data: { balance: { decrement: carrierFeeCalc.finalFee } },
        });
      }

      // 4. Credit platform revenue (atomic with journal)
      if (totalDeducted > 0) {
        await tx.financialAccount.update({
          where: { id: platformAccountId },
          data: { balance: { increment: totalDeducted } },
        });
      }

      // 5. Update load with fee information (atomic with journal)
      await tx.load.update({
        where: { id: loadId },
        data: {
          corridorId,
          // Shipper fee
          shipperServiceFee: shipperFeeCalc.finalFee,
          shipperFeeStatus: shipperDeducted ? "DEDUCTED" : "PENDING",
          shipperFeeDeductedAt: shipperDeducted ? new Date() : null,
          // Carrier fee
          carrierServiceFee: carrierFeeCalc.finalFee,
          carrierFeeStatus: carrierDeducted ? "DEDUCTED" : "PENDING",
          carrierFeeDeductedAt: carrierDeducted ? new Date() : null,
          // Legacy fields
          serviceFeeEtb: totalPlatformFee,
          serviceFeeStatus:
            shipperDeducted && carrierDeducted ? "DEDUCTED" : "PENDING",
          serviceFeeDeductedAt:
            shipperDeducted && carrierDeducted ? new Date() : null,
        },
      });

      return journalEntry.id;
    });

    transactionId = result;
  } else {
    // No fees to process - just update load with calculated fees
    await db.load.update({
      where: { id: loadId },
      data: {
        corridorId,
        shipperServiceFee: shipperFeeCalc.finalFee,
        shipperFeeStatus: shipperDeducted ? "DEDUCTED" : "PENDING",
        carrierServiceFee: carrierFeeCalc.finalFee,
        carrierFeeStatus: carrierDeducted ? "DEDUCTED" : "PENDING",
        serviceFeeEtb: totalPlatformFee,
        serviceFeeStatus:
          shipperDeducted && carrierDeducted ? "DEDUCTED" : "PENDING",
      },
    });
  }

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
export async function refundServiceFee(
  loadId: string
): Promise<ServiceFeeRefundResult> {
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
      error: "Load not found",
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
        shipperFeeStatus: "REFUNDED",
        serviceFeeStatus: "REFUNDED",
        serviceFeeRefundedAt: new Date(),
      },
    });

    return {
      success: true,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      error: "No fee to refund",
    };
  }

  // Get accounts
  const [platformAccount, shipperWallet] = await Promise.all([
    db.financialAccount.findFirst({
      where: { accountType: "PLATFORM_REVENUE", isActive: true },
      select: { id: true, balance: true },
    }),
    db.financialAccount.findFirst({
      where: {
        organizationId: load.shipperId,
        accountType: "SHIPPER_WALLET",
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
      error: "Required accounts not found",
    };
  }

  // ATOMICITY FIX (2026-02-08):
  // All refund operations MUST be in a single transaction.
  // This ensures journal entry, balance updates, and load updates
  // either ALL succeed or ALL fail together.

  const { journalEntryId, newShipperBalance } = await db.$transaction(
    async (tx) => {
      // Verify platform has sufficient balance for refund
      const currentPlatformAccount = await tx.financialAccount.findUnique({
        where: { id: platformAccount.id },
        select: { balance: true },
      });
      if (
        !currentPlatformAccount ||
        new Decimal(currentPlatformAccount.balance).lessThan(feeToRefund)
      ) {
        throw new Error("Insufficient platform balance for refund");
      }

      // 1. Create journal entry for refund
      const journalEntry = await tx.journalEntry.create({
        data: {
          transactionType: "SERVICE_FEE_REFUND",
          description: `Service fee refund for cancelled load ${loadId} - ${load.shipper.name}`,
          reference: loadId,
          loadId,
          metadata: {
            serviceFee: feeToRefund.toFixed(2),
            reason: "Load cancelled",
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

      // 2. Debit platform revenue (atomic with journal)
      await tx.financialAccount.update({
        where: { id: platformAccount.id },
        data: { balance: { decrement: feeToRefund.toNumber() } },
      });

      // 3. Credit shipper wallet (atomic with journal)
      const updatedShipperWallet = await tx.financialAccount.update({
        where: { id: shipperWallet.id },
        data: { balance: { increment: feeToRefund.toNumber() } },
        select: { balance: true },
      });

      // 4. Update load (atomic with journal)
      await tx.load.update({
        where: { id: loadId },
        data: {
          shipperFeeStatus: "REFUNDED",
          serviceFeeStatus: "REFUNDED",
          serviceFeeRefundedAt: new Date(),
        },
      });

      return {
        journalEntryId: journalEntry.id,
        newShipperBalance: new Decimal(updatedShipperWallet.balance),
      };
    }
  );

  return {
    success: true,
    serviceFee: feeToRefund,
    shipperBalance: newShipperBalance,
    transactionId: journalEntryId,
  };
}

/**
 * Validate wallet balances before trip acceptance
 *
 * CURRENT FLOW (2026-02-08):
 * - Trip acceptance: VALIDATE both wallet balances (no deduction)
 * - Trip completion: DEDUCT fees from both wallets
 * - Trip cancellation: NO refund needed (nothing was taken)
 *
 * This function checks that both shipper and carrier have sufficient
 * balance to cover their respective service fees. This is validation only,
 * no money is moved.
 *
 * @param loadId - Load ID to validate
 * @param carrierId - Carrier organization ID accepting the load
 * @returns Validation result with fee amounts and any errors
 */
export async function validateWalletBalancesForTrip(
  loadId: string,
  carrierId: string
): Promise<{
  valid: boolean;
  shipperFee: number;
  carrierFee: number;
  shipperBalance: number;
  carrierBalance: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Get load with corridor info
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      corridorId: true,
      estimatedTripKm: true,
      tripKm: true,
      corridor: {
        select: {
          distanceKm: true,
          shipperPricePerKm: true,
          carrierPricePerKm: true,
          pricePerKm: true,
          shipperPromoFlag: true,
          shipperPromoPct: true,
          carrierPromoFlag: true,
          carrierPromoPct: true,
          promoFlag: true,
          promoDiscountPct: true,
        },
      },
    },
  });

  if (!load) {
    return {
      valid: false,
      shipperFee: 0,
      carrierFee: 0,
      shipperBalance: 0,
      carrierBalance: 0,
      errors: ["Load not found"],
    };
  }

  // If no corridor, fees will be waived - validation passes
  if (!load.corridor) {
    return {
      valid: true,
      shipperFee: 0,
      carrierFee: 0,
      shipperBalance: 0,
      carrierBalance: 0,
      errors: [],
    };
  }

  // Calculate expected fees
  const distanceKm = load.estimatedTripKm
    ? Number(load.estimatedTripKm)
    : load.tripKm
      ? Number(load.tripKm)
      : Number(load.corridor.distanceKm);

  const shipperPricePerKm = load.corridor.shipperPricePerKm
    ? Number(load.corridor.shipperPricePerKm)
    : Number(load.corridor.pricePerKm);
  const shipperPromoFlag =
    load.corridor.shipperPromoFlag || load.corridor.promoFlag || false;
  const shipperPromoPct = load.corridor.shipperPromoPct
    ? Number(load.corridor.shipperPromoPct)
    : load.corridor.promoDiscountPct
      ? Number(load.corridor.promoDiscountPct)
      : null;

  const carrierPricePerKm = load.corridor.carrierPricePerKm
    ? Number(load.corridor.carrierPricePerKm)
    : 0;
  const carrierPromoFlag = load.corridor.carrierPromoFlag || false;
  const carrierPromoPct = load.corridor.carrierPromoPct
    ? Number(load.corridor.carrierPromoPct)
    : null;

  const shipperFeeCalc = calculatePartyFee(
    distanceKm,
    shipperPricePerKm,
    shipperPromoFlag,
    shipperPromoPct
  );
  const carrierFeeCalc = calculatePartyFee(
    distanceKm,
    carrierPricePerKm,
    carrierPromoFlag,
    carrierPromoPct
  );

  // Get wallet balances
  const [shipperWallet, carrierWallet] = await Promise.all([
    db.financialAccount.findFirst({
      where: {
        organizationId: load.shipperId,
        accountType: "SHIPPER_WALLET",
        isActive: true,
      },
      select: { balance: true },
    }),
    db.financialAccount.findFirst({
      where: {
        organizationId: carrierId,
        accountType: "CARRIER_WALLET",
        isActive: true,
      },
      select: { balance: true },
    }),
  ]);

  const shipperBalance = shipperWallet ? Number(shipperWallet.balance) : 0;
  const carrierBalance = carrierWallet ? Number(carrierWallet.balance) : 0;

  // Validate shipper balance
  if (shipperFeeCalc.finalFee > 0 && shipperBalance < shipperFeeCalc.finalFee) {
    errors.push(
      `Shipper has insufficient wallet balance for this trip. Required: ${shipperFeeCalc.finalFee.toFixed(2)} ETB, Available: ${shipperBalance.toFixed(2)} ETB`
    );
  }

  // Validate carrier balance
  if (carrierFeeCalc.finalFee > 0 && carrierBalance < carrierFeeCalc.finalFee) {
    errors.push(
      `Carrier has insufficient wallet balance for this trip. Required: ${carrierFeeCalc.finalFee.toFixed(2)} ETB, Available: ${carrierBalance.toFixed(2)} ETB`
    );
  }

  return {
    valid: errors.length === 0,
    shipperFee: shipperFeeCalc.finalFee,
    carrierFee: carrierFeeCalc.finalFee,
    shipperBalance,
    carrierBalance,
    errors,
  };
}

/**
 * @deprecated REMOVED - No longer used. Use validateWalletBalancesForTrip() instead.
 *
 * The reservation flow has been removed. The current flow is:
 * 1. Trip acceptance: validateWalletBalancesForTrip() (validation only)
 * 2. Trip completion: deductServiceFee() (actual deduction)
 * 3. Trip cancellation: No action needed (nothing was taken)
 *
 * This function is kept as a no-op for backward compatibility with any
 * code that may still call it. It returns success with zero values.
 */
export async function reserveServiceFee(
  loadId: string
): Promise<ServiceFeeReserveResult> {
  console.warn(
    `reserveServiceFee(${loadId}) called but is deprecated. Use validateWalletBalancesForTrip() instead.`
  );
  return {
    success: true,
    serviceFee: new Decimal(0),
    shipperBalance: new Decimal(0),
    error:
      "Reserve flow removed - use validateWalletBalancesForTrip() for validation",
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
    return { success: false, error: "Load not found" };
  }

  if (load.corridorId) {
    return { success: true, corridorId: load.corridorId };
  }

  // Determine regions
  const originRegion = load.pickupLocation?.region || load.pickupCity;
  const destinationRegion = load.deliveryLocation?.region || load.deliveryCity;

  if (!originRegion || !destinationRegion) {
    return { success: true, error: "No region information available" };
  }

  // Find matching corridor
  const match = await findMatchingCorridor(originRegion, destinationRegion);

  if (!match) {
    return { success: true, error: "No matching corridor found" };
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
