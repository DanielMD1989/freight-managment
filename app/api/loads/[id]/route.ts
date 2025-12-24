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

const updateLoadSchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "UNPOSTED", "CANCELLED"]).optional(),
  pickupCity: z.string().min(2).optional(),
  pickupAddress: z.string().optional(),
  deliveryCity: z.string().min(2).optional(),
  deliveryAddress: z.string().optional(),
  truckType: z.enum(["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "DRY_VAN", "LOWBOY", "DUMP_TRUCK", "BOX_TRUCK"]).optional(),
  weight: z.number().positive().optional(),
  rate: z.number().positive().optional(),
  safetyNotes: z.string().optional(),
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
      session.role === "ADMIN" ||
      session.role === "PLATFORM_OPS";

    if (!canEdit) {
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

    const load = await db.load.update({
      where: { id },
      data: validatedData,
    });

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
      select: { shipperId: true, status: true },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (user?.organizationId !== load.shipperId) {
      return NextResponse.json(
        { error: "You do not have permission to delete this load" },
        { status: 403 }
      );
    }

    // Can only delete draft or unposted loads
    if (load.status !== "DRAFT" && load.status !== "UNPOSTED") {
      return NextResponse.json(
        { error: "Can only delete draft or unposted loads" },
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
