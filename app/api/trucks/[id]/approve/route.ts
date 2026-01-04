/**
 * Truck Approval API
 *
 * Sprint 18 - Admin Truck Approval
 *
 * Allows admins to approve or reject trucks submitted by carriers.
 * Only ADMIN and SUPER_ADMIN can approve trucks.
 *
 * POST: Approve or reject a truck
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { hasPermission, Permission } from '@/lib/rbac/permissions';
import { createNotification } from '@/lib/notifications';
import { UserRole } from '@prisma/client';

// Validation schema for truck approval
const TruckApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/trucks/[id]/approve
 *
 * Approve or reject a truck.
 *
 * Only ADMIN and SUPER_ADMIN can approve trucks.
 *
 * Request body:
 * - action: 'APPROVE' | 'REJECT'
 * - reason: string (optional, required for rejection)
 *
 * Returns: Updated truck
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: truckId } = await params;
    const session = await requireAuth();

    // Check admin permission
    if (!hasPermission(session.role as UserRole, Permission.VERIFY_DOCUMENTS)) {
      return NextResponse.json(
        { error: 'Only admins can approve trucks' },
        { status: 403 }
      );
    }

    // Get the truck
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
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

    // Validate request body
    const body = await request.json();
    const validationResult = TruckApprovalSchema.safeParse(body);

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

    // Require reason for rejection
    if (data.action === 'REJECT' && !data.reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    if (data.action === 'APPROVE') {
      // Approve the truck
      const updatedTruck = await db.truck.update({
        where: { id: truckId },
        data: {
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          approvedById: session.userId,
          rejectionReason: null,
        },
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Find carrier users to notify
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: truck.carrierId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Send in-app notifications
      for (const user of carrierUsers) {
        await createNotification({
          userId: user.id,
          type: 'TRUCK_APPROVED',
          title: 'Truck Approved',
          message: `Your truck ${truck.licensePlate} has been approved and is now available for posting.`,
          metadata: {
            truckId: truck.id,
            licensePlate: truck.licensePlate,
          },
        });
      }

      // TODO: Send email notification to carrier

      return NextResponse.json({
        truck: updatedTruck,
        message: 'Truck approved successfully',
      });
    } else {
      // Reject the truck
      const updatedTruck = await db.truck.update({
        where: { id: truckId },
        data: {
          approvalStatus: 'REJECTED',
          rejectionReason: data.reason,
        },
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Find carrier users to notify
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: truck.carrierId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Send in-app notifications
      for (const user of carrierUsers) {
        await createNotification({
          userId: user.id,
          type: 'TRUCK_REJECTED',
          title: 'Truck Rejected',
          message: `Your truck ${truck.licensePlate} has been rejected. Reason: ${data.reason}`,
          metadata: {
            truckId: truck.id,
            licensePlate: truck.licensePlate,
            reason: data.reason,
          },
        });
      }

      // TODO: Send email notification to carrier

      return NextResponse.json({
        truck: updatedTruck,
        message: 'Truck rejected',
      });
    }
  } catch (error) {
    console.error('Error approving/rejecting truck:', error);

    return NextResponse.json(
      { error: 'Failed to process truck approval' },
      { status: 500 }
    );
  }
}
