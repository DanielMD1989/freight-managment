import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  calculateAge,
  calculateRPM,
  calculateTRPM,
  canSeeContact,
  maskCompany,
} from "@/lib/loadUtils";
import {
  calculateTotalFare,
  validatePricing,
} from "@/lib/pricingCalculation";
import {
  incrementCompletedLoads,
  incrementCancelledLoads,
} from "@/lib/trustMetrics";
import { checkSuspiciousCancellation } from "@/lib/bypassDetection";

const updateLoadSchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "UNPOSTED", "ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "EXPIRED"]).optional(),
  pickupCity: z.string().min(2).optional(),
  pickupAddress: z.string().optional().nullable(),
  deliveryCity: z.string().min(2).optional(),
  deliveryAddress: z.string().optional().nullable(),
  pickupDockHours: z.string().optional().nullable(),
  deliveryDockHours: z.string().optional().nullable(),
  pickupDate: z.string().optional(),
  deliveryDate: z.string().optional().nullable(),
  truckType: z.enum(["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "DRY_VAN", "LOWBOY", "DUMP_TRUCK", "BOX_TRUCK"]).optional(),
  weight: z.number().positive().optional(),
  lengthM: z.number().positive().optional(),
  fullPartial: z.enum(["FULL", "PARTIAL"]).optional(),
  tripKm: z.number().positive().optional(),
  estimatedTripKm: z.number().positive().optional(),
  // Sprint 16: New pricing fields
  baseFareEtb: z.number().positive().optional(),
  perKmEtb: z.number().positive().optional(),
  rate: z.number().positive().optional(),  // Legacy field
  currency: z.string().optional(),
  cargoDescription: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  safetyNotes: z.string().optional().nullable(),
  bookMode: z.enum(["REQUEST", "INSTANT"]).optional(),
  shipperContactPhone: z.string().optional().nullable(),
  shipperContactName: z.string().optional().nullable(),
  isKept: z.boolean().optional(),
  hasAlerts: z.boolean().optional(),
  groupId: z.string().optional().nullable(),
});

