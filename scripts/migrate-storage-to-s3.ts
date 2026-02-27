#!/usr/bin/env npx tsx

/**
 * Storage Migration Script
 *
 * PHASE 3: Medium Priority Architecture - Migrate Local Files to S3
 *
 * This script migrates all local files to AWS S3 and optionally updates
 * database records with new URLs.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage-to-s3.ts
 *   npx tsx scripts/migrate-storage-to-s3.ts --dry-run
 *   npx tsx scripts/migrate-storage-to-s3.ts --update-db
 *   npx tsx scripts/migrate-storage-to-s3.ts --batch-size=20
 *
 * Options:
 *   --dry-run       Show what would be migrated without actually migrating
 *   --update-db     Update database records with new S3/CDN URLs
 *   --batch-size=N  Number of files to process in parallel (default: 10)
 *   --delete-local  Delete local files after successful migration
 *
 * Prerequisites:
 *   1. Set STORAGE_PROVIDER=s3 in .env
 *   2. Configure AWS credentials:
 *      - AWS_ACCESS_KEY_ID
 *      - AWS_SECRET_ACCESS_KEY
 *      - AWS_REGION
 *      - AWS_S3_BUCKET
 *   3. Optionally set CDN_DOMAIN and CDN_ENABLED=true for CloudFront
 */

import {
  listLocalFiles,
  migrateFileToS3,
  getStorageStats,
  checkStorageHealth,
  getPublicUrl,
  isCDNEnabled,
  getCDNDomain,
} from "../lib/storage";
import { db } from "../lib/db";
import fs from "fs/promises";
import path from "path";

// =============================================================================
// CONFIGURATION
// =============================================================================

interface MigrationConfig {
  dryRun: boolean;
  updateDb: boolean;
  deleteLocal: boolean;
  batchSize: number;
}

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    dryRun: false,
    updateDb: false,
    deleteLocal: false,
    batchSize: 10,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg === "--update-db") {
      config.updateDb = true;
    } else if (arg === "--delete-local") {
      config.deleteLocal = true;
    } else if (arg.startsWith("--batch-size=")) {
      config.batchSize = parseInt(arg.split("=")[1]);
    }
  }

  return config;
}

// =============================================================================
// DATABASE UPDATE FUNCTIONS
// =============================================================================

interface DocumentRecord {
  id: string;
  fileUrl: string;
  table: string;
}

/**
 * Get all documents with local file URLs from the database
 */
async function getDocumentsWithLocalUrls(): Promise<DocumentRecord[]> {
  const documents: DocumentRecord[] = [];

  // CompanyDocuments
  const companyDocs = await db.companyDocument.findMany({
    where: {
      OR: [
        { fileUrl: { startsWith: "/uploads/" } },
        { fileUrl: { startsWith: "/api/uploads/" } },
      ],
    },
    select: { id: true, fileUrl: true },
  });
  documents.push(
    ...companyDocs.map((d) => ({ ...d, table: "companyDocument" }))
  );

  // TruckDocuments
  const truckDocs = await db.truckDocument.findMany({
    where: {
      OR: [
        { fileUrl: { startsWith: "/uploads/" } },
        { fileUrl: { startsWith: "/api/uploads/" } },
      ],
    },
    select: { id: true, fileUrl: true },
  });
  documents.push(...truckDocs.map((d) => ({ ...d, table: "truckDocument" })));

  // Load Documents
  const loadDocs = await db.document.findMany({
    where: {
      OR: [
        { fileUrl: { startsWith: "/uploads/" } },
        { fileUrl: { startsWith: "/api/uploads/" } },
      ],
    },
    select: { id: true, fileUrl: true },
  });
  documents.push(...loadDocs.map((d) => ({ ...d, table: "document" })));

  // TripPods
  const tripPods = await db.tripPod.findMany({
    where: {
      OR: [
        { fileUrl: { startsWith: "/uploads/" } },
        { fileUrl: { startsWith: "/api/uploads/" } },
      ],
    },
    select: { id: true, fileUrl: true },
  });
  documents.push(...tripPods.map((d) => ({ ...d, table: "tripPod" })));

  return documents;
}

/**
 * Extract storage key from local URL
 */
function extractKeyFromUrl(url: string): string {
  // Handle /uploads/... or /api/uploads/...
  if (url.startsWith("/api/uploads/")) {
    return url.replace("/api/uploads/", "");
  }
  if (url.startsWith("/uploads/")) {
    return url.replace("/uploads/", "");
  }
  return url;
}

/**
 * Update document URL in database
 */
