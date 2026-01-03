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
    const session = await requireAuth(request);
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
        raisedById: session.userId,
        raisedByOrganizationId: session.organizationId!,
        type: validatedData.type,
        description: validatedData.description,
        evidence: validatedData.evidence,
        status: 'OPEN',
      },
      include: {
        load: {
          select: {
            id: true,
            loadNumber: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        raisedBy: {
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
  } catch (error: any) {
    console.error('Error creating dispute:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    if (error.message === 'Unauthorized') {
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
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const loadId = searchParams.get('loadId');

    // Build where clause
    const where: any = {
      OR: [
        { raisedByOrganizationId: session.organizationId },
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
      where.status = status;
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
            loadNumber: true,
            pickupCity: true,
            deliveryCity: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ disputes });
  } catch (error: any) {
    console.error('Error fetching disputes:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}
