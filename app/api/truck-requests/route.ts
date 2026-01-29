/**
 * Truck Requests API
 *
 * Phase 2 - Shipper-led matching workflow
 *
 * Allows shippers to request specific trucks for their loads.
 * Carrier must approve before assignment happens.
 *
 * POST: Create a new request (SHIPPER only for own loads)
 * GET: List requests (filtered by role)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { requireCSRF } from '@/lib/csrf';
import { canRequestTruck } from '@/lib/dispatcherPermissions';
import { RULE_CARRIER_FINAL_AUTHORITY, RULE_SHIPPER_DEMAND_FOCUS } from '@/lib/foundation-rules';
import { UserRole } from '@prisma/client';
import { notifyTruckRequest } from '@/lib/notifications';

// Validation schema for truck request
// Note: No offeredRate field - price negotiation happens outside platform
const TruckRequestSchema = z.object({
  loadId: z.string().min(10),
  truckId: z.string().min(10),
  notes: z.string().max(500).optional(),
  expiresInHours: z.number().min(1).max(72).default(24), // Default 24 hours expiry
});

/**
 * POST /api/truck-requests
 *
 * Create a new truck request.
 *
 * Phase 2 Foundation Rules:
 * - SHIPPER_DEMAND_FOCUS: Shippers can request available trucks
 * - CARRIER_FINAL_AUTHORITY: Carrier must approve
 *
 * Request body: TruckRequestSchema
 *
 * Returns: Created truck request object
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuth();

    // CSRF protection for state-changing operation
    // Skip for mobile clients using Bearer token authentication (no cookies)
    // Bearer tokens are inherently CSRF-safe as attackers cannot add Authorization headers cross-origin
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const body = await request.json();

    // Validate input
    const validationResult = TruckRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Validate load exists and belongs to shipper
    const load = await db.load.findUnique({
      where: { id: data.loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        assignedTruckId: true,
        shipper: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check if user can request trucks for this load
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canRequestTruck(user, load.shipperId)) {
      return NextResponse.json(
        {
          error: 'You can only request trucks for your own loads',
          rule: RULE_SHIPPER_DEMAND_FOCUS.id,
        },
        { status: 403 }
      );
    }

    // Only allow requests for loads that are not yet assigned
    const requestableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
    if (!requestableStatuses.includes(load.status)) {
      return NextResponse.json(
        {
          error: `Cannot request truck for load with status ${load.status}`,
          hint: 'Load must be in POSTED, SEARCHING, or OFFERED status',
        },
        { status: 400 }
      );
    }

    if (load.assignedTruckId) {
      return NextResponse.json(
        { error: 'Load is already assigned to a truck' },
        { status: 400 }
      );
    }

    // Validate truck exists and is posted (available)
    const truck = await db.truck.findUnique({
      where: { id: data.truckId },
      select: {
        id: true,
        carrierId: true,
        isAvailable: true,
        licensePlate: true,
        postings: {
          where: { status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // Check if truck has an active posting (is available)
    if (truck.postings.length === 0) {
      return NextResponse.json(
        {
          error: 'Truck is not currently posted as available',
          hint: 'You can only request trucks that have active postings',
        },
        { status: 400 }
      );
    }

    // Check if there's already a pending request for this load-truck pair
    const existingRequest = await db.truckRequest.findFirst({
      where: {
        loadId: data.loadId,
        truckId: data.truckId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'A pending request already exists for this load-truck pair',
          existingRequestId: existingRequest.id,
        },
        { status: 409 }
      );
    }

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

    // Create the request
    const truckRequest = await db.truckRequest.create({
      data: {
        loadId: data.loadId,
        truckId: data.truckId,
        shipperId: load.shipperId,
        requestedById: session.userId,
        carrierId: truck.carrierId,
        notes: data.notes,
        // No offeredRate - price negotiation happens outside platform
        expiresAt,
        status: 'PENDING',
      },
      include: {
        load: {
          select: {
            pickupCity: true,
            deliveryCity: true,
            pickupDate: true,
            weight: true,
            truckType: true,
          },
        },
        truck: {
          select: {
            licensePlate: true,
            truckType: true,
            capacity: true,
          },
        },
        carrier: {
          select: {
            name: true,
          },
        },
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: data.loadId,
        eventType: 'TRUCK_REQUESTED',
        description: `Truck ${truck.licensePlate} requested for this load. Awaiting carrier approval.`,
        userId: session.userId,
        metadata: {
          requestId: truckRequest.id,
          truckId: data.truckId,
        },
      },
    });

    // Send notification to carrier about the request
    notifyTruckRequest({
      carrierId: truck.carrierId,
      shipperName: load.shipper?.name || 'Shipper',
      loadReference: `LOAD-${data.loadId.slice(-8).toUpperCase()}`,
      truckPlate: truck.licensePlate,
      requestId: truckRequest.id,
    }).catch((err) => console.error('Failed to send notification:', err));

    return NextResponse.json(
      {
        request: truckRequest,
        message: 'Truck request created. Awaiting carrier approval.',
        rule: RULE_CARRIER_FINAL_AUTHORITY.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating truck request:', error);

    return NextResponse.json(
      { error: 'Failed to create truck request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/truck-requests
 *
 * List truck requests with filtering based on role.
 *
 * Query parameters:
 * - status: Filter by status (PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED)
 * - loadId: Filter by load
 * - truckId: Filter by truck
 * - limit: Max results (default: 20, max: 100)
 * - offset: Pagination offset
 *
 * Returns: { requests: [], total: number, limit: number, offset: number }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const loadId = searchParams.get('loadId');
    const truckId = searchParams.get('truckId');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Pagination
    const limit = Math.min(parseInt(limitParam || '20', 10), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10), 0);

    // Build where clause based on role
    const where: any = {};

    // Role-based filtering
    if (session.role === 'SHIPPER') {
      // Shippers see their own requests
      where.shipperId = session.organizationId;
    } else if (session.role === 'CARRIER') {
      // Carriers see requests for their trucks
      where.carrierId = session.organizationId;
    }
    // Admins and dispatchers see all requests

    // Apply additional filters
    if (status) {
      where.status = status;
    }

    if (loadId) {
      where.loadId = loadId;
    }

    if (truckId) {
      where.truckId = truckId;
    }

    // Fetch requests
    const [requests, total] = await Promise.all([
      db.truckRequest.findMany({
        where,
        include: {
          load: {
            select: {
              pickupCity: true,
              deliveryCity: true,
              pickupDate: true,
              weight: true,
              truckType: true,
              status: true,
            },
          },
          truck: {
            select: {
              licensePlate: true,
              truckType: true,
              capacity: true,
            },
          },
          shipper: {
            select: {
              name: true,
            },
          },
          carrier: {
            select: {
              name: true,
            },
          },
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      db.truckRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching truck requests:', error);

    return NextResponse.json(
      { error: 'Failed to fetch truck requests' },
      { status: 500 }
    );
  }
}
