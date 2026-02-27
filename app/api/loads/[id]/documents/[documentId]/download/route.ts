/**
 * Load Document Download API
 *
 * GET /api/loads/[id]/documents/[documentId]/download
 *
 * Downloads a specific load document.
 *
 * Sprint 3 - Story 3.3: Document Management
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

/**
 * GET /api/loads/[id]/documents/[documentId]/download
 *
 * Download a load document file.
 *
 * Returns: Binary file data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id, documentId } = await params;

    // Require authentication
    const session = await requireAuth();

    // Find document
    const document = await db.document.findUnique({
      where: { id: documentId },
      include: {
        load: {
          include: {
            assignedTruck: {
              select: {
                carrierId: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Verify document belongs to this load
    if (document.loadId !== id) {
      return NextResponse.json(
        { error: "Document does not belong to this load" },
        { status: 400 }
      );
    }

    // Check access (owner or assigned carrier or admin)
    const hasAccess =
      document.load.shipperId === session.organizationId ||
      document.load.assignedTruck?.carrierId === session.organizationId ||
      session.role === "ADMIN";

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this document" },
        { status: 403 }
      );
    }

    // H3 FIX: Path traversal prevention
    // Validate fileUrl doesn't contain path traversal sequences
    if (document.fileUrl.includes("..") || document.fileUrl.includes("\\")) {
      console.error("Path traversal attempt detected:", document.fileUrl);
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Get file path and verify it stays within uploads directory
    const uploadsDir = join(process.cwd(), "public", "uploads");
    const filePath = join(process.cwd(), "public", document.fileUrl);

    // Resolve to absolute path and verify it's under uploads directory
    const resolvedPath = resolve(filePath);
    const resolvedUploads = resolve(uploadsDir);

    if (!resolvedPath.startsWith(resolvedUploads)) {
      console.error("Path escape attempt detected:", resolvedPath);
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found on server" },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Return file
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${document.fileName}"`,
        "Content-Length": document.fileSize.toString(),
      },
    });
    // FIX: Use unknown type
  } catch (error: unknown) {
    console.error("Error downloading document:", error);

    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}
