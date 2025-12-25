/**
 * File Serving API
 *
 * Serve uploaded files from local storage.
 *
 * GET /api/uploads/[...path]
 *
 * Security:
 * - Validates file paths to prevent directory traversal
 * - TODO: Add authentication to verify user has access to file
 * - TODO: Generate signed URLs with expiration for production
 *
 * Sprint 8 - Story 8.5: Document Upload System
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileFromStorage } from '@/lib/fileStorage';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/uploads/[...path]
 *
 * Serve an uploaded file.
 *
 * Example: GET /api/uploads/documents/org-123/file.pdf
 *
 * Returns the file with appropriate content type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;

    // Validate path exists
    if (!path || path.length === 0) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Construct file path
    const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const filePath = join(UPLOAD_DIR, ...path);

    // Security: Prevent directory traversal
    // Ensure the resolved path is still within UPLOAD_DIR
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // TODO: Verify user has access to this file
    // For MVP, allow all access
    // In production:
    // - Extract organization ID from path
    // - Verify user belongs to organization or is admin
    // - Or use signed URLs with expiration

    // Read file
    const buffer = await readFileFromStorage(filePath);

    // Determine content type from file extension
    const extension = path[path.length - 1].split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    switch (extension) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
    }

    // Return file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error: any) {
    console.error('Error serving file:', error);

    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
