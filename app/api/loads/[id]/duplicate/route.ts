/**
 * Load Duplicate API
 *
 * POST /api/loads/[id]/duplicate
 *
 * Duplicates an existing load with a new ID, useful for creating similar loads.
 *
 * Sprint 2 - Story 2.3: Load Listing & Editing
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { CacheInvalidation } from "@/lib/cache";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

/**
 * POST /api/loads/[id]/duplicate
 *
 * Duplicates a load, creating a new DRAFT load with the same details.
 *
 * Returns:
 * {
 *   load: Load
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C4 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "load-duplicate",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down.", retryAfter: 1 },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rpsResult.limit.toString(),
            "X-RateLimit-Remaining": rpsResult.remaining.toString(),
            "Retry-After": "1",
          },
        }
      );
    }

    const { id } = await params;

    // Require ACTIVE user status and permission to post loads
    await requireActiveUser();
    const session = await requirePermission(Permission.POST_LOADS);

    // Find original load
    const originalLoad = await db.load.findUnique({
      where: { id },
    });

    if (!originalLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // H14 FIX: Verify ownership or admin access (include SUPER_ADMIN)
    const isOwner = originalLoad.shipperId === session.organizationId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You can only duplicate your own loads" },
        { status: 403 }
      );
    }

    // Create duplicate load
    const duplicateLoad = await db.load.create({
      data: {
        // Copy all fields except unique identifiers and status
        status: "DRAFT",
        // Reset Sprint 14 DAT-style fields
        isKept: false,
        hasAlerts: false,
        groupId: null,
        pickupCity: originalLoad.pickupCity,
        pickupCityId: originalLoad.pickupCityId,
        pickupAddress: originalLoad.pickupAddress,
        pickupDockHours: originalLoad.pickupDockHours,
        pickupDate: originalLoad.pickupDate,
        appointmentRequired: originalLoad.appointmentRequired,
        deliveryCity: originalLoad.deliveryCity,
        deliveryCityId: originalLoad.deliveryCityId,
        deliveryAddress: originalLoad.deliveryAddress,
        deliveryDockHours: originalLoad.deliveryDockHours,
        deliveryDate: originalLoad.deliveryDate,
        tripKm: originalLoad.tripKm,
        dhToOriginKm: originalLoad.dhToOriginKm,
        dhAfterDeliveryKm: originalLoad.dhAfterDeliveryKm,
        originLat: originalLoad.originLat,
        originLon: originalLoad.originLon,
        destinationLat: originalLoad.destinationLat,
        destinationLon: originalLoad.destinationLon,
        truckType: originalLoad.truckType,
        weight: originalLoad.weight,
        volume: originalLoad.volume,
        cargoDescription: originalLoad.cargoDescription,
        isFullLoad: originalLoad.isFullLoad,
        fullPartial: originalLoad.fullPartial,
        isFragile: originalLoad.isFragile,
        requiresRefrigeration: originalLoad.requiresRefrigeration,
        lengthM: originalLoad.lengthM,
        casesCount: originalLoad.casesCount,
        currency: originalLoad.currency,
        bookMode: originalLoad.bookMode,
        isAnonymous: originalLoad.isAnonymous,
        shipperContactName: originalLoad.shipperContactName,
        shipperContactPhone: originalLoad.shipperContactPhone,
        safetyNotes: originalLoad.safetyNotes,
        specialInstructions: originalLoad.specialInstructions,
        // Set new ownership
        shipperId: session.organizationId!,
        createdById: session.userId,
        // Reset assignment
        assignedTruckId: null,
        assignedAt: null,
        postedAt: null,
        expiresAt: null,
      },
      include: {
        pickupLocation: true,
        deliveryLocation: true,
        shipper: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: duplicateLoad.id,
        eventType: "DUPLICATED",
        description: `Load duplicated from load ${id}`,
        userId: session.userId,
        metadata: {
          originalLoadId: id,
        },
      },
    });

    // TD-009 FIX: Invalidate cache after duplicate creation
    await CacheInvalidation.load(duplicateLoad.id, session.organizationId!);

    return NextResponse.json({
      message: "Load duplicated successfully",
      load: duplicateLoad,
    });
  } catch (error: unknown) {
    return handleApiError(error, "Duplicate load error");
  }
}
