/**
 * Seed Test Data Script for E2E Testing
 *
 * Creates essential test data for E2E testing of FreightET platform
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 *   npx ts-node scripts/seed-test-data.ts
 *
 * Creates:
 * - Test Users: shipper@test.com, carrier@test.com, admin@test.com
 * - Test Organizations: Test Shipper Co, Test Carrier Co
 * - Test Corridors: Critical routes for service fee calculation
 * - Test Trucks: DRY_VAN, FLATBED, REFRIGERATED for carrier
 * - Financial Accounts: Wallet accounts with initial balance
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://danieldamitew@localhost:5432/freight_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Test user credentials
const TEST_PASSWORD = 'password';

// Helper: Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('========================================');
  console.log('  E2E Test Data Seed Script');
  console.log('========================================\n');

  const hashedPassword = await hashPassword(TEST_PASSWORD);

  // ============================================================================
  // 1. TEST USERS & ORGANIZATIONS
  // ============================================================================
  console.log('1. Creating test users and organizations...\n');

  // --- Shipper User & Organization ---
  let shipperOrg = await prisma.organization.findFirst({
    where: { name: 'Test Shipper Co' },
  });

  if (!shipperOrg) {
    shipperOrg = await prisma.organization.create({
      data: {
        name: 'Test Shipper Co',
        type: 'SHIPPER',
        contactEmail: 'shipper@test.com',
        contactPhone: '+251911111111',
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log('   [+] Created organization: Test Shipper Co');
  } else {
    // Ensure it's verified
    await prisma.organization.update({
      where: { id: shipperOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        contactPhone: '+251911111111',
      },
    });
    console.log('   [=] Organization exists: Test Shipper Co (updated)');
  }

  let shipperUser = await prisma.user.findUnique({
    where: { email: 'shipper@test.com' },
  });

  if (!shipperUser) {
    shipperUser = await prisma.user.create({
      data: {
        email: 'shipper@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Shipper',
        phone: '+251911111111',
        role: 'SHIPPER',
        status: 'ACTIVE',
        isActive: true,
        organizationId: shipperOrg.id,
      },
    });
    console.log('   [+] Created user: shipper@test.com');
  } else {
    await prisma.user.update({
      where: { id: shipperUser.id },
      data: {
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        isActive: true,
        organizationId: shipperOrg.id,
      },
    });
    console.log('   [=] User exists: shipper@test.com (updated)');
  }

  // --- Carrier User & Organization ---
  let carrierOrg = await prisma.organization.findFirst({
    where: { name: 'Test Carrier Co' },
  });

  if (!carrierOrg) {
    carrierOrg = await prisma.organization.create({
      data: {
        name: 'Test Carrier Co',
        type: 'CARRIER_COMPANY',
        contactEmail: 'carrier@test.com',
        contactPhone: '+251922222222',
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log('   [+] Created organization: Test Carrier Co');
  } else {
    await prisma.organization.update({
      where: { id: carrierOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        contactPhone: '+251922222222',
      },
    });
    console.log('   [=] Organization exists: Test Carrier Co (updated)');
  }

  let carrierUser = await prisma.user.findUnique({
    where: { email: 'carrier@test.com' },
  });

  if (!carrierUser) {
    carrierUser = await prisma.user.create({
      data: {
        email: 'carrier@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Carrier',
        phone: '+251922222222',
        role: 'CARRIER',
        status: 'ACTIVE',
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });
    console.log('   [+] Created user: carrier@test.com');
  } else {
    await prisma.user.update({
      where: { id: carrierUser.id },
      data: {
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });
    console.log('   [=] User exists: carrier@test.com (updated)');
  }

  // --- Admin User ---
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@test.com' },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Admin',
        phone: '+251933333333',
        role: 'ADMIN',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    console.log('   [+] Created user: admin@test.com');
  } else {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    console.log('   [=] User exists: admin@test.com (updated)');
  }

  console.log('');

  // ============================================================================
  // 2. TEST CORRIDORS (Critical for Service Fee Calculation)
  // ============================================================================
  console.log('2. Creating test corridors...\n');

  const corridorsData = [
    {
      name: 'Addis Ababa - Dire Dawa',
      originRegion: 'Addis Ababa',
      destinationRegion: 'Dire Dawa',
      distanceKm: 453,
      pricePerKm: 2.50,
    },
    {
      name: 'Addis Ababa - Djibouti',
      originRegion: 'Addis Ababa',
      destinationRegion: 'Djibouti',
      distanceKm: 910,
      pricePerKm: 3.00,
    },
    {
      name: 'Addis Ababa - Mekelle',
      originRegion: 'Addis Ababa',
      destinationRegion: 'Mekelle',
      distanceKm: 783,
      pricePerKm: 2.50,
    },
  ];

  for (const corridorData of corridorsData) {
    const existingCorridor = await prisma.corridor.findFirst({
      where: {
        originRegion: corridorData.originRegion,
        destinationRegion: corridorData.destinationRegion,
        direction: 'ONE_WAY',
      },
    });

    if (!existingCorridor) {
      await prisma.corridor.create({
        data: {
          name: corridorData.name,
          originRegion: corridorData.originRegion,
          destinationRegion: corridorData.destinationRegion,
          distanceKm: corridorData.distanceKm,
          pricePerKm: corridorData.pricePerKm,
          shipperPricePerKm: corridorData.pricePerKm,
          carrierPricePerKm: corridorData.pricePerKm,
          direction: 'ONE_WAY',
          isActive: true,
          createdById: adminUser.id,
        },
      });
      console.log(`   [+] Created corridor: ${corridorData.name} (${corridorData.distanceKm}km @ ${corridorData.pricePerKm} ETB/km)`);
    } else {
      await prisma.corridor.update({
        where: { id: existingCorridor.id },
        data: {
          distanceKm: corridorData.distanceKm,
          pricePerKm: corridorData.pricePerKm,
          shipperPricePerKm: corridorData.pricePerKm,
          carrierPricePerKm: corridorData.pricePerKm,
          isActive: true,
        },
      });
      console.log(`   [=] Corridor exists: ${corridorData.name} (updated)`);
    }
  }

  console.log('');

  // ============================================================================
  // 3. TEST TRUCKS (for Carrier)
  // ============================================================================
  console.log('3. Creating test trucks for carrier...\n');

  const trucksData = [
    {
      licensePlate: 'TEST-DV-001',
      truckType: 'DRY_VAN' as const,
      capacity: 15000,
      lengthM: 12,
      currentCity: 'Addis Ababa',
    },
    {
      licensePlate: 'TEST-FB-002',
      truckType: 'FLATBED' as const,
      capacity: 20000,
      lengthM: 14,
      currentCity: 'Addis Ababa',
    },
    {
      licensePlate: 'TEST-RF-003',
      truckType: 'REFRIGERATED' as const,
      capacity: 12000,
      lengthM: 10,
      currentCity: 'Dire Dawa',
    },
  ];

  for (const truckData of trucksData) {
    const existingTruck = await prisma.truck.findUnique({
      where: { licensePlate: truckData.licensePlate },
    });

    if (!existingTruck) {
      await prisma.truck.create({
        data: {
          carrierId: carrierOrg.id,
          licensePlate: truckData.licensePlate,
          truckType: truckData.truckType,
          capacity: truckData.capacity,
          lengthM: truckData.lengthM,
          currentCity: truckData.currentCity,
          isAvailable: true,
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          approvedById: adminUser.id,
          contactName: 'Test Driver',
          contactPhone: '+251944444444',
        },
      });
      console.log(`   [+] Created truck: ${truckData.licensePlate} (${truckData.truckType})`);
    } else {
      await prisma.truck.update({
        where: { id: existingTruck.id },
        data: {
          carrierId: carrierOrg.id,
          isAvailable: true,
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          approvedById: adminUser.id,
        },
      });
      console.log(`   [=] Truck exists: ${truckData.licensePlate} (updated)`);
    }
  }

  console.log('');

  // ============================================================================
  // 4. FINANCIAL ACCOUNTS (Wallets)
  // ============================================================================
  console.log('4. Creating financial accounts...\n');

  const INITIAL_BALANCE = 10000;

  // Shipper Wallet
  let shipperWallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: shipperOrg.id,
      accountType: 'SHIPPER_WALLET',
    },
  });

  if (!shipperWallet) {
    shipperWallet = await prisma.financialAccount.create({
      data: {
        organizationId: shipperOrg.id,
        accountType: 'SHIPPER_WALLET',
        balance: INITIAL_BALANCE,
        currency: 'ETB',
        isActive: true,
      },
    });
    console.log(`   [+] Created shipper wallet: ${INITIAL_BALANCE} ETB`);
  } else {
    await prisma.financialAccount.update({
      where: { id: shipperWallet.id },
      data: {
        balance: INITIAL_BALANCE,
        isActive: true,
      },
    });
    console.log(`   [=] Shipper wallet exists: balance set to ${INITIAL_BALANCE} ETB`);
  }

  // Carrier Wallet
  let carrierWallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: carrierOrg.id,
      accountType: 'CARRIER_WALLET',
    },
  });

  if (!carrierWallet) {
    carrierWallet = await prisma.financialAccount.create({
      data: {
        organizationId: carrierOrg.id,
        accountType: 'CARRIER_WALLET',
        balance: INITIAL_BALANCE,
        currency: 'ETB',
        isActive: true,
      },
    });
    console.log(`   [+] Created carrier wallet: ${INITIAL_BALANCE} ETB`);
  } else {
    await prisma.financialAccount.update({
      where: { id: carrierWallet.id },
      data: {
        balance: INITIAL_BALANCE,
        isActive: true,
      },
    });
    console.log(`   [=] Carrier wallet exists: balance set to ${INITIAL_BALANCE} ETB`);
  }

  // Platform Revenue Account (if not exists)
  let platformAccount = await prisma.financialAccount.findFirst({
    where: {
      accountType: 'PLATFORM_REVENUE',
      organizationId: null,
    },
  });

  if (!platformAccount) {
    platformAccount = await prisma.financialAccount.create({
      data: {
        accountType: 'PLATFORM_REVENUE',
        balance: 0,
        currency: 'ETB',
        isActive: true,
      },
    });
    console.log('   [+] Created platform revenue account');
  } else {
    console.log('   [=] Platform revenue account exists');
  }

  console.log('');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('========================================');
  console.log('  SEED COMPLETED SUCCESSFULLY');
  console.log('========================================\n');

  console.log('Test Users (password: password):');
  console.log('  - shipper@test.com   (Shipper role)');
  console.log('  - carrier@test.com   (Carrier role)');
  console.log('  - admin@test.com     (Admin role)');
  console.log('');

  console.log('Test Organizations:');
  console.log(`  - Test Shipper Co (ID: ${shipperOrg.id})`);
  console.log(`  - Test Carrier Co (ID: ${carrierOrg.id})`);
  console.log('');

  console.log('Test Corridors:');
  console.log('  - Addis Ababa -> Dire Dawa: 453km @ 2.50 ETB/km');
  console.log('  - Addis Ababa -> Djibouti: 910km @ 3.00 ETB/km');
  console.log('  - Addis Ababa -> Mekelle: 783km @ 2.50 ETB/km');
  console.log('');

  console.log('Test Trucks (approved):');
  console.log('  - TEST-DV-001 (DRY_VAN)');
  console.log('  - TEST-FB-002 (FLATBED)');
  console.log('  - TEST-RF-003 (REFRIGERATED)');
  console.log('');

  console.log('Financial Accounts:');
  console.log(`  - Shipper Wallet: ${INITIAL_BALANCE} ETB`);
  console.log(`  - Carrier Wallet: ${INITIAL_BALANCE} ETB`);
  console.log('  - Platform Revenue: 0 ETB');
  console.log('');

  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
