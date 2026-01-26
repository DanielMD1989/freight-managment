# S3 File Storage Migration Plan

**Date:** 2026-01-23
**Version:** 1.0
**Priority:** HIGH
**Target:** 10,000+ DAU Production Environment

---

## Executive Summary

This plan outlines the migration from local file storage to Amazon S3 (or compatible object storage). Local file storage is a **critical blocker** for horizontal scaling - files stored on one server instance are not accessible from other instances.

### Current State: LOCAL DISK (blocks horizontal scaling)
### Target State: S3 + CloudFront CDN

---

## File Types to Migrate

| File Type | Current Location | Typical Size | Access Pattern |
|-----------|------------------|--------------|----------------|
| Profile Pictures | `/uploads/profiles/` | 50KB-2MB | High read, low write |
| Shipment Documents | `/uploads/shipments/` | 100KB-10MB | Medium read/write |
| Proof of Delivery (POD) | `/uploads/pod/` | 500KB-5MB | Write once, read many |
| Invoices | `/uploads/invoices/` | 50KB-500KB | Write once, read few |
| Truck Documents | `/uploads/trucks/` | 100KB-5MB | Low read, low write |
| Organization Documents | `/uploads/orgs/` | 100KB-10MB | Low read/write |

**Estimated Total Storage:** 10-50GB for 10K DAU
**Estimated Monthly Requests:** 500K-2M

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         File Upload Flow                                 │
│                                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────────┐   │
│  │  Client  │───►│  API Server  │───►│  S3 Bucket                  │   │
│  │  (Web/   │    │  (Presigned  │    │  - freight-uploads-prod     │   │
│  │  Mobile) │    │   URL Gen)   │    │  - Lifecycle policies       │   │
│  └──────────┘    └──────────────┘    │  - Encryption at rest       │   │
│                                       └─────────────────────────────┘   │
│                                                    │                     │
│                                                    ▼                     │
│                                       ┌─────────────────────────────┐   │
│                                       │  CloudFront CDN             │   │
│                                       │  - Global edge caching      │   │
│                                       │  - HTTPS only               │   │
│                                       │  - Signed URLs for private  │   │
│                                       └─────────────────────────────┘   │
│                                                    │                     │
│  ┌──────────┐                                     │                     │
│  │  Client  │◄────────────────────────────────────┘                     │
│  │  (Read)  │    Fast CDN delivery                                      │
│  └──────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AWS Infrastructure Setup

### Terraform Configuration

```hcl
# s3-storage.tf

# =============================================================================
# S3 BUCKET
# =============================================================================

resource "aws_s3_bucket" "uploads" {
  bucket = "freight-uploads-${var.environment}"

  tags = {
    Name        = "freight-uploads"
    Environment = var.environment
    Purpose     = "User file uploads"
  }
}

# Block public access (files accessed via signed URLs or CloudFront)
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Encryption at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# KMS Key for encryption
resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "freight-s3-key"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/freight-s3-${var.environment}"
  target_key_id = aws_kms_key.s3.key_id
}

# Versioning (for accidental deletion protection)
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  # Move old versions to cheaper storage
  rule {
    id     = "archive-old-versions"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  # Abort incomplete multipart uploads
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Delete expired temp files
  rule {
    id     = "delete-temp-files"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 1
    }
  }
}

# CORS configuration (for direct browser uploads)
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag", "Content-Length"]
    max_age_seconds = 3600
  }
}

# =============================================================================
# CLOUDFRONT CDN
# =============================================================================

# Origin Access Identity (OAI)
resource "aws_cloudfront_origin_access_identity" "uploads" {
  comment = "OAI for freight uploads bucket"
}

# Bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.uploads.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "uploads" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Freight uploads CDN"
  default_root_object = ""
  price_class         = "PriceClass_100"  # US, Canada, Europe

  origin {
    domain_name = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id   = "S3-freight-uploads"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.uploads.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-freight-uploads"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year

    # Signed URLs for private content
    trusted_signers = var.use_signed_urls ? ["self"] : []
  }

  # Cache behavior for profile pictures (longer cache)
  ordered_cache_behavior {
    path_pattern     = "profiles/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-freight-uploads"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 604800   # 7 days
    max_ttl                = 31536000 # 1 year
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # For custom domain:
    # acm_certificate_arn      = var.certificate_arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "freight-uploads-cdn"
    Environment = var.environment
  }
}

# =============================================================================
# IAM ROLE FOR APPLICATION
# =============================================================================

resource "aws_iam_role" "app_s3_access" {
  name = "freight-app-s3-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      },
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "${var.oidc_provider}:sub" = "system:serviceaccount:${var.namespace}:freight-app"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "app_s3_policy" {
  name = "freight-app-s3-policy"
  role = aws_iam_role.app_s3_access.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3BucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      },
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.s3.arn
      }
    ]
  })
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "s3_bucket_name" {
  value = aws_s3_bucket.uploads.id
}

output "s3_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.uploads.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.uploads.id
}
```

