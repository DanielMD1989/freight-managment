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
 * - Test Users: shipper@test.com, carrier@test.com, dispatcher@test.com, admin@test.com
 * - Test Organizations: Test Shipper Co, Test Carrier Co, Dispatch Center
 * - Test Corridors: Critical routes for service fee calculation
 * - Test Trucks: DRY_VAN, FLATBED, REFRIGERATED for carrier
 * - Test Loads: Posted loads for shipper
 * - Test Truck Postings: Available trucks for matching
 * - Financial Accounts: Wallet accounts with initial balance (50,000 ETB)
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

  // --- Dispatcher User & Organization ---
  let dispatchOrg = await prisma.organization.findFirst({
    where: { name: 'Dispatch Center' },
  });

  if (!dispatchOrg) {
    dispatchOrg = await prisma.organization.create({
      data: {
        name: 'Dispatch Center',
        type: 'LOGISTICS_AGENT',
        contactEmail: 'dispatcher@test.com',
        contactPhone: '+251944444444',
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log('   [+] Created organization: Dispatch Center');
  } else {
    await prisma.organization.update({
      where: { id: dispatchOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log('   [=] Organization exists: Dispatch Center (updated)');
  }

  let dispatcherUser = await prisma.user.findUnique({
    where: { email: 'dispatcher@test.com' },
  });

  if (!dispatcherUser) {
    dispatcherUser = await prisma.user.create({
      data: {
        email: 'dispatcher@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Dispatcher',
        phone: '+251944444444',
        role: 'DISPATCHER',
        status: 'ACTIVE',
        isActive: true,
        organizationId: dispatchOrg.id,
      },
    });
    console.log('   [+] Created user: dispatcher@test.com');
  } else {
    await prisma.user.update({
      where: { id: dispatcherUser.id },
      data: {
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        isActive: true,
        organizationId: dispatchOrg.id,
      },
    });
    console.log('   [=] User exists: dispatcher@test.com (updated)');
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

  const INITIAL_BALANCE = 50000;

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
  // 5. TEST LOADS (Posted by Shipper)
  // ============================================================================
  console.log('5. Creating test loads for shipper...\n');

  const loadsData = [
    {
      pickupCity: 'Addis Ababa',
      deliveryCity: 'Djibouti',
      truckType: 'DRY_VAN' as const,
      weight: 12000,
      cargoDescription: 'Electronics and household goods',
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    },
    {
      pickupCity: 'Addis Ababa',
      deliveryCity: 'Dire Dawa',
      truckType: 'FLATBED' as const,
      weight: 18000,
      cargoDescription: 'Construction materials',
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
    {
      pickupCity: 'Addis Ababa',
      deliveryCity: 'Mekelle',
      truckType: 'REFRIGERATED' as const,
      weight: 8000,
      cargoDescription: 'Fresh produce and dairy',
      pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
    },
  ];

  const createdLoads: any[] = [];
  for (const loadData of loadsData) {
    const existingLoad = await prisma.load.findFirst({
      where: {
        shipperId: shipperOrg.id,
        pickupCity: loadData.pickupCity,
        deliveryCity: loadData.deliveryCity,
        truckType: loadData.truckType,
      },
    });

    if (!existingLoad) {
      const load = await prisma.load.create({
        data: {
          shipperId: shipperOrg.id,
          createdById: shipperUser.id,
          pickupCity: loadData.pickupCity,
          deliveryCity: loadData.deliveryCity,
          truckType: loadData.truckType,
          weight: loadData.weight,
          cargoDescription: loadData.cargoDescription,
          pickupDate: loadData.pickupDate,
          deliveryDate: loadData.deliveryDate,
          status: 'POSTED',
          postedAt: new Date(),
          bookMode: 'REQUEST',
          fullPartial: 'FULL',
        },
      });
      createdLoads.push(load);
      console.log(`   [+] Created load: ${loadData.pickupCity} → ${loadData.deliveryCity} (${loadData.truckType})`);
    } else {
      await prisma.load.update({
        where: { id: existingLoad.id },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
        },
      });
      createdLoads.push(existingLoad);
      console.log(`   [=] Load exists: ${loadData.pickupCity} → ${loadData.deliveryCity} (updated to POSTED)`);
    }
  }

  console.log('');

  // ============================================================================
  // 6. ETHIOPIAN LOCATIONS (Required for TruckPostings)
  // ============================================================================
  console.log('6. Creating Ethiopian locations...\n');

  const locationsData = [
    { name: 'Addis Ababa', region: 'Addis Ababa', latitude: 9.0054, longitude: 38.7636 },
    { name: 'Dire Dawa', region: 'Dire Dawa', latitude: 9.6011, longitude: 41.8505 },
    { name: 'Mekelle', region: 'Tigray', latitude: 13.4967, longitude: 39.4753 },
    { name: 'Djibouti', region: 'Djibouti', latitude: 11.5883, longitude: 43.1450 },
  ];

  const locationMap: Record<string, string> = {};

  for (const locData of locationsData) {
    let location = await prisma.ethiopianLocation.findFirst({
      where: { name: locData.name, region: locData.region },
    });

    if (!location) {
      location = await prisma.ethiopianLocation.create({
        data: {
          name: locData.name,
          region: locData.region,
          latitude: locData.latitude,
          longitude: locData.longitude,
          type: 'CITY',
          isActive: true,
        },
      });
      console.log(`   [+] Created location: ${locData.name}`);
    } else {
      console.log(`   [=] Location exists: ${locData.name}`);
    }
    locationMap[locData.name] = location.id;
  }

  console.log('');

  // ============================================================================
  // 7. TEST TRUCK POSTINGS (Posted by Carrier)
  // ============================================================================
  console.log('7. Creating truck postings for carrier...\n');

  const trucks = await prisma.truck.findMany({
    where: { carrierId: carrierOrg.id },
  });

  const addisAbabaId = locationMap['Addis Ababa'];
  const direDawaId = locationMap['Dire Dawa'];

  for (const truck of trucks) {
    const existingPosting = await prisma.truckPosting.findFirst({
      where: {
        truckId: truck.id,
        status: 'ACTIVE',
      },
    });

    if (!existingPosting) {
      // Determine origin based on truck's current city
      const originCityId = truck.currentCity === 'Dire Dawa' ? direDawaId : addisAbabaId;

      await prisma.truckPosting.create({
        data: {
          truckId: truck.id,
          carrierId: carrierOrg.id,
          createdById: carrierUser.id,
          originCityId: originCityId,
          availableFrom: new Date(),
          availableTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          status: 'ACTIVE',
          contactName: 'Test Driver',
          contactPhone: '+251955555555',
          fullPartial: 'FULL',
        },
      });
      console.log(`   [+] Created posting for truck: ${truck.licensePlate}`);
    } else {
      console.log(`   [=] Posting exists for truck: ${truck.licensePlate}`);
    }
  }

  console.log('');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('========================================');
  console.log('  SEED COMPLETED SUCCESSFULLY');
  console.log('========================================\n');

  console.log('Test Users (password: password):');
  console.log('  - shipper@test.com    (Shipper role)');
  console.log('  - carrier@test.com    (Carrier role)');
  console.log('  - dispatcher@test.com (Dispatcher role)');
  console.log('  - admin@test.com      (Admin role)');
  console.log('');

  console.log('Test Organizations:');
  console.log(`  - Test Shipper Co (ID: ${shipperOrg.id})`);
  console.log(`  - Test Carrier Co (ID: ${carrierOrg.id})`);
  console.log(`  - Dispatch Center (ID: ${dispatchOrg.id})`);
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

  console.log('Test Loads (posted):');
  console.log('  - Addis Ababa → Djibouti (DRY_VAN, 12000kg)');
  console.log('  - Addis Ababa → Dire Dawa (FLATBED, 18000kg)');
  console.log('  - Addis Ababa → Mekelle (REFRIGERATED, 8000kg)');
  console.log('');

  console.log('Test Locations:');
  console.log('  - Addis Ababa, Dire Dawa, Mekelle, Djibouti');
  console.log('');

  console.log('Test Truck Postings:');
  console.log('  - All 3 trucks posted as ACTIVE');
  console.log('  - Available for matching');
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
