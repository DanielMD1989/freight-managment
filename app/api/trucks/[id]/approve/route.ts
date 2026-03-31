export const dynamic = "force-dynamic";
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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/rbac/permissions";
import { createNotification, NotificationType } from "@/lib/notifications";
import { UserRole } from "@prisma/client";
// P1-001-B FIX: Import CacheInvalidation for approval status changes
import { CacheInvalidation } from "@/lib/cache";
import { sendEmail, createEmailHTML } from "@/lib/email";
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { writeAuditLog, AuditEventType, AuditSeverity } from "@/lib/auditLog";

// Validation schema for truck approval
const TruckApprovalSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
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
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: truckId } = await params;
    // Fix 3d: Require ACTIVE user for truck approval
    const session = await requireActiveUser();

    // Check admin permission
    if (!hasPermission(session.role as UserRole, Permission.VERIFY_DOCUMENTS)) {
      return NextResponse.json(
        { error: "Only admins can approve trucks" },
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
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = TruckApprovalSchema.safeParse(body);

    if (!validationResult.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // H10 FIX: Guard against approving/rejecting non-PENDING trucks
    // Default to PENDING if approvalStatus is not set (Prisma @default)
    const currentApprovalStatus = truck.approvalStatus || "PENDING";
    if (currentApprovalStatus !== "PENDING") {
      return NextResponse.json(
        {
          error: `Truck is already ${currentApprovalStatus.toLowerCase()}. Only PENDING trucks can be approved or rejected.`,
          currentStatus: currentApprovalStatus,
        },
        { status: 400 }
      );
    }

    // Require reason for rejection (min 10 chars after trim)
    if (
      data.action === "REJECT" &&
      (!data.reason || data.reason.trim().length < 10)
    ) {
      return NextResponse.json(
        { error: "Rejection reason must be at least 10 characters" },
        { status: 400 }
      );
    }

    if (data.action === "APPROVE") {
      // P0 Insurance Gate: Require approved insurance document before truck approval
      const { validateTruckInsurance } =
        await import("@/lib/insuranceValidation");
      const insuranceCheck = await validateTruckInsurance(truckId);
      if (!insuranceCheck.valid) {
        return NextResponse.json(
          {
            error: "Truck cannot be approved without valid insurance",
            insuranceStatus: insuranceCheck.status,
            hint: "Upload an INSURANCE document and have it approved with a future expiry date",
          },
          { status: 400 }
        );
      }

      // Approve the truck
      const updatedTruck = await db.truck.update({
        where: { id: truckId },
        data: {
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedById: session.userId,
          rejectionReason: null,
          rejectedAt: null,
          documentsLockedAt: new Date(), // Round S3
          insuranceStatus: insuranceCheck.status,
          insuranceExpiresAt: insuranceCheck.expiresAt,
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
          status: "ACTIVE",
        },
        select: { id: true },
        take: 100,
      });

      // Send in-app notifications
      for (const user of carrierUsers) {
        await createNotification({
          userId: user.id,
          type: NotificationType.TRUCK_APPROVED,
          title: "Truck Approved",
          message: `Your truck ${truck.licensePlate} has been approved and is now available for posting.`,
          metadata: {
            truckId: truck.id,
            licensePlate: truck.licensePlate,
          },
        });
      }

      // Send email notification to carrier organization
      if (truck.carrier.contactEmail) {
        const approvalContent = `
          <h1>Truck Approved</h1>
          <p>Dear ${truck.carrier.name},</p>
          <p>Your truck <strong>${truck.licensePlate}</strong> has been approved and is now available for posting on the marketplace.</p>
          <div class="status-badge status-approved">APPROVED</div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/carrier/loadboard" class="button">
            Go to Loadboard
          </a>
        `;
        sendEmail({
          to: truck.carrier.contactEmail,
          subject: `Truck Approved: ${truck.licensePlate}`,
          html: createEmailHTML(approvalContent),
          text: `Your truck ${truck.licensePlate} has been approved and is now available for posting.`,
        }).catch((err) =>
          console.error("Failed to send truck approval email:", err)
        );
      }

      // P1-001-B FIX: Invalidate cache after truck approval to update listings
      await CacheInvalidation.truck(
        updatedTruck.id,
        updatedTruck.carrierId,
        updatedTruck.carrierId
      );

      // G-A2-6: Audit log for truck approval
      await writeAuditLog({
        eventType: AuditEventType.DOCUMENT_VERIFIED,
        severity: AuditSeverity.INFO,
        userId: session.userId,
        organizationId: truck.carrierId,
        resource: "truck",
        resourceId: truckId,
        action: "APPROVE",
        result: "SUCCESS",
        message: `Truck approved: ${truck.licensePlate}`,
        metadata: {
          licensePlate: truck.licensePlate,
          carrierId: truck.carrierId,
        },
        timestamp: new Date(),
      });

      return NextResponse.json({
        truck: {
          ...updatedTruck,
          documentsLockedAt: updatedTruck.documentsLockedAt,
        },
        message: "Truck approved successfully",
      });
    } else {
      // Reject the truck
      const updatedTruck = await db.truck.update({
        where: { id: truckId },
        data: {
          approvalStatus: "REJECTED",
          rejectionReason: data.reason,
          rejectedAt: new Date(),
          documentsLockedAt: null, // G-M7-1: Unlock docs for re-upload
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

      // G-M12-1: Cancel active postings and pending requests for rejected truck
      await db.truckPosting.updateMany({
        where: { truckId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      await db.truckRequest.updateMany({
        where: { truckId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await db.loadRequest.updateMany({
        where: { truckId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await db.matchProposal.updateMany({
        where: { truckId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      // Find carrier users to notify
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: truck.carrierId,
          status: "ACTIVE",
        },
        select: { id: true },
        take: 100,
      });

      // Send in-app notifications
      for (const user of carrierUsers) {
        await createNotification({
          userId: user.id,
          type: NotificationType.TRUCK_REJECTED,
          title: "Truck Rejected",
          message: `Your truck ${truck.licensePlate} has been rejected. Reason: ${data.reason}`,
          metadata: {
            truckId: truck.id,
            licensePlate: truck.licensePlate,
            reason: data.reason,
          },
        });
      }

      // Send email notification to carrier organization
      if (truck.carrier.contactEmail) {
        const rejectionContent = `
          <h1>Truck Registration Rejected</h1>
          <p>Dear ${truck.carrier.name},</p>
          <p>Your truck <strong>${truck.licensePlate}</strong> registration has been rejected.</p>
          <div class="status-badge status-rejected">REJECTED</div>
          <div class="info-section" style="border-left-color: #ef4444;">
            <p><strong>Reason:</strong> ${data.reason}</p>
          </div>
          <p>Please address the issues and resubmit your truck for approval.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/carrier/loadboard" class="button">
            Go to Dashboard
          </a>
        `;
        sendEmail({
          to: truck.carrier.contactEmail,
          subject: `Truck Rejected: ${truck.licensePlate} - Action Required`,
          html: createEmailHTML(rejectionContent),
          text: `Your truck ${truck.licensePlate} has been rejected. Reason: ${data.reason}. Please resubmit.`,
        }).catch((err) =>
          console.error("Failed to send truck rejection email:", err)
        );
      }

      // P1-001-B FIX: Invalidate cache after truck rejection to update listings
      await CacheInvalidation.truck(
        updatedTruck.id,
        updatedTruck.carrierId,
        updatedTruck.carrierId
      );

      // G-A2-6: Audit log for truck rejection
      await writeAuditLog({
        eventType: AuditEventType.DOCUMENT_REJECTED,
        severity: AuditSeverity.INFO,
        userId: session.userId,
        organizationId: truck.carrierId,
        resource: "truck",
        resourceId: truckId,
        action: "REJECT",
        result: "SUCCESS",
        message: `Truck rejected: ${truck.licensePlate} — ${data.reason}`,
        metadata: { licensePlate: truck.licensePlate, reason: data.reason },
        timestamp: new Date(),
      });

      return NextResponse.json({
        truck: updatedTruck,
        message: "Truck rejected",
      });
    }
  } catch (error) {
    // Fix 5a: Use handleApiError for consistent error handling
    return handleApiError(error, "Error processing truck approval");
  }
}