### AWS CLI Quick Setup

```bash
#!/bin/bash
# quick-s3-setup.sh

BUCKET_NAME="freight-uploads-production"
REGION="us-east-1"

# Create bucket
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $REGION

# Block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket $BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Set CORS
aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["https://app.freight.com", "https://admin.freight.com"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3600
    }]
  }'

# Create folders
aws s3api put-object --bucket $BUCKET_NAME --key profiles/
aws s3api put-object --bucket $BUCKET_NAME --key shipments/
aws s3api put-object --bucket $BUCKET_NAME --key pod/
aws s3api put-object --bucket $BUCKET_NAME --key invoices/
aws s3api put-object --bucket $BUCKET_NAME --key trucks/
aws s3api put-object --bucket $BUCKET_NAME --key orgs/

echo "S3 bucket created successfully!"
echo "Bucket: $BUCKET_NAME"
```

---

## Application Code: S3 Adapter

### lib/storage/s3-adapter.ts

```typescript
// lib/storage/s3-adapter.ts

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  cdnDomain?: string;
  signedUrlExpiry?: number; // seconds
}

function getS3Config(): S3Config {
  return {
    bucket: process.env.S3_BUCKET || 'freight-uploads',
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    cdnDomain: process.env.CDN_DOMAIN,
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600'),
  };
}

// =============================================================================
// S3 CLIENT SINGLETON
// =============================================================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const config = getS3Config();

  s3Client = new S3Client({
    region: config.region,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}), // Use IAM role if no credentials
  });

  return s3Client;
}

// =============================================================================
// FILE TYPES & PATHS
// =============================================================================

export type FileType =
  | 'profile'
  | 'shipment'
  | 'pod'
  | 'invoice'
  | 'truck'
  | 'org';

const FILE_TYPE_PATHS: Record<FileType, string> = {
  profile: 'profiles',
  shipment: 'shipments',
  pod: 'pod',
  invoice: 'invoices',
  truck: 'trucks',
  org: 'orgs',
};

const ALLOWED_MIME_TYPES: Record<FileType, string[]> = {
  profile: ['image/jpeg', 'image/png', 'image/webp'],
  shipment: ['application/pdf', 'image/jpeg', 'image/png'],
  pod: ['image/jpeg', 'image/png', 'application/pdf'],
  invoice: ['application/pdf'],
  truck: ['application/pdf', 'image/jpeg', 'image/png'],
  org: ['application/pdf', 'image/jpeg', 'image/png'],
};

const MAX_FILE_SIZES: Record<FileType, number> = {
  profile: 2 * 1024 * 1024, // 2MB
  shipment: 10 * 1024 * 1024, // 10MB
  pod: 5 * 1024 * 1024, // 5MB
  invoice: 5 * 1024 * 1024, // 5MB
  truck: 5 * 1024 * 1024, // 5MB
  org: 10 * 1024 * 1024, // 10MB
};

// =============================================================================
// STORAGE ADAPTER
// =============================================================================

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl?: string;
  size: number;
  contentType: string;
  etag?: string;
}

export interface UploadOptions {
  fileType: FileType;
  entityId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  metadata?: Record<string, string>;
}

/**
 * Generate a unique file key
 */
function generateFileKey(
  fileType: FileType,
  entityId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const hash = createHash('md5').update(`${entityId}-${timestamp}`).digest('hex').substring(0, 8);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const folder = FILE_TYPE_PATHS[fileType];

  return `${folder}/${entityId}/${hash}-${sanitizedName}`;
}

/**
 * Validate file before upload
 */
export function validateFile(
  fileType: FileType,
  contentType: string,
  size: number
): { valid: boolean; error?: string } {
  const allowedTypes = ALLOWED_MIME_TYPES[fileType];
  const maxSize = MAX_FILE_SIZES[fileType];

  if (!allowedTypes.includes(contentType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum: ${maxSize / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Upload a file to S3
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { fileType, entityId, fileName, contentType, buffer, metadata } = options;
  const config = getS3Config();
  const client = getS3Client();

  // Validate
  const validation = validateFile(fileType, contentType, buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate key
  const key = generateFileKey(fileType, entityId, fileName);

  // Upload
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: {
      ...metadata,
      'uploaded-by': 'freight-api',
      'upload-timestamp': new Date().toISOString(),
    },
    // Cache control
    CacheControl: fileType === 'profile' ? 'max-age=604800' : 'max-age=86400',
  });

  const response = await client.send(command);

  // Build URLs
  const s3Url = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
  const cdnUrl = config.cdnDomain ? `https://${config.cdnDomain}/${key}` : undefined;

  return {
    key,
    url: s3Url,
    cdnUrl,
    size: buffer.length,
    contentType,
    etag: response.ETag,
  };
}

