/**
 * Return Loads API
 *
 * Service Fee Implementation - Task 6
 *
 * Get available return loads for a carrier in a specific region
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getReturnLoadSuggestions } from "@/lib/returnLoadNotifications";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const returnLoadsQuerySchema = z.object({
  region: z.string().min(1),
  truckType: z.string().optional(),
});

/**
 * GET /api/return-loads
 *
 * Get available return loads for a region
 *
 * Query params:
 * - region: Region to search for loads (required)
 * - truckType: Filter by truck type (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Must be carrier or dispatcher
    if (
      session.role !== "CARRIER" &&
      session.role !== "DISPATCHER" &&
      session.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Unauthorized - Carrier access required" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "No organization associated with user" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region");
    const truckType = searchParams.get("truckType");

    const validatedData = returnLoadsQuerySchema.parse({
      region,
      truckType: truckType || undefined,
    });

    const returnLoads = await getReturnLoadSuggestions(
      session.organizationId,
      validatedData.region,
      validatedData.truckType
    );

    return NextResponse.json({
      region: validatedData.region,
      truckType: validatedData.truckType || null,
      count: returnLoads.length,
      loads: returnLoads.map((load) => ({
        id: load.loadId,
        pickup: {
          city: load.pickupCity,
          region: load.pickupRegion,
        },
        delivery: {
          city: load.deliveryCity,
          region: load.deliveryRegion,
        },
        weight: load.weight,
        truckType: load.truckType,
        distanceKm: load.distanceKm,
        matchScore: load.matchScore,
        postedAt: load.postedAt,
      })),
    });
  } catch (error) {
    console.error("Return loads error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
