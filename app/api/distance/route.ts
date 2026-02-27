/**
 * Distance Calculation API
 *
 * Calculate distance between two Ethiopian locations.
 *
 * Method: Haversine formula for straight-line distance
 * Future: Can integrate with OpenRouteService, Google Maps, or Mapbox for road distance
 *
 * Security:
 * - Public endpoint (no auth required)
 * - Rate limiting: 500 requests/hour per IP
 * - Input validation for location IDs
 *
 * Sprint 8 - Story 8.3: Map-Based Distance Calculation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateDistanceKm } from "@/lib/geo";
import { roundDistance1 } from "@/lib/rounding";

/**
 * GET /api/distance
 *
 * Calculate distance between two locations.
 *
 * Query parameters:
 * - originId: Origin location ID (required)
 * - destinationId: Destination location ID (required)
 *
 * Returns:
 * {
 *   distance: number,        // Distance in km
 *   origin: {
 *     id: string,
 *     name: string,
 *     latitude: number,
 *     longitude: number
 *   },
 *   destination: {
 *     id: string,
 *     name: string,
 *     latitude: number,
 *     longitude: number
 *   },
 *   method: "haversine"      // Calculation method used
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const originId = searchParams.get("originId");
    const destinationId = searchParams.get("destinationId");

    // Validate required parameters
    if (!originId || !destinationId) {
      return NextResponse.json(
        { error: "Both originId and destinationId are required" },
        { status: 400 }
      );
    }

    // Validate IDs are different
    if (originId === destinationId) {
      return NextResponse.json(
        { error: "Origin and destination must be different locations" },
        { status: 400 }
      );
    }

    // Validate ID format (cuid)
    if (
      typeof originId !== "string" ||
      originId.length < 10 ||
      typeof destinationId !== "string" ||
      destinationId.length < 10
    ) {
      return NextResponse.json(
        { error: "Invalid location ID format" },
        { status: 400 }
      );
    }

    // Fetch both locations in parallel
    const [origin, destination] = await Promise.all([
      db.ethiopianLocation.findUnique({
        where: { id: originId },
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          isActive: true,
        },
      }),
      db.ethiopianLocation.findUnique({
        where: { id: destinationId },
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          isActive: true,
        },
      }),
    ]);

    // Validate locations exist and are active
    if (!origin || !origin.isActive) {
      return NextResponse.json(
        { error: "Origin location not found or inactive" },
        { status: 404 }
      );
    }

    if (!destination || !destination.isActive) {
      return NextResponse.json(
        { error: "Destination location not found or inactive" },
        { status: 404 }
      );
    }

    // Calculate distance using Haversine formula (delegated to lib/geo.ts)
    const distance = roundDistance1(
      calculateDistanceKm(
        Number(origin.latitude),
        Number(origin.longitude),
        Number(destination.latitude),
        Number(destination.longitude)
      )
    );

    // Return result
    return NextResponse.json({
      distance,
      origin: {
        id: origin.id,
        name: origin.name,
        latitude: Number(origin.latitude),
        longitude: Number(origin.longitude),
      },
      destination: {
        id: destination.id,
        name: destination.name,
        latitude: Number(destination.latitude),
        longitude: Number(destination.longitude),
      },
      method: "haversine",
      note: "Straight-line distance. Road distance may vary by 10-30%.",
    });
  } catch (error) {
    console.error("Error calculating distance:", error);

    return NextResponse.json(
      { error: "Failed to calculate distance" },
      { status: 500 }
    );
  }
}
