import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import { calculateAge, maskCompany } from "@/lib/loadUtils";
import { LoadCache, CacheInvalidation, CacheTTL } from "@/lib/cache";
import {
  checkRpsLimit,
  RPS_CONFIGS,
  addRateLimitHeaders,
} from "@/lib/rateLimit";
import { zodErrorResponse } from "@/lib/validation";
import { Prisma } from "@prisma/client";

const createLoadSchema = z.object({
  // Location & Schedule
  pickupCity: z.string().min(2),
  pickupAddress: z.string().optional(),
  pickupDockHours: z.string().optional(), // Changed to single field (string)
  pickupDate: z.string(),
  appointmentRequired: z.boolean().default(false),
  deliveryCity: z.string().min(2),
  deliveryAddress: z.string().optional(),
  deliveryDockHours: z.string().optional(), // Changed to single field (string)
  deliveryDate: z.string(),

  tripKm: z.number().positive().optional(), // Required for POSTED status
  dhToOriginKm: z.number().positive().optional(),
  dhAfterDeliveryKm: z.number().positive().optional(),
  originLat: z.number().optional(),
  originLon: z.number().optional(),
  destinationLat: z.number().optional(),
  destinationLon: z.number().optional(),

  // Load Details
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
  weight: z.number().positive(),
  volume: z.number().positive().optional(),
  cargoDescription: z.string().min(5),
  isFullLoad: z.boolean().default(true), // Keep for backward compatibility
  fullPartial: z.enum(["FULL", "PARTIAL"]).default("FULL"), // [NEW]
  isFragile: z.boolean().default(false),
  requiresRefrigeration: z.boolean().default(false),

  // Insurance
  isInsured: z.boolean().default(false),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceCoverageAmount: z.number().positive().optional(),

  lengthM: z.number().positive().optional(),
  casesCount: z.number().int().positive().optional(),

  // Pricing is negotiated off-platform
  bookMode: z.enum(["REQUEST", "INSTANT"]).default("REQUEST"), // [NEW]

  dtpReference: z.string().optional(),
  factorRating: z.string().optional(),

  // Privacy & Safety
  isAnonymous: z.boolean().default(false),
  shipperContactName: z.string().optional(), // [NEW]
  shipperContactPhone: z.string().optional(), // [NEW]
  safetyNotes: z.string().optional(),
  specialInstructions: z.string().optional(),

  // Status
  status: z.enum(["DRAFT", "POSTED"]).default("DRAFT"),
});

