/**
 * Sprint 4: Dispatcher Escalation System
 * API endpoints for load escalations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateCSRFWithMobile } from '@/lib/csrf';
import { CacheInvalidation } from '@/lib/cache';
import { z } from 'zod';
import { validateStateTransition, LoadStatus } from '@/lib/loadStateMachine';
import { zodErrorResponse } from '@/lib/validation';
import { createNotification, notifyExceptionAssigned, createNotificationForRole } from '@/lib/notifications';

const createEscalationSchema = z.object({
  escalationType: z.enum([
    'LATE_PICKUP',
    'LATE_DELIVERY',
    'TRUCK_BREAKDOWN',
    'CARRIER_NO_SHOW',
    'ROUTE_DEVIATION',
    'GPS_OFFLINE',
    'CARGO_DAMAGE',
    'SHIPPER_ISSUE',
    'CARRIER_ISSUE',
    'DOCUMENTATION',
    'PAYMENT_DISPUTE',
    'BYPASS_DETECTED',
    'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(), // Optional dispatcher/admin to assign
});

// POST /api/loads/[id]/escalations - Create new escalation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C10 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { id: loadId } = await params;

    const body = await request.json();
    const validatedData = createEscalationSchema.parse(body);

    // Get load
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        assignedTruck: {
          select: {
            carrierId: true,
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

    // H2 FIX: Get user's organizationId for proper ownership check
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Permission check: Only involved parties + dispatchers + admins can create escalations
    // H2 FIX: Compare organizationId (not userId) with shipperId/carrierId
    const isShipper = session.role === 'SHIPPER' && load.shipperId === user?.organizationId;
    const isCarrier = session.role === 'CARRIER' && load.assignedTruck?.carrierId === user?.organizationId;
    const isDispatcher = session.role === 'DISPATCHER';
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isCarrier && !isDispatcher && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to create escalations for this load' },
        { status: 403 }
      );
    }

    // Auto-set priority based on escalation type
    let priority = validatedData.priority;
    if (validatedData.escalationType === 'CARRIER_NO_SHOW' ||
        validatedData.escalationType === 'TRUCK_BREAKDOWN') {
      priority = 'HIGH';
    } else if (validatedData.escalationType === 'BYPASS_DETECTED') {
      priority = 'CRITICAL';
    }

    // TD-004 FIX: Wrap all escalation operations in a transaction for atomicity
    const escalation = await db.$transaction(async (tx) => {
      // Create escalation
      const esc = await tx.loadEscalation.create({
        data: {
          loadId,
          escalationType: validatedData.escalationType,
          priority,
          title: validatedData.title,
          description: validatedData.description,
          notes: validatedData.notes,
          createdBy: session.userId,
          assignedTo: validatedData.assignedTo,
          assignedAt: validatedData.assignedTo ? new Date() : null,
          status: validatedData.assignedTo ? 'ASSIGNED' : 'OPEN',
        },
        include: {
          load: {
            select: {
              id: true,
              status: true,
              pickupCity: true,
              deliveryCity: true,
            },
          },
        },
      });

      // Create load event
      await tx.loadEvent.create({
        data: {
          loadId,
          eventType: 'ESCALATION_CREATED',
          description: `Escalation created: ${validatedData.title}`,
          userId: session.userId,
          metadata: {
            escalationId: esc.id,
            escalationType: validatedData.escalationType,
            priority,
          },
        },
      });

      // Update load status to EXCEPTION if not already
      if (load.status !== 'EXCEPTION' && load.status !== 'CANCELLED' && load.status !== 'COMPLETED') {
        // Validate state transition
        const stateValidation = validateStateTransition(
          load.status,
          LoadStatus.EXCEPTION,
          session.role
        );

        if (stateValidation.valid) {
          await tx.load.update({
            where: { id: loadId },
            data: { status: 'EXCEPTION' },
          });

          await tx.loadEvent.create({
            data: {
              loadId,
              eventType: 'STATUS_CHANGED',
              description: `Status changed to EXCEPTION due to escalation`,
              userId: session.userId,
            },
          });
        }
      }

      return esc;
    });

    // TD-006 FIX: Invalidate cache after escalation/EXCEPTION status change
    await CacheInvalidation.load(loadId, load.shipperId);

    // Send notification to assigned dispatcher
    if (validatedData.assignedTo) {
      await notifyExceptionAssigned({
        userId: validatedData.assignedTo,
        exceptionType: validatedData.escalationType,
        loadReference: `${load.id.substring(0, 8)}`,
        exceptionId: escalation.id,
      });
    }

    // Notify all dispatchers and admins about new escalation
    await createNotificationForRole({
      role: 'DISPATCHER',
      type: 'ESCALATION_ASSIGNED',
      title: `New ${priority} Escalation: ${validatedData.escalationType.replace(/_/g, ' ')}`,
      message: `Escalation "${validatedData.title}" created for load ${loadId.substring(0, 8)}. Priority: ${priority}.`,
      metadata: { escalationId: escalation.id, loadId, priority },
    });

    return NextResponse.json({
      message: 'Escalation created successfully',
      escalation,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    console.error('Escalation creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create escalation' },
      { status: 500 }
    );
  }
}

// GET /api/loads/[id]/escalations - List escalations for a load
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: loadId } = await params;

    // Get load to check permissions
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        shipperId: true,
        assignedTruck: {
          select: {
            carrierId: true,
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

    // Permission check
    const isShipper = session.role === 'SHIPPER' && load.shipperId === session.userId;
    const isCarrier = session.role === 'CARRIER' && load.assignedTruck?.carrierId === session.userId;
    const isDispatcher = session.role === 'DISPATCHER';
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isCarrier && !isDispatcher && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to view escalations for this load' },
        { status: 403 }
      );
    }

    // Get escalations
    const escalations = await db.loadEscalation.findMany({
      where: { loadId },
      orderBy: [
        { priority: 'desc' }, // CRITICAL first
        { createdAt: 'desc' },
      ],
      include: {
        load: {
          select: {
            id: true,
            status: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
      },
    });

    return NextResponse.json({
      escalations,
      count: escalations.length,
    });

  } catch (error) {
    console.error('Escalation fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escalations' },
      { status: 500 }
    );
  }
}
