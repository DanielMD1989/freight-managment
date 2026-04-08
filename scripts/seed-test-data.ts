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
// shipper/carrier/admin use "Test123!" to match auth.setup.ts files
// dispatcher uses "password" (matches dispatcher/auth.setup.ts)
const TEST_PASSWORD_STANDARD = "Test123!";
const TEST_PASSWORD_DISPATCHER = "password";

// Helper: Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Idempotent wallet seeding with full ledger integrity.
 *
 * Guarantees: after calling this function, the wallet's stored balance is
 * exactly `initialBalance` AND there is exactly one matching DEPOSIT
 * journal entry equal to `initialBalance` (and zero other journal entries
 * for this wallet). Re-seeding wipes any prior journal entries to prevent
 * the drift bug where balance was reset without clearing journal history.
 */
async function seedWalletWithJournal(
  organizationId: string,
  accountType: "SHIPPER_WALLET" | "CARRIER_WALLET",
  initialBalance: number,
  description = "Initial seed funding"
): Promise<{ walletId: string }> {
  // Find or create the wallet
  let wallet = await prisma.financialAccount.findFirst({
    where: { organizationId, accountType },
  });

  if (wallet) {
    // Re-seed: wipe all journal lines + entries that touch this wallet
    // BEFORE resetting balance, so journal and balance stay in sync.
    // We must delete journalLines first (FK), then any orphan journalEntries
    // whose lines were all on this wallet.
    const linesToDelete = await prisma.journalLine.findMany({
      where: { accountId: wallet.id },
      select: { id: true, journalEntryId: true },
    });
    const affectedEntryIds = Array.from(
      new Set(linesToDelete.map((l) => l.journalEntryId))
    );

    if (linesToDelete.length > 0) {
      await prisma.journalLine.deleteMany({
        where: { accountId: wallet.id },
      });
    }

    // Delete journal entries that now have zero remaining lines
    for (const entryId of affectedEntryIds) {
      const remaining = await prisma.journalLine.count({
        where: { journalEntryId: entryId },
      });
      if (remaining === 0) {
        await prisma.journalEntry
          .delete({ where: { id: entryId } })
          .catch(() => {
            // Entry may have been deleted by cascade or no longer exist
          });
      }
    }

    // Reset balance to 0 — about to create the seed deposit entry
    await prisma.financialAccount.update({
      where: { id: wallet.id },
      data: { balance: 0, isActive: true },
    });
  } else {
    wallet = await prisma.financialAccount.create({
      data: {
        organizationId,
        accountType,
        balance: 0,
        currency: "ETB",
        isActive: true,
      },
    });
  }

  // Create the seed deposit: one credit line for the initial amount,
  // then increment the balance to match. Wrapped in a transaction so
  // journal entry + balance update are atomic.
  if (initialBalance > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: {
          transactionType: "DEPOSIT",
          description,
          reference: `seed-${organizationId}`,
          metadata: {
            seedFunding: true,
            seededAt: new Date().toISOString(),
          },
          lines: {
            create: [
              {
                accountId: wallet!.id,
                amount: initialBalance,
                isDebit: false, // Credit to wallet (money IN)
              },
            ],
          },
        },
      });

      await tx.financialAccount.update({
        where: { id: wallet!.id },
        data: { balance: { increment: initialBalance } },
      });
    });
  }

  return { walletId: wallet.id };
}

