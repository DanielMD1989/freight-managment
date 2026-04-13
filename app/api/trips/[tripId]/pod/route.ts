export const dynamic = "force-dynamic";
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
import { requireActiveUser } from "@/lib/auth";
import { CacheInvalidation } from "@/lib/cache";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  createNotification,
  notifyOrganization,
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";
import { uploadPOD } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";
import { deductServiceFee } from "@/lib/serviceFeeManagement";
import { incrementCompletedLoads } from "@/lib/trustMetrics";

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
    const session = await requireActiveUser();

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
              where: { status: "ACTIVE" },
              select: { id: true },
            },
          },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            driverProfile: {
              select: {
                cdlNumber: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // G-M21-9: Active trips always have loadId; capture as non-null
    const tripLoadId = trip.loadId!;

    // Check authorization BEFORE business logic to avoid leaking trip state
    const isCarrier =
      session.role === "CARRIER" && session.organizationId === trip.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    // Assigned driver may upload POD for their own trip
    const isDriver =
      session.role === "DRIVER" && trip.driverId === session.userId;

    if (!isCarrier && !isAdmin && !isDriver) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Only DELIVERED trips can have POD uploaded
    if (trip.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Trip must be in DELIVERED status before uploading POD" },
        { status: 400 }
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

    // §6 V3 FIX: POD upload auto-completes the trip (Blueprint §7: "Carrier uploads POD → COMPLETED")
    // Deduct service fee BEFORE transaction (blocking pattern — matches confirm + PATCH routes)
    let serviceFeeResult: Awaited<ReturnType<typeof deductServiceFee>> | null =
      null;
    try {
      serviceFeeResult = await deductServiceFee(tripLoadId);
      if (
        !serviceFeeResult.success &&
        serviceFeeResult.error !== "Service fees already deducted"
      ) {
        createNotificationForRole({
          role: "ADMIN",
          type: NotificationType.SERVICE_FEE_FAILED,
          title: "Service fee deduction failed",
          message: `Fee deduction failed on POD upload for trip ${tripId}: ${serviceFeeResult.error}`,
          metadata: { tripId, loadId: tripLoadId },
        }).catch((err) => console.warn("Notification failed:", err?.message));
        return NextResponse.json(
          {
            error: "Cannot complete trip: fee deduction failed",
            details: serviceFeeResult.error,
          },
          { status: 400 }
        );
      }
    } catch (feeErr: unknown) {
      console.error("Fee deduction failed on POD upload:", feeErr);
      createNotificationForRole({
        role: "ADMIN",
        type: NotificationType.SERVICE_FEE_FAILED,
        title: "Service fee deduction failed",
        message: `Fee exception on POD upload for trip ${tripId}: ${feeErr instanceof Error ? feeErr.message : "Unknown"}`,
        metadata: { tripId, loadId: tripLoadId },
      }).catch((err) => console.warn("Notification failed:", err?.message));
      return NextResponse.json(
        { error: "Cannot complete trip: fee deduction failed" },
        { status: 400 }
      );
    }

    // Atomic transaction: create POD + update load + complete trip + restore truck
    const tripPod = await db.$transaction(async (tx) => {
      // Re-check trip status inside transaction (optimistic lock)
      const freshTrip = await tx.trip.findUnique({
        where: { id: tripId },
        select: { status: true },
      });
      if (!freshTrip || freshTrip.status !== "DELIVERED") {
        throw new Error("TRIP_STATUS_CHANGED");
      }

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

      // Update Load: POD submitted + auto-complete
      await tx.load.update({
        where: { id: tripLoadId },
        data: {
          podUrl,
          podSubmitted: true,
          podSubmittedAt: new Date(),
          status: "COMPLETED",
        },
      });

      // Auto-complete trip (§6 V3: POD upload = completion)
      await tx.trip.update({
        where: { id: tripId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          trackingEnabled: false,
        },
      });

      // §5 B4: Increment trust metrics (once, at COMPLETED only)
      if (trip.load?.shipperId) {
        await incrementCompletedLoads(trip.load.shipperId);
      }
      if (trip.carrierId) {
        await incrementCompletedLoads(trip.carrierId);
      }

      // Restore truck availability
      if (trip.truckId) {
        const otherActiveTrips = await tx.trip.count({
          where: {
            truckId: trip.truckId,
            id: { not: tripId },
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
        if (otherActiveTrips === 0) {
          await tx.truck.update({
            where: { id: trip.truckId },
            data: { isAvailable: true },
          });
        }
        await tx.truckPosting.updateMany({
          where: { truckId: trip.truckId, status: "MATCHED" },
          data: { status: "ACTIVE", updatedAt: new Date() },
        });
      }

      // Auto-availability: restore driver if no other active trips
      // Mirrors the truck availability pattern above.
      if (trip.driverId) {
        const otherDriverTrips = await tx.trip.count({
          where: {
            driverId: trip.driverId,
            id: { not: tripId },
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
        if (otherDriverTrips === 0) {
          await tx.driverProfile.update({
            where: { userId: trip.driverId },
            data: { isAvailable: true },
          });
        }
      }

      // Settlement status
      const feeActuallySettled =
        serviceFeeResult?.success &&
        serviceFeeResult.error !== "Service fees already deducted" &&
        (serviceFeeResult.platformRevenue?.greaterThan(0) ||
          serviceFeeResult.totalPlatformFee === 0);
      if (feeActuallySettled) {
        await tx.load.update({
          where: { id: tripLoadId },
          data: { settlementStatus: "PAID", settledAt: new Date() },
        });
      }

      // Load events
      await tx.loadEvent.create({
        data: {
          loadId: tripLoadId,
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
      await tx.loadEvent.create({
        data: {
          loadId: tripLoadId,
          eventType: "TRIP_STATUS_UPDATED",
          description: "Trip auto-completed on POD upload (Blueprint §7)",
          userId: session.userId,
          metadata: { tripId, trigger: "pod_upload" },
        },
      });

      return tripPod;
    });

    // Cache invalidation
    await CacheInvalidation.load(tripLoadId, trip.load?.shipperId);
    await CacheInvalidation.trip(tripId, trip.carrierId, trip.shipperId);

    // Notify shipper: POD submitted + trip completed
    const shipperUsers = trip.shipper?.users ?? [];
    for (const u of shipperUsers) {
      createNotification({
        userId: u.id,
        type: NotificationType.DELIVERY_CONFIRMED,
        title: "Trip Completed — POD Uploaded",
        message: `Carrier has uploaded POD for trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Trip is now COMPLETED.`,
        metadata: { tripId, loadId: tripLoadId },
      }).catch((err) =>
        console.error("Failed to notify shipper of POD completion:", err)
      );
    }

    return NextResponse.json({
      message: "POD uploaded successfully. Trip completed.",
      pod: {
        id: tripPod.id,
        fileUrl: tripPod.fileUrl,
        fileName: tripPod.fileName,
        fileType: tripPod.fileType,
        uploadedAt: tripPod.uploadedAt,
      },
      tripStatus: "COMPLETED",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TRIP_STATUS_CHANGED") {
      return NextResponse.json(
        { error: "Trip is no longer in DELIVERED status" },
        { status: 409 }
      );
    }
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
    const session = await requireActiveUser();

    // Get trip details
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        carrierId: true,
        shipperId: true,
        driverId: true,
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            driverProfile: {
              select: {
                cdlNumber: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check if user has access to this trip
    const isCarrier =
      session.role === "CARRIER" && session.organizationId === trip.carrierId;
    const isShipper =
      session.role === "SHIPPER" && session.organizationId === trip.shipperId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    // G-M29-3: Dispatcher is platform-wide (role-only) — matches M24 fix
    const isDispatcher = session.role === "DISPATCHER";
    // Assigned driver may view POD for their own trip
    const isDriver =
      session.role === "DRIVER" && trip.driverId === session.userId;

    if (!isCarrier && !isShipper && !isAdmin && !isDispatcher && !isDriver) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
