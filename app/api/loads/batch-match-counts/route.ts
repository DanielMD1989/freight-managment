export const dynamic = "force-dynamic";
/**
 * Batch Match Counts API
 *
 * Returns match counts for multiple loads in a single request.
 * Replaces N+1 individual fetches on the shipper loadboard.
 *
 * POST /api/loads/batch-match-counts
 * Body: { loadIds: string[] }
 * Response: { counts: Record<string, number> }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { z } from "zod";
import { findMatchingTrucks } from "@/lib/matchingEngine";
import { handleApiError } from "@/lib/apiErrors";

const batchSchema = z.object({
  loadIds: z.array(z.string()).min(1).max(100),
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

    const { loadIds } = parsed.data;

    // Fetch all requested loads (only POSTED ones need match counts)
    const loads = await db.load.findMany({
      where: {
        id: { in: loadIds },
        status: "POSTED",
        // Shipper can only see their own loads' counts
        ...(session.role === "SHIPPER"
          ? { shipperId: session.organizationId }
          : {}),
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
        pickupLocation: { select: { latitude: true, longitude: true } },
        deliveryLocation: { select: { latitude: true, longitude: true } },
      },
    });

    // Fetch all active truck postings — only APPROVED trucks (blueprint §4)
    const trucks = await db.truckPosting.findMany({
      where: { status: "ACTIVE", truck: { approvalStatus: "APPROVED" } },
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
      take: 500,
    });

    const trucksCriteria = trucks.map((t) => ({
      id: t.id,
      currentCity: t.originCity?.name || "",
      currentCityLat: t.originCity ? Number(t.originCity.latitude) : null,
      currentCityLon: t.originCity ? Number(t.originCity.longitude) : null,
      destinationCity: t.destinationCity?.name || null,
      destinationCityLat: t.destinationCity
        ? Number(t.destinationCity.latitude)
        : null,
      destinationCityLon: t.destinationCity
        ? Number(t.destinationCity.longitude)
        : null,
      truckType: t.truck?.truckType || "",
      maxWeight: t.availableWeight ? Number(t.availableWeight) : null,
      lengthM: t.availableLength ? Number(t.availableLength) : null,
      fullPartial: t.fullPartial,
      availableDate: t.availableFrom,
    }));

    // Calculate match count per load
    const counts: Record<string, number> = {};

    // Initialize all requested IDs with 0 (including non-POSTED)
    for (const id of loadIds) {
      counts[id] = 0;
    }

    for (const load of loads) {
      if (!load.pickupCity || !load.deliveryCity || !load.truckType) continue;

      const loadCriteria = {
        pickupCity: load.pickupCity,
        pickupCityLat: load.pickupLocation
          ? Number(load.pickupLocation.latitude)
          : null,
        pickupCityLon: load.pickupLocation
          ? Number(load.pickupLocation.longitude)
          : null,
        deliveryCity: load.deliveryCity,
        deliveryCityLat: load.deliveryLocation
          ? Number(load.deliveryLocation.latitude)
          : null,
        deliveryCityLon: load.deliveryLocation
          ? Number(load.deliveryLocation.longitude)
          : null,
        pickupDate: load.pickupDate,
        truckType: load.truckType,
        weight: load.weight ? Number(load.weight) : null,
        lengthM: load.lengthM ? Number(load.lengthM) : null,
        fullPartial: load.fullPartial,
      };

      const matches = findMatchingTrucks(loadCriteria, trucksCriteria, 50);
      counts[load.id] = matches.length;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    return handleApiError(error, "POST /api/loads/batch-match-counts");
  }
}
