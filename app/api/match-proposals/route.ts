export const dynamic = "force-dynamic";
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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma, UserRole, ProposalStatus } from "@prisma/client";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { canProposeMatch } from "@/lib/dispatcherPermissions";
import { RULE_DISPATCHER_COORDINATION_ONLY } from "@/lib/foundation-rules";
import { createNotification } from "@/lib/notifications";
import { zodErrorResponse } from "@/lib/validation";
import { handleApiError } from "@/lib/apiErrors";
import { CacheInvalidation } from "@/lib/cache";

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

    // Fix 2f: Consolidated CSRF with mobile bypass (was bare requireCSRF, broke mobile dispatchers)
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Check if user can propose matches
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canProposeMatch(user)) {
      return NextResponse.json(
        {
          error: "You do not have permission to create match proposals",
          rule: RULE_DISPATCHER_COORDINATION_ONLY.id,
          hint: "Only dispatchers and admins can propose matches",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = MatchProposalSchema.safeParse(body);

    // H9 FIX: Use zodErrorResponse to prevent schema detail leakage
    if (!validationResult.success) {
      return zodErrorResponse(validationResult.error);
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
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Only allow proposals for loads that are not yet assigned
    const proposableStatuses = ["POSTED", "SEARCHING", "OFFERED"];
    if (!proposableStatuses.includes(load.status)) {
      return NextResponse.json(
        {
          error: `Cannot propose match for load with status ${load.status}`,
          hint: "Load must be in POSTED, SEARCHING, or OFFERED status",
        },
        { status: 400 }
      );
    }

    if (load.assignedTruckId) {
      return NextResponse.json(
        { error: "Load is already assigned to a truck" },
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
        approvalStatus: true,
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Only approved trucks can be proposed for matches
    if (truck.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved trucks can be proposed for matches" },
        { status: 400 }
      );
    }

    // Truck must be available
    if (!truck.isAvailable) {
      return NextResponse.json(
        { error: "Truck is not currently available" },
        { status: 400 }
      );
    }

    // G-M17-4: Reject proposals for trucks already on an active trip
    const activeTripCount = await db.trip.count({
      where: {
        truckId: data.truckId,
        status: {
          in: [
            "ASSIGNED",
            "PICKUP_PENDING",
            "IN_TRANSIT",
            "DELIVERED",
            "EXCEPTION",
          ],
        },
      },
    });
    if (activeTripCount > 0) {
      return NextResponse.json(
        { error: "Truck is currently on an active trip" },
        { status: 409 }
      );
    }

    // Check if there's already a pending proposal for this load-truck pair
    const existingProposal = await db.matchProposal.findFirst({
      where: {
        loadId: data.loadId,
        truckId: data.truckId,
        status: "PENDING",
      },
    });

    if (existingProposal) {
      // H10 FIX: Don't leak proposal ID in error response
      return NextResponse.json(
        { error: "A pending proposal already exists for this load-truck pair" },
        { status: 409 }
      );
    }

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

    // Create the proposal
    // G-M14-3: Partial unique index enforces one PENDING per (loadId, truckId)
    let proposal;
    try {
      proposal = await db.matchProposal.create({
        data: {
          loadId: data.loadId,
          truckId: data.truckId,
          carrierId: truck.carrierId,
          proposedById: session.userId,
          notes: data.notes,
          proposedRate: data.proposedRate,
          expiresAt,
          status: "PENDING",
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A pending request already exists for this load and truck" },
          { status: 409 }
        );
      }
      throw error;
    }

    // Notify carrier users about the proposal
    const carrierUsers = await db.user.findMany({
      where: { organizationId: truck.carrierId, status: "ACTIVE" },
      select: { id: true },
    });

    await Promise.all(
      carrierUsers.map((user) =>
        createNotification({
          userId: user.id,
          type: "MATCH_PROPOSAL",
          title: "New Load Match Proposal",
          message: `A dispatcher has proposed truck ${proposal.truck.licensePlate} for a load from ${proposal.load.pickupCity} to ${proposal.load.deliveryCity}`,
          metadata: {
            proposalId: proposal.id,
            loadId: proposal.loadId,
            truckId: proposal.truckId,
          },
        })
      )
    );

    // Notify shipper org too — dispatcher proposed a match for their load
    if (load.shipperId) {
      const shipperUsers = await db.user.findMany({
        where: { organizationId: load.shipperId, status: "ACTIVE" },
        select: { id: true },
      });
      await Promise.all(
        shipperUsers.map((u) =>
          createNotification({
            userId: u.id,
            type: "MATCH_PROPOSAL",
            title: "Truck Matched to Your Load",
            message: `A dispatcher has matched truck ${proposal.truck.licensePlate} to your load from ${proposal.load.pickupCity} to ${proposal.load.deliveryCity}`,
            metadata: {
              proposalId: proposal.id,
              loadId: proposal.loadId,
              truckId: proposal.truckId,
            },
          })
        )
      );
    }

    // Fix 8b: Cache invalidation after match proposal creation
    await CacheInvalidation.load(data.loadId);

    return NextResponse.json(
      {
        proposal,
        message: "Match proposal created. Awaiting carrier approval.",
        rule: RULE_DISPATCHER_COORDINATION_ONLY.id,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Error creating match proposal");
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
    const session = await requireActiveUser();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const loadId = searchParams.get("loadId");
    const truckId = searchParams.get("truckId");
    const carrierId = searchParams.get("carrierId");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    // Pagination (NaN guard: parseInt("abc") returns NaN, fallback to defaults)
    const limit = Math.min(parseInt(limitParam || "20", 10) || 20, 100);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // H7 FIX: Use typed where clause instead of any
    const where: Prisma.MatchProposalWhereInput = {};

    // H11 FIX: Role-based filtering - handle all roles explicitly
    if (session.role === "CARRIER") {
      // Carriers see proposals for their organization
      where.carrierId = session.organizationId;
    } else if (session.role === "DISPATCHER") {
      // Dispatchers see all proposals (for follow-up coordination)
    } else if (session.role === "SHIPPER") {
      // H11 FIX: Shippers can only see proposals for their own loads
      where.load = { shipperId: session.organizationId };
    }
    // Admins/SUPER_ADMIN see all proposals

    // Apply additional filters
    // H7 FIX: Cast status to ProposalStatus enum for type safety
    if (
      status &&
      Object.values(ProposalStatus).includes(status as ProposalStatus)
    ) {
      where.status = status as ProposalStatus;
    }

    if (loadId) {
      where.loadId = loadId;
    }

    if (truckId) {
      where.truckId = truckId;
    }

    if (
      carrierId &&
      (session.role === "ADMIN" || session.role === "SUPER_ADMIN")
    ) {
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
          createdAt: "desc",
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
    return handleApiError(error, "Error fetching match proposals");
  }
}
