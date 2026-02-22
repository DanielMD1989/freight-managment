import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import {
  validateImeiFormat,
  verifyGpsDevice,
  detectGpsProvider,
  determineGpsStatus,
} from "@/lib/gpsVerification";
import {
  getVisibilityRules,
  RULE_SHIPPER_DEMAND_FOCUS,
} from "@/lib/foundation-rules";
import { TruckCache, CacheInvalidation } from "@/lib/cache";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/apiErrors";
import { sanitizeText } from "@/lib/validation";

const createTruckSchema = z.object({
  truckType: z.enum([
    "FLATBED",
    "REFRIGERATED",
    "TANKER",
    "CONTAINER",
    "DRY_VAN",
    "LOWBOY",
    "DUMP_TRUCK",
    "BOX_TRUCK",
  ]),
  licensePlate: z.string().min(3).max(20),
  capacity: z.number().positive(),
  volume: z.number().positive().optional(),
  currentCity: z.string().max(200).optional(),
  currentRegion: z.string().max(200).optional(),
  isAvailable: z.boolean().default(true),
  gpsDeviceId: z.string().max(50).optional(),
  // Sprint 16: GPS fields
  imei: z.string().max(15).optional(),
  gpsProvider: z.string().max(100).optional(),
});

// POST /api/trucks - Create truck
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.fleet
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

    // CSRF protection with mobile client handling
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

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

    // Sanitize user-provided text fields
    validatedData.licensePlate = sanitizeText(validatedData.licensePlate, 20);
    if (validatedData.currentCity)
      validatedData.currentCity = sanitizeText(validatedData.currentCity, 200);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gpsData: Record<string, any> = {};

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
        gpsProvider:
          validatedData.gpsProvider || detectGpsProvider(validatedData.imei),
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

    // PHASE 4: Invalidate truck list caches when new truck is created
    await CacheInvalidation.truck(
      truck.id,
      user.organizationId,
      user.organizationId
    );

    return NextResponse.json({ truck }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Create truck error");
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
    // Rate limiting: Apply RPS_CONFIGS.fleet
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

    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20") || 20, 1),
      100
    );
    const truckType = searchParams.get("truckType");
    const isAvailable = searchParams.get("isAvailable");
    const myTrucks = searchParams.get("myTrucks") === "true";
    const carrierId = searchParams.get("carrierId"); // Admin filter
    const approvalStatus = searchParams.get("approvalStatus"); // Sprint 18: Filter by approval status
    const hasActivePosting = searchParams.get("hasActivePosting"); // Filter by active posting status

    // PHASE 4: Build cache key from filter parameters
    const cacheFilters = {
      page,
      limit,
      truckType,
      isAvailable,
      myTrucks,
      carrierId,
      approvalStatus,
      hasActivePosting,
      role: session.role,
      orgId: session.organizationId,
    };

    // Try cache first for non-personalized queries
    // Cache dispatcher/admin queries that see all trucks
    const isCacheableQuery =
      session.role === "DISPATCHER" ||
      session.role === "ADMIN" ||
      session.role === "SUPER_ADMIN";
    if (isCacheableQuery && !myTrucks) {
      const cachedResult = await TruckCache.getList(cacheFilters);
      if (cachedResult) {
        return NextResponse.json(cachedResult);
      }
    }

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
    if (user.role === "SHIPPER") {
      return NextResponse.json(
        {
          error: "Shippers cannot browse truck fleet inventory",
          hint: "Use /api/truck-postings to search for available trucks",
          rule: RULE_SHIPPER_DEMAND_FOCUS.id,
        },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Role-based filtering
    if (user.role === "CARRIER") {
      // Carriers can only see their own fleet
      if (!user.organizationId) {
        return NextResponse.json(
          { error: "Carrier must belong to an organization to view trucks" },
          { status: 403 }
        );
      }
      where.carrierId = user.organizationId;
    } else if (user.role === "DISPATCHER") {
      // Dispatchers can see all trucks (for coordination)
      // But they cannot modify - enforced by other endpoints
    }
    // ADMIN/SUPER_ADMIN: No filter - can see all

    // myTrucks filter for carriers
    if (myTrucks && user.organizationId) {
      where.carrierId = user.organizationId;
    }

    // Admin can filter by specific carrier
    if (carrierId && (user.role === "ADMIN" || user.role === "SUPER_ADMIN")) {
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

    // Filter by active posting status
    // hasActivePosting=true: trucks with at least one ACTIVE posting
    // hasActivePosting=false: trucks with NO active postings (unposted trucks)
    if (hasActivePosting !== null && hasActivePosting !== undefined) {
      if (hasActivePosting === "true") {
        where.postings = {
          some: { status: "ACTIVE" },
        };
      } else if (hasActivePosting === "false") {
        where.postings = {
          none: { status: "ACTIVE" },
        };
      }
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
            where: { status: "ACTIVE" },
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
    const trucksWithPostingStatus = trucks.map((truck) => ({
      ...truck,
      hasActivePosting: truck.postings.length > 0,
      activePostingId: truck.postings[0]?.id || null,
    }));

    const response = {
      trucks: trucksWithPostingStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // PHASE 4: Cache the result for cacheable queries
    if (isCacheableQuery && !myTrucks) {
      await TruckCache.setList(cacheFilters, response as unknown as unknown[]);
    }

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "List trucks error");
  }
}
