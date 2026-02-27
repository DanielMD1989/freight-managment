/**
 * Sprint 1 Phase 1: Add new UserRole enum values
 * Adds SUPER_ADMIN and DISPATCHER to the UserRole enum
 */

import { db as prisma } from "../lib/db";

async function addEnumValues() {
  console.log("🚀 Adding new UserRole enum values...\n");

  try {
    // Add SUPER_ADMIN
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'
    `);
    console.log("✅ Added SUPER_ADMIN to UserRole enum");

    // Add DISPATCHER (if not exists)
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DISPATCHER'
    `);
    console.log("✅ Added DISPATCHER to UserRole enum");

    console.log("\n✅ Successfully added new enum values!");
  } catch (error) {
    console.error("❌ Failed to add enum values:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
addEnumValues()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
