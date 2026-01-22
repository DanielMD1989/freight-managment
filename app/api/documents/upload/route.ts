/**
 * Document Upload API
 *
 * Upload company or truck documents for verification.
 *
 * POST /api/documents/upload
 *
 * Security:
 * - Requires authentication
 * - CSRF protection (double-submit cookie)
 * - Rate limiting (10 uploads/hour per user)
 * - File type validation (PDF, JPG, PNG only)
 * - File size validation (max 10MB)
 * - Magic bytes verification
 * - Organization ownership verification
 * - Unique file names to prevent path traversal
 *
 * Sprint 8 - Story 8.5: Document Upload System
 * Sprint 9 - Story 9.6: CSRF Protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  saveFile,
  validateUploadedFile,
  MAX_FILE_SIZE,
} from '@/lib/fileStorage';
import { CompanyDocumentType, TruckDocumentType } from '@prisma/client';
import { requireRegistrationAccess } from '@/lib/auth';
import { validateFileName, validateIdFormat } from '@/lib/validation';
import {
  checkRateLimit,
  addRateLimitHeaders,
  RATE_LIMIT_DOCUMENT_UPLOAD,
} from '@/lib/rateLimit';
import { requireCSRF } from '@/lib/csrf';

/**
 * POST /api/documents/upload
 *
 * Upload a document file.
 *
 * Accepts multipart/form-data with:
 * - file: File (PDF, JPG, PNG, max 10MB)
 * - type: CompanyDocumentType or TruckDocumentType
 * - entityType: 'company' | 'truck'
 * - entityId: organizationId or truckId
 *
 * Returns:
 * {
 *   id: string,
 *   fileName: string,
 *   fileUrl: string,
 *   type: string,
 *   verificationStatus: 'PENDING'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Allow document upload for users in registration flow
    // (REGISTERED, PENDING_VERIFICATION, and ACTIVE users)
    const session = await requireRegistrationAccess();
    const userId = session.userId;
    const userOrgId = session.organizationId;

    // Check CSRF token
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check rate limit: 10 uploads per hour per user
    const rateLimitResult = await checkRateLimit(RATE_LIMIT_DOCUMENT_UPLOAD, userId);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Document upload limit exceeded. Maximum 10 uploads per hour.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': rateLimitResult.retryAfter!.toString(),
          },
        }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const entityType = formData.get('entityType') as 'company' | 'truck' | null;
    const entityId = formData.get('entityId') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Document type is required' },
        { status: 400 }
      );
    }

    if (!entityType || !['company', 'truck'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Entity type must be "company" or "truck"' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      );
    }

    // Validate entity ID format
    const idValidation = validateIdFormat(entityId, 'Entity ID');
    if (!idValidation.valid) {
      return NextResponse.json(
        { error: idValidation.error },
        { status: 400 }
      );
    }

    // Validate document type enum
    const validCompanyTypes = Object.values(CompanyDocumentType);
    const validTruckTypes = Object.values(TruckDocumentType);

    if (entityType === 'company' && !validCompanyTypes.includes(type as any)) {
      return NextResponse.json(
        {
          error: `Invalid company document type. Must be one of: ${validCompanyTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (entityType === 'truck' && !validTruckTypes.includes(type as any)) {
      return NextResponse.json(
        {
          error: `Invalid truck document type. Must be one of: ${validTruckTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Get file details
    const fileSize = file.size;
    const mimeType = file.type;
    const originalName = file.name;

    // Validate file name
    const fileNameValidation = validateFileName(originalName);
    if (!fileNameValidation.valid) {
      return NextResponse.json(
        { error: fileNameValidation.error },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file
    const validation = validateUploadedFile(buffer, mimeType, fileSize);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Verify entity exists and user has access
    if (entityType === 'company') {
      const organization = await db.organization.findUnique({
        where: { id: entityId },
        select: { id: true },
      });

      if (!organization) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }

      // Verify user belongs to this organization (admins can upload for any org)
      if (entityId !== userOrgId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only upload documents for your own organization' },
          { status: 403 }
        );
      }
    } else {
      // entityType === 'truck'
      const truck = await db.truck.findUnique({
        where: { id: entityId },
        select: { id: true, carrierId: true },
      });

      if (!truck) {
        return NextResponse.json(
          { error: 'Truck not found' },
          { status: 404 }
        );
      }

      // Verify user's organization owns this truck (admins can upload for any truck)
      if (truck.carrierId !== userOrgId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only upload documents for trucks owned by your organization' },
          { status: 403 }
        );
      }
    }

    // Save file to storage
    // For organization files, use entityId as organizationId
    // For truck files, we need to get the truck's organization
    let organizationId = entityId;

    if (entityType === 'truck') {
      const truck = await db.truck.findUnique({
        where: { id: entityId },
        select: { carrierId: true },
      });
      organizationId = truck!.carrierId;
    }

    const { fileName, fileUrl } = await saveFile(
      buffer,
      organizationId,
      originalName,
      mimeType
    );

    // Create database record
    if (entityType === 'company') {
      const document = await db.companyDocument.create({
        data: {
          type: type as CompanyDocumentType,
          fileName: originalName,
          fileUrl,
          fileSize,
          mimeType,
          verificationStatus: 'PENDING',
          organizationId: entityId,
          uploadedById: userId,
        },
        select: {
          id: true,
          type: true,
          fileName: true,
          fileUrl: true,
          fileSize: true,
          verificationStatus: true,
          uploadedAt: true,
        },
      });

      const response = NextResponse.json({
        message: 'Company document uploaded successfully',
        document,
      });

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());

      return response;
    } else {
      // entityType === 'truck'
      const document = await db.truckDocument.create({
        data: {
          type: type as TruckDocumentType,
          fileName: originalName,
          fileUrl,
          fileSize,
          mimeType,
          verificationStatus: 'PENDING',
          truckId: entityId,
          uploadedById: userId,
        },
        select: {
          id: true,
          type: true,
          fileName: true,
          fileUrl: true,
          fileSize: true,
          verificationStatus: true,
          uploadedAt: true,
        },
      });

      const response = NextResponse.json({
        message: 'Truck document uploaded successfully',
        document,
      });

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());

      return response;
    }
  } catch (error: any) {
    console.error('Error uploading document:', error);

    // Handle specific errors
    if (error.message?.includes('too large')) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