// GET /api/loads/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth();

    // Get current user's info
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        organizationId: true,
        role: true,
      },
    });

    const load = await db.load.findUnique({
      where: { id },
      include: {
        shipper: {
          select: {
            id: true,
            name: true,
            type: true,
            isVerified: true,
            contactEmail: true,
            contactPhone: true,
            // Sprint 16: Story 16.6 - Bypass detection fields
            isFlagged: true,
            flagReason: true,
            flaggedAt: true,
          },
        },
        assignedTruck: {
          include: {
            carrier: {
              select: {
                id: true,
                name: true,
                isVerified: true,
              },
            },
          },
        },
        documents: true,
        events: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Compute age
    const ageMinutes = calculateAge(load.postedAt, load.createdAt);

    // Compute RPM and tRPM
    const rpmEtbPerKm = calculateRPM(load.rate, load.tripKm);
    const trpmEtbPerKm = calculateTRPM(
      load.rate,
      load.tripKm,
      load.dhToOriginKm,
      load.dhAfterDeliveryKm
    );

    // Determine if viewer can see contact information
    const userCanSeeContact = canSeeContact(
      load.assignedTruckId,
      user?.organizationId || null,
      load.assignedTruck?.carrier?.id || null,
      user?.role || "SHIPPER"
    );

    // Apply company masking
    const maskedShipper = load.shipper
      ? {
          ...load.shipper,
          name: maskCompany(load.isAnonymous, load.shipper.name),
        }
      : null;

    // Build response with conditional contact information
    const responseLoad = {
      ...load,
      // Replace shipper with masked version
      shipper: maskedShipper,
      // Computed fields
      ageMinutes,
      rpmEtbPerKm,
      trpmEtbPerKm,
      // Contact info - only include if authorized
      shipperContactName: userCanSeeContact ? load.shipperContactName : null,
      shipperContactPhone: userCanSeeContact ? load.shipperContactPhone : null,
    };

    return NextResponse.json({ load: responseLoad });
  } catch (error) {
    console.error("Get load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/loads/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth();

    // Check if load exists and belongs to user's organization
    const existingLoad = await db.load.findUnique({
      where: { id },
      select: {
        shipperId: true,
        status: true,
        createdById: true,
      },
    });

    if (!existingLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canEdit =
      user?.organizationId === existingLoad.shipperId ||
      session.userId === existingLoad.createdById ||
      session.role === "ADMIN" ||
      session.role === "PLATFORM_OPS";

    if (!canEdit) {
      console.error('Permission denied:', {
        userId: session.userId,
        userOrgId: user?.organizationId,
        shipperId: existingLoad.shipperId,
        createdById: existingLoad.createdById,
        role: session.role
      });
      return NextResponse.json(
        { error: "You do not have permission to edit this load" },
        { status: 403 }
      );
    }

    // Cannot edit if already assigned
    if (existingLoad.status === "ASSIGNED" || existingLoad.status === "IN_TRANSIT" || existingLoad.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Cannot edit load after it has been assigned" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateLoadSchema.parse(body);

    // Sprint 16: Recalculate totalFareEtb if pricing fields changed
    let additionalData: any = {};
    const pricingFieldsChanged =
      validatedData.baseFareEtb !== undefined ||
      validatedData.perKmEtb !== undefined ||
      validatedData.tripKm !== undefined ||
      validatedData.estimatedTripKm !== undefined;

    // Sync tripKm and estimatedTripKm for backward compatibility
    if (validatedData.tripKm !== undefined && validatedData.estimatedTripKm === undefined) {
      additionalData.estimatedTripKm = validatedData.tripKm;
    } else if (validatedData.estimatedTripKm !== undefined && validatedData.tripKm === undefined) {
      additionalData.tripKm = validatedData.estimatedTripKm;
    }

    if (pricingFieldsChanged) {
      // Get current load data to fill in missing fields
      const currentLoad = await db.load.findUnique({
        where: { id },
        select: {
          baseFareEtb: true,
          perKmEtb: true,
          tripKm: true,
          estimatedTripKm: true,
        },
      });

      const baseFare = validatedData.baseFareEtb ?? currentLoad?.baseFareEtb;
      const perKm = validatedData.perKmEtb ?? currentLoad?.perKmEtb;
      const tripKm = validatedData.estimatedTripKm ?? validatedData.tripKm ?? currentLoad?.estimatedTripKm ?? currentLoad?.tripKm;

      // Calculate totalFareEtb if we have all required fields
      if (baseFare && perKm && tripKm) {
        try {
          validatePricing(baseFare, perKm, tripKm);
          const totalFare = calculateTotalFare(baseFare, perKm, tripKm);
          additionalData.totalFareEtb = totalFare.toNumber();
          // Update legacy rate field for backward compatibility
          additionalData.rate = totalFare.toNumber();
        } catch (error: any) {
          return NextResponse.json(
            { error: error.message || "Invalid pricing parameters" },
            { status: 400 }
          );
        }
      }
    }

    const load = await db.load.update({
      where: { id },
      data: {
        ...validatedData,
        ...additionalData,
      },
    });

    // Sprint 16: Update trust metrics on status change
    if (validatedData.status === "DELIVERED") {
      // Increment completed loads for shipper
      if (existingLoad.shipperId) {
        await incrementCompletedLoads(existingLoad.shipperId);
      }

      // Also increment for carrier if assigned
      const assignedLoad = await db.load.findUnique({
        where: { id },
        select: {
          assignedTruck: {
            select: {
              carrierId: true,
            },
          },
        },
      });

      if (assignedLoad?.assignedTruck?.carrierId) {
        await incrementCompletedLoads(assignedLoad.assignedTruck.carrierId);
      }
    } else if (validatedData.status === "CANCELLED") {
      // Increment cancelled loads for shipper
      if (existingLoad.shipperId) {
        await incrementCancelledLoads(existingLoad.shipperId);
      }

      // Sprint 16: Check for suspicious bypass pattern
      await checkSuspiciousCancellation(id);
    }

    // Log event
    await db.loadEvent.create({
      data: {
        loadId: id,
        eventType: validatedData.status === "POSTED" ? "POSTED" : validatedData.status === "UNPOSTED" ? "UNPOSTED" : "EDITED",
        description: `Load ${validatedData.status || "updated"}`,
        userId: session.userId,
      },
    });

    return NextResponse.json({ load });
  } catch (error) {
    console.error("Update load error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/loads/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth();

    const load = await db.load.findUnique({
      where: { id },
      select: { shipperId: true, status: true, createdById: true },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canDelete =
      user?.organizationId === load.shipperId ||
      session.userId === load.createdById ||
      session.role === "ADMIN" ||
      session.role === "PLATFORM_OPS";

    if (!canDelete) {
      return NextResponse.json(
        { error: "You do not have permission to delete this load" },
        { status: 403 }
      );
    }

    // Can only delete draft, unposted, or posted loads (not assigned/in-transit/delivered)
    if (load.status === "ASSIGNED" || load.status === "IN_TRANSIT" || load.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Cannot delete loads that are assigned, in transit, or delivered" },
        { status: 400 }
      );
    }

    await db.load.delete({ where: { id } });

    return NextResponse.json({ message: "Load deleted successfully" });
  } catch (error) {
    console.error("Delete load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
