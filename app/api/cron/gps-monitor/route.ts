export const dynamic = "force-dynamic";
/**
 * GPS Monitoring Cron Job
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 * Task: Background GPS monitoring cron job
 *
 * Should be called every 30 seconds by external cron service
 *
 * POST /api/cron/gps-monitor
 */

import { NextRequest, NextResponse } from "next/server";
import { pollAllGpsDevices, checkForOfflineTrucks } from "@/lib/gpsMonitoring";
import { triggerGpsOfflineAlerts } from "@/lib/gpsAlerts";
import { checkAllGeofenceEvents } from "@/lib/geofenceNotifications";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import {
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";

/**
 * GPS monitoring cron endpoint
 *
 * Security: Protected by CRON_SECRET - required in all environments
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (REQUIRED - not optional)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // SECURITY: Always require CRON_SECRET - never allow unauthenticated access
    if (!cronSecret) {
      console.error("[GPS Monitor] CRON_SECRET environment variable not set");
      return NextResponse.json(
        { error: "Server misconfigured - CRON_SECRET required" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[GPS Monitor] Starting GPS device polling...");

    // Poll all GPS devices
    const pollingSummary = await pollAllGpsDevices();

    logger.debug("[GPS Monitor] Polling complete", { pollingSummary });

    // Check for newly offline trucks
    const offlineTruckIds = await checkForOfflineTrucks();

    logger.info("[GPS Monitor] Checked for offline trucks", {
      offlineCount: offlineTruckIds.length,
    });

    // Trigger alerts for offline trucks
    if (offlineTruckIds.length > 0) {
      await triggerGpsOfflineAlerts(offlineTruckIds);
      logger.info("[GPS Monitor] Offline alerts triggered", {
        count: offlineTruckIds.length,
      });
    }

    // Check for geofence events (arrivals at pickup/delivery)
    logger.debug("[GPS Monitor] Checking geofence events...");
    const geofenceNotifications = await checkAllGeofenceEvents();
    logger.info("[GPS Monitor] Geofence check complete", {
      geofenceNotifications,
    });

    // §11 GPS Tracking Policy: Alert admin about active postings without GPS device.
    // Deduplicated: max 1 notification per posting per 24h.
    let gpsPostingAlerts = 0;
    try {
      const postingsWithoutGps = await db.truckPosting.findMany({
        where: {
          status: "ACTIVE",
          truck: {
            OR: [
              { gpsDeviceId: null },
              { gpsDevice: { status: { not: "ACTIVE" } } },
            ],
          },
        },
        select: {
          id: true,
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrierId: true,
            },
          },
        },
      });

      const oneDayAgo = new Date(Date.now() - 86_400_000);
      for (const posting of postingsWithoutGps) {
        // Deduplicate: check if alert already sent in last 24h for this posting
        const existing = await db.notification.findFirst({
          where: {
            type: NotificationType.GPS_NO_DATA,
            metadata: { path: ["truckPostingId"], equals: posting.id },
            createdAt: { gte: oneDayAgo },
          },
        });
        if (!existing) {
          await createNotificationForRole({
            role: "ADMIN",
            type: NotificationType.GPS_NO_DATA,
            title: "Active posting without GPS device",
            message: `Truck ${posting.truck?.licensePlate ?? "unknown"} has an active marketplace posting but no GPS device registered. Tracking will not be available for loads accepted by this truck.`,
            metadata: {
              truckPostingId: posting.id,
              truckId: posting.truck?.id,
              licensePlate: posting.truck?.licensePlate,
            },
          });
          gpsPostingAlerts++;
        }
      }
    } catch (err) {
      logger.error("[GPS Monitor] GPS posting alert error:", { error: err });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      polling: pollingSummary,
      offlineAlerts: offlineTruckIds.length,
      geofenceNotifications,
      gpsPostingAlerts,
    });
  } catch (error) {
    console.error("[GPS Monitor] Error:", error);

    return NextResponse.json(
      {
        error: "GPS monitoring failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing (development only)
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Same logic as POST for testing
  return POST(request);
}
