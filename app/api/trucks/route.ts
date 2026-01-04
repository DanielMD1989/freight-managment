import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import {
  validateImeiFormat,
  verifyGpsDevice,
  detectGpsProvider,
  determineGpsStatus,
} from "@/lib/gpsVerification";
import { getVisibilityRules, RULE_SHIPPER_DEMAND_FOCUS } from "@/lib/foundation-rules";

const createTruckSchema = z.object({
  truckType: z.enum(["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "DRY_VAN", "LOWBOY", "DUMP_TRUCK", "BOX_TRUCK"]),
  licensePlate: z.string().min(3),
  capacity: z.number().positive(),
  volume: z.number().positive().optional(),
  currentCity: z.string().optional(),
  currentRegion: z.string().optional(),
  isAvailable: z.boolean().default(true),
  gpsDeviceId: z.string().optional(),
  // Sprint 16: GPS fields
  imei: z.string().optional(),
  gpsProvider: z.string().optional(),
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

    // Sprint 16: GPS verification
    let gpsData: any = {};

    if (validatedData.imei) {
      // Validate IMEI format
      if (!validateImeiFormat(validatedData.imei)) {
        return NextResponse.json(
          { error: "Invalid IMEI format. Must be exactly 15 digits." },
          { status: 400 }
        );
      }

      // Verify GPS device
      const verification = await verifyGpsDevice(validatedData.imei);

      if (!verification.success) {
        return NextResponse.json(
          { error: verification.message },
          { status: 400 }
        );
      }

      // Set GPS data
      const now = new Date();
      gpsData = {
        imei: validatedData.imei,
        gpsProvider: validatedData.gpsProvider || detectGpsProvider(validatedData.imei),
        gpsVerifiedAt: now,
        gpsLastSeenAt: verification.lastSeen || now,
        gpsStatus: determineGpsStatus(verification.lastSeen || now),
      };
    }

    const truck = await db.truck.create({
      data: {
        ...validatedData,
        ...gpsData,
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
// PHASE 2: Role-based visibility enforcement
// - SHIPPER: Cannot browse fleet inventory (use /api/truck-postings for availability)
// - CARRIER: Can view their own fleet only
// - DISPATCHER: Can view all trucks (for coordination)
// - ADMIN/SUPER_ADMIN: Full access
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const truckType = searchParams.get("truckType");
    const isAvailable = searchParams.get("isAvailable");
    const myTrucks = searchParams.get("myTrucks") === "true";
    const carrierId = searchParams.get("carrierId"); // Admin filter
    const approvalStatus = searchParams.get("approvalStatus"); // Sprint 18: Filter by approval status

    // Get user with role info
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // PHASE 2: Get visibility rules based on role
    const visibility = getVisibilityRules(user.role);

    // PHASE 2: SHIPPER cannot browse fleet inventory
    // Foundation Rule: SHIPPER_DEMAND_FOCUS
    // Shippers should use /api/truck-postings to search for available trucks
    if (user.role === 'SHIPPER') {
      return NextResponse.json(
        {
          error: "Shippers cannot browse truck fleet inventory",
          hint: "Use /api/truck-postings to search for available trucks",
          rule: RULE_SHIPPER_DEMAND_FOCUS.id,
        },
        { status: 403 }
      );
    }

    const where: any = {};

    // Role-based filtering
    if (user.role === 'CARRIER') {
      // Carriers can only see their own fleet
      if (!user.organizationId) {
        return NextResponse.json(
          { error: "Carrier must belong to an organization to view trucks" },
          { status: 403 }
        );
      }
      where.carrierId = user.organizationId;
    } else if (user.role === 'DISPATCHER') {
      // Dispatchers can see all trucks (for coordination)
      // But they cannot modify - enforced by other endpoints
    }
    // ADMIN/SUPER_ADMIN: No filter - can see all

    // myTrucks filter for carriers
    if (myTrucks && user.organizationId) {
      where.carrierId = user.organizationId;
    }

    // Admin can filter by specific carrier
    if (carrierId && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      where.carrierId = carrierId;
    }

    if (truckType) {
      where.truckType = truckType;
    }

    if (isAvailable !== null) {
      where.isAvailable = isAvailable === "true";
    }

    // Sprint 18: Filter by approval status
    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
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
          // Include active posting info
          postings: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              status: true,
              originCityId: true,
              availableFrom: true,
            },
            take: 1,
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

    // Add hasActivePosting flag
    const trucksWithPostingStatus = trucks.map(truck => ({
      ...truck,
      hasActivePosting: truck.postings.length > 0,
      activePostingId: truck.postings[0]?.id || null,
    }));

    return NextResponse.json({
      trucks: trucksWithPostingStatus,
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
