/**
 * Load Request API
 *
 * Sprint 18 - Carrier requests load from shipper
 *
 * Allows carriers to request loads from shippers.
 * Shippers must approve before the load is assigned.
 *
 * POST: Create a load request (CARRIER only)
 * GET: List load requests
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification, NotificationType } from "@/lib/notifications";
import { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { CacheInvalidation } from "@/lib/cache";
import { validateWalletBalancesForTrip } from "@/lib/serviceFeeManagement";

// Validation schema for load request
// Note: No proposedRate field - price negotiation happens outside platform
const LoadRequestSchema = z.object({
  loadId: z.string().min(1, "Load ID is required"),
  truckId: z.string().min(1, "Truck ID is required"),
  notes: z.string().max(500).optional(),
  expiresInHours: z.number().min(1).max(72).default(24),
});

/**
 * POST /api/load-requests
 *
 * Create a load request (carrier requests a load from shipper).
 *
 * Only carriers can create load requests.
 * The shipper must approve before the load is assigned.
 *
 * Request body: LoadRequestSchema
 *
 * Returns: Created load request
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "load-requests",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    // H7 FIX: Add CSRF protection; M19 FIX: Use requireActiveUser
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    // BUG-2 FIX: Allow ADMIN/SUPER_ADMIN to create load requests on behalf of carriers
    if (!isAdmin && session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only carriers can request loads" },
        { status: 403 }
      );
    }

    if (!isAdmin && !session.organizationId) {
      return NextResponse.json(
        { error: "Carrier must belong to an organization" },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validationResult = LoadRequestSchema.safeParse(body);

    if (!validationResult.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Get the load
    const load = await db.load.findUnique({
      where: { id: data.loadId },
      include: {
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check load status - must be available
    const availableStatuses = ["POSTED", "SEARCHING", "OFFERED"];
    if (!availableStatuses.includes(load.status)) {
      return NextResponse.json(
        { error: `Load is not available (status: ${load.status})` },
        { status: 400 }
      );
    }

    // Check if load is already assigned
    if (load.assignedTruckId) {
      return NextResponse.json(
        { error: "Load is already assigned to a truck" },
        { status: 400 }
      );
    }

    // Get the truck
    const truck = await db.truck.findUnique({
      where: { id: data.truckId },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
        // G-A7-6: Fetch active trips to block requests for busy trucks.
        // G-A7-3: PICKUP_PENDING included — truck heading to pickup is already committed.
        // Uses trips (hasMany) rather than assignedLoad (one-to-one) for proper filtering.
        trips: {
          where: {
            status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // BUG-2 FIX: Admins act on behalf of the truck's carrier org.
    // For carriers, enforce that they own the truck.
    const effectiveCarrierId = isAdmin
      ? truck.carrierId
      : session.organizationId!;

    if (!isAdmin && truck.carrierId !== session.organizationId) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Verify truck is approved
    if (truck.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Truck must be approved before requesting loads" },
        { status: 400 }
      );
    }

    // G-A7-6: Reject requests for trucks already on an active trip.
    if (truck.trips.length > 0) {
      return NextResponse.json(
        {
          error:
            "Truck is currently on an active trip and cannot be used for load requests",
        },
        { status: 409 }
      );
    }

    // Check if truck has an active posting
    const activePosting = await db.truckPosting.findFirst({
      where: {
        truckId: data.truckId,
        status: "ACTIVE",
      },
    });

    if (!activePosting) {
      return NextResponse.json(
        { error: "Truck must have an active posting to request loads" },
        { status: 400 }
      );
    }

    // Check for existing pending request for same load-truck pair
    const existingRequest = await db.loadRequest.findFirst({
      where: {
        loadId: data.loadId,
        truckId: data.truckId,
        status: "PENDING",
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error:
            "A pending request already exists for this load-truck combination",
        },
        { status: 400 }
      );
    }

    // Validate wallet balances before creating the request
    const walletValidation = await validateWalletBalancesForTrip(
      data.loadId,
      effectiveCarrierId
    );
    if (!walletValidation.valid) {
      return NextResponse.json(
        {
          error: "Insufficient wallet balance to request this load",
          details: walletValidation.errors,
          fees: {
            shipperFee: walletValidation.shipperFee,
            carrierFee: walletValidation.carrierFee,
          },
        },
        { status: 400 }
      );
    }

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

    // Create the load request
    const loadRequest = await db.loadRequest.create({
      data: {
        loadId: data.loadId,
        truckId: data.truckId,
        carrierId: effectiveCarrierId,
        requestedById: session.userId,
        shipperId: load.shipperId!,
        notes: data.notes,
        // No proposedRate - price negotiation happens outside platform
        expiresAt,
      },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            truckType: true,
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: data.loadId,
        eventType: "LOAD_REQUESTED",
        description: `Carrier ${truck.carrier.name} requested this load with truck ${truck.licensePlate}`,
        userId: session.userId,
        metadata: {
          loadRequestId: loadRequest.id,
          truckId: data.truckId,
          carrierId: effectiveCarrierId,
        },
      },
    });

    // G-A9-3: Transition load POSTED → SEARCHING ("active carrier search in progress")
    if (load.status === "POSTED") {
      await db.load.update({
        where: { id: data.loadId },
        data: { status: "SEARCHING" },
      });
    }

    // Notify shipper users
    const shipperUsers = await db.user.findMany({
      where: {
        organizationId: load.shipperId!,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await Promise.all(
      shipperUsers.map((user) =>
        createNotification({
          userId: user.id,
          type: NotificationType.LOAD_REQUEST_RECEIVED,
          title: "New Load Request",
          message: `${truck.carrier.name} wants to haul your load from ${load.pickupCity} to ${load.deliveryCity}`,
          metadata: {
            loadRequestId: loadRequest.id,
            loadId: data.loadId,
            truckId: data.truckId,
            carrierName: truck.carrier.name,
          },
        })
      )
    );

    // Invalidate load cache after request creation
    await CacheInvalidation.load(data.loadId);

    return NextResponse.json(
      {
        loadRequest,
        message: "Load request sent to shipper",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Error creating load request");
  }
}

/**
 * GET /api/load-requests
 *
 * List load requests based on user role.
 *
 * - Carriers see their own requests
 * - Shippers see requests for their loads
 * - Admins see all requests
 *
 * Query params:
 * - status: filter by status
 * - loadId: filter by load
 * - truckId: filter by truck
 * - limit: max results (default 50, max 100)
 * - offset: pagination offset
 *
 * Returns: Array of load requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const loadId = searchParams.get("loadId");
    const truckId = searchParams.get("truckId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause based on role
    const where: Prisma.LoadRequestWhereInput = {};

    if (session.role === "CARRIER") {
      // Carriers see their own requests
      where.carrierId = session.organizationId;
    } else if (session.role === "SHIPPER") {
      // Shippers see requests for their loads
      where.shipperId = session.organizationId;
    } else if (session.role === "DISPATCHER") {
      // G-A9-4: Dispatchers have full platform visibility (blueprint §5) — no org filter
    } else if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Apply filters
    if (status) {
      where.status = status as Prisma.EnumRequestStatusFilter;
    }
    if (loadId) {
      where.loadId = loadId;
    }
    if (truckId) {
      where.truckId = truckId;
    }

    const [loadRequests, total] = await Promise.all([
      db.loadRequest.findMany({
        where,
        include: {
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
              pickupDate: true,
              truckType: true,
              status: true,
            },
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              truckType: true,
            },
          },
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
          shipper: {
            select: {
              id: true,
              name: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.loadRequest.count({ where }),
    ]);

    return NextResponse.json({
      loadRequests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + loadRequests.length < total,
      },
    });
  } catch (error) {
    return handleApiError(error, "Error fetching load requests");
  }
}
