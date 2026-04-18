export const dynamic = "force-dynamic";
/**
 * Batch Matching Loads for Truck Postings
 *
 * Returns deduplicated matching loads across multiple truck postings in a
 * single request. Fetches loads from DB **once** and runs the matching
 * engine for each posting — replaces the N+1 pattern where the client
 * called GET /api/truck-postings/[id]/matching-loads per truck.
 *
 * POST /api/truck-postings/batch-matching-loads
 * Body: { postingIds: string[], limit?: number }
 * Response: { totalMatches: number, matches: LoadMatch[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { z } from "zod";
import { findMatchingLoads } from "@/lib/matchingEngine";
import { calculateDistanceKm } from "@/lib/geo";
import { handleApiError } from "@/lib/apiErrors";
import { checkWalletGate } from "@/lib/walletGate";

const batchSchema = z.object({
  postingIds: z.array(z.string()).min(1).max(100),
  limit: z.number().min(1).max(200).optional().default(100),
});

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(calculateDistanceKm(lat1, lon1, lat2, lon2));
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    // Wallet gate
    const gateError = await checkWalletGate({
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
    });
    if (gateError) return gateError;

    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { postingIds, limit } = parsed.data;

    // ── 1. Fetch all requested truck postings ────────────────────────
    const postings = await db.truckPosting.findMany({
      where: {
        id: { in: postingIds },
        status: "ACTIVE",
        ...(session.role === "CARRIER"
          ? { truck: { carrierId: session.organizationId } }
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

    if (postings.length === 0) {
      return NextResponse.json({ totalMatches: 0, matches: [] });
    }

    // ── 2. Fetch loads ONCE (shared across all postings) ────────────
    const loads = await db.load.findMany({
      where: {
        status: { in: ["POSTED", "SEARCHING", "OFFERED"] },
      },
      select: {
        id: true,
        status: true,
        pickupCity: true,
        deliveryCity: true,
        pickupDate: true,
        deliveryDate: true,
        truckType: true,
        weight: true,
        lengthM: true,
        fullPartial: true,
        cargoDescription: true,
        isAnonymous: true,
        shipperContactName: true,
        shipperContactPhone: true,
        currency: true,
        createdAt: true,
        postedAt: true,
        shipperId: true,
        shipper: {
          select: {
            id: true,
            name: true,
            isVerified: true,
            contactPhone: true,
            contactEmail: true,
          },
        },
      },
      take: 500,
    });

    // ── 3. Build city coordinate map ────────────────────────────────
    const ethiopianCities = await db.ethiopianLocation.findMany({
      where: { isActive: true },
      select: { name: true, latitude: true, longitude: true },
      take: 500,
    });

    const getCityCoords = (
      cityName: string | null
    ): { lat: number; lon: number } | null => {
      if (!cityName) return null;
      const searchName = cityName.toLowerCase().trim();
      let city = ethiopianCities.find(
        (c) => c.name.toLowerCase().trim() === searchName
      );
      if (!city) {
        city = ethiopianCities.find((c) => {
          const name = c.name.toLowerCase().trim();
          if (name.includes(searchName) || searchName.includes(name))
            return true;
          const simplify = (s: string) => s.replace(/(.)\1+/g, "$1");
          return simplify(name) === simplify(searchName);
        });
      }
      if (city?.latitude && city?.longitude) {
        return { lat: Number(city.latitude), lon: Number(city.longitude) };
      }
      return null;
    };

    // ── 4. Build load criteria (once) ───────────────────────────────
    const loadsCriteria = loads
      .filter((l) => l.pickupCity && l.deliveryCity && l.truckType)
      .map((l) => {
        const pickupCoords = getCityCoords(l.pickupCity);
        const deliveryCoords = getCityCoords(l.deliveryCity);
        return {
          id: l.id,
          pickupCity: l.pickupCity!,
          pickupCityLat: pickupCoords?.lat ?? null,
          pickupCityLon: pickupCoords?.lon ?? null,
          deliveryCity: l.deliveryCity!,
          deliveryCityLat: deliveryCoords?.lat ?? null,
          deliveryCityLon: deliveryCoords?.lon ?? null,
          pickupDate: l.pickupDate,
          truckType: l.truckType,
          weight: l.weight ? Number(l.weight) : null,
          lengthM: l.lengthM ? Number(l.lengthM) : null,
          fullPartial: l.fullPartial,
          shipper: l.shipper,
          isAnonymous: l.isAnonymous,
          shipperContactName: l.shipperContactName,
          shipperContactPhone: l.shipperContactPhone,
          currency: l.currency,
          createdAt: l.createdAt,
          status: l.status,
        };
      });

    // ── 5. Run matching for each posting, deduplicate by load ID ────
    const matchMap = new Map<
      string,
      {
        load: (typeof loads)[0];
        matchScore: number;
        matchReasons: string[];
        isExactMatch: boolean;
        dhOriginKm: number;
        dhToOriginKm: number;
        dhAfterDeliveryKm: number;
        withinDhLimits: boolean;
      }
    >();

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

      const truckOriginCoords =
        posting.originCity?.latitude && posting.originCity?.longitude
          ? {
              lat: Number(posting.originCity.latitude),
              lon: Number(posting.originCity.longitude),
            }
          : null;
      const truckDestCoords =
        posting.destinationCity?.latitude && posting.destinationCity?.longitude
          ? {
              lat: Number(posting.destinationCity.latitude),
              lon: Number(posting.destinationCity.longitude),
            }
          : null;

      const declaredDhO = posting.preferredDhToOriginKm
        ? Number(posting.preferredDhToOriginKm)
        : null;
      const declaredDhD = posting.preferredDhAfterDeliveryKm
        ? Number(posting.preferredDhAfterDeliveryKm)
        : null;

      const matched = findMatchingLoads(truckCriteria, loadsCriteria, 50);

      for (const m of matched) {
        // Deduplicate: keep the highest-scoring match per load
        const existing = matchMap.get(m.id);
        if (existing && existing.matchScore >= m.matchScore) continue;

        const fullLoad = loads.find((l) => l.id === m.id);
        if (!fullLoad) continue;

        const pickupCoords = getCityCoords(m.pickupCity);
        const deliveryCoords = getCityCoords(m.deliveryCity);

        let dhToOriginKm = 0;
        if (truckOriginCoords && pickupCoords) {
          dhToOriginKm = haversineDistance(
            truckOriginCoords.lat,
            truckOriginCoords.lon,
            pickupCoords.lat,
            pickupCoords.lon
          );
        }

        let dhAfterDeliveryKm = 0;
        if (truckDestCoords && deliveryCoords) {
          dhAfterDeliveryKm = haversineDistance(
            deliveryCoords.lat,
            deliveryCoords.lon,
            truckDestCoords.lat,
            truckDestCoords.lon
          );
        }

        const withinDhOLimit =
          declaredDhO === null || dhToOriginKm <= declaredDhO;
        const withinDhDLimit =
          declaredDhD === null || dhAfterDeliveryKm <= declaredDhD;

        matchMap.set(m.id, {
          load: fullLoad,
          matchScore: m.matchScore,
          matchReasons: m.matchReasons,
          isExactMatch: m.isExactMatch,
          dhOriginKm: m.dhOriginKm,
          dhToOriginKm,
          dhAfterDeliveryKm,
          withinDhLimits: withinDhOLimit && withinDhDLimit,
        });
      }
    }

    // ── 6. Sort and limit ───────────────────────────────────────────
    const allMatches = Array.from(matchMap.values())
      .sort((a, b) => {
        if (a.withinDhLimits !== b.withinDhLimits)
          return a.withinDhLimits ? -1 : 1;
        if (a.dhToOriginKm !== b.dhToOriginKm)
          return a.dhToOriginKm - b.dhToOriginKm;
        return b.matchScore - a.matchScore;
      })
      .slice(0, limit);

    // ── 7. Mask shipper contact info ────────────────────────────────
    const maskedMatches = allMatches.map((match) => {
      const { load } = match;
      const maskedShipper = load.isAnonymous
        ? {
            id: load.shipper?.id,
            name: "Anonymous Shipper",
            isVerified: load.shipper?.isVerified,
          }
        : load.shipper
          ? {
              id: load.shipper.id,
              name: load.shipper.name,
              isVerified: load.shipper.isVerified,
              contactPhone: null,
              contactEmail: null,
            }
          : load.shipper;

      return {
        load: {
          id: load.id,
          status: load.status,
          pickupCity: load.pickupCity,
          deliveryCity: load.deliveryCity,
          pickupDate: load.pickupDate,
          deliveryDate: load.deliveryDate,
          truckType: load.truckType,
          weight: load.weight,
          lengthM: load.lengthM,
          fullPartial: load.fullPartial,
          cargoDescription: load.cargoDescription,
          currency: load.currency,
          createdAt: load.createdAt,
          postedAt: load.postedAt,
          isAnonymous: load.isAnonymous,
          shipperContactName: null,
          shipperContactPhone: null,
          shipper: maskedShipper,
          dhToOriginKm: match.dhToOriginKm,
          dhAfterDeliveryKm: match.dhAfterDeliveryKm,
          withinDhLimits: match.withinDhLimits,
        },
        matchScore: match.matchScore,
        matchReasons: match.matchReasons,
        isExactMatch: match.isExactMatch,
        dhToOriginKm: match.dhToOriginKm,
        dhAfterDeliveryKm: match.dhAfterDeliveryKm,
        withinDhLimits: match.withinDhLimits,
      };
    });

    return NextResponse.json({
      totalMatches: maskedMatches.length,
      matches: maskedMatches,
    });
  } catch (error) {
    return handleApiError(
      error,
      "POST /api/truck-postings/batch-matching-loads"
    );
  }
}
