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
import { VerificationStatus, CompanyDocumentType, TruckDocumentType, Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';

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
    // Require authentication
    const session = await requireAuth();

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
      // FIX: Use Prisma type instead of any
      const where: Prisma.CompanyDocumentWhereInput = {
        organizationId: entityId,
      };

      // FIX: Use proper enum types
      if (typeFilter && Object.values(CompanyDocumentType).includes(typeFilter as CompanyDocumentType)) {
        where.type = typeFilter as CompanyDocumentType;
      }

      if (statusFilter && Object.values(VerificationStatus).includes(statusFilter as VerificationStatus)) {
        where.verificationStatus = statusFilter as VerificationStatus;
      }

      // Verify user has access to this organization
      if (entityId !== session.organizationId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only view documents for your own organization' },
          { status: 403 }
        );
      }

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
      // FIX: Use Prisma type instead of any
      const where: Prisma.TruckDocumentWhereInput = {
        truckId: entityId,
      };

      // FIX: Use proper enum types
      if (typeFilter && Object.values(TruckDocumentType).includes(typeFilter as TruckDocumentType)) {
        where.type = typeFilter as TruckDocumentType;
      }

      if (statusFilter && Object.values(VerificationStatus).includes(statusFilter as VerificationStatus)) {
        where.verificationStatus = statusFilter as VerificationStatus;
      }

      // Verify user has access to this truck
      const truck = await db.truck.findUnique({
        where: { id: entityId },
        select: { carrierId: true },
      });

      if (!truck) {
        return NextResponse.json(
          { error: 'Truck not found' },
          { status: 404 }
        );
      }

      if (truck.carrierId !== session.organizationId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only view documents for trucks owned by your organization' },
          { status: 403 }
        );
      }

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
  // FIX: Use unknown type
  } catch (error: unknown) {
    console.error('Error fetching documents:', error);

    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
