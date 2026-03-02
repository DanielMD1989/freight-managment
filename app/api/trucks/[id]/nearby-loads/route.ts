/**
 * Sprint 6: DH-O Optimized Load Search
 * Find loads near truck's current location with minimal deadhead
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { findLoadsWithMinimalDHO } from "@/lib/deadheadOptimization";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

// GET /api/trucks/[id]/nearby-loads - Find loads with minimal DH-O
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireActiveUser();

    // M10 FIX: Rate limit nearby-loads queries
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const config = RPS_CONFIGS.gps;
    const rpsResult = await checkRpsLimit(
      config.endpoint,
      ip,
      config.rps,
      config.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    const { id: truckId } = await params;

    // Verify truck exists and user has permission
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: { id: true, carrierId: true },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Only truck owner or admin can access nearby loads
    const isOwner =
      session.role === "CARRIER" && session.organizationId === truck.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);

    // Parse and validate maxDHO (1-2000 km range)
    const maxDHORaw = parseInt(searchParams.get("maxDHO") || "200", 10);
    const maxDHO = isNaN(maxDHORaw)
      ? 200
      : Math.max(1, Math.min(maxDHORaw, 2000));

    const truckType = searchParams.get("truckType") || undefined;

    // Parse and validate trip distances (positive values only)
    const minTripKmRaw = searchParams.get("minTripKm")
      ? parseFloat(searchParams.get("minTripKm")!)
      : undefined;
    const minTripKm =
      minTripKmRaw !== undefined && !isNaN(minTripKmRaw) && minTripKmRaw >= 0
        ? minTripKmRaw
        : undefined;

    const maxTripKmRaw = searchParams.get("maxTripKm")
      ? parseFloat(searchParams.get("maxTripKm")!)
      : undefined;
    const maxTripKm =
      maxTripKmRaw !== undefined && !isNaN(maxTripKmRaw) && maxTripKmRaw >= 0
        ? maxTripKmRaw
        : undefined;

    // Validate minTripKm <= maxTripKm if both provided
    if (
      minTripKm !== undefined &&
      maxTripKm !== undefined &&
      minTripKm > maxTripKm
    ) {
      return NextResponse.json(
        { error: "minTripKm must be less than or equal to maxTripKm" },
        { status: 400 }
      );
    }

    const pickupAfter = searchParams.get("pickupAfter")
      ? new Date(searchParams.get("pickupAfter")!)
      : undefined;
    const pickupBefore = searchParams.get("pickupBefore")
      ? new Date(searchParams.get("pickupBefore")!)
      : undefined;

    // Find loads with minimal DH-O
    const loads = await findLoadsWithMinimalDHO(truckId, maxDHO, {
      truckType,
      minTripKm,
      maxTripKm,
      pickupAfter,
      pickupBefore,
    });

    return NextResponse.json({
      truckId,
      maxDHO,
      loads,
      count: loads.length,
      filters: {
        maxDHO,
        truckType,
        minTripKm,
        maxTripKm,
        pickupAfter,
        pickupBefore,
      },
    });
  } catch (error) {
    return handleApiError(error, "Nearby loads error");
  }
}
