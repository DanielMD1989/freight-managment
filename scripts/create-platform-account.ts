/**
 * Create Platform Revenue Account
 *
 * This script creates the platform revenue account that's required
 * for service fee collection.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Decimal } from 'decimal.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 Creating Platform Revenue Account...\n');

  // Check if platform account already exists
  const existingAccount = await prisma.financialAccount.findFirst({
    where: { accountType: 'PLATFORM_REVENUE' },
  });

  if (existingAccount) {
    console.log('✅ Platform revenue account already exists:');
    console.log(`   ID: ${existingAccount.id}`);
    console.log(`   Balance: ${existingAccount.balance} ${existingAccount.currency}`);
    console.log(`   Created: ${existingAccount.createdAt.toISOString()}`);
    return;
  }

  // Create platform revenue account
  const platformAccount = await prisma.financialAccount.create({
    data: {
      accountType: 'PLATFORM_REVENUE',
      balance: new Decimal(0),
      currency: 'ETB',
      // No organizationId - this is a platform-level account
    },
  });

  console.log('✅ Platform revenue account created:');
  console.log(`   ID: ${platformAccount.id}`);
  console.log(`   Balance: ${platformAccount.balance} ${platformAccount.currency}`);

  // Also check/create carrier wallets for carriers without wallets
  const carriersWithoutWallets = await prisma.organization.findMany({
    where: {
      type: 'CARRIER_COMPANY',
      financialAccounts: {
        none: { accountType: 'CARRIER_WALLET' },
      },
    },
    select: { id: true, name: true },
  });

  if (carriersWithoutWallets.length > 0) {
    console.log(`\n🔧 Creating wallets for ${carriersWithoutWallets.length} carriers...`);

    for (const carrier of carriersWithoutWallets) {
      await prisma.financialAccount.create({
        data: {
          accountType: 'CARRIER_WALLET',
          balance: new Decimal(0),
          currency: 'ETB',
          organizationId: carrier.id,
        },
      });
      console.log(`   ✅ Created wallet for ${carrier.name}`);
    }
  }

  // Check/create shipper wallets for shippers without wallets
  const shippersWithoutWallets = await prisma.organization.findMany({
    where: {
      type: 'SHIPPER',
      financialAccounts: {
        none: { accountType: 'SHIPPER_WALLET' },
      },
    },
    select: { id: true, name: true },
  });

  if (shippersWithoutWallets.length > 0) {
    console.log(`\n🔧 Creating wallets for ${shippersWithoutWallets.length} shippers...`);

    for (const shipper of shippersWithoutWallets) {
      await prisma.financialAccount.create({
        data: {
          accountType: 'SHIPPER_WALLET',
          balance: new Decimal(0),
          currency: 'ETB',
          organizationId: shipper.id,
        },
      });
      console.log(`   ✅ Created wallet for ${shipper.name}`);
    }
  }

  // Summary
  const allAccounts = await prisma.financialAccount.groupBy({
    by: ['accountType'],
    _count: { id: true },
  });

  console.log('\n📊 Final Account Summary:');
  allAccounts.forEach(a => {
    console.log(`   ${a.accountType}: ${a._count.id}`);
  });

  console.log('\n✅ Done!');
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
