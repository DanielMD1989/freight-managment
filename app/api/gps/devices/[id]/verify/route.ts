import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { GpsDeviceStatus } from "@prisma/client";

// POST /api/gps/devices/[id]/verify - Manually verify GPS device
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // H9 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_GPS_DEVICES);

    const { id } = await params;

    // Check if device exists
    const device = await db.gpsDevice.findUnique({
      where: { id },
      select: {
        id: true,
        imei: true,
        status: true,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: "GPS device not found" },
        { status: 404 }
      );
    }

    // Update device status to ACTIVE
    const updatedDevice = await db.gpsDevice.update({
      where: { id },
      data: {
        status: GpsDeviceStatus.ACTIVE,
        lastSeenAt: new Date(),
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

    return NextResponse.json({
      success: true,
      device: updatedDevice,
    });
  } catch (error) {
    console.error("Verify GPS device error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
