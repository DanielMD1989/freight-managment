/**
 * Load Duplicate API
 *
 * POST /api/loads/[id]/duplicate
 *
 * Duplicates an existing load with a new ID, useful for creating similar loads.
 *
 * Sprint 2 - Story 2.3: Load Listing & Editing
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, Permission } from '@/lib/rbac';

/**
 * POST /api/loads/[id]/duplicate
 *
 * Duplicates a load, creating a new DRAFT load with the same details.
 *
 * Returns:
 * {
 *   load: Load
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require permission to post loads
    const session = await requirePermission(Permission.POST_LOADS);

    // Find original load
    const originalLoad = await db.load.findUnique({
      where: { id },
    });

    if (!originalLoad) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Verify ownership or admin access
    if (
      originalLoad.shipperId !== session.organizationId &&
      session.role !== 'ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Forbidden: You can only duplicate your own loads' },
        { status: 403 }
      );
    }

    // Create duplicate load
    const duplicateLoad = await db.load.create({
      data: {
        // Copy all fields except unique identifiers and status
        status: 'DRAFT',
        // Reset Sprint 14 DAT-style fields
        isKept: false,
        hasAlerts: false,
        groupId: null,
        pickupCity: originalLoad.pickupCity,
        pickupCityId: originalLoad.pickupCityId,
        pickupAddress: originalLoad.pickupAddress,
        pickupDockHours: originalLoad.pickupDockHours,
        pickupDate: originalLoad.pickupDate,
        appointmentRequired: originalLoad.appointmentRequired,
        deliveryCity: originalLoad.deliveryCity,
        deliveryCityId: originalLoad.deliveryCityId,
        deliveryAddress: originalLoad.deliveryAddress,
        deliveryDockHours: originalLoad.deliveryDockHours,
        deliveryDate: originalLoad.deliveryDate,
        tripKm: originalLoad.tripKm,
        dhToOriginKm: originalLoad.dhToOriginKm,
        dhAfterDeliveryKm: originalLoad.dhAfterDeliveryKm,
        originLat: originalLoad.originLat,
        originLon: originalLoad.originLon,
        destinationLat: originalLoad.destinationLat,
        destinationLon: originalLoad.destinationLon,
        truckType: originalLoad.truckType,
        weight: originalLoad.weight,
        volume: originalLoad.volume,
        cargoDescription: originalLoad.cargoDescription,
        isFullLoad: originalLoad.isFullLoad,
        fullPartial: originalLoad.fullPartial,
        isFragile: originalLoad.isFragile,
        requiresRefrigeration: originalLoad.requiresRefrigeration,
        lengthM: originalLoad.lengthM,
        casesCount: originalLoad.casesCount,
        rate: originalLoad.rate,
        currency: originalLoad.currency,
        bookMode: originalLoad.bookMode,
        isAnonymous: originalLoad.isAnonymous,
        shipperContactName: originalLoad.shipperContactName,
        shipperContactPhone: originalLoad.shipperContactPhone,
        safetyNotes: originalLoad.safetyNotes,
        specialInstructions: originalLoad.specialInstructions,
        // Set new ownership
        shipperId: session.organizationId!,
        createdById: session.userId,
        // Reset escrow and assignment
        escrowFunded: false,
        escrowAmount: null,
        shipperCommission: null,
        carrierCommission: null,
        platformCommission: null,
        assignedTruckId: null,
        assignedAt: null,
        postedAt: null,
        expiresAt: null,
      },
      include: {
        pickupLocation: true,
        deliveryLocation: true,
        shipper: true,
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

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: duplicateLoad.id,
        eventType: 'DUPLICATED',
        description: `Load duplicated from load ${id}`,
        userId: session.userId,
        metadata: {
          originalLoadId: id,
        },
      },
    });

    return NextResponse.json({
      message: 'Load duplicated successfully',
      load: duplicateLoad,
    });
  } catch (error: any) {
    console.error('Error duplicating load:', error);

    return NextResponse.json(
      { error: 'Failed to duplicate load' },
      { status: 500 }
    );
  }
}