/**
 * Generate a presigned URL for direct upload
 */
export async function getPresignedUploadUrl(
  fileType: FileType,
  entityId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string; expiresAt: Date }> {
  const config = getS3Config();
  const client = getS3Client();

  // Validate content type
  const allowedTypes = ALLOWED_MIME_TYPES[fileType];
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`Invalid content type. Allowed: ${allowedTypes.join(', ')}`);
  }

  const key = generateFileKey(fileType, entityId, fileName);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: config.signedUrlExpiry,
  });

  const expiresAt = new Date(Date.now() + (config.signedUrlExpiry || 3600) * 1000);

  return { uploadUrl, key, expiresAt };
}

/**
 * Generate a presigned URL for download
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn?: number
): Promise<string> {
  const config = getS3Config();
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  return getSignedUrl(client, command, {
    expiresIn: expiresIn || config.signedUrlExpiry,
  });
}

/**
 * Get public URL (via CDN or S3)
 */
export function getPublicUrl(key: string): string {
  const config = getS3Config();

  if (config.cdnDomain) {
    return `https://${config.cdnDomain}/${key}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

/**
 * Delete a file
 */
export async function deleteFile(key: string): Promise<void> {
  const config = getS3Config();
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Check if file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  const config = getS3Config();
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files for an entity
 */
export async function listFiles(
  fileType: FileType,
  entityId: string
): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const config = getS3Config();
  const client = getS3Client();

  const prefix = `${FILE_TYPE_PATHS[fileType]}/${entityId}/`;

  const command = new ListObjectsV2Command({
    Bucket: config.bucket,
    Prefix: prefix,
  });

  const response = await client.send(command);

  return (response.Contents || []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}

/**
 * Copy file (for moving between folders)
 */
export async function copyFile(
  sourceKey: string,
  destinationKey: string
): Promise<void> {
  const config = getS3Config();
  const client = getS3Client();

  const { CopyObjectCommand } = await import('@aws-sdk/client-s3');

  const command = new CopyObjectCommand({
    Bucket: config.bucket,
    CopySource: `${config.bucket}/${sourceKey}`,
    Key: destinationKey,
  });

  await client.send(command);
}
```

### lib/storage/index.ts (Unified Interface)

```typescript
// lib/storage/index.ts

import * as s3 from './s3-adapter';
import * as local from './local-adapter'; // Existing local adapter

export type StorageProvider = 'local' | 's3';

function getStorageProvider(): StorageProvider {
  return (process.env.STORAGE_PROVIDER as StorageProvider) || 'local';
}

// Re-export types
export type { FileType, UploadResult, UploadOptions } from './s3-adapter';

/**
 * Upload file using configured storage provider
 */
export async function uploadFile(
  options: s3.UploadOptions
): Promise<s3.UploadResult> {
  const provider = getStorageProvider();

  if (provider === 's3') {
    return s3.uploadFile(options);
  }

  // Local fallback (development)
  return local.uploadFile(options);
}

/**
 * Get file URL
 */
export function getFileUrl(key: string): string {
  const provider = getStorageProvider();

  if (provider === 's3') {
    return s3.getPublicUrl(key);
  }

  return local.getFileUrl(key);
}

/**
 * Get presigned upload URL (S3 only)
 */
export async function getPresignedUploadUrl(
  fileType: s3.FileType,
  entityId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string; expiresAt: Date }> {
  const provider = getStorageProvider();

  if (provider !== 's3') {
    throw new Error('Presigned URLs only available with S3 storage');
  }

  return s3.getPresignedUploadUrl(fileType, entityId, fileName, contentType);
}

/**
 * Delete file
 */
export async function deleteFile(key: string): Promise<void> {
  const provider = getStorageProvider();

  if (provider === 's3') {
    return s3.deleteFile(key);
  }

  return local.deleteFile(key);
}

/**
 * Validate file
 */
export function validateFile(
  fileType: s3.FileType,
  contentType: string,
  size: number
): { valid: boolean; error?: string } {
  return s3.validateFile(fileType, contentType, size);
}
```

---

## API Endpoints

### Upload Endpoint

```typescript
// app/api/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, validateFile, FileType } from '@/lib/storage';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const fileType = formData.get('fileType') as FileType;
  const entityId = formData.get('entityId') as string;

  if (!file || !fileType || !entityId) {
    return NextResponse.json(
      { error: 'Missing required fields: file, fileType, entityId' },
      { status: 400 }
    );
  }

  // Validate
  const validation = validateFile(fileType, file.type, file.size);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Convert to buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload
  const result = await uploadFile({
    fileType,
    entityId,
    fileName: file.name,
    contentType: file.type,
    buffer,
    metadata: {
      'uploaded-by-user': user.id,
    },
  });

  return NextResponse.json({
    success: true,
    key: result.key,
    url: result.cdnUrl || result.url,
    size: result.size,
  });
}
```

### Presigned URL Endpoint (Direct Upload)

```typescript
// app/api/upload/presign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl, FileType } from '@/lib/storage';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileType, entityId, fileName, contentType } = await request.json();

  if (!fileType || !entityId || !fileName || !contentType) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const { uploadUrl, key, expiresAt } = await getPresignedUploadUrl(
      fileType as FileType,
      entityId,
      fileName,
      contentType
    );

    return NextResponse.json({
      uploadUrl,
      key,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
}
```

---

## Migration Script

```typescript
// scripts/migrate-files-to-s3.ts

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { uploadFile, FileType } from '../lib/storage/s3-adapter';
import { db } from '../lib/db';

const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || './uploads';

const FILE_TYPE_MAPPING: Record<string, FileType> = {
  profiles: 'profile',
  shipments: 'shipment',
  pod: 'pod',
  invoices: 'invoice',
  trucks: 'truck',
  orgs: 'org',
};

interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

async function migrateDirectory(
  dirPath: string,
  fileType: FileType
): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Entity subdirectory (e.g., user ID)
        const entityId = entry.name;
        const entityPath = join(dirPath, entityId);
        const files = await readdir(entityPath);

        for (const fileName of files) {
          result.total++;
          const filePath = join(entityPath, fileName);

          try {
            const fileStat = await stat(filePath);
            const buffer = await readFile(filePath);

            // Detect content type
            const ext = fileName.split('.').pop()?.toLowerCase();
            const contentType = getContentType(ext || '');

            if (!contentType) {
              result.skipped++;
              console.log(`Skipped (unknown type): ${filePath}`);
              continue;
            }

            // Upload to S3
            const uploadResult = await uploadFile({
              fileType,
              entityId,
              fileName,
              contentType,
              buffer,
              metadata: {
                'migrated-from': 'local',
                'original-path': filePath,
              },
            });

            console.log(`Migrated: ${filePath} -> ${uploadResult.key}`);
            result.migrated++;

            // Update database references (if applicable)
            await updateDatabaseReference(fileType, entityId, fileName, uploadResult.key);
          } catch (error) {
            result.failed++;
            result.errors.push({
              file: filePath,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            console.error(`Failed: ${filePath}`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return result;
}

function getContentType(ext: string): string | null {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  return types[ext] || null;
}

async function updateDatabaseReference(
  fileType: FileType,
  entityId: string,
  fileName: string,
  s3Key: string
): Promise<void> {
  // Update database records based on file type
  switch (fileType) {
    case 'profile':
      await db.user.updateMany({
        where: { id: entityId },
        data: { profilePictureUrl: s3Key },
      });
      break;
    // Add other file types as needed
  }
}

async function runMigration(): Promise<void> {
  console.log('=== Starting File Migration to S3 ===');
  console.log(`Source: ${LOCAL_UPLOADS_DIR}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const totalResults: MigrationResult = {
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const [dirName, fileType] of Object.entries(FILE_TYPE_MAPPING)) {
    const dirPath = join(LOCAL_UPLOADS_DIR, dirName);
    console.log(`\nMigrating ${dirName}...`);

    const result = await migrateDirectory(dirPath, fileType);

    totalResults.total += result.total;
    totalResults.migrated += result.migrated;
    totalResults.failed += result.failed;
    totalResults.skipped += result.skipped;
    totalResults.errors.push(...result.errors);

    console.log(`  Total: ${result.total}`);
    console.log(`  Migrated: ${result.migrated}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Skipped: ${result.skipped}`);
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Total Files: ${totalResults.total}`);
  console.log(`Migrated: ${totalResults.migrated}`);
  console.log(`Failed: ${totalResults.failed}`);
  console.log(`Skipped: ${totalResults.skipped}`);

  if (totalResults.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of totalResults.errors) {
      console.log(`  ${err.file}: ${err.error}`);
    }
  }
}

// Run
runMigration().catch(console.error);
```

---

## Environment Configuration

```bash
# .env.production

# Storage Provider
STORAGE_PROVIDER=s3

# AWS S3 Configuration
S3_BUCKET=freight-uploads-production
AWS_REGION=us-east-1

# CDN (CloudFront)
CDN_DOMAIN=d1234567890.cloudfront.net

# Signed URL expiry (seconds)
SIGNED_URL_EXPIRY=3600

# For local development (use AWS credentials or IAM role)
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
```

---

## Cost Estimate

| Component | Usage | Monthly Cost |
|-----------|-------|--------------|
| S3 Storage | 50GB | ~$1.15 |
| S3 Requests | 2M GET, 500K PUT | ~$2.50 |
| CloudFront Transfer | 100GB | ~$8.50 |
| CloudFront Requests | 2M | ~$1.50 |
| **Total** | | **~$15/month** |

---

## Migration Checklist

### Pre-Migration

- [ ] Create S3 bucket with proper configuration
- [ ] Set up CloudFront distribution
- [ ] Configure IAM roles and policies
- [ ] Test S3 adapter in staging
- [ ] Back up local files

### Migration Steps

- [ ] Deploy S3 adapter code
- [ ] Run migration script (staging)
- [ ] Verify migrated files
- [ ] Update environment variables
- [ ] Deploy to production
- [ ] Run migration script (production)
- [ ] Verify all files accessible

### Post-Migration

- [ ] Monitor CloudFront cache hits
- [ ] Verify upload/download flows
- [ ] Remove local storage after 30 days
- [ ] Update documentation

---

## Timeline

| Day | Task |
|-----|------|
| 1 | Create S3 bucket and CloudFront |
| 2 | Implement S3 adapter |
| 3 | Test in staging |
| 4 | Run staging migration |
| 5 | Production deployment |
| 6 | Production migration |
| 7 | Monitoring and verification |

**Total: 1-2 weeks**

---

**Report Generated:** 2026-01-23
**Version:** 1.0
**Status:** READY FOR IMPLEMENTATION
