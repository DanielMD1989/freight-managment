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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { requireCSRF } from '@/lib/csrf';
import { createNotification } from '@/lib/notifications';
import { UserRole } from '@prisma/client';

// Validation schema for load request
const LoadRequestSchema = z.object({
  loadId: z.string().min(1, 'Load ID is required'),
  truckId: z.string().min(1, 'Truck ID is required'),
  notes: z.string().max(500).optional(),
  proposedRate: z.number().positive().optional(),
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
    const session = await requireAuth();

    // CSRF protection for state-changing operation
    const csrfError = await requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Only carriers can request loads
    if (session.role !== 'CARRIER') {
      return NextResponse.json(
        { error: 'Only carriers can request loads' },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'Carrier must belong to an organization' },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validationResult = LoadRequestSchema.safeParse(body);

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
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check load status - must be available
    const availableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
    if (!availableStatuses.includes(load.status)) {
      return NextResponse.json(
        { error: `Load is not available (status: ${load.status})` },
        { status: 400 }
      );
    }

    // Check if load is already assigned
    if (load.assignedTruckId) {
      return NextResponse.json(
        { error: 'Load is already assigned to a truck' },
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
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // Verify carrier owns the truck
    if (truck.carrierId !== session.organizationId) {
      return NextResponse.json(
        { error: 'You can only request loads for your own trucks' },
        { status: 403 }
      );
    }

    // Verify truck is approved
    if (truck.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Truck must be approved before requesting loads' },
        { status: 400 }
      );
    }

    // Check if truck has an active posting
    const activePosting = await db.truckPosting.findFirst({
      where: {
        truckId: data.truckId,
        status: 'ACTIVE',
      },
    });

    if (!activePosting) {
      return NextResponse.json(
        { error: 'Truck must have an active posting to request loads' },
        { status: 400 }
      );
    }

    // Check for existing pending request for same load-truck pair
    const existingRequest = await db.loadRequest.findFirst({
      where: {
        loadId: data.loadId,
        truckId: data.truckId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending request already exists for this load-truck combination' },
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
        carrierId: session.organizationId,
        requestedById: session.userId,
        shipperId: load.shipperId!,
        notes: data.notes,
        proposedRate: data.proposedRate,
        expiresAt,
      },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            truckType: true,
            rate: true,
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
        eventType: 'LOAD_REQUESTED',
        description: `Carrier ${truck.carrier.name} requested this load with truck ${truck.licensePlate}`,
        userId: session.userId,
        metadata: {
          loadRequestId: loadRequest.id,
          truckId: data.truckId,
          carrierId: session.organizationId,
        },
      },
    });

    // Notify shipper users
    const shipperUsers = await db.user.findMany({
      where: {
        organizationId: load.shipperId!,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const user of shipperUsers) {
      await createNotification({
        userId: user.id,
        type: 'LOAD_REQUEST_RECEIVED',
        title: 'New Load Request',
        message: `${truck.carrier.name} wants to haul your load from ${load.pickupCity} to ${load.deliveryCity}`,
        metadata: {
          loadRequestId: loadRequest.id,
          loadId: data.loadId,
          truckId: data.truckId,
          carrierName: truck.carrier.name,
        },
      });
    }

    return NextResponse.json({
      loadRequest,
      message: 'Load request sent to shipper',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating load request:', error);

    return NextResponse.json(
      { error: 'Failed to create load request' },
      { status: 500 }
    );
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
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const loadId = searchParams.get('loadId');
    const truckId = searchParams.get('truckId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause based on role
    const where: any = {};

    if (session.role === 'CARRIER') {
      // Carriers see their own requests
      where.carrierId = session.organizationId;
    } else if (session.role === 'SHIPPER') {
      // Shippers see requests for their loads
      where.shipperId = session.organizationId;
    } else if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Apply filters
    if (status) {
      where.status = status;
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
              rate: true,
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
        orderBy: { createdAt: 'desc' },
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
    console.error('Error fetching load requests:', error);

    return NextResponse.json(
      { error: 'Failed to fetch load requests' },
      { status: 500 }
    );
  }
}
