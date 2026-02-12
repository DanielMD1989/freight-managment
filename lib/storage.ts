/**
 * Storage Service
 *
 * PHASE 3: Medium Priority Architecture - S3 + CDN File Storage
 *
 * Abstraction layer for file storage supporting horizontal scaling.
 * Supports local filesystem (development) and cloud storage (production).
 *
 * Environment Variables:
 * - STORAGE_PROVIDER: 'local' | 's3' | 'cloudinary' (default: 'local')
 * - AWS_S3_BUCKET: S3 bucket name
 * - AWS_REGION: AWS region
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - CDN_DOMAIN: CloudFront/CDN domain (e.g., 'cdn.example.com')
 * - CDN_ENABLED: Enable CDN URLs ('true' | 'false', default: 'false')
 * - CLOUDINARY_CLOUD_NAME: Cloudinary cloud name
 * - CLOUDINARY_API_KEY: Cloudinary API key
 * - CLOUDINARY_API_SECRET: Cloudinary API secret
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Helper to prevent webpack from analyzing dynamic requires
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic require for optional SDK dependencies (AWS S3, Cloudinary)
const dynamicRequire = (moduleName: string): any => { // eslint-disable-line @typescript-eslint/no-explicit-any
  // Use eval to prevent webpack bundling analysis
  // eslint-disable-next-line no-eval
  return eval('require')(moduleName);
};

// ============================================================================
// PHASE 3: CDN CONFIGURATION
// ============================================================================

/**
 * Check if CDN is enabled
 */
export function isCDNEnabled(): boolean {
  return process.env.CDN_ENABLED === 'true' && !!process.env.CDN_DOMAIN;
}

/**
 * Get CDN domain
 */
export function getCDNDomain(): string | null {
  return process.env.CDN_DOMAIN || null;
}

/**
 * Convert S3 URL to CDN URL
 */