async function main() {
  console.log("========================================");
  console.log("  E2E Test Data Seed Script");
  console.log("========================================\n");

  const hashedPassword = await hashPassword(TEST_PASSWORD_STANDARD);
  const hashedPasswordDispatcher = await hashPassword(TEST_PASSWORD_DISPATCHER);

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
        verificationStatus: "APPROVED",
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
        verificationStatus: "APPROVED",
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
        verificationStatus: "APPROVED",
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
        verificationStatus: "APPROVED",
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

  // --- Super Admin User ---
  let superAdminUser = await prisma.user.findUnique({
    where: { email: "superadmin@test.com" },
  });

  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        email: "superadmin@test.com",
        passwordHash: hashedPassword,
        firstName: "Test",
        lastName: "SuperAdmin",
        phone: "+251955555555",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isActive: true,
      },
    });
    console.log("   [+] Created user: superadmin@test.com");
  } else {
    await prisma.user.update({
      where: { id: superAdminUser.id },
      data: {
        passwordHash: hashedPassword,
        status: "ACTIVE",
        isActive: true,
      },
    });
    console.log("   [=] User exists: superadmin@test.com (updated)");
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
        verificationStatus: "APPROVED",
      },
    });
    console.log("   [+] Created organization: Dispatch Center");
  } else {
    await prisma.organization.update({
      where: { id: dispatchOrg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verificationStatus: "APPROVED",
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
        passwordHash: hashedPasswordDispatcher,
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
        passwordHash: hashedPasswordDispatcher,
        status: "ACTIVE",
        isActive: true,
        organizationId: dispatchOrg.id,
      },
    });
    console.log("   [=] User exists: dispatcher@test.com (updated)");
  }

  // ── Dedicated workflow users (isolated from shared test accounts) ──

  // Workflow Shipper — used by full-workflow.spec.ts
  const wfShipperOrg = await prisma.organization.upsert({
    where: { licenseNumber: "WF-SHIPPER-001" },
    update: { verificationStatus: "APPROVED", isVerified: true },
    create: {
      name: "Workflow Shipper Co",
      type: "SHIPPER",
      licenseNumber: "WF-SHIPPER-001",
      contactEmail: "wf-shipper@test.com",
      contactPhone: "+251911777001",
      isVerified: true,
      verificationStatus: "APPROVED",
      documentsLockedAt: new Date(),
    },
  });
  await prisma.user.upsert({
    where: { email: "wf-shipper@test.com" },
    update: { passwordHash: hashedPassword, status: "ACTIVE", isActive: true },
    create: {
      email: "wf-shipper@test.com",
      passwordHash: hashedPassword,
      firstName: "Workflow",
      lastName: "Shipper",
      phone: "+251911777001",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: wfShipperOrg.id,
    },
  });
  await seedWalletWithJournal(
    wfShipperOrg.id,
    "SHIPPER_WALLET",
    50000,
    "Workflow shipper initial seed funding"
  );
  console.log("   [+] Workflow shipper: wf-shipper@test.com");

  // Workflow Carrier — used by full-workflow.spec.ts
  const wfCarrierOrg = await prisma.organization.upsert({
    where: { licenseNumber: "WF-CARRIER-001" },
    update: { verificationStatus: "APPROVED", isVerified: true },
    create: {
      name: "Workflow Carrier Co",
      type: "CARRIER_COMPANY",
      licenseNumber: "WF-CARRIER-001",
      contactEmail: "wf-carrier@test.com",
      contactPhone: "+251911777002",
      isVerified: true,
      verificationStatus: "APPROVED",
      documentsLockedAt: new Date(),
    },
  });
  await prisma.user.upsert({
    where: { email: "wf-carrier@test.com" },
    update: { passwordHash: hashedPassword, status: "ACTIVE", isActive: true },
    create: {
      email: "wf-carrier@test.com",
      passwordHash: hashedPassword,
      firstName: "Workflow",
      lastName: "Carrier",
      phone: "+251911777002",
      role: "CARRIER",
      status: "ACTIVE",
      isActive: true,
      organizationId: wfCarrierOrg.id,
    },
  });
  await seedWalletWithJournal(
    wfCarrierOrg.id,
    "CARRIER_WALLET",
    50000,
    "Workflow carrier initial seed funding"
  );
  // Create a dedicated workflow truck (approved + insured)
  const wfTruck = await prisma.truck.upsert({
    where: { licensePlate: "WF-FB-001" },
    update: {
      carrierId: wfCarrierOrg.id,
      isAvailable: true,
      approvalStatus: "APPROVED",
      insuranceStatus: "VALID",
      insuranceExpiresAt: new Date("2027-12-31"),
    },
    create: {
      carrierId: wfCarrierOrg.id,
      licensePlate: "WF-FB-001",
      truckType: "FLATBED",
      capacity: 20000,
      lengthM: 14,
      currentCity: "Addis Ababa",
      isAvailable: true,
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      approvedById: adminUser.id,
      contactName: "WF Driver",
      contactPhone: "+251911777003",
      insuranceStatus: "VALID",
      insuranceExpiresAt: new Date("2027-12-31"),
    },
  });
  // Extra workflow trucks (avoid running out if one gets locked in a trip)
  for (const extra of [
    { plate: "WF-DV-002", type: "DRY_VAN" as const, capacity: 15000 },
    { plate: "WF-CT-003", type: "CONTAINER" as const, capacity: 25000 },
    { plate: "WF-DV-004", type: "DRY_VAN" as const, capacity: 14000 },
    { plate: "WF-FB-005", type: "FLATBED" as const, capacity: 18000 },
    { plate: "WF-RF-006", type: "REFRIGERATED" as const, capacity: 12000 },
    { plate: "WF-CT-007", type: "CONTAINER" as const, capacity: 28000 },
    { plate: "WF-DV-008", type: "DRY_VAN" as const, capacity: 16000 },
    { plate: "WF-FB-009", type: "FLATBED" as const, capacity: 20000 },
  ]) {
    await prisma.truck.upsert({
      where: { licensePlate: extra.plate },
      update: {
        carrierId: wfCarrierOrg.id,
        isAvailable: true,
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        insuranceExpiresAt: new Date("2027-12-31"),
      },
      create: {
        carrierId: wfCarrierOrg.id,
        licensePlate: extra.plate,
        truckType: extra.type,
        capacity: extra.capacity,
        lengthM: 12,
        currentCity: "Addis Ababa",
        isAvailable: true,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        approvedById: adminUser.id,
        contactName: "WF Driver",
        contactPhone: "+251911777003",
        insuranceStatus: "VALID",
        insuranceExpiresAt: new Date("2027-12-31"),
      },
    });
  }
  console.log("   [+] Workflow carrier: wf-carrier@test.com + 9 trucks");

  // Delete-test user — used by account deletion E2E test
  const deleteOrg = await prisma.organization.upsert({
    where: { licenseNumber: "DELETE-TEST-001" },
    update: { verificationStatus: "APPROVED", isVerified: true },
    create: {
      name: "Delete Test Co",
      type: "SHIPPER",
      licenseNumber: "DELETE-TEST-001",
      contactEmail: "delete-test@test.com",
      contactPhone: "+251911777099",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await prisma.user.upsert({
    where: { email: "delete-test@test.com" },
    update: { passwordHash: hashedPassword, status: "ACTIVE", isActive: true },
    create: {
      email: "delete-test@test.com",
      passwordHash: hashedPassword,
      firstName: "Delete",
      lastName: "TestUser",
      phone: "+251911777099",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: deleteOrg.id,
    },
  });
  console.log("   [+] Delete test user: delete-test@test.com");

  // Post workflow truck to marketplace
  const wfAddis = await prisma.ethiopianLocation.findFirst({
    where: { name: "Addis Ababa" },
  });
  if (wfAddis) {
    const existingPosting = await prisma.truckPosting.findFirst({
      where: { truckId: wfTruck.id, status: "ACTIVE" },
    });
    if (!existingPosting) {
      const wfCarrierUser = await prisma.user.findUnique({
        where: { email: "wf-carrier@test.com" },
      });
      await prisma.truckPosting.create({
        data: {
          truckId: wfTruck.id,
          carrierId: wfCarrierOrg.id,
          createdById: wfCarrierUser!.id,
          originCityId: wfAddis.id,
          availableFrom: new Date(),
          availableTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          fullPartial: "FULL",
          availableWeight: 20000,
          contactName: "WF Driver",
          contactPhone: "+251911777003",
          status: "ACTIVE",
          postedAt: new Date(),
        },
      });
    }
    // Post ALL workflow trucks to marketplace (not just WF-FB-001)
    const wfCarrierUser = await prisma.user.findUnique({
      where: { email: "wf-carrier@test.com" },
    });
    const allWfTrucks = await prisma.truck.findMany({
      where: { carrierId: wfCarrierOrg.id },
    });
    for (const t of allWfTrucks) {
      const hasPosting = await prisma.truckPosting.findFirst({
        where: { truckId: t.id, status: "ACTIVE" },
      });
      if (!hasPosting) {
        await prisma.truckPosting.create({
          data: {
            truckId: t.id,
            carrierId: wfCarrierOrg.id,
            createdById: wfCarrierUser!.id,
            originCityId: wfAddis.id,
            availableFrom: new Date(),
            availableTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            fullPartial: "FULL",
            availableWeight: Number(t.capacity),
            contactName: "WF Driver",
            contactPhone: "+251911777003",
            status: "ACTIVE",
            postedAt: new Date(),
          },
        });
      }
    }
    console.log(
      `   [+] ${allWfTrucks.length} workflow trucks posted to marketplace`
    );
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

    // Addis Ababa — extra trucks for test isolation (8 more = 12 total in AA)
    {
      licensePlate: "AA-DV-005",
      truckType: "DRY_VAN" as const,
      capacity: 14000,
      lengthM: 11,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-DV-006",
      truckType: "DRY_VAN" as const,
      capacity: 16000,
      lengthM: 13,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-FB-007",
      truckType: "FLATBED" as const,
      capacity: 18000,
      lengthM: 13,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-FB-008",
      truckType: "FLATBED" as const,
      capacity: 22000,
      lengthM: 15,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-RF-009",
      truckType: "REFRIGERATED" as const,
      capacity: 10000,
      lengthM: 9,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-RF-010",
      truckType: "REFRIGERATED" as const,
      capacity: 14000,
      lengthM: 11,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-CT-011",
      truckType: "CONTAINER" as const,
      capacity: 28000,
      lengthM: 13,
      currentCity: "Addis Ababa",
    },
    {
      licensePlate: "AA-CT-012",
      truckType: "CONTAINER" as const,
      capacity: 30000,
      lengthM: 14,
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
          insuranceStatus: "VALID",
          insuranceExpiresAt: new Date("2027-12-31"),
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
          insuranceStatus: "VALID",
          insuranceExpiresAt: new Date("2027-12-31"),
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

  // Shipper Wallet — uses seedWalletWithJournal helper to guarantee
  // ledger integrity (balance = sum of journal credits − debits).
  // On re-seed, prior journal entries for this wallet are wiped first.
  await seedWalletWithJournal(
    shipperOrg.id,
    "SHIPPER_WALLET",
    INITIAL_BALANCE,
    "Test shipper initial seed funding"
  );
  console.log(
    `   [+] Shipper wallet seeded: ${INITIAL_BALANCE} ETB (with matching journal entry)`
  );

  // Carrier Wallet — same pattern
  await seedWalletWithJournal(
    carrierOrg.id,
    "CARRIER_WALLET",
    INITIAL_BALANCE,
    "Test carrier initial seed funding"
  );
  console.log(
    `   [+] Carrier wallet seeded: ${INITIAL_BALANCE} ETB (with matching journal entry)`
  );

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
        shipperContactName: "Test Shipper",
        shipperContactPhone: "+251911111111",
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
  // 6b. GPS DEVICES (Required before posting trucks to marketplace - §11)
  // ============================================================================
  console.log("6b. Creating GPS devices for all trucks...\n");

  const allTrucksForGps = await prisma.truck.findMany({
    where: { carrierId: { in: [carrierOrg.id, wfCarrierOrg.id] } },
  });
  for (const truck of allTrucksForGps) {
    if (truck.gpsDeviceId) continue; // Already has GPS
    const imei = `IMEI${truck.licensePlate.replace(/[^A-Z0-9]/g, "")}001`;
    const existing = await prisma.gpsDevice.findUnique({ where: { imei } });
    if (!existing) {
      const device = await prisma.gpsDevice.create({
        data: {
          imei,
          status: "ACTIVE",
          lastSeenAt: new Date(),
        },
      });
      await prisma.truck.update({
        where: { id: truck.id },
        data: { gpsDeviceId: device.id, gpsStatus: "ACTIVE" },
      });
    }
  }
  console.log(
    `   [+] GPS devices created for ${allTrucksForGps.length} trucks\n`
  );

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
  // 8. STATUS-COVERAGE FIXTURES
  //
  // Adds one realistic, relationally-consistent record for every Load /
  // Trip / Truck / TruckPosting status enum value that the main seed
  // doesn't already cover. The reconciliation script in
  // scripts/audit-data-consistency.ts asserts every status has ≥1 row.
  //
  // Patterns mirror existing seed-test-data + seed-demo-data shapes —
  // no new field conventions invented here.
  // ============================================================================
  console.log("8. Creating status-coverage fixtures...\n");

  // Helper: pick the first existing test truck for the carrier so trips
  // and assigned loads have a real FK target.
  const fixtureTrucks = await prisma.truck.findMany({
    where: { carrierId: carrierOrg.id, approvalStatus: "APPROVED" },
    take: 12,
  });
  if (fixtureTrucks.length < 7) {
    throw new Error(
      `status-coverage fixtures need ≥7 approved trucks; got ${fixtureTrucks.length}`
    );
  }

  // ─── Loads — one per missing status ──────────────────────────────────────
  // Existing seed creates POSTED only. We add the other 11.
  const baseLoadFields = (overrides: Record<string, unknown>) => ({
    shipperId: shipperOrg.id,
    createdById: shipperUser.id,
    pickupCity: "Addis Ababa",
    deliveryCity: "Djibouti",
    truckType: "DRY_VAN" as const,
    weight: 10000,
    cargoDescription: "Status coverage fixture",
    pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    shipperContactName: "Test Shipper",
    shipperContactPhone: "+251911111111",
    bookMode: "REQUEST" as const,
    fullPartial: "FULL" as const,
    ...overrides,
  });

  // 1. DRAFT — never posted
  await prisma.load.create({ data: baseLoadFields({ status: "DRAFT" }) });

  // 2. SEARCHING — posted then advanced to searching
  await prisma.load.create({
    data: baseLoadFields({
      status: "SEARCHING",
      postedAt: new Date(),
    }),
  });

  // 3. OFFERED — offered to a carrier
  await prisma.load.create({
    data: baseLoadFields({
      status: "OFFERED",
      postedAt: new Date(),
    }),
  });

  // 4. ASSIGNED — has assignedTruckId + matching ASSIGNED Trip
  const assignedLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "ASSIGNED",
      postedAt: new Date(),
      assignedTruckId: fixtureTrucks[0].id,
      assignedAt: new Date(),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: assignedLoad.id,
      truckId: fixtureTrucks[0].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "ASSIGNED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-assigned",
      trackingEnabled: true,
      estimatedDistanceKm: 910,
    },
  });

  // 5. PICKUP_PENDING — load + trip both PICKUP_PENDING
  const pickupLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "PICKUP_PENDING",
      postedAt: new Date(),
      assignedTruckId: fixtureTrucks[1].id,
      assignedAt: new Date(),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: pickupLoad.id,
      truckId: fixtureTrucks[1].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "PICKUP_PENDING",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-pickup-pending",
      trackingEnabled: true,
      estimatedDistanceKm: 910,
      startedAt: new Date(),
    },
  });

  // 6. IN_TRANSIT
  const inTransitLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "IN_TRANSIT",
      postedAt: new Date(),
      assignedTruckId: fixtureTrucks[2].id,
      assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: inTransitLoad.id,
      truckId: fixtureTrucks[2].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "IN_TRANSIT",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-in-transit",
      trackingEnabled: true,
      estimatedDistanceKm: 910,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  // 7. DELIVERED
  const deliveredLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "DELIVERED",
      postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      assignedTruckId: fixtureTrucks[3].id,
      assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: deliveredLoad.id,
      truckId: fixtureTrucks[3].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "DELIVERED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-delivered",
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(),
    },
  });

  // 8. COMPLETED — settled
  const completedLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "COMPLETED",
      postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      assignedTruckId: fixtureTrucks[4].id,
      assignedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      podSubmitted: true,
      podSubmittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      podVerified: true,
      podVerifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      settlementStatus: "PAID",
      settledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: completedLoad.id,
      truckId: fixtureTrucks[4].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "COMPLETED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-completed",
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shipperConfirmed: true,
      shipperConfirmedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // 9. EXCEPTION — IN_TRANSIT load with EXCEPTION trip
  const exceptionLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "EXCEPTION",
      postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      assignedTruckId: fixtureTrucks[5].id,
      assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: exceptionLoad.id,
      truckId: fixtureTrucks[5].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "EXCEPTION",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-exception",
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  // 10. CANCELLED — load + matching CANCELLED trip
  const cancelledLoad = await prisma.load.create({
    data: baseLoadFields({
      status: "CANCELLED",
      postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      assignedTruckId: fixtureTrucks[6].id,
      assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    }),
  });
  await prisma.trip.create({
    data: {
      loadId: cancelledLoad.id,
      truckId: fixtureTrucks[6].id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: "CANCELLED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Djibouti",
      trackingUrl: "fixture-trip-cancelled",
      cancelledAt: new Date(),
      cancelReason: "Status coverage fixture",
    },
  });

  // 11. EXPIRED — posted load that timed out
  await prisma.load.create({
    data: baseLoadFields({
      status: "EXPIRED",
      postedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    }),
  });

  console.log(`   [+] Loads: 11 status-coverage rows added (DRAFT…EXPIRED)`);
  console.log(
    `   [+] Trips: 7 status-coverage rows added (ASSIGNED…CANCELLED)`
  );

  // ─── Trucks — PENDING + REJECTED ─────────────────────────────────────────
  // POSTED status doesn't exist as an approvalStatus enum value (truckPosting
  // is the "posted" state). Approval statuses we still need: PENDING, REJECTED.
  await prisma.truck.create({
    data: {
      carrierId: carrierOrg.id,
      licensePlate: "FX-PEND-001",
      truckType: "DRY_VAN",
      capacity: 10000,
      lengthM: 10,
      currentCity: "Addis Ababa",
      isAvailable: false,
      approvalStatus: "PENDING",
      contactName: "Test Driver",
      contactPhone: "+251944444445",
      insuranceStatus: "VALID",
      insuranceExpiresAt: new Date("2027-12-31"),
    },
  });
  await prisma.truck.create({
    data: {
      carrierId: carrierOrg.id,
      licensePlate: "FX-REJ-001",
      truckType: "FLATBED",
      capacity: 12000,
      lengthM: 11,
      currentCity: "Addis Ababa",
      isAvailable: false,
      approvalStatus: "REJECTED",
      rejectedAt: new Date(),
      contactName: "Test Driver",
      contactPhone: "+251944444446",
      insuranceStatus: "VALID",
      insuranceExpiresAt: new Date("2027-12-31"),
    },
  });
  console.log(
    `   [+] Trucks: 2 status-coverage rows added (PENDING, REJECTED)`
  );

  // ─── TruckPostings — EXPIRED + CANCELLED ─────────────────────────────────
  // Use 2 of the existing approved trucks; deactivate their existing ACTIVE
  // posting first if any (we don't want duplicate/conflicting state).
  const expiringTruck = fixtureTrucks[7] ?? fixtureTrucks[0];
  const cancellingTruck = fixtureTrucks[8] ?? fixtureTrucks[1];
  await prisma.truckPosting.create({
    data: {
      truckId: expiringTruck.id,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      originCityId: locationMap["Addis Ababa"],
      availableFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      availableTo: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: "EXPIRED",
      contactName: "Test Driver",
      contactPhone: "+251955555556",
      fullPartial: "FULL",
    },
  });
  await prisma.truckPosting.create({
    data: {
      truckId: cancellingTruck.id,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      originCityId: locationMap["Addis Ababa"],
      availableFrom: new Date(),
      availableTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "CANCELLED",
      contactName: "Test Driver",
      contactPhone: "+251955555557",
      fullPartial: "FULL",
    },
  });
  console.log(
    `   [+] TruckPostings: 2 status-coverage rows added (EXPIRED, CANCELLED)\n`
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("========================================");
  console.log("  SEED COMPLETED SUCCESSFULLY");
  console.log("========================================\n");

  console.log("Test Users:");
  console.log(
    "  - shipper@test.com      (Shipper role,     password: Test123!)"
  );
  console.log(
    "  - carrier@test.com      (Carrier role,     password: Test123!)"
  );
  console.log(
    "  - admin@test.com        (Admin role,       password: Test123!)"
  );
  console.log(
    "  - superadmin@test.com   (SuperAdmin role,  password: Test123!)"
  );
  console.log(
    "  - dispatcher@test.com   (Dispatcher role,  password: password)"
  );
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
