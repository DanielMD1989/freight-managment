import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { validateCSRFWithMobile } from "@/lib/csrf";

const createDeviceSchema = z.object({
  imei: z.string().min(15).max(15),
  status: z
    .enum(["ACTIVE", "INACTIVE", "SIGNAL_LOST", "MAINTENANCE"])
    .default("ACTIVE"),
});

// POST /api/gps/devices - Register GPS device (admin/ops only)
export async function POST(request: NextRequest) {
  try {
    // H8 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_GPS_DEVICES);

    const body = await request.json();
    const validatedData = createDeviceSchema.parse(body);

    const existing = await db.gpsDevice.findUnique({
      where: { imei: validatedData.imei },
    });

    if (existing) {
      return NextResponse.json(
        { error: "GPS device with this IMEI already exists" },
        { status: 400 }
      );
    }

    const device = await db.gpsDevice.create({
      data: validatedData,
    });

    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    console.error("Create GPS device error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/gps/devices - List GPS devices
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_GPS);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");

    const where: Prisma.GpsDeviceWhereInput = {};
    if (status) {
      where.status = status as Prisma.EnumGpsDeviceStatusFilter;
    }

    const devices = await db.gpsDevice.findMany({
      where,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ devices });
  } catch (error) {
    console.error("List GPS devices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
