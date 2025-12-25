/**
 * Admin Document Verification API
 *
 * PATCH /api/admin/verification/[id] - Approve or reject a document
 *
 * Request Body:
 * - entityType: "company" | "truck" (required)
 * - verificationStatus: "APPROVED" | "REJECTED" (required)
 * - rejectionReason: string (required if REJECTED)
 * - expiresAt: ISO date string (optional, for setting expiration date)
 *
 * Sprint 8 - Story 8.9: Back-Office Verification Dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { VerificationStatus } from "@prisma/client";
import { sanitizeRejectionReason, validateIdFormat } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin or ops permission
    const session = await requirePermission(Permission.VERIFY_DOCUMENTS);

    const { id } = await params;

    // Validate ID format
    const idValidation = validateIdFormat(id, 'Document ID');
    if (!idValidation.valid) {
      return NextResponse.json(
        { error: idValidation.error },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      entityType,
      verificationStatus,
      rejectionReason,
      expiresAt,
    } = body;

    // Validate required fields
    if (!entityType || !["company", "truck"].includes(entityType)) {
      return NextResponse.json(
        { error: "Invalid entity type. Must be 'company' or 'truck'" },
        { status: 400 }
      );
    }

    if (
      !verificationStatus ||
      !["APPROVED", "REJECTED"].includes(verificationStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid verification status. Must be 'APPROVED' or 'REJECTED'" },
        { status: 400 }
      );
    }

    // Require rejection reason if rejecting
    if (verificationStatus === "REJECTED" && !rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required when rejecting a document" },
        { status: 400 }
      );
    }

    // Sanitize rejection reason to prevent XSS
    const sanitizedReason = rejectionReason
      ? sanitizeRejectionReason(rejectionReason)
      : null;

    // Update data
    const updateData = {
      verificationStatus: verificationStatus as VerificationStatus,
      verifiedById: session.userId,
      verifiedAt: new Date(),
      rejectionReason:
        verificationStatus === "REJECTED" ? sanitizedReason : null,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };

    // Update document based on entity type
    let updatedDocument;

    if (entityType === "company") {
      // Check if document exists
      const existingDoc = await db.companyDocument.findUnique({
        where: { id },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      if (!existingDoc) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      // Update document
      updatedDocument = await db.companyDocument.update({
        where: { id },
        data: updateData,
        include: {
          organization: {
            select: { id: true, name: true, contactEmail: true },
          },
        },
      });

      // Log action in audit trail (could be extended to a separate audit table)
      console.log(
        `[AUDIT] Document ${id} (Company) ${verificationStatus} by user ${session.userId} at ${new Date().toISOString()}`
      );
    } else {
      // Truck document
      const existingDoc = await db.truckDocument.findUnique({
        where: { id },
        include: {
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrier: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!existingDoc) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      // Update document
      updatedDocument = await db.truckDocument.update({
        where: { id },
        data: updateData,
        include: {
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrier: {
                select: { id: true, name: true, contactEmail: true },
              },
            },
          },
        },
      });

      // Log action in audit trail
      console.log(
        `[AUDIT] Document ${id} (Truck) ${verificationStatus} by user ${session.userId} at ${new Date().toISOString()}`
      );
    }

    // TODO: Send email notification to organization
    // This can be implemented later with an email service

    return NextResponse.json({
      message: `Document ${verificationStatus.toLowerCase()} successfully`,
      document: updatedDocument,
    });
  } catch (error) {
    console.error("Document verification error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
