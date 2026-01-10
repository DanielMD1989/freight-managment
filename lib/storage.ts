/**
 * Storage Service
 *
 * Abstraction layer for file storage.
 * Supports local filesystem (development) and cloud storage (production).
 *
 * Environment Variables:
 * - STORAGE_PROVIDER: 'local' | 's3' | 'cloudinary' (default: 'local')
 * - AWS_S3_BUCKET: S3 bucket name
 * - AWS_REGION: AWS region
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - CLOUDINARY_CLOUD_NAME: Cloudinary cloud name
 * - CLOUDINARY_API_KEY: Cloudinary API key
 * - CLOUDINARY_API_SECRET: Cloudinary API secret
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  publicId?: string;
  size?: number;
  error?: string;
}

/**
 * Storage provider type
 */
export type StorageProvider = 'local' | 's3' | 'cloudinary';

/**
 * Get current storage provider from environment
 */
export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  return provider as StorageProvider;
}

/**
 * Generate a unique file key/name
 */
export function generateFileKey(prefix: string, originalName: string): string {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const safeName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 50);
  return `${prefix}/${timestamp}_${randomId}_${safeName}${ext ? '' : '.bin'}`;
}

/**
 * Upload a file to storage
 */
export async function uploadFile(
  buffer: Buffer | ArrayBuffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return uploadToLocal(buffer, key);
    case 's3':
      return uploadToS3(buffer, key, mimeType);
    case 'cloudinary':
      return uploadToCloudinary(buffer, key, mimeType);
    default:
      return uploadToLocal(buffer, key);
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return deleteFromLocal(key);
    case 's3':
      return deleteFromS3(key);
    case 'cloudinary':
      return deleteFromCloudinary(key);
    default:
      return deleteFromLocal(key);
  }
}

/**
 * Get a signed URL for file access (useful for private files)
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return `/uploads/${key}`;
    case 's3':
      return getS3SignedUrl(key, expiresIn);
    case 'cloudinary':
      // Cloudinary URLs are typically public by default
      return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${key}`;
    default:
      return `/uploads/${key}`;
  }
}

// ============================================================================
// LOCAL FILESYSTEM STORAGE (Development)
// ============================================================================

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * Ensure uploads directory exists
 */
async function ensureUploadsDir(subdir: string): Promise<void> {
  const dir = path.join(UPLOADS_DIR, path.dirname(subdir));
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Upload file to local filesystem
 */
async function uploadToLocal(buffer: Buffer | ArrayBuffer, key: string): Promise<UploadResult> {
  try {
    await ensureUploadsDir(key);
    const filePath = path.join(UPLOADS_DIR, key);
    const data = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    await fs.writeFile(filePath, data);

    return {
      success: true,
      url: `/uploads/${key}`,
      key,
      size: data.length,
    };
  } catch (error) {
    console.error('Local upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete file from local filesystem
 */
async function deleteFromLocal(key: string): Promise<boolean> {
  try {
    const filePath = path.join(UPLOADS_DIR, key);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Local delete error:', error);
    return false;
  }
}

// ============================================================================
// AWS S3 STORAGE (Production)
// ============================================================================

/**
 * Upload file to S3
 *
 * Note: Requires @aws-sdk/client-s3 package
 * npm install @aws-sdk/client-s3
 */
async function uploadToS3(
  buffer: Buffer | ArrayBuffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET not configured');
    }

    const data = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: mimeType,
      })
    );

    const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return {
      success: true,
      url,
      key,
      size: data.length,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'S3 upload failed',
    };
  }
}

/**
 * Delete file from S3
 *
 * Note: S3 functionality requires optional dependencies:
 * npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
async function deleteFromS3(key: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      return false;
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
}

/**
 * Get signed URL from S3
 */
async function getS3SignedUrl(key: string, expiresIn: number): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedUrl: s3GetSignedUrl } = require('@aws-sdk/s3-request-presigner');

    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await s3GetSignedUrl(client, command, { expiresIn });
  } catch (error) {
    console.error('S3 signed URL error:', error);
    return null;
  }
}

// ============================================================================
// CLOUDINARY STORAGE (Production Alternative)
// ============================================================================

/**
 * Upload file to Cloudinary
 *
 * Note: Cloudinary functionality requires optional dependency:
 * npm install cloudinary
 */
async function uploadToCloudinary(
  buffer: Buffer | ArrayBuffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cloudinary = require('cloudinary');

    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const data = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    const base64Data = data.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    const result = await cloudinary.v2.uploader.upload(dataUri, {
      public_id: key.replace(/\.[^/.]+$/, ''), // Remove extension for public_id
      resource_type: 'auto',
      folder: 'freight-management',
    });

    return {
      success: true,
      url: result.secure_url,
      key,
      publicId: result.public_id,
      size: data.length,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cloudinary upload failed',
    };
  }
}

/**
 * Delete file from Cloudinary
 */
async function deleteFromCloudinary(key: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cloudinary = require('cloudinary');

    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const publicId = key.replace(/\.[^/.]+$/, '');
    await cloudinary.v2.uploader.destroy(`freight-management/${publicId}`);

    return true;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Upload POD document
 *
 * Convenience function specifically for POD uploads
 */
export async function uploadPOD(
  file: File | { buffer: Buffer; name: string; type: string },
  loadId: string
): Promise<UploadResult> {
  const isFile = file instanceof File;
  const buffer = isFile ? await file.arrayBuffer() : file.buffer;
  const name = isFile ? file.name : file.name;
  const mimeType = isFile ? file.type : file.type;

  const key = generateFileKey(`pod/${loadId}`, name);
  return uploadFile(buffer, key, mimeType);
}

/**
 * Upload document (license, registration, etc.)
 */
export async function uploadDocument(
  file: File | { buffer: Buffer; name: string; type: string },
  type: string,
  entityId: string
): Promise<UploadResult> {
  const isFile = file instanceof File;
  const buffer = isFile ? await file.arrayBuffer() : file.buffer;
  const name = isFile ? file.name : file.name;
  const mimeType = isFile ? file.type : file.type;

  const key = generateFileKey(`documents/${type}/${entityId}`, name);
  return uploadFile(buffer, key, mimeType);
}

/**
 * Upload profile photo
 */
export async function uploadProfilePhoto(
  file: File | { buffer: Buffer; name: string; type: string },
  userId: string
): Promise<UploadResult> {
  const isFile = file instanceof File;
  const buffer = isFile ? await file.arrayBuffer() : file.buffer;
  const name = isFile ? file.name : file.name;
  const mimeType = isFile ? file.type : file.type;

  const key = generateFileKey(`profiles/${userId}`, name);
  return uploadFile(buffer, key, mimeType);
}