export function getCDNUrl(key: string): string {
  const cdnDomain = getCDNDomain();
  if (cdnDomain) {
    return `https://${cdnDomain}/${key}`;
  }
  // Fallback to S3 URL
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Get the public URL for a file (CDN or direct S3/local)
 */
export function getPublicUrl(key: string): string {
  const provider = getStorageProvider();

  switch (provider) {
    case 's3':
      if (isCDNEnabled()) {
        return getCDNUrl(key);
      }
      const bucket = process.env.AWS_S3_BUCKET;
      const region = process.env.AWS_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    case 'cloudinary':
      return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${key}`;
    case 'local':
    default:
      return `/uploads/${key}`;
  }
}

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
    const { S3Client, PutObjectCommand } = dynamicRequire('@aws-sdk/client-s3');

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

    // PHASE 3: Return CDN URL if enabled, otherwise direct S3 URL
    const url = isCDNEnabled()
      ? getCDNUrl(key)
      : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

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
    const { S3Client, DeleteObjectCommand } = dynamicRequire('@aws-sdk/client-s3');

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
    const { S3Client, GetObjectCommand } = dynamicRequire('@aws-sdk/client-s3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedUrl: s3GetSignedUrl } = dynamicRequire('@aws-sdk/s3-request-presigner');

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
    const cloudinary = dynamicRequire('cloudinary');

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
    const cloudinary = dynamicRequire('cloudinary');

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

// ============================================================================
// PHASE 3: STORAGE HEALTH & DIAGNOSTICS
// ============================================================================

/**
 * Storage health check result
 */
export interface StorageHealthResult {
  provider: StorageProvider;
  healthy: boolean;
  latencyMs?: number;
  cdnEnabled: boolean;
  cdnDomain?: string;
  error?: string;
}

/**
 * Check storage health
 * Verifies connectivity to the configured storage provider
 */
export async function checkStorageHealth(): Promise<StorageHealthResult> {
  const provider = getStorageProvider();
  const startTime = Date.now();

  const result: StorageHealthResult = {
    provider,
    healthy: false,
    cdnEnabled: isCDNEnabled(),
    cdnDomain: getCDNDomain() || undefined,
  };

  try {
    switch (provider) {
      case 's3':
        await checkS3Health();
        break;
      case 'cloudinary':
        await checkCloudinaryHealth();
        break;
      case 'local':
      default:
        await checkLocalHealth();
        break;
    }

    result.healthy = true;
    result.latencyMs = Date.now() - startTime;
  } catch (error) {
    result.healthy = false;
    result.error = error instanceof Error ? error.message : 'Health check failed';
    result.latencyMs = Date.now() - startTime;
  }

  return result;
}

/**
 * Check S3 connectivity
 * Note: AWS SDK must be installed: npm install @aws-sdk/client-s3
 */
async function checkS3Health(): Promise<void> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET not configured');
  }

  // Try to load AWS SDK dynamically using require (wrapped in try-catch)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, HeadBucketCommand } = dynamicRequire('@aws-sdk/client-s3');

    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('AWS SDK not installed. Run: npm install @aws-sdk/client-s3');
    }
    throw error;
  }
}

/**
 * Check Cloudinary connectivity
 * Note: Cloudinary SDK must be installed: npm install cloudinary
 */
async function checkCloudinaryHealth(): Promise<void> {
  // Check if required env vars are set
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    throw new Error('Cloudinary not configured. Set CLOUDINARY_* environment variables.');
  }

  // Try to load cloudinary module dynamically using require (wrapped in try-catch)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cloudinary = dynamicRequire('cloudinary');

    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    await cloudinary.v2.api.ping();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Cloudinary SDK not installed. Run: npm install cloudinary');
    }
    throw error;
  }
}

/**
 * Check local storage health
 */
async function checkLocalHealth(): Promise<void> {
  // Verify uploads directory exists and is writable
  try {
    await fs.access(UPLOADS_DIR, fs.constants.W_OK);
  } catch {
    // Create directory if it doesn't exist
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// ============================================================================
// PHASE 3: FILE MIGRATION UTILITIES
// ============================================================================

/**
 * Migration result for a single file
 */
export interface MigrationResult {
  localPath: string;
  key: string;
  success: boolean;
  newUrl?: string;
  error?: string;
}

/**
 * List all files in local storage
 */
export async function listLocalFiles(subdir: string = ''): Promise<string[]> {
  const dir = path.join(UPLOADS_DIR, subdir);
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.join(subdir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await listLocalFiles(relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    console.error(`Error listing files in ${dir}:`, error);
  }

  return files;
}

/**
 * Migrate a single file from local to S3
 */
export async function migrateFileToS3(localKey: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    localPath: path.join(UPLOADS_DIR, localKey),
    key: localKey,
    success: false,
  };

  try {
    // Read local file
    const filePath = path.join(UPLOADS_DIR, localKey);
    const buffer = await fs.readFile(filePath);

    // Determine MIME type from extension
    const ext = path.extname(localKey).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Upload to S3
    const uploadResult = await uploadToS3(buffer, localKey, mimeType);

    if (uploadResult.success) {
      result.success = true;
      result.newUrl = uploadResult.url;
    } else {
      result.error = uploadResult.error;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Migration failed';
  }

  return result;
}

/**
 * Batch migrate files from local to S3
 * Returns migration results for each file
 */
export async function migrateAllFilesToS3(options?: {
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: MigrationResult[];
}> {
  const { batchSize = 10, onProgress } = options || {};

  // List all local files
  const files = await listLocalFiles();
  const results: MigrationResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(file => migrateFileToS3(file))
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        successful++;
      } else {
        failed++;
        console.error(`[Migration Failed] ${result.key}: ${result.error}`);
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, files.length), files.length);
    }

    }

  return {
    total: files.length,
    successful,
    failed,
    results,
  };
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  provider: StorageProvider;
  cdnEnabled: boolean;
  localFileCount: number;
  localTotalSize: number;
}> {
  const provider = getStorageProvider();
  const files = await listLocalFiles();
  let totalSize = 0;

  for (const file of files) {
    try {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    } catch {
      // File may have been deleted
    }
  }

  return {
    provider,
    cdnEnabled: isCDNEnabled(),
    localFileCount: files.length,
    localTotalSize: totalSize,
  };
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(key: string): Promise<boolean> {
  const provider = getStorageProvider();

  switch (provider) {
    case 's3':
      return s3FileExists(key);
    case 'cloudinary':
      // Cloudinary doesn't have a direct check, try to get the URL
      return true; // Assume exists for Cloudinary
    case 'local':
    default:
      try {
        await fs.access(path.join(UPLOADS_DIR, key));
        return true;
      } catch {
        return false;
      }
  }
}

/**
 * Check if file exists in S3
 */
async function s3FileExists(key: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, HeadObjectCommand } = dynamicRequire('@aws-sdk/client-s3');

    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) return false;

    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
