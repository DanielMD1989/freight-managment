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
import {
  createNotificationForRole,
  notifyOrganization,
  NotificationType,
} from "./notifications";
import { calculateTripDistance, type GpsPosition } from "./gpsQuery";

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
  serviceFee: Decimal; // Shipper fee refunded (backward compat field)
  shipperBalance: Decimal;
  carrierFeeRefunded?: number; // Carrier fee refunded (A3: both parties)
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
      // Blueprint §8: billing distance = actualTripKm (GPS) → corridor.distanceKm only.
      // estimatedTripKm and tripKm are UI/planning fields — NOT used in billing.
      actualTripKm: true,
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
              carrierRatePerKm: true,
              carrierPromoFlag: true,
              carrierPromoPct: true,
            },
          },
        },
      },
      shipper: {
        select: {
          id: true,
          name: true,
          shipperRatePerKm: true,
          shipperPromoFlag: true,
          shipperPromoPct: true,
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
          // Rate/KM snapshot: 0 when waived (no corridor). NULL = never ran; 0 = ran but waived.
          shipperRatePerKmUsed: 0,
          carrierRatePerKmUsed: 0,
          totalKmUsed: 0,
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

  // §11 GPS Tracking Policy: Calculate actualTripKm from GPS positions if not already set.
  // This runs INSIDE deductServiceFee() before billing — single source of truth for GPS distance.
  let gpsCalculatedKm: number | null = null;
  if (load.actualTripKm == null) {
    const trip = await db.trip.findFirst({
      where: {
        loadId: load.id,
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true },
      orderBy: { completedAt: "desc" },
    });

    if (trip) {
      // G-M21-2: OR fallback — hardware/batch GPS positions have loadId but no tripId.
      // Branch 1: positions with tripId (trip-scoped endpoint).
      // Branch 2: positions with loadId but tripId=null (hardware/batch endpoints).
      // Mutually exclusive — no double-counting possible.
      const positions = await db.gpsPosition.findMany({
        where: {
          OR: [{ tripId: trip.id }, { loadId: load.id, tripId: null }],
        },
        select: { latitude: true, longitude: true },
        orderBy: { timestamp: "asc" },
      });

      if (positions.length > 0) {
        // Calculate Haversine sum and persist to Load
        gpsCalculatedKm = calculateTripDistance(
          positions.map((p) => ({
            ...p,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
          })) as GpsPosition[]
        );
        await db.load.update({
          where: { id: load.id },
          data: { actualTripKm: gpsCalculatedKm },
        });
      } else {
        // Zero GPS data — notify admin, corridor fallback will be used
        createNotificationForRole({
          role: "ADMIN",
          type: NotificationType.GPS_NO_DATA,
          title: "Trip completed with no GPS data",
          message: `Trip ${trip.id} for load ${load.pickupCity ?? "?"}→${load.deliveryCity ?? "?"} completed without GPS tracking data. Fees calculated using corridor distance ${corridor.distanceKm} km.`,
          metadata: {
            tripId: trip.id,
            loadId: load.id,
            corridorDistanceKm: Number(corridor.distanceKm),
          },
        }).catch(() => {});
      }
    }
  }

  // Calculate fees for both parties
  // Blueprint §8: billing distance = actualTripKm (GPS-recorded) if available,
  // else corridor.distanceKm (authoritative route baseline).
  // estimatedTripKm and tripKm are NOT used for billing.
  const resolvedActualKm =
    gpsCalculatedKm != null
      ? gpsCalculatedKm
      : load.actualTripKm != null
        ? Number(load.actualTripKm)
        : null;
  const distanceKm =
    resolvedActualKm != null && resolvedActualKm > 0
      ? resolvedActualKm
      : Number(corridor.distanceKm) > 0
        ? Number(corridor.distanceKm)
        : 0;

  const distanceSource =
    resolvedActualKm != null && resolvedActualKm > 0
      ? "actualTripKm (GPS)"
      : "corridor.distanceKm";

  if (distanceKm <= 0) {
    return {
      success: false,
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: new Decimal(0),
      error: `No billing distance: load ${loadId} has no GPS distance and corridor ${corridorId ?? "unknown"} has distanceKm=${corridor.distanceKm}. Service fee cannot be calculated.`,
    };
  }

  // Shipper fee calculation — org override → corridor.shipperPricePerKm → corridor.pricePerKm
  const shipperPricePerKm = load.shipper.shipperRatePerKm
    ? Number(load.shipper.shipperRatePerKm)
    : corridor.shipperPricePerKm
      ? Number(corridor.shipperPricePerKm)
      : Number(corridor.pricePerKm);
  const shipperPromoFlag =
    load.shipper.shipperPromoFlag ||
    corridor.shipperPromoFlag ||
    corridor.promoFlag ||
    false;
  const shipperPromoPct = load.shipper.shipperPromoPct
    ? Number(load.shipper.shipperPromoPct)
    : corridor.shipperPromoPct
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

  // Carrier fee calculation — org override → corridor.carrierPricePerKm → 0
  const carrierPricePerKm = load.assignedTruck?.carrier?.carrierRatePerKm
    ? Number(load.assignedTruck.carrier.carrierRatePerKm)
    : corridor.carrierPricePerKm
      ? Number(corridor.carrierPricePerKm)
      : 0;
  const carrierPromoFlag =
    load.assignedTruck?.carrier?.carrierPromoFlag ||
    corridor.carrierPromoFlag ||
    false;
  const carrierPromoPct = load.assignedTruck?.carrier?.carrierPromoPct
    ? Number(load.assignedTruck.carrier.carrierPromoPct)
    : corridor.carrierPromoPct
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
      select: {
        id: true,
        balance: true,
        organizationId: true,
        minimumBalance: true,
      },
    }),
    carrierId
      ? db.financialAccount.findFirst({
          where: {
            organizationId: carrierId,
            accountType: "CARRIER_WALLET",
            isActive: true,
          },
          select: {
            id: true,
            balance: true,
            organizationId: true,
            minimumBalance: true,
          },
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

  // A5: Warn when partial deduction occurs — surfaces in application logs for admin investigation
  const partialDeductionOccurred =
    (!shipperDeducted && shipperFeeCalc.finalFee > 0) ||
    (!carrierDeducted && carrierFeeCalc.finalFee > 0);

  if (!shipperDeducted && shipperFeeCalc.finalFee > 0) {
    console.warn(
      `[serviceFee] Partial deduction: shipper fee PENDING for load ${loadId}. Required: ${shipperFeeCalc.finalFee}`
    );
  }
  if (!carrierDeducted && carrierFeeCalc.finalFee > 0) {
    console.warn(
      `[serviceFee] Partial deduction: carrier fee PENDING for load ${loadId}. Required: ${carrierFeeCalc.finalFee}`
    );
  }

  // G-A15-4: Notify all admins when partial fee collection occurs (GPS actual > estimated
  // or insufficient wallet balance). Fire-and-forget — financial state is already written.
  if (partialDeductionOccurred) {
    // Corridor baseline is the reference distance (estimatedTripKm not in billing select)
    const estimatedKm = Number(corridor.distanceKm);
    const actualKm = distanceKm;
    const collected =
      (shipperDeducted ? shipperFeeCalc.finalFee : 0) +
      (carrierDeducted ? carrierFeeCalc.finalFee : 0);
    createNotificationForRole({
      role: "ADMIN",
      type: NotificationType.PARTIAL_FEE_COLLECTION,
      title: "Partial Service Fee Collection",
      message: `Load ${loadId}: actual ${actualKm}km vs corridor ${estimatedKm}km. Collected ${collected.toFixed(2)} / ${totalPlatformFee.toFixed(2)} ETB.`,
      metadata: {
        loadId,
        actualKm,
        estimatedKm,
        collected,
        expected: totalPlatformFee,
      },
    }).catch((err) => console.error("Admin partial-fee notify failed:", err));
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
    let result: string;
    try {
      result = await db.$transaction(async (tx) => {
        // Re-check fee status inside transaction to prevent double-deduction race condition
        const freshLoad = await tx.load.findUnique({
          where: { id: loadId },
          select: { shipperFeeStatus: true, carrierFeeStatus: true },
        });
        if (
          freshLoad?.shipperFeeStatus === "DEDUCTED" &&
          freshLoad?.carrierFeeStatus === "DEDUCTED"
        ) {
          throw new Error("FEES_ALREADY_DEDUCTED");
        }

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
            // Rate/KM snapshot (S9): immutable audit record of inputs used for billing
            shipperRatePerKmUsed: shipperPricePerKm,
            carrierRatePerKmUsed: carrierPricePerKm,
            totalKmUsed: distanceKm,
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
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "FEES_ALREADY_DEDUCTED") {
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
      throw error;
    }

    transactionId = result;

    // G-W-N4-5: Notify shipper and carrier that service fees were deducted
    if (totalDeducted > 0) {
      const feeNotifies: Promise<void>[] = [];
      if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
        feeNotifies.push(
          notifyOrganization({
            organizationId: load.shipperId,
            type: NotificationType.SERVICE_FEE_DEDUCTED,
            title: "Service Fee Deducted",
            message: `${shipperFeeCalc.finalFee.toFixed(2)} ETB service fee deducted upon trip completion.`,
            metadata: { loadId, amount: shipperFeeCalc.finalFee },
          })
        );
      }
      if (
        carrierDeducted &&
        carrierWallet &&
        carrierId &&
        carrierFeeCalc.finalFee > 0
      ) {
        feeNotifies.push(
          notifyOrganization({
            organizationId: carrierId,
            type: NotificationType.SERVICE_FEE_DEDUCTED,
            title: "Service Fee Deducted",
            message: `${carrierFeeCalc.finalFee.toFixed(2)} ETB service fee deducted upon trip completion.`,
            metadata: { loadId, amount: carrierFeeCalc.finalFee },
          })
        );
      }
      Promise.all(feeNotifies).catch((err) =>
        console.error("fee deducted notify err", err)
      );

      // G-W-N4-7: Post-deduction low-balance warning
      const balanceChecks: Promise<void>[] = [];
      if (shipperDeducted && shipperWallet && shipperFeeCalc.finalFee > 0) {
        const newShipperBalance = new Decimal(shipperWallet.balance).minus(
          shipperFeeCalc.finalFee
        );
        if (
          newShipperBalance.lessThan(
            new Decimal(shipperWallet.minimumBalance ?? 0)
          )
        ) {
          balanceChecks.push(
            notifyOrganization({
              organizationId: load.shipperId,
              type: NotificationType.LOW_BALANCE_WARNING,
              title: "Low Wallet Balance",
              message: `Your wallet balance has dropped below the minimum required for marketplace access. Please top up.`,
              metadata: {
                currentBalance: newShipperBalance.toNumber(),
                minimumBalance: Number(shipperWallet.minimumBalance),
              },
            })
          );
        }
      }
      if (
        carrierDeducted &&
        carrierWallet &&
        carrierId &&
        carrierFeeCalc.finalFee > 0
      ) {
        const newCarrierBalance = new Decimal(carrierWallet.balance).minus(
          carrierFeeCalc.finalFee
        );
        if (
          newCarrierBalance.lessThan(
            new Decimal(carrierWallet.minimumBalance ?? 0)
          )
        ) {
          balanceChecks.push(
            notifyOrganization({
              organizationId: carrierId,
              type: NotificationType.LOW_BALANCE_WARNING,
              title: "Low Wallet Balance",
              message: `Your wallet balance has dropped below the minimum required for marketplace access. Please top up.`,
              metadata: {
                currentBalance: newCarrierBalance.toNumber(),
                minimumBalance: Number(carrierWallet.minimumBalance),
              },
            })
          );
        }
      }
      Promise.all(balanceChecks).catch((err) =>
        console.error("post-deduct low-balance notify err", err)
      );
    }
  } else {
    // No fees to process - just update load with calculated fees
    // BUG-R9-1 FIX: Wrap in $transaction to prevent partial write race window
    await db.$transaction(async (tx) => {
      await tx.load.update({
        where: { id: loadId },
        data: {
          corridorId,
          shipperServiceFee: shipperFeeCalc.finalFee,
          shipperFeeStatus: shipperDeducted ? "DEDUCTED" : "PENDING",
          carrierServiceFee: carrierFeeCalc.finalFee,
          carrierFeeStatus: carrierDeducted ? "DEDUCTED" : "PENDING",
          // Rate/KM snapshot (S9): write even when fees not deducted (insufficient balance)
          shipperRatePerKmUsed: shipperPricePerKm,
          carrierRatePerKmUsed: carrierPricePerKm,
          totalKmUsed: distanceKm,
          serviceFeeEtb: totalPlatformFee,
          serviceFeeStatus:
            shipperDeducted && carrierDeducted ? "DEDUCTED" : "PENDING",
        },
      });
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
 * Refund service fees to both shipper and carrier when a load is cancelled.
 *
 * A3 Policy (2026-03-07): Both parties are refunded when a trip is cancelled
 * after fee deduction. Platform revenue returns to zero for failed trips.
 * Carrier is no longer doubly penalized (no freight payment + lost fee).
 *
 * Only refunds a party's fee if that party's feeStatus === 'DEDUCTED'.
 *
 * @param loadId - Load ID to refund service fees for
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
      carrierServiceFee: true,
      carrierFeeStatus: true,
      // Legacy
      serviceFeeEtb: true,
      serviceFeeStatus: true,
      shipper: {
        select: { name: true },
      },
      assignedTruck: {
        select: { carrierId: true },
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

  // Determine refund amounts — only refund DEDUCTED fees
  const shipperFeeToRefund =
    load.shipperFeeStatus === "DEDUCTED"
      ? load.shipperServiceFee
        ? new Decimal(load.shipperServiceFee)
        : load.serviceFeeEtb
          ? new Decimal(load.serviceFeeEtb) // legacy fallback
          : new Decimal(0)
      : new Decimal(0);

  const carrierFeeToRefund =
    load.carrierFeeStatus === "DEDUCTED" && load.carrierServiceFee
      ? new Decimal(load.carrierServiceFee)
      : new Decimal(0);

  const totalRefund = shipperFeeToRefund.plus(carrierFeeToRefund);

  if (totalRefund.isZero()) {
    // Mark both as refunded even if zero
    await db.load.update({
      where: { id: loadId },
      data: {
        shipperFeeStatus: "REFUNDED",
        carrierFeeStatus: "REFUNDED",
        serviceFeeStatus: "REFUNDED",
        serviceFeeRefundedAt: new Date(),
      },
    });

    return {
      success: true,
      serviceFee: new Decimal(0),
      shipperBalance: new Decimal(0),
      carrierFeeRefunded: 0,
      error: "No fee to refund",
    };
  }

  const carrierId = load.assignedTruck?.carrierId;

  // Get accounts
  const [platformAccount, shipperWallet, carrierWallet] = await Promise.all([
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
    carrierId && carrierFeeToRefund.greaterThan(0)
      ? db.financialAccount.findFirst({
          where: {
            organizationId: carrierId,
            accountType: "CARRIER_WALLET",
            isActive: true,
          },
          select: { id: true, balance: true },
        })
      : Promise.resolve(null),
  ]);

  if (!platformAccount || !shipperWallet) {
    return {
      success: false,
      serviceFee: shipperFeeToRefund,
      shipperBalance: new Decimal(0),
      error: "Required accounts not found",
    };
  }

  // All refund operations in a single transaction for atomicity
  const { journalEntryId, newShipperBalance } = await db.$transaction(
    async (tx) => {
      // Verify platform has sufficient balance for total refund
      const currentPlatformAccount = await tx.financialAccount.findUnique({
        where: { id: platformAccount.id },
        select: { balance: true },
      });
      if (
        !currentPlatformAccount ||
        new Decimal(currentPlatformAccount.balance).lessThan(totalRefund)
      ) {
        throw new Error("Insufficient platform balance for refund");
      }

      // Build journal lines
      const journalLines: Array<{
        amount: Decimal;
        isDebit: boolean;
        accountId: string;
      }> = [
        // Debit platform revenue for total refund amount
        { amount: totalRefund, isDebit: true, accountId: platformAccount.id },
        // Credit shipper wallet (if any shipper fee was deducted)
        ...(shipperFeeToRefund.greaterThan(0)
          ? [
              {
                amount: shipperFeeToRefund,
                isDebit: false,
                accountId: shipperWallet.id,
              },
            ]
          : []),
        // Credit carrier wallet (if any carrier fee was deducted and wallet found)
        ...(carrierFeeToRefund.greaterThan(0) && carrierWallet
          ? [
              {
                amount: carrierFeeToRefund,
                isDebit: false,
                accountId: carrierWallet.id,
              },
            ]
          : []),
      ];

      // 1. Create journal entry for refund
      const journalEntry = await tx.journalEntry.create({
        data: {
          transactionType: "SERVICE_FEE_REFUND",
          description: `Service fee refund for cancelled load ${loadId} - ${load.shipper.name} (shipper: ${shipperFeeToRefund.toFixed(2)}, carrier: ${carrierFeeToRefund.toFixed(2)})`,
          reference: loadId,
          loadId,
          metadata: {
            shipperFeeRefunded: shipperFeeToRefund.toFixed(2),
            carrierFeeRefunded: carrierFeeToRefund.toFixed(2),
            totalRefunded: totalRefund.toFixed(2),
            reason: "Load cancelled",
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

      // 2. Debit platform revenue (atomic with journal)
      await tx.financialAccount.update({
        where: { id: platformAccount.id },
        data: { balance: { decrement: totalRefund.toNumber() } },
      });

      // 3. Credit shipper wallet (atomic with journal)
      const updatedShipperWallet = await tx.financialAccount.update({
        where: { id: shipperWallet.id },
        data: { balance: { increment: shipperFeeToRefund.toNumber() } },
        select: { balance: true },
      });

      // 4. Credit carrier wallet if applicable (atomic with journal)
      if (carrierFeeToRefund.greaterThan(0) && carrierWallet) {
        await tx.financialAccount.update({
          where: { id: carrierWallet.id },
          data: { balance: { increment: carrierFeeToRefund.toNumber() } },
        });
      }

      // 5. Update load (atomic with journal)
      await tx.load.update({
        where: { id: loadId },
        data: {
          shipperFeeStatus: "REFUNDED",
          carrierFeeStatus: "REFUNDED",
          serviceFeeStatus: "REFUNDED",
          serviceFeeRefundedAt: new Date(),
          shipperFeeDeductedAt: null,
          carrierFeeDeductedAt: null,
          serviceFeeDeductedAt: null,
        },
      });

      return {
        journalEntryId: journalEntry.id,
        newShipperBalance: new Decimal(updatedShipperWallet.balance),
      };
    }
  );

  // G-W-N4-4: Notify shipper and carrier that service fees were refunded
  const refundNotifies: Promise<void>[] = [
    notifyOrganization({
      organizationId: load.shipperId,
      type: NotificationType.SERVICE_FEE_REFUNDED,
      title: "Service Fee Refunded",
      message: `${shipperFeeToRefund.toFixed(2)} ETB service fee has been refunded to your wallet.`,
      metadata: {
        loadId,
        shipperRefund: shipperFeeToRefund.toNumber(),
        carrierRefund: carrierFeeToRefund.toNumber(),
      },
    }),
    ...(carrierFeeToRefund.greaterThan(0) && carrierId
      ? [
          notifyOrganization({
            organizationId: carrierId,
            type: NotificationType.SERVICE_FEE_REFUNDED,
            title: "Service Fee Refunded",
            message: `${carrierFeeToRefund.toFixed(2)} ETB service fee has been refunded to your wallet.`,
            metadata: {
              loadId,
              shipperRefund: shipperFeeToRefund.toNumber(),
              carrierRefund: carrierFeeToRefund.toNumber(),
            },
          }),
        ]
      : []),
  ];
  Promise.all(refundNotifies).catch((err) =>
    console.error("fee refund notify err", err)
  );

  return {
    success: true,
    serviceFee: shipperFeeToRefund,
    shipperBalance: newShipperBalance,
    carrierFeeRefunded: carrierFeeToRefund.toNumber(),
    transactionId: journalEntryId,
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
