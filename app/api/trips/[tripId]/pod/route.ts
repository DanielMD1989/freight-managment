/**
 * Trip POD (Proof of Delivery) API
 *
 * POST /api/trips/[tripId]/pod - Upload POD document
 * GET /api/trips/[tripId]/pod - List POD documents for a trip
 *
 * Supports multiple POD documents per trip via TripPod table
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { CacheInvalidation } from "@/lib/cache";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification, NotificationType } from "@/lib/notifications";
import { uploadPOD } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

/**
 * POST /api/trips/[tripId]/pod
 *
 * Upload POD document to trip
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    // H6 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { tripId } = await params;
    const session = await requireAuth();

    // Rate limit POD uploads: 10 per hour per trip
    const rateResult = await checkRateLimit(
      {
        name: "pod-upload",
        limit: 10,
        windowMs: 60 * 60 * 1000,
        message: "Too many POD uploads",
      },
      `pod:${tripId}`
    );
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Too many POD uploads. Try again later." },
        { status: 429 }
      );
    }

    // Get trip details
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            shipperId: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        carrier: {
          select: { id: true },
        },
        shipper: {
          select: {
            id: true,
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Only DELIVERED trips can have POD uploaded
    if (trip.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Trip must be in DELIVERED status before uploading POD" },
        { status: 400 }
      );
    }

    // Check if user is the carrier
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isCarrier = user?.organizationId === trip.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: "Only the carrier can upload POD" },
        { status: 403 }
      );
    }

    // Parse form data for file upload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formData: any = await request.formData();
    const file = formData.get("file") as File | null;
    const notes = formData.get("notes") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "POD document file is required" },
        { status: 400 }
      );
    }

    // Validate file type (image or PDF)
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File must be an image (JPEG, PNG) or PDF" },
        { status: 400 }
      );
    }

    // Server-side magic byte validation to prevent MIME type spoofing
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicBytes = buffer.subarray(0, 4);
    const isJpeg = magicBytes[0] === 0xff && magicBytes[1] === 0xd8;
    const isPng =
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4e &&
      magicBytes[3] === 0x47;
    const isPdf = magicBytes.toString("ascii").startsWith("%PDF");
    if (!isJpeg && !isPng && !isPdf) {
      return NextResponse.json(
        {
          error: "File content does not match an allowed type (JPEG, PNG, PDF)",
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Determine file type category
    const fileType = file.type.startsWith("image/") ? "IMAGE" : "PDF";

    // Upload file to storage service
    const uploadResult = await uploadPOD(file, tripId);

    if (!uploadResult.success) {
      console.error("POD upload failed:", uploadResult.error);
      return NextResponse.json(
        { error: "Failed to upload POD file. Please try again." },
        { status: 500 }
      );
    }

    const podUrl = uploadResult.url!;

    // B1 FIX: Wrap all three DB writes in a transaction for atomicity
    const tripPod = await db.$transaction(async (tx) => {
      const tripPod = await tx.tripPod.create({
        data: {
          tripId,
          fileUrl: podUrl,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          mimeType: file.type,
          notes: notes || null,
          uploadedBy: session.userId,
        },
      });

      // Update Load model for backward compatibility
      // Always update to the most recent POD URL
      await tx.load.update({
        where: { id: trip.loadId },
        data: {
          podUrl, // Always use latest POD
          podSubmitted: true,
          podSubmittedAt: new Date(),
        },
      });

      // Create load event
      await tx.loadEvent.create({
        data: {
          loadId: trip.loadId,
          eventType: "POD_SUBMITTED",
          description: `Proof of Delivery uploaded: ${file.name}`,
          userId: session.userId,
          metadata: {
            tripId,
            tripPodId: tripPod.id,
            fileName: file.name,
            fileType,
          },
        },
      });

      return tripPod;
    });

    // TD-008 FIX: Invalidate cache after POD upload
    await CacheInvalidation.load(trip.loadId, trip.load?.shipperId);
    await CacheInvalidation.trip(tripId, trip.carrierId, trip.shipperId);

    // Notify shipper that POD has been submitted
    const shipperUserId = trip.shipper?.users?.[0]?.id;
    if (shipperUserId) {
      await createNotification({
        userId: shipperUserId,
        type: NotificationType.POD_SUBMITTED,
        title: "Proof of Delivery Submitted",
        message: `Carrier has submitted POD for trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Please verify and confirm delivery.`,
        metadata: { tripId, loadId: trip.loadId },
      });
    }

    return NextResponse.json({
      message: "POD uploaded successfully",
      pod: {
        id: tripPod.id,
        fileUrl: tripPod.fileUrl,
        fileName: tripPod.fileName,
        fileType: tripPod.fileType,
        uploadedAt: tripPod.uploadedAt,
      },
    });
  } catch (error) {
    return handleApiError(error, "Upload trip POD error");
  }
}

/**
 * GET /api/trips/[tripId]/pod
 *
 * List all POD documents for a trip
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const session = await requireAuth();

    // Get trip details
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        carrierId: true,
        shipperId: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check if user has access to this trip
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isCarrier = user?.organizationId === trip.carrierId;
    const isShipper = user?.organizationId === trip.shipperId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";

    if (!isCarrier && !isShipper && !isAdmin && !isDispatcher) {
      return NextResponse.json(
        {
          error: "You do not have permission to view this trip's POD documents",
        },
        { status: 403 }
      );
    }

    // Get all POD documents for the trip
    const pods = await db.tripPod.findMany({
      where: { tripId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        mimeType: true,
        notes: true,
        uploadedAt: true,
        uploadedBy: true,
      },
    });

    return NextResponse.json({
      tripId,
      pods,
      count: pods.length,
    });
  } catch (error) {
    return handleApiError(error, "Get trip PODs error");
  }
}
