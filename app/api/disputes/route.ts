/**
 * Disputes API
 * Sprint 6 - Story 6.4: Dispute Management
 *
 * Create and manage disputes for loads
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { zodErrorResponse } from '@/lib/validation';
import { Prisma } from '@prisma/client';

const createDisputeSchema = z.object({
  loadId: z.string(),
  type: z.enum(['PAYMENT_ISSUE', 'DAMAGE', 'LATE_DELIVERY', 'OTHER']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  evidence: z.string().optional(),
});

/**
 * POST /api/disputes
 * Create a new dispute
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const validatedData = createDisputeSchema.parse(body);

    // Verify load exists and user has access
    const load = await db.load.findUnique({
      where: { id: validatedData.loadId },
      include: {
        shipper: { select: { id: true } },
        assignedTruck: {
          select: {
            carrier: { select: { id: true } },
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Check if user is shipper or carrier for this load
    const isShipper = load.shipper?.id === session.organizationId;
    const isCarrier = load.assignedTruck?.carrier?.id === session.organizationId;

    if (!isShipper && !isCarrier) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this load' },
        { status: 403 }
      );
    }

    // Create dispute
    const dispute = await db.dispute.create({
      data: {
        loadId: validatedData.loadId,
        createdById: session.userId,
        disputedOrgId: session.organizationId!,
        type: validatedData.type,
        description: validatedData.description,
        evidenceUrls: validatedData.evidence ? [validatedData.evidence] : [],
        status: 'OPEN',
      },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Dispute created successfully',
      dispute,
    });
  // FIX: Use unknown type with type guards
  } catch (error: unknown) {
    console.error('Error creating dispute:', error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to create dispute' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/disputes
 * Get disputes for current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const loadId = searchParams.get('loadId');

    // Build where clause
    const where: Prisma.DisputeWhereInput = {
      OR: [
        { disputedOrgId: session.organizationId },
        {
          load: {
            OR: [
              { shipperId: session.organizationId },
              {
                assignedTruck: {
                  carrierId: session.organizationId,
                },
              },
            ],
          },
        },
      ],
    };

    if (status) {
      where.status = status as Prisma.EnumDisputeStatusFilter;
    }

    if (loadId) {
      where.loadId = loadId;
    }

    const disputes = await db.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        disputedOrg: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ disputes });
  // FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error('Error fetching disputes:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}
