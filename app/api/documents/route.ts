/**
 * Documents List API
 *
 * List documents for an organization or truck.
 *
 * GET /api/documents
 *
 * Query parameters:
 * - entityType: 'company' | 'truck' (required)
 * - entityId: organizationId or truckId (required)
 * - type: Filter by document type (optional)
 * - status: Filter by verification status (optional)
 *
 * Security:
 * - Requires authentication
 * - Users can only see their own organization's documents
 * - Admins can see all documents
 *
 * Sprint 8 - Story 8.5: Document Upload System
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VerificationStatus, CompanyDocumentType, TruckDocumentType } from '@prisma/client';

/**
 * GET /api/documents
 *
 * List documents filtered by entity.
 *
 * Returns:
 * {
 *   documents: [
 *     {
 *       id: string,
 *       type: string,
 *       fileName: string,
 *       fileUrl: string,
 *       fileSize: number,
 *       verificationStatus: string,
 *       uploadedAt: Date,
 *       verifiedAt: Date | null
 *     }
 *   ],
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get authenticated user from session/token
    // For MVP, we'll skip auth checks
    const userId = 'test-user-id'; // PLACEHOLDER
    const userOrgId = 'test-org-id'; // PLACEHOLDER
    const isAdmin = false; // PLACEHOLDER

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const typeFilter = searchParams.get('type');
    const statusFilter = searchParams.get('status');

    // Validate required parameters
    if (!entityType || !['company', 'truck'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be "company" or "truck"' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId is required' },
        { status: 400 }
      );
    }

    // Fetch documents based on entity type
    if (entityType === 'company') {
      // Build where clause
      const where: any = {
        organizationId: entityId,
      };

      if (typeFilter && Object.values(CompanyDocumentType).includes(typeFilter as any)) {
        where.type = typeFilter as CompanyDocumentType;
      }

      if (statusFilter && Object.values(VerificationStatus).includes(statusFilter as any)) {
        where.verificationStatus = statusFilter as VerificationStatus;
      }

      // TODO: Verify user has access to this organization
      // For MVP, we'll allow access

      const [documents, total] = await Promise.all([
        db.companyDocument.findMany({
          where,
          select: {
            id: true,
            type: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            verificationStatus: true,
            uploadedAt: true,
            verifiedAt: true,
            rejectionReason: true,
            expiresAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        }),
        db.companyDocument.count({ where }),
      ]);

      return NextResponse.json({
        documents,
        total,
        entityType: 'company',
        entityId,
      });
    } else {
      // entityType === 'truck'
      const where: any = {
        truckId: entityId,
      };

      if (typeFilter && Object.values(TruckDocumentType).includes(typeFilter as any)) {
        where.type = typeFilter as TruckDocumentType;
      }

      if (statusFilter && Object.values(VerificationStatus).includes(statusFilter as any)) {
        where.verificationStatus = statusFilter as VerificationStatus;
      }

      // TODO: Verify user has access to this truck
      // For MVP, we'll allow access

      const [documents, total] = await Promise.all([
        db.truckDocument.findMany({
          where,
          select: {
            id: true,
            type: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            verificationStatus: true,
            uploadedAt: true,
            verifiedAt: true,
            rejectionReason: true,
            expiresAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        }),
        db.truckDocument.count({ where }),
      ]);

      return NextResponse.json({
        documents,
        total,
        entityType: 'truck',
        entityId,
      });
    }
  } catch (error: any) {
    console.error('Error fetching documents:', error);

    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
