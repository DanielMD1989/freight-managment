export const dynamic = "force-dynamic";
/**
 * Truck Posting Matching Loads API
 *
 * GET /api/truck-postings/[id]/matching-loads
 *
 * Finds matching loads for a truck posting using the matching engine.
 * Calculates DH-O (deadhead to origin) and DH-D (deadhead after delivery) using Haversine formula.
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth";
import { findMatchingLoads } from "@/lib/matchingEngine";
import { db } from "@/lib/db";
import { calculateDistanceKm } from "@/lib/geo";
import { handleApiError } from "@/lib/apiErrors";
import { createNotification, NotificationType } from "@/lib/notifications";

// Use centralized haversine from lib/geo.ts (rounds result for this use case)
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(calculateDistanceKm(lat1, lon1, lat2, lon2));
}

/**
 * GET /api/truck-postings/[id]/matching-loads
 *
 * Find loads that match this truck posting.
 *
 * Query parameters:
 * - minScore: Minimum match score (default: 40, range: 0-100)
 * - limit: Max results (default: 20, max: 100)
 *
 * Returns:
 * {
 *   matches: LoadMatch[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const session = await requireActiveUser();

    // A4: Block marketplace search if wallet below minimum threshold
    if (session.organizationId) {
      const walletAccount = await db.financialAccount.findFirst({
        where: { organizationId: session.organizationId, isActive: true },
        select: { balance: true, minimumBalance: true },
      });
      if (
        walletAccount &&
        walletAccount.balance < walletAccount.minimumBalance
      ) {
        // G-W-N4-6: Fire LOW_BALANCE_WARNING at most once per 24h per user
        const oneDayAgo = new Date(Date.now() - 86_400_000);
        db.notification
          .findFirst({
            where: {
              userId: session.userId,
              type: NotificationType.LOW_BALANCE_WARNING,
              createdAt: { gte: oneDayAgo },
            },
          })
          .then((existing) => {
            if (!existing) {
              createNotification({
                userId: session.userId,
                type: NotificationType.LOW_BALANCE_WARNING,
                title: "Insufficient Wallet Balance",
                message: `Your wallet balance is below the required minimum (${Number(walletAccount.minimumBalance).toLocaleString()} ETB). Top up to restore marketplace access.`,
                metadata: {
                  currentBalance: Number(walletAccount.balance),
                  minimumBalance: Number(walletAccount.minimumBalance),
                },
              }).catch((err) => console.error("low-balance notify err", err));
            }
          })
          .catch(() => {});
        return NextResponse.json(
          { error: "Insufficient wallet balance for marketplace access" },
          { status: 402 }
        );
      }
    }

    // Get truck posting with coordinates
    const truckPosting = await db.truckPosting.findUnique({
      where: { id },
      include: {
        carrier: true,
        originCity: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        destinationCity: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        truck: {
          select: {
            truckType: true,
            capacity: true,
            lengthM: true,
          },
        },
      },
    });

    // Fetch all Ethiopian cities with coordinates for lookup
    const ethiopianCities = await db.ethiopianLocation.findMany({
      where: { isActive: true },
      select: { name: true, latitude: true, longitude: true },
      take: 500,
    });

    // Helper to find city coordinates by name
    const getCityCoords = (
      cityName: string | null
    ): { lat: number; lon: number } | null => {
      if (!cityName) return null;
      const searchName = cityName.toLowerCase().trim();

      // Try exact match first
      let city = ethiopianCities.find(
        (c) => c.name.toLowerCase().trim() === searchName
      );

      // Fuzzy match for spelling variations
      if (!city) {
        city = ethiopianCities.find((c) => {
          const name = c.name.toLowerCase().trim();
          if (name.includes(searchName) || searchName.includes(name))
            return true;
          // Handle double letters (Mekelle/Mekele, Jimma/Jima)
          const simplify = (s: string) => s.replace(/(.)\1+/g, "$1");
          return simplify(name) === simplify(searchName);
        });
      }

      if (city?.latitude && city?.longitude) {
        return { lat: Number(city.latitude), lon: Number(city.longitude) };
      }
      return null;
    };

    if (!truckPosting) {
      return NextResponse.json(
        { error: "Truck posting not found" },
        { status: 404 }
      );
    }

    // Verify ownership - only the carrier who owns this truck posting can see matches
    // Per RULE_CARRIER_OWNS_TRUCKS: Carrier is sole owner of trucks
    // Dispatchers can also view matches to facilitate load matching
    const hasAccess =
      truckPosting.carrierId === session.organizationId ||
      session.role === "ADMIN" ||
      session.role === "SUPER_ADMIN" ||
      session.role === "DISPATCHER";

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Truck posting not found" },
        { status: 404 }
      );
    }

    // Only search for active postings
    if (truckPosting.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "Cannot find matches for inactive truck posting",
          matches: [],
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get("minScore") || "50", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );

    // G-A7-7: Include SEARCHING and OFFERED loads (Round A6 consistency).
    const loads = await db.load.findMany({
      where: {
        status: { in: ["POSTED", "SEARCHING", "OFFERED"] },
      },
      include: {
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
      take: 500, // Limit initial fetch
    });

    // Prepare truck criteria
    const truckCriteria = {
      id: truckPosting.id,
      currentCity: truckPosting.originCity?.name || "",
      currentCityLat: truckPosting.originCity
        ? Number(truckPosting.originCity.latitude)
        : null,
      currentCityLon: truckPosting.originCity
        ? Number(truckPosting.originCity.longitude)
        : null,
      destinationCity: truckPosting.destinationCity?.name || null,
      destinationCityLat: truckPosting.destinationCity
        ? Number(truckPosting.destinationCity.latitude)
        : null,
      destinationCityLon: truckPosting.destinationCity
        ? Number(truckPosting.destinationCity.longitude)
        : null,
      availableDate: truckPosting.availableFrom,
      truckType: truckPosting.truck?.truckType || "",
      maxWeight: truckPosting.availableWeight
        ? Number(truckPosting.availableWeight)
        : null,
      lengthM: truckPosting.availableLength
        ? Number(truckPosting.availableLength)
        : null,
      fullPartial: truckPosting.fullPartial,
    };

    // Prepare loads criteria (filter out loads with missing required fields)
    const loadsCriteria = loads
      .filter((load) => load.pickupCity && load.deliveryCity && load.truckType)
      .map((load) => {
        const pickupCoords = getCityCoords(load.pickupCity);
        const deliveryCoords = getCityCoords(load.deliveryCity);
        return {
          id: load.id,
          pickupCity: load.pickupCity!,
          pickupCityLat: pickupCoords?.lat ?? null,
          pickupCityLon: pickupCoords?.lon ?? null,
          deliveryCity: load.deliveryCity!,
          deliveryCityLat: deliveryCoords?.lat ?? null,
          deliveryCityLon: deliveryCoords?.lon ?? null,
          pickupDate: load.pickupDate,
          truckType: load.truckType,
          weight: load.weight ? Number(load.weight) : null,
          lengthM: load.lengthM ? Number(load.lengthM) : null,
          fullPartial: load.fullPartial,
          shipper: load.shipper,
          isAnonymous: load.isAnonymous,
          shipperContactName: load.shipperContactName,
          shipperContactPhone: load.shipperContactPhone,
          currency: load.currency,
          createdAt: load.createdAt,
          status: load.status,
        };
      });

    // Get truck coordinates
    const truckOriginCoords =
      truckPosting.originCity?.latitude && truckPosting.originCity?.longitude
        ? {
            lat: Number(truckPosting.originCity.latitude),
            lon: Number(truckPosting.originCity.longitude),
          }
        : null;
    const truckDestCoords =
      truckPosting.destinationCity?.latitude &&
      truckPosting.destinationCity?.longitude
        ? {
            lat: Number(truckPosting.destinationCity.latitude),
            lon: Number(truckPosting.destinationCity.longitude),
          }
        : null;

    // Get declared DH limits
    const declaredDhO = truckPosting.preferredDhToOriginKm
      ? Number(truckPosting.preferredDhToOriginKm)
      : null;
    const declaredDhD = truckPosting.preferredDhAfterDeliveryKm
      ? Number(truckPosting.preferredDhAfterDeliveryKm)
      : null;

    // Find matching loads and calculate distances
    // FIX: Remove any - type inferred from findMatchingLoads return type
    const matchedLoads = findMatchingLoads(
      truckCriteria,
      loadsCriteria,
      minScore
    )
      .slice(0, limit)
      .map((load) => {
        const fullLoad = loads.find((l) => l.id === load.id);

        // Get load pickup/delivery coordinates
        const pickupCoords = getCityCoords(load.pickupCity);
        const deliveryCoords = getCityCoords(load.deliveryCity);

        // Calculate DH-O: distance from truck origin to load pickup
        let dhToOriginKm = 0;
        if (truckOriginCoords && pickupCoords) {
          dhToOriginKm = haversineDistance(
            truckOriginCoords.lat,
            truckOriginCoords.lon,
            pickupCoords.lat,
            pickupCoords.lon
          );
        }

        // Calculate DH-D: distance from load delivery to truck destination
        let dhAfterDeliveryKm = 0;
        if (truckDestCoords && deliveryCoords) {
          dhAfterDeliveryKm = haversineDistance(
            deliveryCoords.lat,
            deliveryCoords.lon,
            truckDestCoords.lat,
            truckDestCoords.lon
          );
        }

        // Check if within declared limits
        const withinDhOLimit =
          declaredDhO === null || dhToOriginKm <= declaredDhO;
        const withinDhDLimit =
          declaredDhD === null || dhAfterDeliveryKm <= declaredDhD;
        const withinDhLimits = withinDhOLimit && withinDhDLimit;

        return {
          load: {
            ...load,
            ...fullLoad,
            // Calculated distances
            dhToOriginKm,
            dhAfterDeliveryKm,
            withinDhLimits,
          },
          matchScore: load.matchScore,
          matchReasons: load.matchReasons,
          isExactMatch: load.isExactMatch,
          // Also include at top level for easy access
          dhToOriginKm,
          dhAfterDeliveryKm,
          withinDhLimits,
        };
      });

    // Sort: loads within DH limits first, then by DH-O, then match score
    const sortedMatches = matchedLoads.sort((a, b) => {
      // Loads within limits first
      if (a.withinDhLimits !== b.withinDhLimits) {
        return a.withinDhLimits ? -1 : 1;
      }
      // Then by DH-O (lower is better)
      if (a.dhToOriginKm !== b.dhToOriginKm) {
        return a.dhToOriginKm - b.dhToOriginKm;
      }
      // Then by match score (higher is better)
      return b.matchScore - a.matchScore;
    });

    const matches = sortedMatches;

    // M6 FIX: Always mask shipper contact info in matching results
    // Contact info should only be revealed after load assignment, not during browsing
    const maskedMatches = matches.map((match) => {
      const { load } = match;

      if (load.isAnonymous) {
        return {
          ...match,
          load: {
            ...load,
            shipperContactName: null,
            shipperContactPhone: null,
            shipper: {
              id: load.shipper?.id,
              name: "Anonymous Shipper",
              isVerified: load.shipper?.isVerified,
            },
          },
        };
      }

      // Non-anonymous: still hide direct contact info (revealed only after assignment)
      return {
        ...match,
        load: {
          ...load,
          shipperContactName: null,
          shipperContactPhone: null,
          shipper: load.shipper
            ? {
                id: load.shipper.id,
                name: load.shipper.name,
                isVerified: load.shipper.isVerified,
                contactPhone: null,
                contactEmail: null,
              }
            : load.shipper,
        },
      };
    });

    return NextResponse.json({
      truckPostingId: id,
      totalMatches: maskedMatches.length,
      matches: maskedMatches,
    });
  } catch (error) {
    return handleApiError(error, "Error finding matching loads");
  }
}
