export const dynamic = "force-dynamic";
/**
 * Driver Detail API — Task 14
 *
 * GET    /api/drivers/[id] — driver detail (carrier-in-same-org OR the driver themselves)
 * PUT    /api/drivers/[id] — update driver profile (carrier full fields, driver self-serve subset)
 * DELETE /api/drivers/[id] — soft-delete: suspend + revoke sessions (carrier only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser, revokeAllSessions } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { zodErrorResponse } from "@/lib/validation";

// Full carrier-managed update — includes fields drivers shouldn't edit
// themselves (e.g. endorsements, which can be a safety-sensitive record).
const carrierUpdateSchema = z.object({
  cdlNumber: z.string().max(50).optional(),
  cdlState: z.string().max(50).optional(),
  cdlExpiry: z.string().datetime().optional().nullable(),
  medicalCertExp: z.string().datetime().optional().nullable(),
  endorsements: z.record(z.string(), z.unknown()).optional().nullable(),
  isAvailable: z.boolean().optional(),
});

// Driver-self subset — no endorsements, no state-specific CDL fields that
// would normally be maintained by the carrier.
const driverSelfUpdateSchema = z.object({
  cdlNumber: z.string().max(50).optional(),
  cdlState: z.string().max(50).optional(),
  cdlExpiry: z.string().datetime().optional().nullable(),
  medicalCertExp: z.string().datetime().optional().nullable(),
  isAvailable: z.boolean().optional(),
});

// Helper: fetch a driver with authorization context. Returns null if either
// the user doesn't exist, isn't a DRIVER, or the caller isn't allowed to see
// them (carrier-in-same-org or the driver themselves).
async function loadAuthorizedDriver(params: {
  driverId: string;
  callerUserId: string;
  callerRole: string;
  callerOrgId?: string | null;
}) {
  const { driverId, callerUserId, callerRole, callerOrgId } = params;

  const driver = await db.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      status: true,
      organizationId: true,
      createdAt: true,
      driverProfile: {
        select: {
          id: true,
          cdlNumber: true,
          cdlState: true,
          cdlExpiry: true,
          medicalCertExp: true,
          endorsements: true,
          cdlFrontUrl: true,
          cdlBackUrl: true,
          medicalCertUrl: true,
          isAvailable: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!driver || driver.organizationId == null) {
    return null;
  }

  // Only actual DRIVERs are viewable through this endpoint.
  // Check via a lightweight second query to avoid pulling the full User.role
  // into the select (which is fine, but keeps the select minimal).
  const roleCheck = await db.user.findUnique({
    where: { id: driverId },
    select: { role: true },
  });
  if (roleCheck?.role !== "DRIVER") {
    return null;
  }

  const callerIsCarrierSameOrg =
    callerRole === "CARRIER" &&
    !!callerOrgId &&
    driver.organizationId === callerOrgId;
  const callerIsSelf = callerRole === "DRIVER" && callerUserId === driver.id;

  if (!callerIsCarrierSameOrg && !callerIsSelf) {
    return null;
  }

  return driver;
}

/**
 * GET /api/drivers/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { id } = await params;

    const driver = await loadAuthorizedDriver({
      driverId: id,
      callerUserId: session.userId,
      callerRole: session.role,
      callerOrgId: session.organizationId,
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Pull active trips with just enough load/truck context for the UI.
    const activeTrips = await db.trip.findMany({
      where: {
        driverId: id,
        status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ...driver,
      activeTrips,
    });
  } catch (error) {
    return handleApiError(error, "Get driver error");
  }
}

/**
 * PUT /api/drivers/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id } = await params;

    const driver = await loadAuthorizedDriver({
      driverId: id,
      callerUserId: session.userId,
      callerRole: session.role,
      callerOrgId: session.organizationId,
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (!driver.driverProfile) {
      return NextResponse.json(
        {
          error:
            "Driver profile not found — driver must complete accept-invite flow first",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const isDriverSelf = session.role === "DRIVER" && session.userId === id;

    const parsed = isDriverSelf
      ? driverSelfUpdateSchema.safeParse(body)
      : carrierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const data = parsed.data;

    // Build update payload. Preserve nullability: undefined means "don't touch",
    // null means "clear the field". Zod above accepts both `.optional()` and
    // `.nullable()` which map cleanly to Prisma semantics.
    const updateData: Record<string, unknown> = {};
    if (data.cdlNumber !== undefined) updateData.cdlNumber = data.cdlNumber;
    if (data.cdlState !== undefined) updateData.cdlState = data.cdlState;
    if (data.cdlExpiry !== undefined) {
      updateData.cdlExpiry = data.cdlExpiry ? new Date(data.cdlExpiry) : null;
    }
    if (data.medicalCertExp !== undefined) {
      updateData.medicalCertExp = data.medicalCertExp
        ? new Date(data.medicalCertExp)
        : null;
    }
    if (!isDriverSelf && "endorsements" in data) {
      // Carrier-only field.
      updateData.endorsements =
        (data as z.infer<typeof carrierUpdateSchema>).endorsements ?? null;
    }
    if (data.isAvailable !== undefined)
      updateData.isAvailable = data.isAvailable;

    const updated = await db.driverProfile.update({
      where: { userId: id },
      data: updateData,
      select: {
        id: true,
        cdlNumber: true,
        cdlState: true,
        cdlExpiry: true,
        medicalCertExp: true,
        endorsements: true,
        isAvailable: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      driverProfile: updated,
    });
  } catch (error) {
    return handleApiError(error, "Update driver error");
  }
}

/**
 * DELETE /api/drivers/[id]
 *
 * Soft-delete: suspend the driver (status=SUSPENDED) + revoke all sessions
 * so the current JWT immediately stops being honored. Hard delete is never
 * used — audit trail on trips/messages stays intact.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id } = await params;

    if (session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only carriers can remove drivers" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to a carrier organization" },
        { status: 400 }
      );
    }

    // Drivers cannot delete themselves.
    if (session.userId === id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 400 }
      );
    }

    const driver = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        organizationId: true,
        status: true,
      },
    });

    if (
      !driver ||
      driver.role !== "DRIVER" ||
      driver.organizationId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Refuse suspend if the driver is sitting on an active trip — carrier
    // must reassign or cancel first.
    const activeTripCount = await db.trip.count({
      where: {
        driverId: id,
        status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
      },
    });
    if (activeTripCount > 0) {
      return NextResponse.json(
        {
          error:
            "Driver has active trips. Reassign or complete them before suspending.",
        },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });

    // Mark driver unavailable so they don't appear in assign-driver pickers.
    // Best-effort — driverProfile may not exist if suspended before accepting invite.
    try {
      await db.driverProfile.update({
        where: { userId: id },
        data: { isAvailable: false },
      });
    } catch (err) {
      console.warn("driverProfile.update failed after suspension:", err);
    }

    // Best-effort session revocation — if it fails, the driver is still
    // suspended in the DB, and requireActiveUser will reject them on next
    // request regardless.
    try {
      await revokeAllSessions(id);
    } catch (err) {
      console.warn("revokeAllSessions failed after driver suspension:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Driver suspended",
    });
  } catch (error) {
    return handleApiError(error, "Delete driver error");
  }
}
