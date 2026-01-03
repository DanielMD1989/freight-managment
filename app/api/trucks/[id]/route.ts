import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";

const updateTruckSchema = z.object({
  truckType: z.enum(["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "DRY_VAN", "LOWBOY", "DUMP_TRUCK", "BOX_TRUCK"]).optional(),
  licensePlate: z.string().min(3).optional(),
  capacity: z.number().positive().optional(),
  volume: z.number().positive().optional().nullable(),
  currentCity: z.string().optional().nullable(),
  currentRegion: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  status: z.enum(["ACTIVE", "IN_TRANSIT", "MAINTENANCE", "INACTIVE"]).optional(),
});

/**
 * GET /api/trucks/[id] - Get truck details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();

    const truck = await db.truck.findUnique({
      where: { id: params.id },
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
      user?.role === "ADMIN" ||
      user?.role === "SUPERADMIN" ||
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    await requirePermission(Permission.UPDATE_TRUCK);

    const truck = await db.truck.findUnique({
      where: { id: params.id },
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
      user?.role === "ADMIN" ||
      user?.role === "SUPERADMIN" ||
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
      where: { id: params.id },
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

    return NextResponse.json(updatedTruck);
  } catch (error) {
    console.error("PATCH /api/trucks/[id] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    await requirePermission(Permission.DELETE_TRUCK);

    const truck = await db.truck.findUnique({
      where: { id: params.id },
      include: {
        truckPostings: {
          where: {
            status: {
              in: ["ACTIVE", "POSTED"],
            },
          },
        },
      },
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
      user?.role === "ADMIN" ||
      user?.role === "SUPERADMIN" ||
      truck.carrierId === user?.organizationId;

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this truck" },
        { status: 403 }
      );
    }

    // Check if truck has active postings
    if (truck.truckPostings && truck.truckPostings.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete truck with active postings",
          message: "This truck has active postings. Please cancel or complete all active postings before deleting the truck.",
          activePostings: truck.truckPostings.length,
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Delete the truck
    await db.truck.delete({
      where: { id: params.id },
    });

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
