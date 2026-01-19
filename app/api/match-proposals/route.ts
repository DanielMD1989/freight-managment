/**
 * Match Proposals API
 *
 * Phase 2 - Foundation Rule: DISPATCHER_COORDINATION_ONLY
 *
 * Allows dispatchers to propose load-truck matches.
 * Carrier must approve before assignment happens.
 *
 * POST: Create a new proposal (DISPATCHER only)
 * GET: List proposals (filtered by role)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, requireActiveUser } from '@/lib/auth';
import { requireCSRF } from '@/lib/csrf';
import { canProposeMatch } from '@/lib/dispatcherPermissions';
import { RULE_DISPATCHER_COORDINATION_ONLY } from '@/lib/foundation-rules';
import { UserRole } from '@prisma/client';
import { createNotification, NotificationType } from '@/lib/notifications';

// Validation schema for match proposal
const MatchProposalSchema = z.object({
  loadId: z.string().min(10),
  truckId: z.string().min(10),
  notes: z.string().max(500).optional(),
  proposedRate: z.number().positive().optional(),
  expiresInHours: z.number().min(1).max(72).default(24), // Default 24 hours expiry
});

/**
 * POST /api/match-proposals
 *
 * Create a new match proposal.
 *
 * Phase 2 Foundation Rule: DISPATCHER_COORDINATION_ONLY
 * - Only dispatchers (and admin) can create proposals
 * - Carrier must approve before load is assigned
 *
 * Request body: MatchProposalSchema
 *
 * Returns: Created match proposal object
 */
export async function POST(request: NextRequest) {
  try {
    // Require ACTIVE user status for creating proposals
    const session = await requireActiveUser();

    // CSRF protection for state-changing operation
    const csrfError = await requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check if user can propose matches
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canProposeMatch(user)) {
      return NextResponse.json(
        {
          error: 'You do not have permission to create match proposals',
          rule: RULE_DISPATCHER_COORDINATION_ONLY.id,
          hint: 'Only dispatchers and admins can propose matches',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = MatchProposalSchema.safeParse(body);

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

    // Validate load exists and is in a proposable state
    const load = await db.load.findUnique({
      where: { id: data.loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        assignedTruckId: true,
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Only allow proposals for loads that are not yet assigned
    const proposableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
    if (!proposableStatuses.includes(load.status)) {
      return NextResponse.json(
        {
          error: `Cannot propose match for load with status ${load.status}`,
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

    // Validate truck exists and is available
    const truck = await db.truck.findUnique({
      where: { id: data.truckId },
      select: {
        id: true,
        carrierId: true,
        isAvailable: true,
        licensePlate: true,
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // Check if there's already a pending proposal for this load-truck pair
    const existingProposal = await db.matchProposal.findFirst({
      where: {
        loadId: data.loadId,
        truckId: data.truckId,
        status: 'PENDING',
      },
    });

    if (existingProposal) {
      return NextResponse.json(
        {
          error: 'A pending proposal already exists for this load-truck pair',
          existingProposalId: existingProposal.id,
        },
        { status: 409 }
      );
    }

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

    // Create the proposal
    const proposal = await db.matchProposal.create({
      data: {
        loadId: data.loadId,
        truckId: data.truckId,
        carrierId: truck.carrierId,
        proposedById: session.userId,
        notes: data.notes,
        proposedRate: data.proposedRate,
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

    // Notify carrier users about the proposal
    const carrierUsers = await db.user.findMany({
      where: { organizationId: truck.carrierId, isActive: true },
      select: { id: true },
    });

    await Promise.all(
      carrierUsers.map((user) =>
        createNotification({
          userId: user.id,
          type: 'MATCH_PROPOSAL',
          title: 'New Load Match Proposal',
          message: `A dispatcher has proposed truck ${proposal.truck.licensePlate} for a load from ${proposal.load.pickupCity} to ${proposal.load.deliveryCity}`,
          metadata: {
            proposalId: proposal.id,
            loadId: proposal.loadId,
            truckId: proposal.truckId,
          },
        })
      )
    );

    return NextResponse.json(
      {
        proposal,
        message: 'Match proposal created. Awaiting carrier approval.',
        rule: RULE_DISPATCHER_COORDINATION_ONLY.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating match proposal:', error);

    return NextResponse.json(
      { error: 'Failed to create match proposal' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/match-proposals
 *
 * List match proposals with filtering based on role.
 *
 * Query parameters:
 * - status: Filter by status (PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED)
 * - loadId: Filter by load
 * - truckId: Filter by truck
 * - carrierId: Filter by carrier
 * - limit: Max results (default: 20, max: 100)
 * - offset: Pagination offset
 *
 * Returns: { proposals: [], total: number, limit: number, offset: number }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const loadId = searchParams.get('loadId');
    const truckId = searchParams.get('truckId');
    const carrierId = searchParams.get('carrierId');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Pagination
    const limit = Math.min(parseInt(limitParam || '20', 10), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10), 0);

    // Build where clause based on role
    const where: any = {};

    // Role-based filtering
    if (session.role === 'CARRIER') {
      // Carriers see proposals for their organization
      where.carrierId = session.organizationId;
    } else if (session.role === 'DISPATCHER') {
      // Dispatchers see proposals they created
      where.proposedById = session.userId;
    }
    // Admins see all proposals

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

    if (carrierId && (session.role === 'ADMIN' || session.role === 'SUPER_ADMIN')) {
      where.carrierId = carrierId;
    }

    // Fetch proposals
    const [proposals, total] = await Promise.all([
      db.matchProposal.findMany({
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
          carrier: {
            select: {
              name: true,
            },
          },
          proposedBy: {
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
      db.matchProposal.count({ where }),
    ]);

    return NextResponse.json({
      proposals,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching match proposals:', error);

    return NextResponse.json(
      { error: 'Failed to fetch match proposals' },
      { status: 500 }
    );
  }
}
