/**
 * Load Documents API
 *
 * POST /api/loads/[id]/documents - Upload document
 * GET /api/loads/[id]/documents - List documents
 *
 * Sprint 3 - Story 3.3: Document Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { DocumentType } from '@prisma/client';
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from '@/lib/csrf';

/**
 * GET /api/loads/[id]/documents
 *
 * List all documents for a load.
 *
 * Returns:
 * {
 *   documents: Document[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const session = await requireAuth();

    // Find load
    const load = await db.load.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check access (owner or assigned carrier or admin)
    const hasAccess =
      load.shipperId === session.organizationId ||
      (load.assignedTruck?.carrierId === session.organizationId) ||
      session.role === 'ADMIN';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to these documents' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      documents: load.documents,
    });
  } catch (error: any) {
    console.error('Error fetching load documents:', error);

    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loads/[id]/documents
 *
 * Upload a document for a load.
 *
 * Form data:
 * - file: File
 * - type: DocumentType
 * - description: string (optional)
 *
 * Returns:
 * {
 *   document: Document
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id } = await params;

    // Require authentication
    const session = await requireAuth();

    // Find load
    const load = await db.load.findUnique({
      where: { id },
      include: {
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check ownership or carrier assignment
    const hasAccess =
      load.shipperId === session.organizationId ||
      (load.assignedTruck?.carrierId === session.organizationId) ||
      session.role === 'ADMIN';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot upload documents for this load' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const description = formData.get('description') as string | null;

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

    // Validate document type
    const validTypes = ['BOL', 'POD', 'INVOICE', 'RECEIPT', 'INSURANCE', 'PERMIT', 'OTHER'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'loads', id);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${sanitizedFileName}`;
    const filePath = join(uploadDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create document record
    const document = await db.document.create({
      data: {
        loadId: id,
        type: type as DocumentType,
        fileName: file.name,
        fileUrl: `/uploads/loads/${id}/${fileName}`,
        fileSize: file.size,
        mimeType: file.type,
        description: description || undefined,
      },
    });

    return NextResponse.json({
      message: 'Document uploaded successfully',
      document,
    });
  } catch (error: any) {
    console.error('Error uploading load document:', error);

    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
