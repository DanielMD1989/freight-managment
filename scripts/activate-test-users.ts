/**
 * Activate Test Users Script
 *
 * Updates test users to ACTIVE status so they can use marketplace features
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 Activating test users...\n');

  // Update all test users to ACTIVE status
  const result = await prisma.user.updateMany({
    where: {
      email: {
        contains: 'testfreightet.com',
      },
    },
    data: {
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Updated ${result.count} test users to ACTIVE status`);

  // Show updated users
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'testfreightet.com',
      },
    },
    select: {
      email: true,
      status: true,
      role: true,
    },
  });

  console.log('\n📋 Test Users:');
  users.forEach((user) => {
    console.log(`  • ${user.email} - ${user.role} - ${user.status}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
