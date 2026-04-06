export const dynamic = "force-dynamic";
/**
 * Saved Search Monitor Cron — Load + Truck Alerts
 *
 * Runs periodically to check if new POSTED loads or new ACTIVE truck
 * postings match any saved search with alertsEnabled=true. Sends a
 * SAVED_SEARCH_MATCH notification to the search owner.
 *
 * Two parallel paths:
 *   - type=LOADS searches (typically carriers) match new POSTED loads
 *   - type=TRUCKS searches (typically shippers) match new ACTIVE truck postings
 *
 * Throttling: Skip if the search was already alerted within the lookback
 * window (prevents duplicate notifications when the cron runs every few
 * minutes).
 *
 * POST /api/cron/saved-search-monitor
 * Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification, NotificationType } from "@/lib/notifications";

const LOOKBACK_MINUTES = 15;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    // ─── Path 1: New POSTED loads → carrier load alerts ───────────────────
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
      take: 100,
    });

    const loadSearches = await db.savedSearch.findMany({
      where: { alertsEnabled: true, type: "LOADS" },
      include: { user: { select: { id: true, organizationId: true } } },
    });

    let loadAlertsSent = 0;
    if (newLoads.length > 0) {
      for (const search of loadSearches) {
        if (search.lastAlertedAt && search.lastAlertedAt > cutoff) continue;

        const criteria = search.criteria as Record<string, unknown>;
        const pickupCity = criteria.pickupCity as string | undefined;
        const deliveryCity = criteria.deliveryCity as string | undefined;
        const truckType = criteria.truckType as string | undefined;
        const maxWeight = criteria.maxWeight as number | undefined;

        const matches = newLoads.filter((load) => {
          if (pickupCity && load.pickupCity !== pickupCity) return false;
          if (deliveryCity && load.deliveryCity !== deliveryCity) return false;
          if (truckType && load.truckType !== truckType) return false;
          if (maxWeight && load.weight && Number(load.weight) > maxWeight)
            return false;
          return true;
        });

        if (matches.length === 0 || !search.user.id) continue;

        await createNotification({
          userId: search.user.id,
          type: NotificationType.SAVED_SEARCH_MATCH,
          title: `${matches.length} new load${matches.length > 1 ? "s" : ""} match "${search.name}"`,
          message: `${matches[0].pickupCity} → ${matches[0].deliveryCity} (${matches[0].truckType})${matches.length > 1 ? ` and ${matches.length - 1} more` : ""}`,
          metadata: {
            savedSearchId: search.id,
            searchType: "LOADS",
            matchCount: matches.length,
            firstLoadId: matches[0].id,
          },
        }).catch((err) =>
          console.warn("Load alert notification failed:", err?.message)
        );

        await db.savedSearch.update({
          where: { id: search.id },
          data: { lastAlertedAt: new Date() },
        });
        loadAlertsSent++;
      }
    }

    // ─── Path 2: New ACTIVE truck postings → shipper truck alerts ─────────
    const newTruckPostings = await db.truckPosting.findMany({
      where: {
        status: "ACTIVE",
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        truck: {
          select: {
            id: true,
            truckType: true,
            capacity: true,
          },
        },
        originCity: { select: { name: true } },
        destinationCity: { select: { name: true } },
      },
      take: 100,
    });

    const truckSearches = await db.savedSearch.findMany({
      where: { alertsEnabled: true, type: "TRUCKS" },
      include: { user: { select: { id: true, organizationId: true } } },
    });

    let truckAlertsSent = 0;
    if (newTruckPostings.length > 0) {
      for (const search of truckSearches) {
        if (search.lastAlertedAt && search.lastAlertedAt > cutoff) continue;

        const criteria = search.criteria as Record<string, unknown>;
        const originCity = criteria.originCity as string | undefined;
        const destinationCity = criteria.destinationCity as string | undefined;
        const truckType = criteria.truckType as string | undefined;
        const minCapacity = criteria.minCapacity as number | undefined;

        const matches = newTruckPostings.filter((posting) => {
          if (originCity && posting.originCity?.name !== originCity)
            return false;
          if (
            destinationCity &&
            posting.destinationCity?.name !== destinationCity
          )
            return false;
          if (truckType && posting.truck.truckType !== truckType) return false;
          if (
            minCapacity &&
            posting.truck.capacity &&
            Number(posting.truck.capacity) < minCapacity
          )
            return false;
          return true;
        });

        if (matches.length === 0 || !search.user.id) continue;

        const first = matches[0];
        const route = `${first.originCity?.name || "any"} → ${first.destinationCity?.name || "any"}`;
        await createNotification({
          userId: search.user.id,
          type: NotificationType.SAVED_SEARCH_MATCH,
          title: `${matches.length} new truck${matches.length > 1 ? "s" : ""} match "${search.name}"`,
          message: `${route} (${first.truck.truckType})${matches.length > 1 ? ` and ${matches.length - 1} more` : ""}`,
          metadata: {
            savedSearchId: search.id,
            searchType: "TRUCKS",
            matchCount: matches.length,
            firstPostingId: first.id,
          },
        }).catch((err) =>
          console.warn("Truck alert notification failed:", err?.message)
        );

        await db.savedSearch.update({
          where: { id: search.id },
          data: { lastAlertedAt: new Date() },
        });
        truckAlertsSent++;
      }
    }

    return NextResponse.json({
      message: "Saved search monitor complete",
      newLoads: newLoads.length,
      loadSearchesChecked: loadSearches.length,
      loadAlertsSent,
      newTruckPostings: newTruckPostings.length,
      truckSearchesChecked: truckSearches.length,
      truckAlertsSent,
    });
  } catch (error) {
    console.error("Saved search monitor error:", error);
    return NextResponse.json({ error: "Monitor failed" }, { status: 500 });
  }
}
