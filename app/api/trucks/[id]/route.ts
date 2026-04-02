export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { TripStatus, Prisma } from "@prisma/client";
// P1-001-B FIX: Import CacheInvalidation for update/delete operations
import { CacheInvalidation } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { createNotification, NotificationType } from "@/lib/notifications";
import { TRUCK_TYPE_VALUES } from "@/lib/constants/truckTypes";
import { handleApiError } from "@/lib/apiErrors";
import { sanitizeText, zodErrorResponse } from "@/lib/validation";

/**
 * Helper function to apply RPS rate limiting for fleet endpoints
 */
async function applyFleetRpsLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rpsResult = await checkRpsLimit(
    RPS_CONFIGS.fleet.endpoint,
    ip,
    RPS_CONFIGS.fleet.rps,
    RPS_CONFIGS.fleet.burst
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
  return null;
}

const updateTruckSchema = z.object({
  truckType: z.enum(TRUCK_TYPE_VALUES).optional(),
  licensePlate: z.string().min(3).max(20).optional(),
  capacity: z.number().positive().optional(),
  volume: z.number().positive().optional().nullable(),
  currentCity: z.string().max(200).optional().nullable(),
  currentRegion: z.string().max(200).optional().nullable(),
  isAvailable: z.boolean().optional(),
  status: z
    .enum(["ACTIVE", "IN_TRANSIT", "MAINTENANCE", "INACTIVE"])
    .optional(),
  // G-M9-1: Sprint 8 fields
  lengthM: z.number().positive().optional().nullable(),
  ownerName: z.string().max(200).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  // G-M10-1: approvalStatus and rejectionReason removed — use /approve and /resubmit endpoints
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

    const session = await requireActiveUser();
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
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check if user has permission to view this truck
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Truck visibility: owner, admin, dispatcher
    // Carriers can only see their OWN trucks — not other carriers' fleet
    // Shippers must use /api/truck-postings (RULE_SHIPPER_DEMAND_FOCUS)
    const canView =
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN" ||
      truck.carrierId === user?.organizationId ||
      user?.role === "DISPATCHER";

    if (!canView) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Strip GPS device info for non-owner roles (dispatcher shouldn't see IMEI)
    if (
      truck.carrierId !== user?.organizationId &&
      user?.role !== "ADMIN" &&
      user?.role !== "SUPER_ADMIN"
    ) {
      const { gpsDevice: _, ...truckWithoutGps } = truck;
      return NextResponse.json(truckWithoutGps);
    }

    return NextResponse.json(truck);
  } catch (error) {
    return handleApiError(error, "GET /api/trucks/[id] error");
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

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Fix 3b: Require ACTIVE user for truck updates
    const session = await requireActiveUser();
    await requirePermission(Permission.EDIT_TRUCKS);
    const { id } = await params;

    const truck = await db.truck.findUnique({
      where: { id },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check if user owns this truck
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canUpdate =
      user?.role === "ADMIN" ||
      user?.role === "SUPER_ADMIN" ||
      truck.carrierId === user?.organizationId;

    if (!canUpdate) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    const body = await request.json();
    // Fix 4b: Use safeParse to avoid leaking schema details
    const parseResult = updateTruckSchema.safeParse(body);
    if (!parseResult.success) {
      return zodErrorResponse(parseResult.error);
    }
    const validatedData = parseResult.data;

    // Sanitize user-provided text fields
    if (validatedData.licensePlate)
      validatedData.licensePlate = sanitizeText(validatedData.licensePlate, 20);
    if (validatedData.currentCity)
      validatedData.currentCity = sanitizeText(validatedData.currentCity, 200);
    if (validatedData.currentRegion)
      validatedData.currentRegion = sanitizeText(
        validatedData.currentRegion,
        200
      );

    // If license plate is being updated, check for duplicates
    if (
      validatedData.licensePlate &&
      validatedData.licensePlate !== truck.licensePlate
    ) {
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

    // Critical field change guard — editing truckType, capacity, or licensePlate
    // on an APPROVED truck auto-reverts to PENDING for re-approval
    const CRITICAL_FIELDS = ["truckType", "capacity", "licensePlate"] as const;
    const updateData: Record<string, unknown> = { ...validatedData };

    if (truck.approvalStatus === "APPROVED") {
      const hasCriticalChange = CRITICAL_FIELDS.some(
        (field) =>
          updateData[field] !== undefined &&
          String(updateData[field]) !== String(truck[field])
      );

      if (hasCriticalChange) {
        updateData.approvalStatus = "PENDING";
        updateData.documentsLockedAt = null; // Unlock docs for re-upload
        logger.warn(
          `Truck ${id} reverted to PENDING — critical field changed by ${session.userId}`
        );
      }
    }

    const updatedTruck = await db.truck.update({
      where: { id },
      data: updateData,
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

    // Notify if reverted to PENDING
    if (
      truck.approvalStatus === "APPROVED" &&
      updatedTruck.approvalStatus === "PENDING"
    ) {
      // Notify admin
      const admins = await db.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { id: true },
        take: 10,
      });
      for (const admin of admins) {
        createNotification({
          userId: admin.id,
          type:
            NotificationType.TRUCK_RESUBMITTED ||
            ("TRUCK_RESUBMITTED" as string),
          title: "Truck Modified After Approval",
          message: `Truck ${updatedTruck.licensePlate} was modified after approval and needs re-review.`,
          metadata: { truckId: id },
        }).catch(() => {});
      }
    }

    // P1-001-B FIX: Invalidate cache after truck update to ensure fresh data
    await CacheInvalidation.truck(
      updatedTruck.id,
      updatedTruck.carrierId,
      updatedTruck.carrierId
    );

    return NextResponse.json(updatedTruck);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Truck with this license plate already exists" },
        { status: 400 }
      );
    }
    return handleApiError(error, "PATCH /api/trucks/[id] error");
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

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Fix 3c: Require ACTIVE user for truck deletion
    const session = await requireActiveUser();
    await requirePermission(Permission.DELETE_TRUCKS);
    const { id } = await params;

    const truck = await db.truck.findUnique({
      where: { id },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Only admins can delete trucks (carriers must request admin deletion)
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canDelete = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

    // Fix 6a: Return 404 instead of 403 to prevent resource existence leakage
    if (!canDelete) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // =================================================================
    // GUARD: Check for active trips before allowing deletion
    // Active trip = any trip NOT in COMPLETED or CANCELLED status
    // =================================================================
    const ACTIVE_TRIP_STATUSES: TripStatus[] = [
      "ASSIGNED",
      "PICKUP_PENDING",
      "IN_TRANSIT",
      "EXCEPTION",
      "DELIVERED",
    ];

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
      logger.warn("Truck deletion blocked - active trip", {
        truckId: id,
        tripId: activeTrip.id,
        tripStatus: activeTrip.status,
        loadId: activeTrip.load?.id,
      });

      return NextResponse.json(
        {
          error: "Cannot delete truck with active assignments",
          message:
            "This truck is currently assigned to an active trip. Complete or cancel the trip before deleting the truck.",
        },
        { status: 409 }
      );
    }

    // M7 FIX: Wrap GPS device disconnect + truck delete in transaction
    try {
      await db.$transaction(async (tx) => {
        // M7 FIX: Disconnect GPS device and delete truck atomically
        if (truck.gpsDeviceId) {
          await tx.truck.update({
            where: { id },
            data: { gpsDeviceId: null },
          });
        }
        await tx.truck.delete({
          where: { id },
        });
      });
      // FIX: Use unknown type with type guards
    } catch (deleteError: unknown) {
      // Handle foreign key constraint errors - Prisma error
      const prismaError = deleteError as { code?: string; message?: string };
      if (
        prismaError?.code === "P2003" ||
        prismaError?.message?.includes("foreign key constraint")
      ) {
        return NextResponse.json(
          {
            error: "Cannot delete truck with active postings",
            message:
              "This truck has active postings or associated records. Please remove them first.",
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
    return handleApiError(error, "DELETE /api/trucks/[id] error");
  }
}
