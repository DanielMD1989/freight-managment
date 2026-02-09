/**
 * Fix Missing Wallets Script
 *
 * This script finds organizations that don't have a wallet (financial account)
 * and creates one for them.
 *
 * ISSUE #1 FIX: Some organizations were created during registration
 * without wallets. This script retroactively fixes them.
 *
 * Usage: npx tsx scripts/fix-missing-wallets.ts
 */

import { db } from '../lib/db';

async function fixMissingWallets() {
  console.log('🔍 Finding organizations without wallets...\n');

  // Find all organizations
  const organizations = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      financialAccounts: {
        select: { id: true, accountType: true },
      },
    },
  });

  // Filter organizations without any wallet
  const orgsWithoutWallets = organizations.filter(
    (org) => org.financialAccounts.length === 0
  );

  if (orgsWithoutWallets.length === 0) {
    console.log('✅ All organizations have wallets. Nothing to fix.\n');
    return;
  }

  console.log(`⚠️  Found ${orgsWithoutWallets.length} organizations without wallets:\n`);

  for (const org of orgsWithoutWallets) {
    console.log(`  - ${org.name} (${org.type})`);
  }

  console.log('\n📦 Creating missing wallets...\n');

  let created = 0;
  let failed = 0;

  for (const org of orgsWithoutWallets) {
    try {
      // Determine wallet type based on organization type
      const walletType = org.type === 'SHIPPER' ? 'SHIPPER_WALLET' : 'CARRIER_WALLET';

      await db.financialAccount.create({
        data: {
          organizationId: org.id,
          accountType: walletType,
          balance: 0,
          currency: 'ETB',
          isActive: true,
        },
      });

      console.log(`  ✅ Created ${walletType} for "${org.name}"`);
      created++;
    } catch (error: any) {
      console.error(`  ❌ Failed to create wallet for "${org.name}": ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  - Organizations checked: ${organizations.length}`);
  console.log(`  - Missing wallets found: ${orgsWithoutWallets.length}`);
  console.log(`  - Wallets created: ${created}`);
  console.log(`  - Failures: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✅ All missing wallets have been created successfully!\n');
  } else {
    console.log('⚠️  Some wallets could not be created. Check the errors above.\n');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('FIX MISSING WALLETS SCRIPT');
  console.log('='.repeat(60));
  console.log('');

  try {
    await fixMissingWallets();
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    // db from lib/db handles its own connection
  }
}

main();
