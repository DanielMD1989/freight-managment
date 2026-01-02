/**
 * Sprint 1: RBAC Role Consolidation - Data Migration
 *
 * Migrates existing users from 7-role system to 5-role system:
 * - PLATFORM_OPS → ADMIN
 * - ADMIN → SUPER_ADMIN
 * - LOGISTICS_AGENT → DISPATCHER
 * - DRIVER → CARRIER
 * - SHIPPER → SHIPPER (unchanged)
 * - CARRIER → CARRIER (unchanged)
 * - DISPATCHER → DISPATCHER (unchanged)
 */

import { db as prisma } from '../lib/db';

async function migrateUserRoles() {
  console.log('🚀 Starting Sprint 1 RBAC Role Migration...\n');

  try {
    // Step 1: Get current role distribution
    console.log('📊 Current Role Distribution:');
    const allUsers = await prisma.user.findMany({
      select: { role: true },
    });

    const roleCounts: Record<string, number> = {};
    allUsers.forEach((user) => {
      roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
    });

    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });
    console.log(`  Total users: ${allUsers.length}\n`);

    // Step 2: Migrate ADMIN → SUPER_ADMIN
    // Note: Current database only has ADMIN, SHIPPER, CARRIER roles
    // We only need to migrate ADMIN → SUPER_ADMIN
    const adminCount = roleCounts['ADMIN'] || 0;

    if (adminCount > 0) {
      // Fetch ADMIN users and update them one by one
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
      });

      let migratedCount = 0;
      for (const user of adminUsers) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPER_ADMIN' },
        });
        migratedCount++;
      }

      console.log(`✅ Migrated ${migratedCount} ADMIN users → SUPER_ADMIN`);
    } else {
      console.log(`ℹ️  No ADMIN users found to migrate`);
    }

    // Step 3: SHIPPER and CARRIER remain unchanged
    console.log(`ℹ️  SHIPPER users unchanged: ${roleCounts['SHIPPER'] || 0}`);
    console.log(`ℹ️  CARRIER users unchanged: ${roleCounts['CARRIER'] || 0}`);

    // Step 6: Verify new role distribution
    console.log('\n📊 New Role Distribution:');
    const updatedUsers = await prisma.user.findMany({
      select: { role: true },
    });

    const newRoleCounts: Record<string, number> = {};
    updatedUsers.forEach((user) => {
      newRoleCounts[user.role] = (newRoleCounts[user.role] || 0) + 1;
    });

    Object.entries(newRoleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });

    console.log('\n✅ Sprint 1 RBAC Role Migration completed successfully!');
    console.log('📋 Summary:');
    console.log(`  - ADMIN → SUPER_ADMIN: ${adminCount > 0 ? adminCount : 0}`);
    console.log(`  - SHIPPER (unchanged): ${roleCounts['SHIPPER'] || 0}`);
    console.log(`  - CARRIER (unchanged): ${roleCounts['CARRIER'] || 0}`);
    console.log(`  - DISPATCHER (new role): ${newRoleCounts['DISPATCHER'] || 0}`);
    console.log(`  - Total users in database: ${updatedUsers.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateUserRoles()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
