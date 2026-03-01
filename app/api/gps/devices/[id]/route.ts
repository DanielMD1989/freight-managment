import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

// H20 FIX: Zod schema for GPS device updates
const updateDeviceSchema = z.object({
  imei: z.string().length(15).optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "SIGNAL_LOST", "MAINTENANCE"])
    .optional(),
});

// DELETE /api/gps/devices/[id] - Remove GPS device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_GPS_DEVICES);

    const { id } = await params;

    // Check if device exists
    const device = await db.gpsDevice.findUnique({
      where: { id },
      select: {
        id: true,
        truck: {
          select: { id: true },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: "GPS device not found" },
        { status: 404 }
      );
    }

    // Delete the device
    await db.gpsDevice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete GPS device error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/gps/devices/[id] - Update GPS device
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_GPS_DEVICES);

    const { id } = await params;
    const body = await request.json();

    // H20 FIX: Validate input with Zod schema
    const validationResult = updateDeviceSchema.safeParse(body);
    if (!validationResult.success) {
      return zodErrorResponse(validationResult.error);
    }
    const validatedData = validationResult.data;

    // Check if device exists
    const device = await db.gpsDevice.findUnique({
      where: { id },
    });

    if (!device) {
      return NextResponse.json(
        { error: "GPS device not found" },
        { status: 404 }
      );
    }

    // M26 FIX: Unlink device from truck before deletion-related updates
    // Update the device
    const updatedDevice = await db.gpsDevice.update({
      where: { id },
      data: {
        ...(validatedData.imei && { imei: validatedData.imei }),
        ...(validatedData.status && { status: validatedData.status }),
      },
      include: {
        truck: {
          select: {
            id: true,
            licensePlate: true,
            carrier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ device: updatedDevice });
  } catch (error) {
    console.error("Update GPS device error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
