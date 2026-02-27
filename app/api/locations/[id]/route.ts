/**
 * Ethiopian Location Detail API
 *
 * Get a specific location by ID.
 *
 * Security:
 * - Public endpoint (no auth required)
 * - Input validation for ID format
 * - Returns 404 if location not found or inactive
 *
 * Sprint 8 - Story 8.2: Ethiopian Location Management
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/locations/[id]
 *
 * Get details of a specific location.
 *
 * Returns:
 * {
 *   id: string,
 *   name: string,
 *   nameEthiopic: string | null,
 *   region: string,
 *   zone: string | null,
 *   latitude: number,
 *   longitude: number,
 *   type: string,
 *   population: number | null,
 *   aliases: string[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format (cuid)
    if (!id || typeof id !== "string" || id.length < 10) {
      return NextResponse.json(
        { error: "Invalid location ID format" },
        { status: 400 }
      );
    }

    // Fetch location
    const location = await db.ethiopianLocation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        nameEthiopic: true,
        region: true,
        zone: true,
        latitude: true,
        longitude: true,
        type: true,
        population: true,
        aliases: true,
        isActive: true,
      },
    });

    // Check if location exists and is active
    if (!location || !location.isActive) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Convert Decimal to number for JSON response
    const locationFormatted = {
      ...location,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      isActive: undefined, // Remove from response
    };

    return NextResponse.json(locationFormatted);
  } catch (error) {
    console.error("Error fetching location:", error);

    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: 500 }
    );
  }
}
