/**
 * Proof of Delivery (POD) Upload API
 *
 * Allows carriers to upload POD documents after delivery
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { CacheInvalidation } from "@/lib/cache";
import { createNotification, NotificationType } from "@/lib/notifications";
import { uploadPOD } from "@/lib/storage";
import { deductServiceFee } from "@/lib/serviceFeeManagement";
import { checkRateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

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
    const session = await requireActiveUser();

    // B2 FIX: Rate limit POD uploads: 10 per hour per load
    const rateResult = await checkRateLimit(
      {
        name: "pod-upload",
        limit: 10,
        windowMs: 60 * 60 * 1000,
        message: "Too many POD uploads",
      },
      `pod:${loadId}`
    );
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Too many POD uploads. Try again later." },
        { status: 429 }
      );
    }

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
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Only DELIVERED loads can have POD uploaded
    if (load.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Load must be DELIVERED before uploading POD" },
        { status: 400 }
      );
    }

    // Check if user is the carrier (truck owner)
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isCarrier = user?.organizationId === load.assignedTruck?.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: "Only the assigned carrier can upload POD" },
        { status: 403 }
      );
    }

    // Check if POD already submitted
    if (load.podSubmitted) {
      return NextResponse.json(
        { error: "POD already submitted for this load" },
        { status: 400 }
      );
    }

    // Parse form data for file upload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formData: any = await request.formData();
    const file = formData.get("file") as File | null;

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

    // B2 FIX: Server-side magic byte validation to prevent MIME type spoofing
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
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Upload file to storage service
    const uploadResult = await uploadPOD(file, loadId);

    if (!uploadResult.success) {
      console.error("POD upload failed:", uploadResult.error);
      return NextResponse.json(
        { error: "Failed to upload POD file. Please try again." },
        { status: 500 }
      );
    }

    const podUrl = uploadResult.url!;

    // B2 FIX: Wrap load update + load event in transaction for atomicity
    const updatedLoad = await db.$transaction(async (tx) => {
      const updatedLoad = await tx.load.update({
        where: { id: loadId },
        data: {
          podUrl,
          podSubmitted: true,
          podSubmittedAt: new Date(),
        },
      });

      await tx.loadEvent.create({
        data: {
          loadId,
          eventType: "POD_SUBMITTED",
          description: "Proof of Delivery submitted by carrier",
          userId: session.userId,
        },
      });

      return updatedLoad;
    });

    // TD-007 FIX: Invalidate cache after POD submission
    await CacheInvalidation.load(loadId);

    // C4 FIX: Notify shipper user (not org ID) that POD has been submitted
    const loadWithShipper = await db.load.findUnique({
      where: { id: loadId },
      select: {
        shipperId: true,
        pickupCity: true,
        deliveryCity: true,
        shipper: {
          select: {
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    const shipperUserId = loadWithShipper?.shipper?.users?.[0]?.id;
    if (shipperUserId) {
      await createNotification({
        userId: shipperUserId,
        type: NotificationType.POD_SUBMITTED,
        title: "Proof of Delivery Submitted",
        message: `Carrier has submitted POD for load ${loadWithShipper.pickupCity} → ${loadWithShipper.deliveryCity}. Please verify.`,
        metadata: { loadId },
      });
    }

    return NextResponse.json({
      message: "POD uploaded successfully",
      load: {
        id: updatedLoad.id,
        podUrl: updatedLoad.podUrl,
        podSubmitted: updatedLoad.podSubmitted,
        podSubmittedAt: updatedLoad.podSubmittedAt,
      },
    });
  } catch (error) {
    return handleApiError(error, "Upload POD error");
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
    const session = await requireActiveUser();

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
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check if user is the shipper
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isShipper = user?.organizationId === load.shipperId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isShipper && !isAdmin) {
      return NextResponse.json(
        { error: "Only the shipper can verify POD" },
        { status: 403 }
      );
    }

    // Check if POD was submitted
    if (!load.podSubmitted) {
      return NextResponse.json(
        { error: "No POD has been submitted for this load" },
        { status: 400 }
      );
    }

    // Check if already verified
    if (load.podVerified) {
      return NextResponse.json(
        { error: "POD already verified" },
        { status: 400 }
      );
    }

    // B3 FIX: Wrap verification writes in transaction for atomicity
    const updatedLoad = await db.$transaction(async (tx) => {
      const updatedLoad = await tx.load.update({
        where: { id: loadId },
        data: {
          podVerified: true,
          podVerifiedAt: new Date(),
        },
      });

      await tx.loadEvent.create({
        data: {
          loadId,
          eventType: "POD_VERIFIED",
          description: "Proof of Delivery verified by shipper",
          userId: session.userId,
        },
      });

      return updatedLoad;
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

    const carrierUserId =
      loadWithCarrier?.assignedTruck?.carrier?.users?.[0]?.id;
    if (carrierUserId) {
      await createNotification({
        userId: carrierUserId,
        type: NotificationType.POD_VERIFIED,
        title: "POD Verified",
        message: `Your POD for load ${loadWithCarrier.pickupCity} → ${loadWithCarrier.deliveryCity} has been verified. Settlement can now proceed.`,
        metadata: { loadId },
      });
    }

    // === AUTO-SETTLEMENT: Deduct service fees immediately on POD verification ===
    let settlementResult: {
      status: string;
      shipperFee?: number;
      carrierFee?: number;
    } = { status: "skipped" };
    try {
      const feeResult = await deductServiceFee(loadId);

      if (feeResult.success && feeResult.totalPlatformFee > 0) {
        // B3 FIX: Wrap settlement DB writes in transaction for atomicity
        await db.$transaction(async (tx) => {
          await tx.load.update({
            where: { id: loadId },
            data: {
              settlementStatus: "PAID",
              settledAt: new Date(),
            },
          });

          await tx.loadEvent.create({
            data: {
              loadId,
              eventType: "SETTLEMENT_COMPLETED",
              description: `Auto-settlement: Shipper fee ${feeResult.shipperFee.toFixed(2)} ETB, Carrier fee ${feeResult.carrierFee.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: {
                shipperFee: feeResult.shipperFee,
                carrierFee: feeResult.carrierFee,
                totalPlatformFee: feeResult.totalPlatformFee,
                transactionId: feeResult.transactionId,
                trigger: "pod_verification",
              },
            },
          });
        });

        // Notify shipper about fee deduction
        if (load.shipperId) {
          // Find shipper user
          const shipperOrg = await db.organization.findUnique({
            where: { id: load.shipperId },
            select: { users: { select: { id: true }, take: 1 } },
          });
          const shipperUserId = shipperOrg?.users?.[0]?.id;
          if (shipperUserId) {
            await createNotification({
              userId: shipperUserId,
              type: NotificationType.SETTLEMENT_COMPLETE,
              title: "Settlement Completed",
              message: `Service fee of ${feeResult.shipperFee.toFixed(2)} ETB deducted for load ${loadWithCarrier?.pickupCity} → ${loadWithCarrier?.deliveryCity}.`,
              metadata: { loadId, fee: feeResult.shipperFee },
            });
          }
        }

        // Notify carrier about fee deduction
        if (carrierUserId) {
          await createNotification({
            userId: carrierUserId,
            type: NotificationType.SETTLEMENT_COMPLETE,
            title: "Settlement Completed",
            message: `Service fee of ${feeResult.carrierFee.toFixed(2)} ETB deducted for load ${loadWithCarrier?.pickupCity} → ${loadWithCarrier?.deliveryCity}.`,
            metadata: { loadId, fee: feeResult.carrierFee },
          });
        }

        settlementResult = {
          status: "paid",
          shipperFee: feeResult.shipperFee,
          carrierFee: feeResult.carrierFee,
        };
      } else if (feeResult.success && feeResult.totalPlatformFee === 0) {
        // Fees waived (no corridor match) — still mark settled
        await db.load.update({
          where: { id: loadId },
          data: { settlementStatus: "PAID", settledAt: new Date() },
        });
        settlementResult = { status: "paid_waived" };
      }
      // If !feeResult.success — leave as PENDING for cron fallback
    } catch (settlementError) {
      console.error("Auto-settlement failed for load", loadId, settlementError);
      await db.load.update({
        where: { id: loadId },
        data: { settlementStatus: "DISPUTE" },
      });
      settlementResult = { status: "failed" };
    }

    // Invalidate cache again after settlement updates
    await CacheInvalidation.load(loadId, load.shipperId);

    return NextResponse.json({
      message: "POD verified successfully. Settlement can now be processed.",
      load: {
        id: updatedLoad.id,
        podVerified: updatedLoad.podVerified,
        podVerifiedAt: updatedLoad.podVerifiedAt,
      },
      settlement: settlementResult,
    });
  } catch (error) {
    return handleApiError(error, "Verify POD error");
  }
}