async function updateDocumentUrl(
  table: string,
  id: string,
  newUrl: string
): Promise<boolean> {
  try {
    switch (table) {
      case "companyDocument":
        await db.companyDocument.update({
          where: { id },
          data: { fileUrl: newUrl },
        });
        break;
      case "truckDocument":
        await db.truckDocument.update({
          where: { id },
          data: { fileUrl: newUrl },
        });
        break;
      case "document":
        await db.document.update({
          where: { id },
          data: { fileUrl: newUrl },
        });
        break;
      case "tripPod":
        await db.tripPod.update({
          where: { id },
          data: { fileUrl: newUrl },
        });
        break;
      default:
        return false;
    }
    return true;
  } catch (error) {
    console.error(`Failed to update ${table}/${id}:`, error);
    return false;
  }
}

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function runMigration(config: MigrationConfig): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("STORAGE MIGRATION: Local -> S3 + CDN");
  console.log("=".repeat(60));

  // Check configuration
  console.log("\n📋 Configuration:");
  console.log(`   Dry run: ${config.dryRun}`);
  console.log(`   Update DB: ${config.updateDb}`);
  console.log(`   Delete local: ${config.deleteLocal}`);
  console.log(`   Batch size: ${config.batchSize}`);

  // Check storage health
  console.log("\n🔍 Checking storage health...");
  const health = await checkStorageHealth();
  console.log(`   Provider: ${health.provider}`);
  console.log(`   Healthy: ${health.healthy ? "✅" : "❌"}`);
  console.log(`   CDN Enabled: ${health.cdnEnabled}`);
  if (health.cdnDomain) {
    console.log(`   CDN Domain: ${health.cdnDomain}`);
  }
  if (health.error) {
    console.log(`   Error: ${health.error}`);
  }

  if (health.provider !== "s3") {
    console.log('\n⚠️  Warning: STORAGE_PROVIDER is not set to "s3"');
    console.log("   Set STORAGE_PROVIDER=s3 in .env to use S3 storage");
    if (!config.dryRun) {
      console.log("   Exiting...");
      return;
    }
  }

  // Get storage stats
  console.log("\n📊 Storage Statistics:");
  const stats = await getStorageStats();
  console.log(`   Local files: ${stats.localFileCount}`);
  console.log(
    `   Total size: ${(stats.localTotalSize / 1024 / 1024).toFixed(2)} MB`
  );

  if (stats.localFileCount === 0) {
    console.log("\n✅ No local files to migrate");
    return;
  }

  // List files to migrate
  console.log("\n📁 Files to migrate:");
  const files = await listLocalFiles();
  for (const file of files.slice(0, 10)) {
    console.log(`   - ${file}`);
  }
  if (files.length > 10) {
    console.log(`   ... and ${files.length - 10} more files`);
  }

  if (config.dryRun) {
    console.log("\n🔍 DRY RUN - No changes will be made");

    // Show what would be migrated
    console.log("\n📋 Database records to update:");
    const documents = await getDocumentsWithLocalUrls();
    console.log(`   Total records: ${documents.length}`);

    const byTable: Record<string, number> = {};
    for (const doc of documents) {
      byTable[doc.table] = (byTable[doc.table] || 0) + 1;
    }
    for (const [table, count] of Object.entries(byTable)) {
      console.log(`   - ${table}: ${count}`);
    }

    console.log("\n✅ Dry run complete");
    return;
  }

  // Perform migration
  console.log("\n🚀 Starting migration...");
  const migrationResults: {
    key: string;
    success: boolean;
    newUrl?: string;
    error?: string;
  }[] = [];
  let successful = 0;
  let failed = 0;

  // Process files in batches
  for (let i = 0; i < files.length; i += config.batchSize) {
    const batch = files.slice(i, i + config.batchSize);

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const result = await migrateFileToS3(file);
        return {
          key: file,
          success: result.success,
          newUrl: result.newUrl,
          error: result.error,
        };
      })
    );

    for (const result of batchResults) {
      migrationResults.push(result);
      if (result.success) {
        successful++;
        if (config.deleteLocal) {
          try {
            const localPath = path.join(
              process.cwd(),
              "public",
              "uploads",
              result.key
            );
            await fs.unlink(localPath);
          } catch {
            // File may already be deleted
          }
        }
      } else {
        failed++;
        console.error(`   ❌ Failed: ${result.key} - ${result.error}`);
      }
    }

    console.log(
      `   Progress: ${Math.min(i + config.batchSize, files.length)}/${files.length} (${successful} successful, ${failed} failed)`
    );
  }

  console.log("\n📊 Migration Results:");
  console.log(`   Total: ${files.length}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);

  // Update database records
  if (config.updateDb && successful > 0) {
    console.log("\n📝 Updating database records...");

    const documents = await getDocumentsWithLocalUrls();
    let dbUpdated = 0;
    let dbFailed = 0;

    for (const doc of documents) {
      const key = extractKeyFromUrl(doc.fileUrl);
      const migrationResult = migrationResults.find(
        (r) => r.key === key && r.success
      );

      if (migrationResult && migrationResult.newUrl) {
        const updated = await updateDocumentUrl(
          doc.table,
          doc.id,
          migrationResult.newUrl
        );
        if (updated) {
          dbUpdated++;
        } else {
          dbFailed++;
        }
      }
    }

    console.log(`   Updated: ${dbUpdated}`);
    console.log(`   Failed: ${dbFailed}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION COMPLETE");
  console.log("=".repeat(60));

  // Summary
  if (failed > 0) {
    console.log("\n⚠️  Some files failed to migrate. Review errors above.");
  } else {
    console.log("\n✅ All files migrated successfully!");
  }

  if (isCDNEnabled()) {
    console.log(
      `\n🌐 Files are now served via CDN: https://${getCDNDomain()}/`
    );
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    await runMigration(config);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
