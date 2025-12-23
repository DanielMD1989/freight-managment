import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";

const createTruckSchema = z.object({
  truckType: z.enum(["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "DRY_VAN", "LOWBOY", "DUMP_TRUCK", "BOX_TRUCK"]),
  licensePlate: z.string().min(3),
  capacity: z.number().positive(),
  volume: z.number().positive().optional(),
  currentCity: z.string().optional(),
  currentRegion: z.string().optional(),
  isAvailable: z.boolean().default(true),
  gpsDeviceId: z.string().optional(),
});

// POST /api/trucks - Create truck
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    await requirePermission(Permission.CREATE_TRUCK);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "You must belong to an organization to create trucks" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createTruckSchema.parse(body);

    // Check if license plate already exists
    const existing = await db.truck.findUnique({
      where: { licensePlate: validatedData.licensePlate },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Truck with this license plate already exists" },
        { status: 400 }
      );
    }

    const truck = await db.truck.create({
      data: {
        ...validatedData,
        carrierId: user.organizationId,
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
      },
    });

    return NextResponse.json({ truck }, { status: 201 });
  } catch (error) {
    console.error("Create truck error:", error);

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

// GET /api/trucks - List trucks
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const truckType = searchParams.get("truckType");
    const isAvailable = searchParams.get("isAvailable");
    const myTrucks = searchParams.get("myTrucks") === "true";

    const where: any = {};

    if (myTrucks) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true },
      });

      if (user?.organizationId) {
        where.carrierId = user.organizationId;
      }
    }

    if (truckType) {
      where.truckType = truckType;
    }

    if (isAvailable !== null) {
      where.isAvailable = isAvailable === "true";
    }

    const [trucks, total] = await Promise.all([
      db.truck.findMany({
        where,
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
          gpsDevice: {
            select: {
              id: true,
              imei: true,
              status: true,
              lastSeenAt: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.truck.count({ where }),
    ]);

    return NextResponse.json({
      trucks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List trucks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
