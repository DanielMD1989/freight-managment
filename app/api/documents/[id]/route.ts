/**
 * Individual Document API
 *
 * GET: View document details
 * PATCH: Update document (admin only - for verification)
 * DELETE: Soft delete document (owner only, PENDING status only)
 *
 * Security:
 * - GET: Owner or admin only
 * - PATCH: Admin only (for verification)
 * - PATCH: CSRF protection (double-submit cookie)
 * - DELETE: Owner only, PENDING status only
 * - DELETE: CSRF protection (double-submit cookie)
 *
 * Sprint 8 - Story 8.5: Document Upload System
 * Sprint 9 - Story 9.6: CSRF Protection
 * Sprint 9 - Story 9.8: Email Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { requirePermission, Permission } from '@/lib/rbac';
import { requireCSRF } from '@/lib/csrf';
import {
  sendEmail,
  createDocumentApprovalEmail,
  createDocumentRejectionEmail,
} from '@/lib/email';

/**
 * GET /api/documents/[id]
 *
 * Get details of a specific document.
 *
 * Query parameter:
 * - entityType: 'company' | 'truck' (required to know which table to query)
 *
 * Returns:
 * {
 *   id: string,
 *   type: string,
 *   fileName: string,
 *   fileUrl: string,
 *   fileSize: number,
 *   verificationStatus: string,
 *   uploadedAt: Date,
 *   verifiedAt: Date | null,
 *   rejectionReason: string | null
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Validate entity type
    if (!entityType || !['company', 'truck'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be "company" or "truck"' },
        { status: 400 }
      );
    }

    // Require authentication
    const session = await requireAuth();

    // Fetch document based on entity type
    if (entityType === 'company') {
      const document = await db.companyDocument.findUnique({
        where: { id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Verify user has access (owner or admin)
      if (document.organizationId !== session.organizationId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only view documents for your own organization' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        ...document,
        fileSize: Number(document.fileSize),
      });
    } else {
      // entityType === 'truck'
      const document = await db.truckDocument.findUnique({
        where: { id },
        include: {
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrierId: true,
            },
          },
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Verify user has access (owner or admin)
      if (document.truck.carrierId !== session.organizationId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only view documents for trucks owned by your organization' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        ...document,
        fileSize: Number(document.fileSize),
      });
    }
  } catch (error: any) {
    console.error('Error fetching document:', error);

    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]
 *
 * Update document verification status (admin only).
 *
 * Body:
 * {
 *   entityType: 'company' | 'truck',
 *   verificationStatus: 'APPROVED' | 'REJECTED',
 *   rejectionReason?: string (required if REJECTED)
 * }
 *
 * Security: Admin only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Require admin permission
    const session = await requirePermission(Permission.VERIFY_DOCUMENTS);

    // Check CSRF token
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Parse request body
    const body = await request.json();
    const { entityType, verificationStatus, rejectionReason } = body;

    // Validate required fields
    if (!entityType || !['company', 'truck'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be "company" or "truck"' },
        { status: 400 }
      );
    }

    if (!verificationStatus || !['APPROVED', 'REJECTED'].includes(verificationStatus)) {
      return NextResponse.json(
        { error: 'verificationStatus must be "APPROVED" or "REJECTED"' },
        { status: 400 }
      );
    }

    if (verificationStatus === 'REJECTED' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason is required when rejecting a document' },
        { status: 400 }
      );
    }

    // Update document based on entity type
    if (entityType === 'company') {
      const updated = await db.companyDocument.update({
        where: { id },
        data: {
          verificationStatus: verificationStatus as VerificationStatus,
          verifiedById: session.userId,
          verifiedAt: new Date(),
          rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Get uploader information for email notification
      const uploader = await db.user.findUnique({
        where: { id: updated.uploadedById },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      // Send email notification
      try {
        if (!uploader) {
          console.error('Uploader not found for document:', id);
        } else {
          const emailParams = {
            recipientEmail: uploader.email,
            recipientName: `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim() || 'User',
            documentType: updated.type,
            documentName: updated.fileName,
            organizationName: updated.organization.name,
          };

        if (verificationStatus === 'APPROVED') {
          await sendEmail(
            createDocumentApprovalEmail({
              ...emailParams,
              verifiedAt: updated.verifiedAt!,
            })
          );
        } else {
          await sendEmail(
            createDocumentRejectionEmail({
              ...emailParams,
              rejectionReason: updated.rejectionReason || 'No reason provided',
              rejectedAt: updated.verifiedAt!,
            })
          );
        }
      }
      } catch (emailError) {
        // Log email error but don't fail the verification
        console.error('Failed to send verification email:', emailError);
      }

      return NextResponse.json({
        message: `Company document ${verificationStatus.toLowerCase()} successfully`,
        document: updated,
      });
    } else {
      // entityType === 'truck'
      const updated = await db.truckDocument.update({
        where: { id },
        data: {
          verificationStatus: verificationStatus as VerificationStatus,
          verifiedById: session.userId,
          verifiedAt: new Date(),
          rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
        },
        include: {
          truck: {
            select: {
              id: true,
              licensePlate: true,
              carrier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Get uploader information for email notification
      const uploader = await db.user.findUnique({
        where: { id: updated.uploadedById },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      // Send email notification
      try {
        if (!uploader) {
          console.error('Uploader not found for document:', id);
        } else {
          const emailParams = {
            recipientEmail: uploader.email,
            recipientName: `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim() || 'User',
            documentType: updated.type,
            documentName: updated.fileName,
            organizationName: updated.truck.carrier.name,
          };

          if (verificationStatus === 'APPROVED') {
            await sendEmail(
              createDocumentApprovalEmail({
                ...emailParams,
                verifiedAt: updated.verifiedAt!,
              })
            );
          } else {
            await sendEmail(
              createDocumentRejectionEmail({
                ...emailParams,
                rejectionReason: updated.rejectionReason || 'No reason provided',
                rejectedAt: updated.verifiedAt!,
              })
            );
          }
        }
      } catch (emailError) {
        // Log email error but don't fail the verification
        console.error('Failed to send verification email:', emailError);
      }

      return NextResponse.json({
        message: `Truck document ${verificationStatus.toLowerCase()} successfully`,
        document: updated,
      });
    }
  } catch (error: any) {
    console.error('Error updating document:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 *
 * Delete a document (owner only, PENDING status only).
 *
 * Query parameter:
 * - entityType: 'company' | 'truck'
 *
 * Security: Owner only, PENDING status only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Validate entity type
    if (!entityType || !['company', 'truck'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be "company" or "truck"' },
        { status: 400 }
      );
    }

    // Require authentication
    const session = await requireAuth();

    // Check CSRF token
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check document exists and is PENDING
    if (entityType === 'company') {
      const document = await db.companyDocument.findUnique({
        where: { id },
        select: {
          id: true,
          verificationStatus: true,
          uploadedById: true,
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Verify user is the uploader
      if (document.uploadedById !== session.userId) {
        return NextResponse.json(
          { error: 'You can only delete documents you uploaded' },
          { status: 403 }
        );
      }

      if (document.verificationStatus !== 'PENDING') {
        return NextResponse.json(
          { error: 'Cannot delete document that has been verified or rejected' },
          { status: 400 }
        );
      }

      // Soft delete (just mark as deleted, keep for audit)
      await db.companyDocument.delete({
        where: { id },
      });

      return NextResponse.json({
        message: 'Company document deleted successfully',
      });
    } else {
      // entityType === 'truck'
      const document = await db.truckDocument.findUnique({
        where: { id },
        select: {
          id: true,
          verificationStatus: true,
          uploadedById: true,
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Verify user is the uploader
      if (document.uploadedById !== session.userId) {
        return NextResponse.json(
          { error: 'You can only delete documents you uploaded' },
          { status: 403 }
        );
      }

      if (document.verificationStatus !== 'PENDING') {
        return NextResponse.json(
          { error: 'Cannot delete document that has been verified or rejected' },
          { status: 400 }
        );
      }

      // Soft delete
      await db.truckDocument.delete({
        where: { id },
      });

      return NextResponse.json({
        message: 'Truck document deleted successfully',
      });
    }
  } catch (error: any) {
    console.error('Error deleting document:', error);

    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
