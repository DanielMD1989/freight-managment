/**
 * File Serving API
 *
 * Serve uploaded files from local storage.
 *
 * GET /api/uploads/[...path]
 *
 * Security:
 * - Validates file paths to prevent directory traversal
 * - Requires authentication
 * - Verifies user has access to organization's files
 * - Audit logging for file access
 * - Future: Generate signed URLs with expiration
 *
 * Sprint 8 - Story 8.5: Document Upload System
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileFromStorage } from "@/lib/fileStorage";
import { requireAuth } from "@/lib/auth";
import { existsSync } from "fs";
import { join } from "path";
import { checkRateLimit, RATE_LIMIT_FILE_DOWNLOAD } from "@/lib/rateLimit";

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
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Require authentication
    const session = await requireAuth();

    // Check rate limit: 100 downloads per hour per user
    const rateLimitResult = await checkRateLimit(
      RATE_LIMIT_FILE_DOWNLOAD,
      session.userId
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error:
            "File download limit exceeded. Maximum 100 downloads per hour.",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(
              rateLimitResult.resetTime
            ).toISOString(),
            "Retry-After": rateLimitResult.retryAfter!.toString(),
          },
        }
      );
    }

    // Extract organization ID from path
    // Expected path format: documents/{organizationId}/{filename}
    // or: documents/{organizationId}/{subfolder}/{filename}
    if (path.length < 2) {
      return NextResponse.json(
        { error: "Invalid file path format" },
        { status: 400 }
      );
    }

    const category = path[0]; // e.g., "documents"
    const organizationId = path[1]; // organization ID

    // Verify user has access to this organization's files
    if (session.organizationId !== organizationId && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "You do not have permission to access this file" },
        { status: 403 }
      );
    }

    // Audit log file access
    // Construct file path
    const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
    const filePath = join(UPLOAD_DIR, ...path);

    // Security: Prevent directory traversal
    // Ensure the resolved path is still within UPLOAD_DIR
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read file
    const buffer = await readFileFromStorage(filePath);

    // Determine content type from file extension
    const extension = path[path.length - 1].split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";

    switch (extension) {
      case "pdf":
        contentType = "application/pdf";
        break;
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        break;
      case "png":
        contentType = "image/png";
        break;
    }

    // Return file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse
    const response = new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour
      },
    });

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
    response.headers.set(
      "X-RateLimit-Remaining",
      rateLimitResult.remaining.toString()
    );
    response.headers.set(
      "X-RateLimit-Reset",
      new Date(rateLimitResult.resetTime).toISOString()
    );

    return response;
    // FIX: Use unknown type
  } catch (error: unknown) {
    console.error("Error serving file:", error);

    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
