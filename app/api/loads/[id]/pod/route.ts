/**
 * Proof of Delivery (POD) Upload API
 *
 * Allows carriers to upload POD documents after delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateCSRFWithMobile } from '@/lib/csrf';
import { CacheInvalidation } from '@/lib/cache';
import { createNotification, NotificationType } from '@/lib/notifications';
import { uploadPOD } from '@/lib/storage';

/**
 * POST /api/loads/[id]/pod
 *
 * Upload POD document
 *
 * Note: This is a simplified implementation.
 * In production, use file upload service (S3, Cloudinary, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C8 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: loadId } = await params;
    const session = await requireAuth();

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podSubmitted: true,
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Only DELIVERED loads can have POD uploaded
    if (load.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Load must be DELIVERED before uploading POD' },
        { status: 400 }
      );
    }

    // Check if user is the carrier (truck owner)
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isCarrier = user?.organizationId === load.assignedTruck?.carrierId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the assigned carrier can upload POD' },
        { status: 403 }
      );
    }

    // Check if POD already submitted
    if (load.podSubmitted) {
      return NextResponse.json(
        { error: 'POD already submitted for this load' },
        { status: 400 }
      );
    }

    // Parse form data for file upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'POD document file is required' },
        { status: 400 }
      );
    }

    // Validate file type (image or PDF)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG) or PDF' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Upload file to storage service
    const uploadResult = await uploadPOD(file, loadId);

    if (!uploadResult.success) {
      console.error('POD upload failed:', uploadResult.error);
      return NextResponse.json(
        { error: 'Failed to upload POD file. Please try again.' },
        { status: 500 }
      );
    }

    const podUrl = uploadResult.url!;

    // Update load with POD information
    const updatedLoad = await db.load.update({
      where: { id: loadId },
      data: {
        podUrl,
        podSubmitted: true,
        podSubmittedAt: new Date(),
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'POD_SUBMITTED',
        description: 'Proof of Delivery submitted by carrier',
        userId: session.userId,
      },
    });

    // TD-007 FIX: Invalidate cache after POD submission
    await CacheInvalidation.load(loadId);

    // Notify shipper that POD has been submitted for verification
    const loadWithShipper = await db.load.findUnique({
      where: { id: loadId },
      select: {
        shipperId: true,
        pickupCity: true,
        deliveryCity: true,
      },
    });

    if (loadWithShipper?.shipperId) {
      await createNotification({
        userId: loadWithShipper.shipperId,
        type: NotificationType.POD_SUBMITTED,
        title: 'Proof of Delivery Submitted',
        message: `Carrier has submitted POD for load ${loadWithShipper.pickupCity} → ${loadWithShipper.deliveryCity}. Please verify.`,
        metadata: { loadId },
      });
    }

    return NextResponse.json({
      message: 'POD uploaded successfully',
      load: {
        id: updatedLoad.id,
        podUrl: updatedLoad.podUrl,
        podSubmitted: updatedLoad.podSubmitted,
        podSubmittedAt: updatedLoad.podSubmittedAt,
      },
    });
  } catch (error) {
    console.error('Upload POD error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/loads/[id]/pod
 *
 * Verify POD (shipper action)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C9 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: loadId } = await params;
    const session = await requireAuth();

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podSubmitted: true,
        podVerified: true,
        shipperId: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Check if user is the shipper
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isShipper = user?.organizationId === load.shipperId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the shipper can verify POD' },
        { status: 403 }
      );
    }

    // Check if POD was submitted
    if (!load.podSubmitted) {
      return NextResponse.json(
        { error: 'No POD has been submitted for this load' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (load.podVerified) {
      return NextResponse.json(
        { error: 'POD already verified' },
        { status: 400 }
      );
    }

    // Verify POD
    const updatedLoad = await db.load.update({
      where: { id: loadId },
      data: {
        podVerified: true,
        podVerifiedAt: new Date(),
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'POD_VERIFIED',
        description: 'Proof of Delivery verified by shipper',
        userId: session.userId,
      },
    });

    // TD-007 FIX: Invalidate cache after POD verification
    await CacheInvalidation.load(loadId, load.shipperId);

    // Notify carrier that POD has been verified
    const loadWithCarrier = await db.load.findUnique({
      where: { id: loadId },
      select: {
        pickupCity: true,
        deliveryCity: true,
        assignedTruck: {
          select: {
            carrierId: true,
            carrier: {
              select: {
                users: {
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    const carrierId = loadWithCarrier?.assignedTruck?.carrier?.users?.[0]?.id;
    if (carrierId) {
      await createNotification({
        userId: carrierId,
        type: NotificationType.POD_VERIFIED,
        title: 'POD Verified',
        message: `Your POD for load ${loadWithCarrier.pickupCity} → ${loadWithCarrier.deliveryCity} has been verified. Settlement can now proceed.`,
        metadata: { loadId },
      });
    }

    return NextResponse.json({
      message: 'POD verified successfully. Settlement can now be processed.',
      load: {
        id: updatedLoad.id,
        podVerified: updatedLoad.podVerified,
        podVerifiedAt: updatedLoad.podVerifiedAt,
      },
    });
  } catch (error) {
    console.error('Verify POD error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
