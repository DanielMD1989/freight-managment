/**
 * Reference Pricing API
 *
 * GET /api/loads/[id]/reference-pricing
 *
 * Returns market reference rates (TriHaul, Broker Spot) for a load
 * Sprint 14 - DAT-Style UI Transformation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Calculate reference pricing based on route and load characteristics
 *
 * This is a simplified algorithm. In production, this would:
 * - Query historical data for similar routes
 * - Factor in seasonality, demand/supply
 * - Use machine learning models
 * - Integrate with DAT RateView or similar services
 */
// FIX: Use proper interface instead of any
interface LoadForPricing {
  tripKm?: unknown;
  weight?: unknown;
  truckType?: string | null;
  fullPartial?: string | null;
  requiresRefrigeration?: boolean;
  isFragile?: boolean;
}

function calculateReferencePricing(load: LoadForPricing): {
  trihaulRate: number | null;
  brokerSpotRate: number | null;
} {
  // Base rate per km (Ethiopian Birr)
  const baseRatePerKm = 25; // ETB per km

  // Calculate base price - convert Prisma Decimal to number
  const tripKm = Number(load.tripKm) || 0;
  const basePrice = tripKm * baseRatePerKm;

  // Apply multipliers based on load characteristics
  let trihaulMultiplier = 1.0;
  let brokerMultiplier = 1.1; // Broker spot usually 10% higher

  // Truck type multiplier
  if (load.truckType === "FLATBED") {
    trihaulMultiplier *= 1.05;
    brokerMultiplier *= 1.08;
  } else if (load.truckType === "REFRIGERATED") {
    trihaulMultiplier *= 1.25;
    brokerMultiplier *= 1.3;
  } else if (load.truckType === "TANKER") {
    trihaulMultiplier *= 1.15;
    brokerMultiplier *= 1.18;
  }

  // Weight multiplier - convert Prisma Decimal to number
  const weightNum = Number(load.weight) || 0;
  if (weightNum) {
    if (weightNum > 10000) {
      trihaulMultiplier *= 1.1;
      brokerMultiplier *= 1.12;
    } else if (weightNum < 2000) {
      trihaulMultiplier *= 0.9;
      brokerMultiplier *= 0.92;
    }
  }

  // Full/Partial multiplier
  if (load.fullPartial === "FULL") {
    trihaulMultiplier *= 1.05;
    brokerMultiplier *= 1.06;
  }

  // Special requirements multiplier
  if (load.requiresRefrigeration) {
    trihaulMultiplier *= 1.2;
    brokerMultiplier *= 1.22;
  }

  if (load.isFragile) {
    trihaulMultiplier *= 1.08;
    brokerMultiplier *= 1.1;
  }

  // Calculate final rates
  const trihaulRate = Math.round(basePrice * trihaulMultiplier);
  const brokerSpotRate = Math.round(basePrice * brokerMultiplier);

  return {
    trihaulRate: trihaulRate > 0 ? trihaulRate : null,
    brokerSpotRate: brokerSpotRate > 0 ? brokerSpotRate : null,
  };
}

/**
 * GET /api/loads/[id]/reference-pricing
 *
 * Returns reference pricing for a load
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate
    const session = await requireAuth();
    const { id } = await params;

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Fetch load
    const load = await db.load.findUnique({
      where: { id },
      select: {
        id: true,
        shipperId: true,
        tripKm: true,
        truckType: true,
        weight: true,
        fullPartial: true,
        requiresRefrigeration: true,
        isFragile: true,
        currency: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // H4 FIX: Authorization check - only shipper who owns load, dispatcher, or admin
    const isOwner = user?.organizationId === load.shipperId;
    const isDispatcher = user?.role === "DISPATCHER";
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

    if (!isOwner && !isDispatcher && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to view pricing for this load" },
        { status: 403 }
      );
    }

    // Calculate reference pricing
    const pricing = calculateReferencePricing(load);

    return NextResponse.json({
      loadId: id,
      currency: load.currency || "ETB",
      ...pricing,
      metadata: {
        tripKm: load.tripKm,
        truckType: load.truckType,
        weight: load.weight,
        fullPartial: load.fullPartial,
        calculatedAt: new Date().toISOString(),
      },
    });
    // FIX: Use unknown type
  } catch (error: unknown) {
    console.error("Error calculating reference pricing:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
