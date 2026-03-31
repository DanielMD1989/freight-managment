export const dynamic = "force-dynamic";
/**
 * Admin Organization Reject API (G-A1-2)
 *
 * POST /api/admin/organizations/[id]/reject
 *
 * Allows admins to reject an organization's registration, providing a reason.
 * Sets verificationStatus=REJECTED, unlocks documents so the user can re-upload,
 * sends in-app notification to all org users, and writes an audit log.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser, revokeAllSessions } from "@/lib/auth";
import { CacheInvalidation } from "@/lib/cache";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { writeAuditLog, AuditEventType, AuditSeverity } from "@/lib/auditLog";
import { createNotification } from "@/lib/notifications";
import { sanitizeRejectionReason, zodErrorResponse } from "@/lib/validation";
import { handleApiError } from "@/lib/apiErrors";

const rejectOrgSchema = z.object({
  reason: z
    .string()
    .min(10, "Rejection reason must be at least 10 characters")
    .max(500, "Rejection reason must not exceed 500 characters"),
});

/**
 * POST /api/admin/organizations/[id]/reject
 *
 * Reject an organization registration (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: orgId } = await params;
    const session = await requireActiveUser();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = rejectOrgSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const sanitizedReason = sanitizeRejectionReason(parsed.data.reason);

    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (organization.verificationStatus === "APPROVED") {
      return NextResponse.json(
        { error: "Cannot reject an already-approved organization" },
        { status: 400 }
      );
    }

    if (organization.verificationStatus === "REJECTED") {
      return NextResponse.json(
        { error: "Organization is already rejected" },
        { status: 400 }
      );
    }

    const updatedOrg = await db.organization.update({
      where: { id: orgId },
      data: {
        isVerified: false,
        verificationStatus: "REJECTED",
        rejectionReason: sanitizedReason,
        rejectedAt: new Date(),
        documentsLockedAt: null, // unlock docs so user can re-upload
      },
    });

    // G-M3-2: Update all org members to REJECTED status + revoke sessions
    const orgUsers = await db.user.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["REGISTERED", "PENDING_VERIFICATION", "ACTIVE"] },
      },
      select: { id: true },
    });

    // Cascade REJECTED status to all org members
    if (orgUsers.length > 0) {
      await db.user.updateMany({
        where: {
          id: { in: orgUsers.map((u) => u.id) },
        },
        data: { status: "REJECTED" },
      });

      // Revoke sessions + invalidate cache for each member
      await Promise.all(
        orgUsers.map(async (u) => {
          await revokeAllSessions(u.id);
          await CacheInvalidation.user(u.id);
        })
      );
    }

    // G-AD3-1: Expire active truck postings when carrier org is rejected
    await db.truckPosting.updateMany({
      where: {
        truck: { carrierId: orgId },
        status: "ACTIVE",
      },
      data: { status: "EXPIRED" },
    });

    // G-M13-5: Unpost active loads and cancel pending requests for rejected org
    const activeLoads = await db.load.findMany({
      where: {
        shipperId: orgId,
        status: { in: ["POSTED", "SEARCHING", "OFFERED"] },
      },
      select: { id: true },
    });
    const loadIds = activeLoads.map((l: { id: string }) => l.id);

    if (loadIds.length > 0) {
      await db.load.updateMany({
        where: { id: { in: loadIds } },
        data: { status: "UNPOSTED" },
      });
      await db.truckRequest.updateMany({
        where: { loadId: { in: loadIds }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await db.loadRequest.updateMany({
        where: { loadId: { in: loadIds }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await db.matchProposal.updateMany({
        where: { loadId: { in: loadIds }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }

    // Notify all org members
    await Promise.all(
      orgUsers.map((u) =>
        createNotification({
          userId: u.id,
          type: "ACCOUNT_FLAGGED",
          title: "Registration Rejected",
          message: `Your organization registration was rejected: ${sanitizedReason}`,
          metadata: { orgId, reason: sanitizedReason },
          skipPreferenceCheck: true,
        })
      )
    );

    await writeAuditLog({
      eventType: AuditEventType.ORG_VERIFIED,
      severity: AuditSeverity.INFO,
      userId: session.userId,
      organizationId: orgId,
      resource: "organization",
      resourceId: orgId,
      action: "REJECT",
      result: "SUCCESS",
      message: `Organization rejected: ${organization.name} — ${sanitizedReason}`,
      metadata: {
        organizationName: organization.name,
        reason: sanitizedReason,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      message: "Organization rejected successfully",
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        verificationStatus: updatedOrg.verificationStatus,
        rejectionReason: updatedOrg.rejectionReason,
        rejectedAt: updatedOrg.rejectedAt,
      },
    });
  } catch (error) {
    return handleApiError(error, "Reject organization error");
  }
}
