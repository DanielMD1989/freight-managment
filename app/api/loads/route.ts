export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { requirePermission, Permission } from "@/lib/rbac";
import { createNotification, NotificationType } from "@/lib/notifications";
import { z } from "zod";
import { calculateAge, maskCompany } from "@/lib/loadUtils";
import { LoadCache, CacheInvalidation } from "@/lib/cache";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";
import { sanitizeText } from "@/lib/validation";
import { calculateDistanceKm } from "@/lib/geo";
import { checkWalletGate } from "@/lib/walletGate";
import { TRUCK_TYPE_VALUES } from "@/lib/constants/truckTypes";

const createLoadSchema = z
  .object({
    // Location & Schedule
    pickupCity: z.string().min(2).max(200),
    pickupAddress: z.string().max(500).optional(),
    pickupDockHours: z.string().max(100).optional(), // Changed to single field (string)
    pickupDate: z.string(),
    appointmentRequired: z.boolean().default(false),
    deliveryCity: z.string().min(2).max(200),
    deliveryAddress: z.string().max(500).optional(),
    deliveryDockHours: z.string().max(100).optional(), // Changed to single field (string)
    deliveryDate: z.string(),

    // Estimated route distance (display only).
    // Calculated server-side from city coordinates.
    // Actual GPS distance is used for fee calculation
    // at trip completion — not this field.
    tripKm: z.number().positive().optional(),
    dhToOriginKm: z.number().positive().optional(),
    dhAfterDeliveryKm: z.number().positive().optional(),
    originLat: z.number().min(-90).max(90).optional(),
    originLon: z.number().min(-180).max(180).optional(),
    destinationLat: z.number().min(-90).max(90).optional(),
    destinationLon: z.number().min(-180).max(180).optional(),

    // Load Details
    truckType: z.enum(TRUCK_TYPE_VALUES),
    weight: z.number().positive().max(50000),
    volume: z.number().positive().optional(),
    cargoDescription: z.string().min(5).max(2000),
    isFullLoad: z.boolean().default(true), // Keep for backward compatibility
    fullPartial: z.enum(["FULL", "PARTIAL"]).default("FULL"), // [NEW]
    isFragile: z.boolean().default(false),
    requiresRefrigeration: z.boolean().default(false),

    // Insurance
    isInsured: z.boolean().default(false),
    insuranceProvider: z.string().max(200).optional(),
    insurancePolicyNumber: z.string().max(100).optional(),
    insuranceCoverageAmount: z.number().positive().optional(),

    lengthM: z.number().positive().optional(),
    casesCount: z.number().int().positive().optional(),

    // Pricing is negotiated off-platform
    bookMode: z.enum(["REQUEST", "INSTANT"]).default("REQUEST"), // [NEW]

    dtpReference: z.string().max(100).optional(),
    factorRating: z.string().max(100).optional(),

    // Privacy & Safety
    isAnonymous: z.boolean().default(false),
    shipperContactName: z
      .string()
      .min(2, "Contact name required (min 2 chars)")
      .max(100)
      .optional(),
    shipperContactPhone: z
      .string()
      .min(10, "Phone must be at least 10 digits")
      .max(20)
      .regex(
        /^(\+251|0)\d{9,}$/,
        "Enter valid Ethiopian phone: +251... or 09..."
      )
      .optional(),
    safetyNotes: z.string().max(1000).optional(),
    specialInstructions: z.string().max(2000).optional(),

    // Status
    status: z.enum(["DRAFT", "POSTED"]).default("DRAFT"),
  })
  .refine(
    (data) => {
      const pickup = new Date(data.pickupDate);
      const delivery = new Date(data.deliveryDate);
      return pickup <= delivery;
    },
    {
      message: "Pickup date must be on or before delivery date",
      path: ["deliveryDate"],
    }
  )
  .refine(
    (data) => {
      // G-M13-3: Pickup date cannot be in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(data.pickupDate) >= today;
    },
    {
      message: "Pickup date cannot be in the past",
      path: ["pickupDate"],
    }
  )
  .refine(
    (data) => {
      // Contact info required when POSTING to marketplace (not DRAFT) and not anonymous
      // DRAFT loads are incomplete by design — contact added before posting
      if (data.status === "POSTED" && !data.isAnonymous) {
        return !!data.shipperContactName && !!data.shipperContactPhone;
      }
      return true;
    },
    {
      message:
        "Contact name and phone are required when posting to marketplace (unless anonymous)",
      path: ["shipperContactName"],
    }
  );

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

    // §8: Wallet gate — block load creation if below minimum balance
    const walletBlock = await checkWalletGate(session);
    if (walletBlock) return walletBlock;

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

    // Sanitize user-provided text fields
    const sanitized = {
      ...validatedData,
      cargoDescription: sanitizeText(validatedData.cargoDescription, 2000),
      pickupAddress: validatedData.pickupAddress
        ? sanitizeText(validatedData.pickupAddress, 500)
        : undefined,
      deliveryAddress: validatedData.deliveryAddress
        ? sanitizeText(validatedData.deliveryAddress, 500)
        : undefined,
      safetyNotes: validatedData.safetyNotes
        ? sanitizeText(validatedData.safetyNotes, 1000)
        : undefined,
      specialInstructions: validatedData.specialInstructions
        ? sanitizeText(validatedData.specialInstructions, 2000)
        : undefined,
    };

    // G-M13-1: Server-side tripKm calculation when coordinates provided but tripKm missing
    let computedTripKm = sanitized.tripKm;
    if (
      computedTripKm == null &&
      sanitized.originLat != null &&
      sanitized.originLon != null &&
      sanitized.destinationLat != null &&
      sanitized.destinationLon != null
    ) {
      computedTripKm = Math.round(
        calculateDistanceKm(
          sanitized.originLat,
          sanitized.originLon,
          sanitized.destinationLat,
          sanitized.destinationLon
        )
      );
    }

    // Pricing is negotiated off-platform - platform only charges service fees
    const load = await db.load.create({
      data: {
        ...sanitized,
        tripKm: computedTripKm, // G-M13-1: use server-calculated tripKm if computed
        pickupDate: new Date(sanitized.pickupDate),
        deliveryDate: new Date(sanitized.deliveryDate),
        postedAt: sanitized.status === "POSTED" ? new Date() : null,
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

    // P3: Populate estimatedTripKm from corridor if not already set.
    // This ensures Trip creation picks up corridor distance via the existing
    // `estimatedDistanceKm: freshLoad.tripKm || freshLoad.estimatedTripKm` pattern.
    if (!load.estimatedTripKm && !computedTripKm) {
      const pickupCity = sanitized.pickupCity;
      const deliveryCity = sanitized.deliveryCity;
      if (pickupCity && deliveryCity) {
        const { findMatchingCorridor } =
          await import("@/lib/serviceFeeCalculation");
        const match = await findMatchingCorridor(pickupCity, deliveryCity);
        if (match && match.corridor.distanceKm > 0) {
          await db.load.update({
            where: { id: load.id },
            data: { estimatedTripKm: match.corridor.distanceKm },
          });
        }
      }
    }

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
    return handleApiError(error, "Create load error");
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

    const session = await requireActiveUser();

    // A4: Block carrier marketplace browsing if below minimum balance
    if (session.organizationId && session.role === "CARRIER") {
      const walletAccount = await db.financialAccount.findFirst({
        where: { organizationId: session.organizationId, isActive: true },
        select: { balance: true, minimumBalance: true },
      });
      if (
        walletAccount &&
        walletAccount.balance < walletAccount.minimumBalance
      ) {
        const oneDayAgo = new Date(Date.now() - 86_400_000);
        db.notification
          .findFirst({
            where: {
              userId: session.userId,
              type: NotificationType.LOW_BALANCE_WARNING,
              createdAt: { gte: oneDayAgo },
            },
          })
          .then((existing) => {
            if (!existing) {
              createNotification({
                userId: session.userId,
                type: NotificationType.LOW_BALANCE_WARNING,
                title: "Insufficient Wallet Balance",
                message: `Your wallet balance is below the required minimum (${Number(walletAccount.minimumBalance).toLocaleString()} ETB). Top up to restore marketplace access.`,
                metadata: {
                  currentBalance: Number(walletAccount.balance),
                  minimumBalance: Number(walletAccount.minimumBalance),
                },
              }).catch((err) => console.error("low-balance notify err", err));
            }
          })
          .catch(() => {});
        return NextResponse.json(
          { error: "Insufficient wallet balance for marketplace access" },
          { status: 402 }
        );
      }
    }

    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get("page") || "1");
    // Fix 37: Cap limit to prevent unbounded queries
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20"), 1),
      100
    );
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
    const minLength = searchParams.get("minLength");
    const minWeight = searchParams.get("minWeight");

    // G-M16-4: Server-side DH from TruckPosting — overrides raw DH params for CARRIER
    const truckPostingId = searchParams.get("truckPostingId");
    let carrierLat: number | undefined;
    let carrierLon: number | undefined;
    let dhOMaxKm: number | undefined;
    let destLat: number | undefined;
    let destLon: number | undefined;
    let dhDMaxKm: number | undefined;

    if (truckPostingId && session.role === "CARRIER") {
      // Fetch posting with ownership check
      const posting = await db.truckPosting.findUnique({
        where: { id: truckPostingId },
        select: {
          truck: { select: { carrierId: true } },
          preferredDhToOriginKm: true,
          preferredDhAfterDeliveryKm: true,
          originCityId: true,
          destinationCityId: true,
        },
      });

      if (posting && posting.truck.carrierId === session.organizationId) {
        // Fetch coordinates for posting's origin/destination cities
        const [originCity, destCity] = await Promise.all([
          posting.originCityId
            ? db.ethiopianLocation.findUnique({
                where: { id: posting.originCityId },
                select: { latitude: true, longitude: true },
              })
            : null,
          posting.destinationCityId
            ? db.ethiopianLocation.findUnique({
                where: { id: posting.destinationCityId },
                select: { latitude: true, longitude: true },
              })
            : null,
        ]);

        // DH-O: posting origin → load pickup
        if (
          originCity?.latitude != null &&
          originCity?.longitude != null &&
          posting.preferredDhToOriginKm != null
        ) {
          carrierLat = Number(originCity.latitude);
          carrierLon = Number(originCity.longitude);
          dhOMaxKm = Number(posting.preferredDhToOriginKm);
        }

        // DH-D: load delivery → posting destination
        if (
          destCity?.latitude != null &&
          destCity?.longitude != null &&
          posting.preferredDhAfterDeliveryKm != null
        ) {
          destLat = Number(destCity.latitude);
          destLon = Number(destCity.longitude);
          dhDMaxKm = Number(posting.preferredDhAfterDeliveryKm);
        }
      }
      // If posting not found or not owned, DH params stay undefined → no DH filter
    } else {
      // Legacy: raw DH params (non-CARRIER callers or no truckPostingId)
      const carrierLatRaw = searchParams.get("carrierLat");
      const carrierLonRaw = searchParams.get("carrierLon");
      const dhOMaxKmRaw = searchParams.get("dhOMaxKm");
      carrierLat = carrierLatRaw ? parseFloat(carrierLatRaw) : undefined;
      carrierLon = carrierLonRaw ? parseFloat(carrierLonRaw) : undefined;
      dhOMaxKm = dhOMaxKmRaw
        ? Math.min(Math.max(parseFloat(dhOMaxKmRaw), 1), 2000)
        : undefined;

      const destLatRaw = searchParams.get("destLat");
      const destLonRaw = searchParams.get("destLon");
      const dhDMaxKmRaw = searchParams.get("dhDMaxKm");
      destLat = destLatRaw ? parseFloat(destLatRaw) : undefined;
      destLon = destLonRaw ? parseFloat(destLonRaw) : undefined;
      dhDMaxKm = dhDMaxKmRaw
        ? Math.min(Math.max(parseFloat(dhDMaxKmRaw), 1), 2000)
        : undefined;
    }

    const hasDHOFilter =
      carrierLat !== undefined &&
      carrierLon !== undefined &&
      dhOMaxKm !== undefined &&
      !isNaN(carrierLat) &&
      !isNaN(carrierLon) &&
      !isNaN(dhOMaxKm) &&
      carrierLat >= -90 &&
      carrierLat <= 90 &&
      carrierLon >= -180 &&
      carrierLon <= 180;

    const hasDHDFilter =
      destLat !== undefined &&
      destLon !== undefined &&
      dhDMaxKm !== undefined &&
      !isNaN(destLat) &&
      !isNaN(destLon) &&
      !isNaN(dhDMaxKm) &&
      destLat >= -90 &&
      destLat <= 90 &&
      destLon >= -180 &&
      destLon <= 180;

    const needsGeoFilter = hasDHOFilter || hasDHDFilter;

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
      carrierLat,
      carrierLon,
      dhOMaxKm, // G-A6-1
      destLat,
      destLon,
      dhDMaxKm, // G-A6-2
      truckPostingId, // G-M16-4
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
    } else if (user?.role === "SHIPPER") {
      // Shippers ALWAYS see only their own loads — privacy rule
      if (user?.organizationId) {
        where.shipperId = user.organizationId;
      }
    } else if (myTrips) {
      // Carrier: Filter loads where assigned truck belongs to their organization
      if (user?.organizationId) {
        where.assignedTruck = {
          carrierId: user.organizationId,
        };
      }
    } else {
      // Blueprint: "ASSIGNED+ loads hidden" — POSTED, SEARCHING, OFFERED all visible
      where.status = { in: ["POSTED", "SEARCHING", "OFFERED"] };
    }

    // Allow status filter only for authenticated views (myLoads, myTrips, dispatcher)
    // Marketplace mode always forces POSTED
    if (status && (user?.role === "SHIPPER" || myTrips || isDispatcher)) {
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

    // G-W12-4: Carrier length/weight filters
    if (minLength) {
      const parsed = parseFloat(minLength);
      if (!isNaN(parsed) && parsed > 0) {
        where.lengthM = { lte: parsed };
      }
    }
    if (minWeight) {
      const parsed = parseFloat(minWeight);
      if (!isNaN(parsed) && parsed > 0) {
        where.weight = { lte: parsed };
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

    const loadSelect = {
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
    } as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let loads: any[];
    let total: number;

    if (needsGeoFilter) {
      // Fetch larger batch for in-memory geo filtering
      // Loads missing required coordinates are excluded from geo-filtered results
      const allDbLoads = await db.load.findMany({
        where,
        select: loadSelect,
        take: 500,
        orderBy,
      });

      const geoFiltered = allDbLoads.filter((load) => {
        if (hasDHOFilter) {
          const oLat = load.originLat ? Number(load.originLat) : null;
          const oLon = load.originLon ? Number(load.originLon) : null;
          if (oLat === null || oLon === null) return false;
          if (
            calculateDistanceKm(carrierLat!, carrierLon!, oLat, oLon) >
            dhOMaxKm!
          )
            return false;
        }
        if (hasDHDFilter) {
          const dLat = load.destinationLat ? Number(load.destinationLat) : null;
          const dLon = load.destinationLon ? Number(load.destinationLon) : null;
          if (dLat === null || dLon === null) return false;
          if (calculateDistanceKm(dLat, dLon, destLat!, destLon!) > dhDMaxKm!)
            return false;
        }
        return true;
      });

      total = geoFiltered.length;
      loads = geoFiltered.slice((page - 1) * limit, page * limit);
    } else {
      // Standard paginated path
      const result = await Promise.all([
        db.load.findMany({
          where,
          select: loadSelect,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
        }),
        db.load.count({ where }),
      ]);
      loads = result[0];
      total = result[1];
    }

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
    return handleApiError(error, "List loads error");
  }
}
