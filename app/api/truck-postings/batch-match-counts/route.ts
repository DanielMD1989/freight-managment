export const dynamic = "force-dynamic";
/**
 * Batch Match Counts for Truck Postings
 *
 * Returns match counts for multiple truck postings in a single request.
 * Replaces N+1 individual fetches on the carrier loadboard.
 *
 * POST /api/truck-postings/batch-match-counts
 * Body: { postingIds: string[] }
 * Response: { counts: Record<string, number> }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { z } from "zod";
import { findMatchingLoads } from "@/lib/matchingEngine";
import { handleApiError } from "@/lib/apiErrors";

const batchSchema = z.object({
  postingIds: z.array(z.string()).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { postingIds } = parsed.data;

    // Fetch all requested truck postings
    const postings = await db.truckPosting.findMany({
      where: {
        id: { in: postingIds },
        status: "ACTIVE",
        // Carrier can only see their own postings' counts
        ...(session.role === "CARRIER"
          ? {
              truck: { carrierId: session.organizationId },
            }
          : {}),
      },
      include: {
        originCity: {
          select: { name: true, latitude: true, longitude: true },
        },
        destinationCity: {
          select: { name: true, latitude: true, longitude: true },
        },
        truck: {
          select: { truckType: true, capacity: true, lengthM: true },
        },
      },
    });

    // Fetch all available loads once (shared across all postings)
    const loads = await db.load.findMany({
      where: {
        status: { in: ["POSTED", "SEARCHING", "OFFERED"] },
      },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        pickupDate: true,
        truckType: true,
        weight: true,
        lengthM: true,
        fullPartial: true,
        pickupCityId: true,
        deliveryCityId: true,
      },
      take: 500,
    });

    // Get city coordinates for loads
    const cityIds = new Set<string>();
    for (const load of loads) {
      if (load.pickupCityId) cityIds.add(load.pickupCityId);
      if (load.deliveryCityId) cityIds.add(load.deliveryCityId);
    }
    const cities = await db.ethiopianLocation.findMany({
      where: { id: { in: Array.from(cityIds) } },
      select: { id: true, name: true, latitude: true, longitude: true },
    });
    const cityMap = new Map(cities.map((c) => [c.id, c]));

    const loadsCriteria = loads
      .filter((l) => l.pickupCity && l.deliveryCity && l.truckType)
      .map((l) => {
        const pickup = l.pickupCityId ? cityMap.get(l.pickupCityId) : null;
        const delivery = l.deliveryCityId
          ? cityMap.get(l.deliveryCityId)
          : null;
        return {
          id: l.id,
          pickupCity: l.pickupCity!,
          pickupCityLat: pickup ? Number(pickup.latitude) : null,
          pickupCityLon: pickup ? Number(pickup.longitude) : null,
          deliveryCity: l.deliveryCity!,
          deliveryCityLat: delivery ? Number(delivery.latitude) : null,
          deliveryCityLon: delivery ? Number(delivery.longitude) : null,
          pickupDate: l.pickupDate,
          truckType: l.truckType,
          weight: l.weight ? Number(l.weight) : null,
          lengthM: l.lengthM ? Number(l.lengthM) : null,
          fullPartial: l.fullPartial,
        };
      });

    // Calculate match count per posting
    const counts: Record<string, number> = {};

    for (const id of postingIds) {
      counts[id] = 0;
    }

    for (const posting of postings) {
      const truckCriteria = {
        id: posting.id,
        currentCity: posting.originCity?.name || "",
        currentCityLat: posting.originCity
          ? Number(posting.originCity.latitude)
          : null,
        currentCityLon: posting.originCity
          ? Number(posting.originCity.longitude)
          : null,
        destinationCity: posting.destinationCity?.name || null,
        destinationCityLat: posting.destinationCity
          ? Number(posting.destinationCity.latitude)
          : null,
        destinationCityLon: posting.destinationCity
          ? Number(posting.destinationCity.longitude)
          : null,
        truckType: posting.truck?.truckType || "",
        maxWeight: posting.availableWeight
          ? Number(posting.availableWeight)
          : null,
        lengthM: posting.availableLength
          ? Number(posting.availableLength)
          : null,
        fullPartial: posting.fullPartial,
        availableDate: posting.availableFrom,
      };

      const matches = findMatchingLoads(truckCriteria, loadsCriteria, 50);
      counts[posting.id] = matches.length;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    return handleApiError(error, "POST /api/truck-postings/batch-match-counts");
  }
}
