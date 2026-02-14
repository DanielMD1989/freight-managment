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

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://danieldamitew@localhost:5432/freight_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Test user credentials
const TEST_PASSWORD = "password";

// Helper: Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("========================================");
  console.log("  E2E Test Data Seed Script");
  console.log("========================================\n");

  const hashedPassword = await hashPassword(TEST_PASSWORD);

  // ============================================================================
  // 1. TEST USERS & ORGANIZATIONS
  // ============================================================================
  console.log("1. Creating test users and organizations...\n");

  // --- Shipper User & Organization ---
  let shipperOrg = await prisma.organization.findFirst({
    where: { name: "Test Shipper Co" },
  });

  if (!shipperOrg) {
    shipperOrg = await prisma.organization.create({
      data: {
        name: "Test Shipper Co",
        type: "SHIPPER",
        contactEmail: "shipper@test.com",
        contactPhone: "+251911111111",
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log("   [+] Created organization: Test Shipper Co");
  } else {
    // Ensure it's verified
    await prisma.organization.update({
      where: { id: shipperOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        contactPhone: "+251911111111",
      },
    });
    console.log("   [=] Organization exists: Test Shipper Co (updated)");
  }

  let shipperUser = await prisma.user.findUnique({
    where: { email: "shipper@test.com" },
  });

  if (!shipperUser) {
    shipperUser = await prisma.user.create({
      data: {
        email: "shipper@test.com",
        passwordHash: hashedPassword,
        firstName: "Test",
        lastName: "Shipper",
        phone: "+251911111111",
        role: "SHIPPER",
        status: "ACTIVE",
        isActive: true,
        organizationId: shipperOrg.id,
      },
    });
    console.log("   [+] Created user: shipper@test.com");
  } else {
    await prisma.user.update({
      where: { id: shipperUser.id },
      data: {
        passwordHash: hashedPassword,
        status: "ACTIVE",
        isActive: true,
        organizationId: shipperOrg.id,
      },
    });
    console.log("   [=] User exists: shipper@test.com (updated)");
  }

  // --- Carrier User & Organization ---
  let carrierOrg = await prisma.organization.findFirst({
    where: { name: "Test Carrier Co" },
  });

  if (!carrierOrg) {
    carrierOrg = await prisma.organization.create({
      data: {
        name: "Test Carrier Co",
        type: "CARRIER_COMPANY",
        contactEmail: "carrier@test.com",
        contactPhone: "+251922222222",
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log("   [+] Created organization: Test Carrier Co");
  } else {
    await prisma.organization.update({
      where: { id: carrierOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        contactPhone: "+251922222222",
      },
    });
    console.log("   [=] Organization exists: Test Carrier Co (updated)");
  }

  let carrierUser = await prisma.user.findUnique({
    where: { email: "carrier@test.com" },
  });

  if (!carrierUser) {
    carrierUser = await prisma.user.create({
      data: {
        email: "carrier@test.com",
        passwordHash: hashedPassword,
        firstName: "Test",
        lastName: "Carrier",
        phone: "+251922222222",
        role: "CARRIER",
        status: "ACTIVE",
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });
    console.log("   [+] Created user: carrier@test.com");
  } else {
    await prisma.user.update({
      where: { id: carrierUser.id },
      data: {
        passwordHash: hashedPassword,
        status: "ACTIVE",
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });
    console.log("   [=] User exists: carrier@test.com (updated)");
  }

  // --- Admin User ---
  let adminUser = await prisma.user.findUnique({
    where: { email: "admin@test.com" },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: "admin@test.com",
        passwordHash: hashedPassword,
        firstName: "Test",
        lastName: "Admin",
        phone: "+251933333333",
        role: "ADMIN",
        status: "ACTIVE",
        isActive: true,
      },
    });
    console.log("   [+] Created user: admin@test.com");
  } else {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: hashedPassword,
        status: "ACTIVE",
        isActive: true,
      },
    });
    console.log("   [=] User exists: admin@test.com (updated)");
  }

  // --- Dispatcher User & Organization ---
  let dispatchOrg = await prisma.organization.findFirst({
    where: { name: "Dispatch Center" },
  });

  if (!dispatchOrg) {
    dispatchOrg = await prisma.organization.create({
      data: {
        name: "Dispatch Center",
        type: "LOGISTICS_AGENT",
        contactEmail: "dispatcher@test.com",
        contactPhone: "+251944444444",
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log("   [+] Created organization: Dispatch Center");
  } else {
    await prisma.organization.update({
      where: { id: dispatchOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log("   [=] Organization exists: Dispatch Center (updated)");
  }

  let dispatcherUser = await prisma.user.findUnique({
    where: { email: "dispatcher@test.com" },
  });

  if (!dispatcherUser) {
    dispatcherUser = await prisma.user.create({
      data: {
        email: "dispatcher@test.com",
        passwordHash: hashedPassword,
        firstName: "Test",
        lastName: "Dispatcher",
        phone: "+251944444444",
        role: "DISPATCHER",
        status: "ACTIVE",
        isActive: true,
        organizationId: dispatchOrg.id,
      },
    });
    console.log("   [+] Created user: dispatcher@test.com");
  } else {
    await prisma.user.update({
      where: { id: dispatcherUser.id },
      data: {
        passwordHash: hashedPassword,
        status: "ACTIVE",
        isActive: true,
        organizationId: dispatchOrg.id,
      },
    });
    console.log("   [=] User exists: dispatcher@test.com (updated)");
  }

  console.log("");

  // ============================================================================
  // 2. TEST CORRIDORS (Critical for Service Fee Calculation)
  // ============================================================================
  console.log("2. Creating test corridors...\n");

  const corridorsData = [
    {
      name: "Addis Ababa - Dire Dawa",
      originRegion: "Addis Ababa",
      destinationRegion: "Dire Dawa",
      distanceKm: 453,
      pricePerKm: 2.5,
    },
    {
      name: "Addis Ababa - Djibouti",
      originRegion: "Addis Ababa",
      destinationRegion: "Djibouti",
      distanceKm: 910,
      pricePerKm: 3.0,
    },
    {
      name: "Addis Ababa - Mekelle",
      originRegion: "Addis Ababa",
      destinationRegion: "Mekelle",
      distanceKm: 783,
      pricePerKm: 2.5,
    },
    {
      name: "Addis Ababa - Hawassa",
      originRegion: "Addis Ababa",
      destinationRegion: "Hawassa",
      distanceKm: 275,
      pricePerKm: 2.0,
    },
  ];

  for (const corridorData of corridorsData) {
    // Check for existing corridor (either ONE_WAY or BIDIRECTIONAL)
    const existingCorridor = await prisma.corridor.findFirst({
      where: {
        originRegion: corridorData.originRegion,
        destinationRegion: corridorData.destinationRegion,
      },
    });

    const carrierPricePerKm =
      corridorData.name === "Addis Ababa - Hawassa"
        ? 1.8
        : corridorData.pricePerKm;

    if (!existingCorridor) {
      await prisma.corridor.create({
        data: {
          name: corridorData.name,
          originRegion: corridorData.originRegion,
          destinationRegion: corridorData.destinationRegion,
          distanceKm: corridorData.distanceKm,
          pricePerKm: corridorData.pricePerKm,
          shipperPricePerKm: corridorData.pricePerKm,
          carrierPricePerKm: carrierPricePerKm,
          direction: "BIDIRECTIONAL",
          isActive: true,
          createdById: adminUser.id,
        },
      });
      console.log(
        `   [+] Created corridor: ${corridorData.name} (${corridorData.distanceKm}km @ ${corridorData.pricePerKm} ETB/km, BIDIRECTIONAL)`
      );
    } else {
      await prisma.corridor.update({
        where: { id: existingCorridor.id },
        data: {
          distanceKm: corridorData.distanceKm,
          pricePerKm: corridorData.pricePerKm,
          shipperPricePerKm: corridorData.pricePerKm,
          carrierPricePerKm: carrierPricePerKm,
          direction: "BIDIRECTIONAL",
          isActive: true,
        },
      });
      console.log(
        `   [=] Corridor exists: ${corridorData.name} (updated to BIDIRECTIONAL)`
      );
    }
  }

  console.log("");

  // ============================================================================
  // 3. TEST TRUCKS (12 trucks across different Ethiopian cities)
  // ============================================================================
  console.log("3. Cleaning up and creating test trucks...\n");

  // First, delete old test truck postings and trucks
  await prisma.truckPosting.deleteMany({
    where: {
      truck: {
        licensePlate: {
          startsWith: "TEST-",
        },
      },
    },
  });
  await prisma.truck.deleteMany({
    where: {
      licensePlate: {
        startsWith: "TEST-",
      },
    },
  });
  console.log("   [x] Cleaned up old TEST-* trucks\n");

  const trucksData = [
    // Addis Ababa (4 trucks)
    {
      licensePlate: "AA-DV-001",
      truckType: "DRY_VAN" as const,
      capacity: 15000,
      lengthM: 12,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-FB-002",
      truckType: "FLATBED" as const,
      capacity: 20000,
      lengthM: 14,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-RF-003",
      truckType: "REFRIGERATED" as const,
      capacity: 12000,
      lengthM: 10,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-CT-004",
      truckType: "CONTAINER" as const,
      capacity: 25000,
      lengthM: 12,
      currentCity: "Addis Ababa",
    },

    // Dire Dawa (3 trucks)
    {
      licensePlate: "DD-DV-001",
      truckType: "DRY_VAN" as const,
      capacity: 18000,
      lengthM: 12,
      currentCity: "Dire Dawa",
    },
    {
      licensePlate: "DD-FB-002",
      truckType: "FLATBED" as const,
      capacity: 15000,
      lengthM: 13,
      currentCity: "Dire Dawa",
    },
    {
      licensePlate: "DD-RF-003",
      truckType: "REFRIGERATED" as const,
      capacity: 10000,
      lengthM: 9,
      currentCity: "Dire Dawa",
    },

    // Djibouti (2 trucks)
    {
      licensePlate: "DJ-DV-001",
      truckType: "DRY_VAN" as const,
      capacity: 20000,
      lengthM: 13,
      currentCity: "Djibouti",
    },
    {
      licensePlate: "DJ-CT-002",
      truckType: "CONTAINER" as const,
      capacity: 30000,
      lengthM: 12,
      currentCity: "Djibouti",
    },

    // Mekelle (2 trucks)
    {
      licensePlate: "MK-FB-001",
      truckType: "FLATBED" as const,
      capacity: 12000,
      lengthM: 11,
      currentCity: "Mekelle",
    },
    {
      licensePlate: "MK-RF-002",
      truckType: "REFRIGERATED" as const,
      capacity: 8000,
      lengthM: 8,
      currentCity: "Mekelle",
    },

    // Hawassa (1 truck)
    {
      licensePlate: "HW-DV-001",
      truckType: "DRY_VAN" as const,
      capacity: 10000,
      lengthM: 10,
      currentCity: "Hawassa",
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
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedById: adminUser.id,
          contactName: "Test Driver",
          contactPhone: "+251944444444",
        },
      });
      console.log(
        `   [+] Created truck: ${truckData.licensePlate} (${truckData.truckType})`
      );
    } else {
      await prisma.truck.update({
        where: { id: existingTruck.id },
        data: {
          carrierId: carrierOrg.id,
          isAvailable: true,
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedById: adminUser.id,
        },
      });
      console.log(`   [=] Truck exists: ${truckData.licensePlate} (updated)`);
    }
  }

  console.log("");

  // ============================================================================
  // 4. FINANCIAL ACCOUNTS (Wallets)
  // ============================================================================
  console.log("4. Creating financial accounts...\n");

  const INITIAL_BALANCE = 50000;

  // Shipper Wallet
  let shipperWallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: shipperOrg.id,
      accountType: "SHIPPER_WALLET",
    },
  });

  if (!shipperWallet) {
    shipperWallet = await prisma.financialAccount.create({
      data: {
        organizationId: shipperOrg.id,
        accountType: "SHIPPER_WALLET",
        balance: INITIAL_BALANCE,
        currency: "ETB",
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
    console.log(
      `   [=] Shipper wallet exists: balance set to ${INITIAL_BALANCE} ETB`
    );
  }

  // Carrier Wallet
  let carrierWallet = await prisma.financialAccount.findFirst({
    where: {
      organizationId: carrierOrg.id,
      accountType: "CARRIER_WALLET",
    },
  });

  if (!carrierWallet) {
    carrierWallet = await prisma.financialAccount.create({
      data: {
        organizationId: carrierOrg.id,
        accountType: "CARRIER_WALLET",
        balance: INITIAL_BALANCE,
        currency: "ETB",
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
    console.log(
      `   [=] Carrier wallet exists: balance set to ${INITIAL_BALANCE} ETB`
    );
  }

  // Platform Revenue Account (if not exists)
  let platformAccount = await prisma.financialAccount.findFirst({
    where: {
      accountType: "PLATFORM_REVENUE",
      organizationId: null,
    },
  });

  if (!platformAccount) {
    platformAccount = await prisma.financialAccount.create({
      data: {
        accountType: "PLATFORM_REVENUE",
        balance: 0,
        currency: "ETB",
        isActive: true,
      },
    });
    console.log("   [+] Created platform revenue account");
  } else {
    console.log("   [=] Platform revenue account exists");
  }

  console.log("");

  // ============================================================================
  // 5. TEST LOADS (8 loads across various Ethiopian routes)
  // ============================================================================
  console.log("5. Cleaning up and creating test loads...\n");

  // Delete old test loads for the shipper (to start fresh)
  await prisma.load.deleteMany({
    where: {
      shipperId: shipperOrg.id,
      status: "POSTED",
    },
  });
  console.log("   [x] Cleaned up old test loads\n");

  const loadsData = [
    // From Addis Ababa
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      truckType: "DRY_VAN" as const,
      weight: 12000,
      cargoDescription: "Electronics and household goods - export",
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      truckType: "CONTAINER" as const,
      weight: 22000,
      cargoDescription: "Containerized export cargo",
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      truckType: "FLATBED" as const,
      weight: 15000,
      cargoDescription: "Construction materials and machinery",
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Mekelle",
      truckType: "REFRIGERATED" as const,
      weight: 8000,
      cargoDescription: "Fresh produce and dairy products",
      pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    // From Dire Dawa
    {
      pickupCity: "Dire Dawa",
      deliveryCity: "Djibouti",
      truckType: "DRY_VAN" as const,
      weight: 16000,
      cargoDescription: "Agricultural products for export",
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      pickupCity: "Dire Dawa",
      deliveryCity: "Addis Ababa",
      truckType: "FLATBED" as const,
      weight: 10000,
      cargoDescription: "Industrial equipment",
      pickupDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    // From Mekelle
    {
      pickupCity: "Mekelle",
      deliveryCity: "Addis Ababa",
      truckType: "DRY_VAN" as const,
      weight: 14000,
      cargoDescription: "Textiles and garments",
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
    // From Djibouti (import)
    {
      pickupCity: "Djibouti",
      deliveryCity: "Addis Ababa",
      truckType: "CONTAINER" as const,
      weight: 20000,
      cargoDescription: "Imported containerized goods",
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdLoads: any[] = [];
  for (const loadData of loadsData) {
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
        status: "POSTED",
        postedAt: new Date(),
        bookMode: "REQUEST",
        fullPartial: "FULL",
      },
    });
    createdLoads.push(load);
    console.log(
      `   [+] Created load: ${loadData.pickupCity} → ${loadData.deliveryCity} (${loadData.truckType}, ${loadData.weight / 1000}T)`
    );
  }

  console.log("");

  // ============================================================================
  // 6. ETHIOPIAN LOCATIONS (Required for TruckPostings)
  // ============================================================================
  console.log("6. Creating Ethiopian locations...\n");

  const locationsData = [
    {
      name: "Addis Ababa",
      region: "Addis Ababa",
      latitude: 9.0054,
      longitude: 38.7636,
    },
    {
      name: "Dire Dawa",
      region: "Dire Dawa",
      latitude: 9.6011,
      longitude: 41.8505,
    },
    {
      name: "Mekelle",
      region: "Tigray",
      latitude: 13.4967,
      longitude: 39.4753,
    },
    {
      name: "Djibouti",
      region: "Djibouti",
      latitude: 11.5883,
      longitude: 43.145,
    },
    { name: "Hawassa", region: "SNNPR", latitude: 7.0624, longitude: 38.4764 },
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
          type: "CITY",
          isActive: true,
        },
      });
      console.log(`   [+] Created location: ${locData.name}`);
    } else {
      console.log(`   [=] Location exists: ${locData.name}`);
    }
    locationMap[locData.name] = location.id;
  }

  console.log("");

  // ============================================================================
  // 7. TEST TRUCK POSTINGS (Posted by Carrier - all 12 trucks)
  // ============================================================================
  console.log("7. Creating truck postings for all trucks...\n");

  const trucks = await prisma.truck.findMany({
    where: { carrierId: carrierOrg.id },
  });

  // City name to location ID mapping
  const cityLocationMap: Record<string, string> = {
    "Addis Ababa": locationMap["Addis Ababa"],
    "Dire Dawa": locationMap["Dire Dawa"],
    Mekelle: locationMap["Mekelle"],
    Djibouti: locationMap["Djibouti"],
    Hawassa: locationMap["Hawassa"],
  };

  for (const truck of trucks) {
    // First, delete any existing postings for this truck (to reset state)
    await prisma.truckPosting.deleteMany({
      where: { truckId: truck.id },
    });

    // Determine origin based on truck's current city
    const originCityId = cityLocationMap[truck.currentCity || "Addis Ababa"];

    if (!originCityId) {
      console.log(
        `   [!] Warning: No location found for ${truck.currentCity}, skipping ${truck.licensePlate}`
      );
      continue;
    }

    await prisma.truckPosting.create({
      data: {
        truckId: truck.id,
        carrierId: carrierOrg.id,
        createdById: carrierUser.id,
        originCityId: originCityId,
        availableFrom: new Date(),
        availableTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (next week)
        status: "ACTIVE",
        contactName: "Test Driver",
        contactPhone: "+251955555555",
        fullPartial: "FULL",
        availableWeight: truck.capacity,
        availableLength: truck.lengthM,
      },
    });
    console.log(
      `   [+] Created posting: ${truck.licensePlate} (${truck.truckType}) in ${truck.currentCity}`
    );
  }

  console.log("");

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("========================================");
  console.log("  SEED COMPLETED SUCCESSFULLY");
  console.log("========================================\n");

  console.log("Test Users (password: password):");
  console.log("  - shipper@test.com    (Shipper role)");
  console.log("  - carrier@test.com    (Carrier role)");
  console.log("  - dispatcher@test.com (Dispatcher role)");
  console.log("  - admin@test.com      (Admin role)");
  console.log("");

  console.log("Test Organizations:");
  console.log(`  - Test Shipper Co (ID: ${shipperOrg.id})`);
  console.log(`  - Test Carrier Co (ID: ${carrierOrg.id})`);
  console.log(`  - Dispatch Center (ID: ${dispatchOrg.id})`);
  console.log("");

  console.log("Test Corridors:");
  console.log(
    "  - Addis Ababa ↔ Dire Dawa: 453km @ 2.50 ETB/km (BIDIRECTIONAL)"
  );
  console.log(
    "  - Addis Ababa ↔ Djibouti: 910km @ 3.00 ETB/km (BIDIRECTIONAL)"
  );
  console.log("  - Addis Ababa ↔ Mekelle: 783km @ 2.50 ETB/km (BIDIRECTIONAL)");
  console.log(
    "  - Addis Ababa ↔ Hawassa: 275km @ 2.00/1.80 ETB/km (BIDIRECTIONAL)"
  );
  console.log("");

  console.log("Test Trucks (12 total across cities):");
  console.log("  Addis Ababa:");
  console.log("    - AA-DV-001 (DRY_VAN, 15T)");
  console.log("    - AA-FB-002 (FLATBED, 20T)");
  console.log("    - AA-RF-003 (REFRIGERATED, 12T)");
  console.log("    - AA-CT-004 (CONTAINER, 25T)");
  console.log("  Dire Dawa:");
  console.log("    - DD-DV-001 (DRY_VAN, 18T)");
  console.log("    - DD-FB-002 (FLATBED, 15T)");
  console.log("    - DD-RF-003 (REFRIGERATED, 10T)");
  console.log("  Djibouti:");
  console.log("    - DJ-DV-001 (DRY_VAN, 20T)");
  console.log("    - DJ-CT-002 (CONTAINER, 30T)");
  console.log("  Mekelle:");
  console.log("    - MK-FB-001 (FLATBED, 12T)");
  console.log("    - MK-RF-002 (REFRIGERATED, 8T)");
  console.log("  Hawassa:");
  console.log("    - HW-DV-001 (DRY_VAN, 10T)");
  console.log("");

  console.log("Test Loads (8 total):");
  console.log("  - Addis Ababa → Djibouti (DRY_VAN, 12T)");
  console.log("  - Addis Ababa → Djibouti (CONTAINER, 22T)");
  console.log("  - Addis Ababa → Dire Dawa (FLATBED, 15T)");
  console.log("  - Addis Ababa → Mekelle (REFRIGERATED, 8T)");
  console.log("  - Dire Dawa → Djibouti (DRY_VAN, 16T)");
  console.log("  - Dire Dawa → Addis Ababa (FLATBED, 10T)");
  console.log("  - Mekelle → Addis Ababa (DRY_VAN, 14T)");
  console.log("  - Djibouti → Addis Ababa (CONTAINER, 20T)");
  console.log("");

  console.log("Test Locations:");
  console.log("  - Addis Ababa, Dire Dawa, Mekelle, Djibouti, Hawassa");
  console.log("");

  console.log("Test Truck Postings:");
  console.log("  - All 12 trucks posted as ACTIVE");
  console.log("  - Available for next 7 days");
  console.log("");

  console.log("Financial Accounts:");
  console.log(`  - Shipper Wallet: ${INITIAL_BALANCE} ETB`);
  console.log(`  - Carrier Wallet: ${INITIAL_BALANCE} ETB`);
  console.log("  - Platform Revenue: 0 ETB");
  console.log("");

  console.log("========================================\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
