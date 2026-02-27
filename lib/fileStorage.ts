/**
 * File Storage Utilities
 *
 * Local file storage for MVP (can be migrated to S3/Azure Blob later)
 *
 * Security:
 * - File type validation (MIME type + magic bytes)
 * - File size limits (10MB max)
 * - UUID filenames to prevent path traversal
 * - Organization-specific folders
 *
 * Sprint 8 - Story 8.5: Document Upload System
 */

import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Allowed MIME types for document uploads
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

/**
 * File type to extension mapping
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};

/**
 * Magic bytes for file type verification
 * First few bytes of each file type to verify actual content
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]], // JPEG
  "image/jpg": [[0xff, 0xd8, 0xff]], // JPG (same as JPEG)
  "image/png": [[0x89, 0x50, 0x4e, 0x47]], // PNG
};

/**
 * File size limits (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Base upload directory (relative to project root)
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");

/**
 * Get the upload directory path for documents
 */
export function getDocumentUploadDir(organizationId: string): string {
  return join(UPLOAD_DIR, "documents", organizationId);
}

/**
 * Ensure upload directory exists
 */
export async function ensureUploadDir(organizationId: string): Promise<void> {
  const dir = getDocumentUploadDir(organizationId);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Validate file type by MIME type
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Verify file content matches declared MIME type using magic bytes
 */
export function verifyFileType(buffer: Buffer, mimeType: string): boolean {
  const magicBytes = MAGIC_BYTES[mimeType];

  if (!magicBytes) {
    return false;
  }

  // Check if buffer starts with any of the magic byte sequences
  return magicBytes.some((sequence) => {
    if (buffer.length < sequence.length) {
      return false;
    }

    return sequence.every((byte, index) => buffer[index] === byte);
  });
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Generate unique filename with extension
 */
export function generateUniqueFileName(
  originalName: string,
  mimeType: string
): string {
  const uuid = randomUUID();
  const extension = MIME_TO_EXTENSION[mimeType] || ".bin";

  return `${uuid}${extension}`;
}

/**
 * Save file to local storage
 *
 * @param buffer - File buffer
 * @param organizationId - Organization ID for folder organization
 * @param originalName - Original file name
 * @param mimeType - MIME type of the file
 * @returns Object with fileName and filePath
 */
export async function saveFile(
  buffer: Buffer,
  organizationId: string,
  originalName: string,
  mimeType: string
): Promise<{ fileName: string; filePath: string; fileUrl: string }> {
  // Ensure upload directory exists
  await ensureUploadDir(organizationId);

  // Generate unique filename
  const fileName = generateUniqueFileName(originalName, mimeType);
  const filePath = join(getDocumentUploadDir(organizationId), fileName);

  // Save file
  await writeFile(filePath, buffer);

  // Generate URL (for local storage, it's a path relative to /uploads)
  const fileUrl = `/uploads/documents/${organizationId}/${fileName}`;

  return { fileName, filePath, fileUrl };
}

/**
 * Delete file from storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Read file from storage
 */
export async function readFileFromStorage(filePath: string): Promise<Buffer> {
  return await readFile(filePath);
}

/**
 * Validate uploaded file
 *
 * Performs:
 * - MIME type validation
 * - File size validation
 * - Magic bytes verification
 *
 * @param buffer - File buffer
 * @param mimeType - Declared MIME type
 * @param fileSize - File size in bytes
 * @returns Validation result with error message if invalid
 */
export function validateUploadedFile(
  buffer: Buffer,
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // Check MIME type
  if (!isAllowedMimeType(mimeType)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: PDF, JPG, PNG. Got: ${mimeType}`,
    };
  }

  // Check file size
  if (!isValidFileSize(fileSize)) {
    return {
      valid: false,
      error: `File size must be between 1 byte and ${MAX_FILE_SIZE / 1024 / 1024}MB. Got: ${fileSize} bytes`,
    };
  }

  // Verify magic bytes
  if (!verifyFileType(buffer, mimeType)) {
    return {
      valid: false,
      error: `File content does not match declared type ${mimeType}. Possible file type mismatch or corruption.`,
    };
  }

  return { valid: true };
}
