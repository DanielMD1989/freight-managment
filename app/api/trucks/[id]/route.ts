import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCSRF } from "@/lib/csrf";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { TripStatus } from "@prisma/client";
// P1-001-B FIX: Import CacheInvalidation for update/delete operations
import { CacheInvalidation } from "@/lib/cache";
import { zodErrorResponse } from "@/lib/validation";

/**
 * Helper function to apply RPS rate limiting for fleet endpoints
 */
async function applyFleetRpsLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rpsResult = await checkRpsLimit(
    RPS_CONFIGS.fleet.endpoint,
    ip,
    RPS_CONFIGS.fleet.rps,
    RPS_CONFIGS.fleet.burst
  );
  if (!rpsResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.', retryAfter: 1 },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rpsResult.limit.toString(),
          'X-RateLimit-Remaining': rpsResult.remaining.toString(),
          'Retry-After': '1',
        },
      }
    );
  }
  return null;
}

const updateTruckSchema = z.object({
  truckType: z.enum(["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "DRY_VAN", "LOWBOY", "DUMP_TRUCK", "BOX_TRUCK"]).optional(),
  licensePlate: z.string().min(3).optional(),
  capacity: z.number().positive().optional(),
  volume: z.number().positive().optional().nullable(),
  currentCity: z.string().optional().nullable(),
  currentRegion: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  status: z.enum(["ACTIVE", "IN_TRANSIT", "MAINTENANCE", "INACTIVE"]).optional(),
  // Support resubmission of rejected trucks
  approvalStatus: z.enum(["PENDING"]).optional(), // Only allow setting to PENDING (resubmit)
  rejectionReason: z.null().optional(), // Clear rejection reason on resubmit
});

/**
 * GET /api/trucks/[id] - Get truck details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.fleet
    const rateLimitError = await applyFleetRpsLimit(request);
    if (rateLimitError) return rateLimitError;

    const session = await requireAuth();
    const { id } = await params;

    const truck = await db.truck.findUnique({
      where: { id },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
        gpsDevice: true,
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: "Truck not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to view this truck
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canView =
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN" ||
      truck.carrierId === user?.organizationId;

    if (!canView) {
      return NextResponse.json(
        { error: "You don't have permission to view this truck" },
        { status: 403 }
      );
    }

    return NextResponse.json(truck);
  } catch (error) {
    console.error("GET /api/trucks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch truck" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/trucks/[id] - Update truck
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.fleet
    const rateLimitError = await applyFleetRpsLimit(request);
    if (rateLimitError) return rateLimitError;

    // CSRF protection for state-changing operation
    // Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
    // Web clients MUST provide CSRF token
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (isMobileClient && !hasBearerAuth) {
      return NextResponse.json(
        { error: 'Mobile clients require Bearer authentication' },
        { status: 401 }
      );
    }

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const session = await requireAuth();
    await requirePermission(Permission.EDIT_TRUCKS);
    const { id } = await params;

    const truck = await db.truck.findUnique({
      where: { id },
    });

    if (!truck) {
      return NextResponse.json(
        { error: "Truck not found" },
        { status: 404 }
      );
    }

    // Check if user owns this truck
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canUpdate =
      user?.role === "SUPER_ADMIN" ||
      truck.carrierId === user?.organizationId;

    if (!canUpdate) {
      return NextResponse.json(
        { error: "You don't have permission to update this truck" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateTruckSchema.parse(body);

    // If license plate is being updated, check for duplicates
    if (validatedData.licensePlate && validatedData.licensePlate !== truck.licensePlate) {
      const existing = await db.truck.findUnique({
        where: { licensePlate: validatedData.licensePlate },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Truck with this license plate already exists" },
          { status: 400 }
        );
      }
    }

    const updatedTruck = await db.truck.update({
      where: { id },
      data: validatedData,
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
        gpsDevice: true,
      },
    });

    // P1-001-B FIX: Invalidate cache after truck update to ensure fresh data
    await CacheInvalidation.truck(updatedTruck.id, updatedTruck.carrierId, updatedTruck.carrierId);

    return NextResponse.json(updatedTruck);
  } catch (error) {
    console.error("PATCH /api/trucks/[id] error:", error);
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to update truck" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trucks/[id] - Delete truck
 * Story 15.5: Task 15.5.1-15.5.4 - Delete with error handling
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.fleet
    const rateLimitError = await applyFleetRpsLimit(request);
    if (rateLimitError) return rateLimitError;

    // CSRF protection for state-changing operation
    // Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
    // Web clients MUST provide CSRF token
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (isMobileClient && !hasBearerAuth) {
      return NextResponse.json(
        { error: 'Mobile clients require Bearer authentication' },
        { status: 401 }
      );
    }

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const session = await requireAuth();
    await requirePermission(Permission.DELETE_TRUCKS);
    const { id } = await params;

    const truck = await db.truck.findUnique({
      where: { id },
    });

    if (!truck) {
      return NextResponse.json(
        { error: "Truck not found" },
        { status: 404 }
      );
    }

    // Check if user owns this truck
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canDelete =
      user?.role === "SUPER_ADMIN" ||
      truck.carrierId === user?.organizationId;

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this truck" },
        { status: 403 }
      );
    }

    // =================================================================
    // GUARD: Check for active trips before allowing deletion
    // Active trip = any trip NOT in COMPLETED or CANCELLED status
    // =================================================================
    const ACTIVE_TRIP_STATUSES: TripStatus[] = ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED'];

    const activeTrip = await db.trip.findFirst({
      where: {
        truckId: id,
        status: {
          in: ACTIVE_TRIP_STATUSES,
        },
      },
      select: {
        id: true,
        status: true,
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
      },
    });

    if (activeTrip) {
      // Log detailed info server-side for debugging
      console.log('Truck deletion blocked - active trip:', {
        truckId: id,
        tripId: activeTrip.id,
        tripStatus: activeTrip.status,
        loadId: activeTrip.load?.id,
      });

      return NextResponse.json(
        {
          error: "Cannot delete truck with active assignments",
          message: "This truck is currently assigned to an active trip. Complete or cancel the trip before deleting the truck.",
        },
        { status: 409 }
      );
    }

    // Try to delete the truck
    try {
      await db.truck.delete({
        where: { id },
      });
    } catch (deleteError: any) {
      // Handle foreign key constraint errors
      if (deleteError.code === 'P2003' || deleteError.message?.includes('foreign key constraint')) {
        return NextResponse.json(
          {
            error: "Cannot delete truck with active postings",
            message: "This truck has active postings or associated records. Please remove them first.",
          },
          { status: 409 }
        );
      }
      throw deleteError;
    }

    // P1-001-B FIX: Invalidate cache after truck deletion to remove stale data
    await CacheInvalidation.truck(truck.id, truck.carrierId, truck.carrierId);

    return NextResponse.json({
      success: true,
      message: "Truck deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/trucks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete truck" },
      { status: 500 }
    );
  }
}