// POST /api/loads - Create load
export async function POST(request: NextRequest) {
  try {
    // H22 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Rate limiting: Apply RPS_CONFIGS.marketplace
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.marketplace.endpoint,
      ip,
      RPS_CONFIGS.marketplace.rps,
      RPS_CONFIGS.marketplace.burst
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

    // Require ACTIVE user status for creating loads
    const session = await requireActiveUser();
    await requirePermission(Permission.CREATE_LOAD);

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "You must belong to an organization to create loads" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createLoadSchema.parse(body);

    // Pricing is negotiated off-platform - platform only charges service fees
    const load = await db.load.create({
      data: {
        ...validatedData,
        pickupDate: new Date(validatedData.pickupDate),
        deliveryDate: new Date(validatedData.deliveryDate),
        postedAt: validatedData.status === "POSTED" ? new Date() : null,
        shipperId: user.organizationId,
        createdById: session.userId,
      },
      include: {
        shipper: {
          select: {
            id: true,
            name: true,
            type: true,
            isVerified: true,
          },
        },
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: load.id,
        eventType: validatedData.status === "POSTED" ? "POSTED" : "CREATED",
        description:
          validatedData.status === "POSTED"
            ? "Load posted to marketplace"
            : "Load created as draft",
        userId: session.userId,
      },
    });

    // PHASE 4: Invalidate load list caches when new load is created
    await CacheInvalidation.allListings();

    // PHASE 4: Send push notification to carriers when load is posted
    if (validatedData.status === "POSTED") {
      // Notify carriers about new load asynchronously (fire-and-forget)
      import("@/lib/notifications")
        .then(({ createNotificationForRole }) => {
          createNotificationForRole({
            role: "CARRIER",
            type: "NEW_LOAD_POSTED",
            title: "New Load Available",
            message: `New ${validatedData.truckType} load: ${validatedData.pickupCity} → ${validatedData.deliveryCity}`,
            metadata: {
              loadId: load.id,
              pickupCity: validatedData.pickupCity,
              deliveryCity: validatedData.deliveryCity,
              truckType: validatedData.truckType,
              weight: validatedData.weight,
            },
          }).catch((err) => console.error("Failed to notify carriers:", err));
        })
        .catch((err) =>
          console.error("Failed to load notifications module:", err)
        );
    }

    return NextResponse.json({ load }, { status: 201 });
  } catch (error) {
    console.error("Create load error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/loads - List loads (marketplace)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.marketplace
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.marketplace.endpoint,
      ip,
      RPS_CONFIGS.marketplace.rps,
      RPS_CONFIGS.marketplace.burst
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

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const pickupCity = searchParams.get("pickupCity");
    const deliveryCity = searchParams.get("deliveryCity");
    const truckType = searchParams.get("truckType");
    const myLoads = searchParams.get("myLoads") === "true";
    const myTrips = searchParams.get("myTrips") === "true"; // For carriers - loads assigned to their trucks

    const tripKmMin = searchParams.get("tripKmMin");
    const tripKmMax = searchParams.get("tripKmMax");
    const fullPartial = searchParams.get("fullPartial");
    const bookMode = searchParams.get("bookMode");
    const pickupFrom = searchParams.get("pickupFrom");
    const rateMin = searchParams.get("rateMin");
    const rateMax = searchParams.get("rateMax");

    // PHASE 4: Build cache key from filter parameters
    const cacheFilters = {
      page,
      limit,
      status,
      pickupCity,
      deliveryCity,
      truckType,
      myLoads,
      myTrips,
      tripKmMin,
      tripKmMax,
      fullPartial,
      bookMode,
      pickupFrom,
      rateMin,
      rateMax,
      role: session.role,
      orgId: session.organizationId,
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    };

    // Try cache first for marketplace queries (public loads only)
    // Only cache non-personalized queries
    const isPublicQuery = !myLoads && !myTrips && session.role !== "SHIPPER";
    if (isPublicQuery) {
      const cachedResult = await LoadCache.getList(cacheFilters);
      if (cachedResult) {
        return NextResponse.json(cachedResult);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Get user details for role-based filtering
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Sprint 16: Dispatcher can see all loads
    const isDispatcher =
      user?.role === "DISPATCHER" ||
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN";

    if (isDispatcher) {
      // Dispatcher/Admin: See all loads (no organization filter)
      // Optional status filter will be applied below if provided
    } else if (myTrips) {
      // Carrier: Filter loads where assigned truck belongs to their organization
      if (user?.organizationId) {
        where.assignedTruck = {
          carrierId: user.organizationId,
        };
      }
    } else if (myLoads) {
      // Shipper: Filter by current user's organization
      if (user?.organizationId) {
        where.shipperId = user.organizationId;
      }
    } else {
      // Only show posted loads in marketplace - force POSTED status
      // Do NOT allow status query param to override this (prevents draft load exposure)
      where.status = "POSTED";
    }

    // Allow status filter only for authenticated views (myLoads, myTrips, dispatcher)
    // Marketplace mode always forces POSTED
    if (status && (myLoads || myTrips || isDispatcher)) {
      // Handle comma-separated statuses (e.g., "PICKUP_PENDING,IN_TRANSIT")
      if (status.includes(",")) {
        where.status = { in: status.split(",") };
      } else {
        where.status = status;
      }
    }

    if (pickupCity) {
      where.pickupCity = { contains: pickupCity, mode: "insensitive" };
    }

    if (deliveryCity) {
      where.deliveryCity = { contains: deliveryCity, mode: "insensitive" };
    }

    if (truckType) {
      where.truckType = truckType;
    }

    if (tripKmMin || tripKmMax) {
      where.tripKm = {};
      if (tripKmMin) {
        where.tripKm.gte = parseFloat(tripKmMin);
      }
      if (tripKmMax) {
        where.tripKm.lte = parseFloat(tripKmMax);
      }
    }

    if (fullPartial && (fullPartial === "FULL" || fullPartial === "PARTIAL")) {
      where.fullPartial = fullPartial;
    }

    if (bookMode && (bookMode === "REQUEST" || bookMode === "INSTANT")) {
      where.bookMode = bookMode;
    }

    if (pickupFrom) {
      const parsedDate = new Date(pickupFrom);
      if (!isNaN(parsedDate.getTime())) {
        where.pickupDate = { gte: parsedDate };
      }
    }

    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: Record<string, any> | Record<string, any>[] = {};

    // Map sortBy to database fields
    switch (sortBy) {
      case "age":
      case "postedAt":
        // Sort by postedAt desc with nulls last, then createdAt as fallback
        orderBy = [
          { postedAt: { sort: sortOrder as "asc" | "desc", nulls: "last" } },
          { createdAt: sortOrder },
        ];
        break;
      case "tripKm":
        orderBy = { tripKm: sortOrder };
        break;
      case "pickupDate":
        orderBy = { pickupDate: sortOrder };
        break;
      case "createdAt":
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    const [loads, total] = await Promise.all([
      db.load.findMany({
        where,
        select: {
          id: true,
          status: true,
          postedAt: true, // [NEW] For age calculation
          // Location & Schedule
          pickupCity: true,
          pickupAddress: true,
          pickupDockHours: true, // [NEW]
          pickupDate: true,
          appointmentRequired: true, // [NEW]
          deliveryCity: true,
          deliveryAddress: true,
          deliveryDockHours: true, // [NEW]
          deliveryDate: true,
          tripKm: true,
          dhToOriginKm: true,
          dhAfterDeliveryKm: true,
          originLat: true,
          originLon: true,
          destinationLat: true,
          destinationLon: true,
          // Load Details
          truckType: true,
          weight: true,
          volume: true,
          cargoDescription: true,
          isFullLoad: true,
          fullPartial: true, // [NEW]
          isFragile: true,
          requiresRefrigeration: true,
          lengthM: true,
          casesCount: true,
          // Settings & Fees
          shipperServiceFee: true,
          currency: true,
          bookMode: true, // [NEW]
          // SPRINT 8: Market pricing (dtpReference, factorRating) removed per TRD
          // Privacy & Safety
          isAnonymous: true,
          // NOTE: shipperContactName and shipperContactPhone are NEVER included in public list
          safetyNotes: true,
          specialInstructions: true,
          // POD status
          podSubmitted: true,
          podVerified: true,
          // Timestamps
          createdAt: true,
          updatedAt: true,
          // Foreign Keys (needed for relations)
          pickupCityId: true,
          deliveryCityId: true,
          shipperId: true,
          createdById: true,
          // Relations
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
          assignedTruck: {
            select: {
              id: true,
              licensePlate: true,
              truckType: true,
              capacity: true,
              carrierId: true,
              carrier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      db.load.count({ where }),
    ]);

    const loadsWithComputed = loads.map((load) => {
      // Compute age
      const ageMinutes = calculateAge(load.postedAt, load.createdAt);

      // Apply company masking
      const maskedShipper = load.shipper
        ? {
            ...load.shipper,
            name: maskCompany(load.isAnonymous, load.shipper.name),
          }
        : null;

      return {
        ...load,
        ageMinutes,
        // Replace shipper with masked version
        shipper: maskedShipper,
      };
    });

    const response = {
      loads: loadsWithComputed,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // PHASE 4: Cache the result for non-personalized queries
    if (isPublicQuery) {
      // Cache with short TTL (30 seconds) for listings - high churn data
      await LoadCache.setList(cacheFilters, response as unknown as unknown[]);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("List loads error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (
        error.message === "Unauthorized" ||
        error.name === "UnauthorizedError"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.name === "ForbiddenError") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV !== "production" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
