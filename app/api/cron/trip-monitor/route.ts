export const dynamic = "force-dynamic";
/**
 * Trip Monitoring Cron Job
 *
 * G-M21-7: Auto-close DELIVERED trips after 48 hours without POD or shipper confirmation.
 * Blueprint v1.5 — Delivery Completion Path 3.
 *
 * Recommended schedule: every 1 hour (configure in deployment environment)
 *
 * POST /api/cron/trip-monitor
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { deductServiceFee } from "@/lib/serviceFeeManagement";
import {
  createNotificationForRole,
  notifyOrganization,
  NotificationType,
} from "@/lib/notifications";

const DELIVERED_TIMEOUT_HOURS = 48;

/**
 * POST /api/cron/trip-monitor
 *
 * Security: Protected by CRON_SECRET — required in all environments
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (REQUIRED - not optional)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Trip Monitor] CRON_SECRET environment variable not set");
      return NextResponse.json(
        { error: "Server misconfigured - CRON_SECRET required" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[Trip Monitor] Starting trip monitoring...");

    // Step 1: Find DELIVERED trips older than 48h without POD or shipper confirmation
    let autoClosedCount = 0;
    let feeCollectedCount = 0;
    let feePendingCount = 0;
    let errorCount = 0;

    try {
      const cutoff = new Date(
        Date.now() - DELIVERED_TIMEOUT_HOURS * 60 * 60 * 1000
      );

      const stuckTrips = await db.trip.findMany({
        where: {
          status: "DELIVERED",
          shipperConfirmed: false,
          deliveredAt: { lte: cutoff },
          load: { podSubmitted: false },
        },
        select: {
          id: true,
          deliveredAt: true,
          loadId: true,
          truckId: true,
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
              shipperId: true,
            },
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrierId: true,
            },
          },
        },
        take: 20,
      });

      logger.info("[Trip Monitor] Found stuck DELIVERED trips", {
        count: stuckTrips.length,
      });

      // Step 2: Process each stuck trip
      for (const trip of stuckTrips) {
        try {
          // a) Attempt fee deduction
          let feeSucceeded = false;
          try {
            const feeResult = await deductServiceFee(trip.loadId!);
            feeSucceeded =
              feeResult.success ||
              feeResult.error === "Service fees already deducted";
          } catch {
            // Fee deduction failed — trip still closes
            feeSucceeded = false;
          }

          // b) ALWAYS close the trip regardless of fee result
          await db.$transaction(async (tx) => {
            await tx.trip.update({
              where: { id: trip.id, status: "DELIVERED" },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                trackingEnabled: false,
                autoClosedAt: new Date(),
              },
            });

            // G-M29-D1: Set settlement + podVerified when fee collected — matches Paths 1-3.
            // Stays PENDING if fee failed — admin resolves.
            await tx.load.update({
              where: { id: trip.loadId! },
              data: {
                status: "COMPLETED",
                ...(feeSucceeded && {
                  settlementStatus: "PAID",
                  settledAt: new Date(),
                  podVerified: true,
                  podVerifiedAt: new Date(),
                }),
              },
            });

            // G-M22-1: Only restore truck if no other active trips on it
            if (trip.truckId) {
              const otherActiveTrips = await tx.trip.count({
                where: {
                  truckId: trip.truckId,
                  id: { not: trip.id },
                  status: {
                    in: [
                      "ASSIGNED",
                      "PICKUP_PENDING",
                      "IN_TRANSIT",
                      "DELIVERED",
                      "EXCEPTION",
                    ],
                  },
                },
              });
              if (otherActiveTrips === 0) {
                await tx.truck.update({
                  where: { id: trip.truckId },
                  data: { isAvailable: true },
                });
              }
              // G-M29-E1: Always revert MATCHED postings regardless of other active trips —
              // matches Paths 1-3 (route.ts:514-517, confirm/route.ts:250-253, pod/route.ts:540-543).
              await tx.truckPosting.updateMany({
                where: { truckId: trip.truckId, status: "MATCHED" },
                data: { status: "ACTIVE", updatedAt: new Date() },
              });
            }

            // CORRECTION 4: Audit trail loadEvent
            await tx.loadEvent.create({
              data: {
                loadId: trip.loadId!,
                eventType: "DELIVERY_CONFIRMED",
                description: `Trip auto-closed after ${DELIVERED_TIMEOUT_HOURS}h without POD or shipper confirmation`,
                userId: "SYSTEM",
                metadata: {
                  tripId: trip.id,
                  autoClosedAt: new Date().toISOString(),
                  feeCollected: feeSucceeded,
                },
              },
            });
          });

          autoClosedCount++;
          if (feeSucceeded) {
            feeCollectedCount++;
          } else {
            feePendingCount++;
          }

          // c) Notify three parties (all fire-and-forget)
          createNotificationForRole({
            role: "ADMIN",
            type: feeSucceeded
              ? NotificationType.DELIVERY_CONFIRMED
              : NotificationType.SERVICE_FEE_FAILED,
            title: feeSucceeded
              ? "Trip auto-closed successfully"
              : "Auto-closed trip — fee pending",
            message: `Trip ${trip.id} for ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} was auto-closed after ${DELIVERED_TIMEOUT_HOURS}h without POD or shipper confirmation. Fee: ${feeSucceeded ? "collected" : "PENDING — requires manual settlement"}.`,
            metadata: {
              tripId: trip.id,
              loadId: trip.loadId,
              feeCollected: feeSucceeded,
            },
          }).catch(() => {});

          if (trip.truck?.carrierId) {
            notifyOrganization({
              organizationId: trip.truck.carrierId,
              type: NotificationType.DELIVERY_CONFIRMED,
              title: "Trip closed — upload POD for records",
              message: `Your trip for ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} was automatically completed after ${DELIVERED_TIMEOUT_HOURS} hours. Please upload POD for your records.`,
              metadata: { tripId: trip.id, loadId: trip.loadId },
            }).catch(() => {});
          }

          if (trip.load?.shipperId) {
            notifyOrganization({
              organizationId: trip.load.shipperId,
              type: NotificationType.DELIVERY_CONFIRMED,
              title: "Delivery automatically confirmed",
              message: `Your delivery for ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} has been automatically completed after ${DELIVERED_TIMEOUT_HOURS} hours. Contact Admin if you have concerns.`,
              metadata: { tripId: trip.id, loadId: trip.loadId },
            }).catch(() => {});
          }

          // §7: Notify all dispatchers (blueprint says Admin + Dispatcher + Carrier + Shipper)
          createNotificationForRole({
            role: "DISPATCHER",
            type: NotificationType.DELIVERY_CONFIRMED,
            title: "Trip auto-closed after 48h",
            message: `Trip ${trip.id} for ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} was auto-closed. Fee: ${feeSucceeded ? "collected" : "pending"}.`,
            metadata: { tripId: trip.id, loadId: trip.loadId },
          }).catch(() => {});
        } catch (err) {
          // CORRECTION 3: P2025 = trip already resolved by another actor — skip silently
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025"
          ) {
            continue;
          }
          logger.error("[Trip Monitor] Auto-close error:", {
            tripId: trip.id,
            error: err,
          });
          errorCount++;
        }
      }
    } catch (err) {
      logger.error("[Trip Monitor] Trip monitoring error:", { error: err });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: autoClosedCount + errorCount,
      autoClosedTrips: autoClosedCount,
      feeCollected: feeCollectedCount,
      feePending: feePendingCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("[Trip Monitor] Error:", error);
    return NextResponse.json(
      {
        error: "Trip monitoring failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
