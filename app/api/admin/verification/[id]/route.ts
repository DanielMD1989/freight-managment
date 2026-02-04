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
import { z } from "zod";
import { sendEmail, createDocumentApprovalEmail, createDocumentRejectionEmail } from "@/lib/email";

const verifyDocumentSchema = z.object({
  entityType: z.enum(["company", "truck"]),
  verificationStatus: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
  expiresAt: z.string().optional(),
}).refine(
  (data) => data.verificationStatus !== "REJECTED" || !!data.rejectionReason,
  { message: "Rejection reason is required when rejecting a document", path: ["rejectionReason"] }
);

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
    const result = verifyDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }

    const { entityType, verificationStatus, rejectionReason, expiresAt } = result.data;

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
      }

    // Send email notification to organization
    const contactEmail = entityType === 'company'
      ? (updatedDocument as any)?.organization?.contactEmail
      : (updatedDocument as any)?.truck?.carrier?.contactEmail;
    const orgName = entityType === 'company'
      ? (updatedDocument as any)?.organization?.name
      : (updatedDocument as any)?.truck?.carrier?.name;

    if (contactEmail) {
      const docTypeName = entityType === 'company' ? 'Company Document' : 'Truck Document';
      const fileName = (updatedDocument as any)?.fileName || 'Document';

      if (verificationStatus === 'APPROVED') {
        const emailMsg = createDocumentApprovalEmail({
          recipientEmail: contactEmail,
          recipientName: orgName || 'Organization',
          documentType: docTypeName,
          documentName: fileName,
          verifiedAt: new Date(),
          organizationName: orgName || 'Unknown',
        });
        sendEmail(emailMsg).catch((err) => console.error('Failed to send doc approval email:', err));
      } else {
        const emailMsg = createDocumentRejectionEmail({
          recipientEmail: contactEmail,
          recipientName: orgName || 'Organization',
          documentType: docTypeName,
          documentName: fileName,
          rejectionReason: sanitizedReason || 'Not specified',
          rejectedAt: new Date(),
          organizationName: orgName || 'Unknown',
        });
        sendEmail(emailMsg).catch((err) => console.error('Failed to send doc rejection email:', err));
      }
    }

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
