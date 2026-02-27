/**
 * Road Distance Calculation API
 *
 * MAP + GPS Implementation - Story 5.2
 *
 * POST /api/routes/distance - Calculate road distance between two points
 *
 * Uses Google Routes API with fallback to Haversine calculation.
 * Results are cached to reduce API calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  calculateRoadDistance,
  calculateDeadheadOrigin,
  calculateDeadheadDestination,
  batchCalculateDistances,
  Coordinates,
} from "@/lib/googleRoutes";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const singleDistanceSchema = z.object({
  origin: coordinatesSchema,
  destination: coordinatesSchema,
  type: z.enum(["road", "dh-o", "dh-d"]).optional().default("road"),
});

const batchDistanceSchema = z.object({
  pairs: z
    .array(
      z.object({
        origin: coordinatesSchema,
        destination: coordinatesSchema,
      })
    )
    .min(1)
    .max(25), // Max 25 pairs per batch
});

/**
 * POST /api/routes/distance
 *
 * Calculate road distance between two points or batch calculate multiple pairs.
 *
 * Single calculation body:
 * {
 *   "origin": { "lat": 9.0, "lng": 38.7 },
 *   "destination": { "lat": 9.6, "lng": 41.8 },
 *   "type": "road" | "dh-o" | "dh-d"
 * }
 *
 * Batch calculation body:
 * {
 *   "pairs": [
 *     { "origin": {...}, "destination": {...} },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();

    // Check if this is a batch request
    if (body.pairs && Array.isArray(body.pairs)) {
      const data = batchDistanceSchema.parse(body);
      const results = await batchCalculateDistances(data.pairs);

      return NextResponse.json({
        results: results.map((r, i) => ({
          origin: data.pairs[i].origin,
          destination: data.pairs[i].destination,
          distanceKm: r.distanceKm,
          distanceMeters: r.distanceMeters,
          durationMinutes: r.durationMinutes,
          estimatedArrival: r.estimatedArrival,
          source: r.source,
        })),
      });
    }

    // Single calculation
    const data = singleDistanceSchema.parse(body);

    let result;
    switch (data.type) {
      case "dh-o":
        result = await calculateDeadheadOrigin(data.origin, data.destination);
        break;
      case "dh-d":
        result = await calculateDeadheadDestination(
          data.origin,
          data.destination
        );
        break;
      default:
        result = await calculateRoadDistance(data.origin, data.destination);
    }

    return NextResponse.json({
      origin: data.origin,
      destination: data.destination,
      distanceKm: result.distanceKm,
      distanceMeters: result.distanceMeters,
      durationMinutes: result.durationMinutes,
      durationSeconds: result.durationSeconds,
      estimatedArrival: result.estimatedArrival,
      source: result.source,
    });
  } catch (error) {
    console.error("Road distance calculation error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/routes/distance
 *
 * Quick distance calculation via query params (single pair only)
 *
 * Query params:
 * - originLat, originLng: Origin coordinates
 * - destLat, destLng: Destination coordinates
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = request.nextUrl;

    const originLat = parseFloat(searchParams.get("originLat") || "");
    const originLng = parseFloat(searchParams.get("originLng") || "");
    const destLat = parseFloat(searchParams.get("destLat") || "");
    const destLng = parseFloat(searchParams.get("destLng") || "");

    if (
      isNaN(originLat) ||
      isNaN(originLng) ||
      isNaN(destLat) ||
      isNaN(destLng)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid coordinates" },
        { status: 400 }
      );
    }

    const origin: Coordinates = { lat: originLat, lng: originLng };
    const destination: Coordinates = { lat: destLat, lng: destLng };

    const result = await calculateRoadDistance(origin, destination);

    return NextResponse.json({
      origin,
      destination,
      distanceKm: result.distanceKm,
      distanceMeters: result.distanceMeters,
      durationMinutes: result.durationMinutes,
      estimatedArrival: result.estimatedArrival,
      source: result.source,
    });
  } catch (error) {
    console.error("Road distance calculation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
