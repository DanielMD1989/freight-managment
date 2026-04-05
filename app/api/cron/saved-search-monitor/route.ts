export const dynamic = "force-dynamic";
/**
 * Saved Search Monitor Cron — Load Alerts
 *
 * Runs periodically to check if new POSTED loads match any carrier's
 * saved searches with alertsEnabled=true. Sends push notification.
 *
 * POST /api/cron/saved-search-monitor
 * Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification, NotificationType } from "@/lib/notifications";

const LOOKBACK_MINUTES = 15; // Check loads posted in the last 15 minutes

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    // Find new POSTED loads since last check
    const newLoads = await db.load.findMany({
      where: {
        status: "POSTED",
        postedAt: { gte: cutoff },
      },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        truckType: true,
        weight: true,
      },
      take: 50,
    });

    if (newLoads.length === 0) {
      return NextResponse.json({
        message: "No new loads to match",
        checked: 0,
        alerted: 0,
      });
    }

    // Find saved searches with alerts enabled (type=LOADS for carriers)
    const savedSearches = await db.savedSearch.findMany({
      where: {
        alertsEnabled: true,
        type: "LOADS",
      },
      include: {
        user: {
          select: { id: true, organizationId: true },
        },
      },
    });

    let alertsSent = 0;

    for (const search of savedSearches) {
      // Parse criteria (flexible JSON)
      const criteria = search.criteria as Record<string, unknown>;
      const pickupCity = criteria.pickupCity as string | undefined;
      const truckType = criteria.truckType as string | undefined;
      const maxWeight = criteria.maxWeight as number | undefined;

      // Find matching loads
      const matches = newLoads.filter((load) => {
        if (pickupCity && load.pickupCity !== pickupCity) return false;
        if (truckType && load.truckType !== truckType) return false;
        if (maxWeight && load.weight && Number(load.weight) > maxWeight)
          return false;
        return true;
      });

      if (matches.length > 0 && search.user.id) {
        // Don't alert if we already alerted recently (within lookback window)
        if (search.lastAlertedAt && search.lastAlertedAt > cutoff) {
          continue;
        }

        // Send notification
        await createNotification({
          userId: search.user.id,
          type: NotificationType.SAVED_SEARCH_MATCH,
          title: `${matches.length} new load${matches.length > 1 ? "s" : ""} match "${search.name}"`,
          message: `${matches[0].pickupCity} → ${matches[0].deliveryCity} (${matches[0].truckType})${matches.length > 1 ? ` and ${matches.length - 1} more` : ""}`,
          metadata: {
            savedSearchId: search.id,
            matchCount: matches.length,
            firstLoadId: matches[0].id,
          },
        }).catch((err) => console.warn("Notification failed:", err?.message));

        // Update lastAlertedAt
        await db.savedSearch.update({
          where: { id: search.id },
          data: { lastAlertedAt: new Date() },
        });

        alertsSent++;
      }
    }

    return NextResponse.json({
      message: "Saved search monitor complete",
      newLoads: newLoads.length,
      searchesChecked: savedSearches.length,
      alertsSent,
    });
  } catch (error) {
    console.error("Saved search monitor error:", error);
    return NextResponse.json({ error: "Monitor failed" }, { status: 500 });
  }
}
