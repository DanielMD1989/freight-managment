/**
 * Demo Data Seed Script for FreightET Platform
 *
 * Creates comprehensive demo data for showcasing the platform with realistic
 * Ethiopian logistics scenarios. Additive — does NOT delete existing test data.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-data.ts
 *
 * Creates:
 * - 10 Organizations (5 shippers + 5 carriers)
 * - 15 Users (1 per shipper, 2 per carrier)
 * - 6 Corridors with shipper/carrier rates
 * - 5 Ethiopian Locations
 * - 23 Trucks (DEMO- prefixed plates)
 * - 20 Loads (8 posted, 4 assigned, 8 completed)
 * - 10 Financial Wallets + platform revenue account
 * - 15 Truck Postings
 * - 5 Match Proposals
 * - 20 Notifications
 *
 * All passwords: "password" (bcrypt 10 rounds)
 * All demo truck plates prefixed with DEMO- for easy cleanup
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://danieldamitew@localhost:5432/freight_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const TEST_PASSWORD = 'password';

// ============================================================================
// HELPERS
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// Counters for summary
const counts = {
  orgsCreated: 0,
  orgsUpdated: 0,
  usersCreated: 0,
  usersUpdated: 0,
  corridorsCreated: 0,
  corridorsUpdated: 0,
  locationsCreated: 0,
  locationsExisting: 0,
  trucksCreated: 0,
  trucksUpdated: 0,
  loadsCreated: 0,
  tripsCreated: 0,
  journalEntriesCreated: 0,
  walletsCreated: 0,
  walletsUpdated: 0,
  postingsCreated: 0,
  proposalsCreated: 0,
  notificationsCreated: 0,
};

async function main() {
  console.log('========================================');
  console.log('  FreightET Demo Data Seed Script');
  console.log('========================================\n');

  const hashedPassword = await hashPassword(TEST_PASSWORD);

  // ============================================================================
  // 1. ORGANIZATIONS (10 new — 5 shippers + 5 carriers)
  // ============================================================================
  console.log('1. Creating demo organizations...\n');

  const shipperOrgsData = [
    { name: 'Ethio Agri Export', type: 'SHIPPER' as const, city: 'Addis Ababa', email: 'agri@demo.com', phone: '+251911100001' },
    { name: 'Merkato Trading PLC', type: 'SHIPPER' as const, city: 'Addis Ababa', email: 'merkato@demo.com', phone: '+251911100002' },
    { name: 'Dire Industries', type: 'SHIPPER' as const, city: 'Dire Dawa', email: 'dire@demo.com', phone: '+251911100003' },
    { name: 'Mekelle Textiles', type: 'SHIPPER' as const, city: 'Mekelle', email: 'mekelle@demo.com', phone: '+251911100004' },
    { name: 'Hawassa Foods', type: 'SHIPPER' as const, city: 'Hawassa', email: 'hawassa@demo.com', phone: '+251911100005' },
  ];

  const carrierOrgsData = [
    { name: 'Selam Transport', type: 'CARRIER_COMPANY' as const, city: 'Addis Ababa', email: 'selam@demo.com', phone: '+251922200001' },
    { name: 'Abay Logistics', type: 'CARRIER_COMPANY' as const, city: 'Addis Ababa', email: 'abay@demo.com', phone: '+251922200002' },
    { name: 'Eastern Cargo', type: 'CARRIER_COMPANY' as const, city: 'Dire Dawa', email: 'eastern@demo.com', phone: '+251922200003' },
    { name: 'Northern Express', type: 'CARRIER_COMPANY' as const, city: 'Mekelle', email: 'northern@demo.com', phone: '+251922200004' },
    { name: 'Rift Valley Haulers', type: 'CARRIER_COMPANY' as const, city: 'Hawassa', email: 'riftvalley@demo.com', phone: '+251922200005' },
  ];

  type OrgRecord = { id: string; name: string };
  const shipperOrgs: OrgRecord[] = [];
  const carrierOrgs: OrgRecord[] = [];

  for (const orgData of [...shipperOrgsData, ...carrierOrgsData]) {
    let org = await prisma.organization.findFirst({
      where: { name: orgData.name },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: orgData.name,
          type: orgData.type,
          contactEmail: orgData.email,
          contactPhone: orgData.phone,
          city: orgData.city,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      counts.orgsCreated++;
      console.log(`   [+] Created organization: ${orgData.name}`);
    } else {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          contactPhone: orgData.phone,
          city: orgData.city,
        },
      });
      counts.orgsUpdated++;
      console.log(`   [=] Organization exists: ${orgData.name} (updated)`);
    }

    if (orgData.type === 'SHIPPER') {
      shipperOrgs.push({ id: org.id, name: orgData.name });
    } else {
      carrierOrgs.push({ id: org.id, name: orgData.name });
    }
  }

  console.log('');

  // ============================================================================
  // 2. USERS (15 new — 1 per shipper, 2 per carrier)
  // ============================================================================
  console.log('2. Creating demo users...\n');

  // Maps for later reference: orgName -> userId
  const userMap: Record<string, { id: string; email: string }> = {};

  // Shipper users (1 per org)
  const shipperUsersData = [
    { email: 'agri-shipper@demo.com', firstName: 'Abebe', lastName: 'Kebede', phone: '+251911100011', orgName: 'Ethio Agri Export' },
    { email: 'merkato-shipper@demo.com', firstName: 'Tigist', lastName: 'Hailu', phone: '+251911100012', orgName: 'Merkato Trading PLC' },
    { email: 'dire-shipper@demo.com', firstName: 'Mohammed', lastName: 'Ahmed', phone: '+251911100013', orgName: 'Dire Industries' },
    { email: 'mekelle-shipper@demo.com', firstName: 'Berhane', lastName: 'Gebre', phone: '+251911100014', orgName: 'Mekelle Textiles' },
    { email: 'hawassa-shipper@demo.com', firstName: 'Sara', lastName: 'Tadesse', phone: '+251911100015', orgName: 'Hawassa Foods' },
  ];

  for (const userData of shipperUsersData) {
    const orgId = shipperOrgs.find(o => o.name === userData.orgName)!.id;
    let user = await prisma.user.findUnique({ where: { email: userData.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: 'SHIPPER',
          status: 'ACTIVE',
          isActive: true,
          organizationId: orgId,
        },
      });
      counts.usersCreated++;
      console.log(`   [+] Created user: ${userData.email} (SHIPPER)`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          isActive: true,
          organizationId: orgId,
        },
      });
      counts.usersUpdated++;
      console.log(`   [=] User exists: ${userData.email} (updated)`);
    }
    userMap[userData.orgName] = { id: user.id, email: userData.email };
  }

  // Carrier users (2 per org: admin + driver)
  const carrierUsersData = [
    { email: 'selam-admin@demo.com', firstName: 'Dawit', lastName: 'Yohannes', phone: '+251922200011', orgName: 'Selam Transport', isAdmin: true },
    { email: 'selam-driver@demo.com', firstName: 'Getachew', lastName: 'Mekonnen', phone: '+251922200012', orgName: 'Selam Transport', isAdmin: false },
    { email: 'abay-admin@demo.com', firstName: 'Kalkidan', lastName: 'Desta', phone: '+251922200013', orgName: 'Abay Logistics', isAdmin: true },
    { email: 'abay-driver@demo.com', firstName: 'Yonas', lastName: 'Belay', phone: '+251922200014', orgName: 'Abay Logistics', isAdmin: false },
    { email: 'eastern-admin@demo.com', firstName: 'Fatuma', lastName: 'Ali', phone: '+251922200015', orgName: 'Eastern Cargo', isAdmin: true },
    { email: 'eastern-driver@demo.com', firstName: 'Hussien', lastName: 'Osman', phone: '+251922200016', orgName: 'Eastern Cargo', isAdmin: false },
    { email: 'northern-admin@demo.com', firstName: 'Tsegaye', lastName: 'Abraha', phone: '+251922200017', orgName: 'Northern Express', isAdmin: true },
    { email: 'northern-driver@demo.com', firstName: 'Gebru', lastName: 'Haile', phone: '+251922200018', orgName: 'Northern Express', isAdmin: false },
    { email: 'riftvalley-admin@demo.com', firstName: 'Alemayehu', lastName: 'Negash', phone: '+251922200019', orgName: 'Rift Valley Haulers', isAdmin: true },
    { email: 'riftvalley-driver@demo.com', firstName: 'Bekele', lastName: 'Worku', phone: '+251922200020', orgName: 'Rift Valley Haulers', isAdmin: false },
  ];

  for (const userData of carrierUsersData) {
    const orgId = carrierOrgs.find(o => o.name === userData.orgName)!.id;
    let user = await prisma.user.findUnique({ where: { email: userData.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: 'CARRIER',
          status: 'ACTIVE',
          isActive: true,
          organizationId: orgId,
        },
      });
      counts.usersCreated++;
      console.log(`   [+] Created user: ${userData.email} (CARRIER${userData.isAdmin ? ' admin' : ' driver'})`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          isActive: true,
          organizationId: orgId,
        },
      });
      counts.usersUpdated++;
      console.log(`   [=] User exists: ${userData.email} (updated)`);
    }

    // Store the first (admin) user per carrier org for later reference
    if (userData.isAdmin) {
      userMap[userData.orgName] = { id: user.id, email: userData.email };
    }
  }

  // Look up the admin@test.com user for truck approvals
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
  if (!adminUser) {
    console.log('\n   [!] WARNING: admin@test.com not found. Run seed-test-data.ts first.');
    console.log('       Truck approvals will use first demo carrier admin instead.\n');
  }

  // Look up dispatcher@test.com for match proposals
  const dispatcherUser = await prisma.user.findUnique({ where: { email: 'dispatcher@test.com' } });

  console.log('');

  // ============================================================================
  // 3. CORRIDORS (6 corridors with shipper/carrier rates)
  // ============================================================================
  console.log('3. Creating/updating corridors...\n');

  const approverUserId = adminUser?.id ?? userMap['Selam Transport'].id;

  const corridorsData = [
    { name: 'Addis Ababa - Djibouti', origin: 'Addis Ababa', dest: 'Djibouti', distanceKm: 910, shipperRate: 45, carrierRate: 38 },
    { name: 'Addis Ababa - Dire Dawa', origin: 'Addis Ababa', dest: 'Dire Dawa', distanceKm: 453, shipperRate: 40, carrierRate: 34 },
    { name: 'Addis Ababa - Mekelle', origin: 'Addis Ababa', dest: 'Mekelle', distanceKm: 783, shipperRate: 42, carrierRate: 36 },
    { name: 'Dire Dawa - Djibouti', origin: 'Dire Dawa', dest: 'Djibouti', distanceKm: 310, shipperRate: 50, carrierRate: 42 },
    { name: 'Addis Ababa - Hawassa', origin: 'Addis Ababa', dest: 'Hawassa', distanceKm: 275, shipperRate: 38, carrierRate: 32 },
    { name: 'Mekelle - Djibouti', origin: 'Mekelle', dest: 'Djibouti', distanceKm: 890, shipperRate: 48, carrierRate: 40 },
  ];

  for (const c of corridorsData) {
    const existing = await prisma.corridor.findFirst({
      where: {
        originRegion: c.origin,
        destinationRegion: c.dest,
        direction: 'ONE_WAY',
      },
    });

    if (!existing) {
      await prisma.corridor.create({
        data: {
          name: c.name,
          originRegion: c.origin,
          destinationRegion: c.dest,
          distanceKm: c.distanceKm,
          pricePerKm: c.shipperRate,
          shipperPricePerKm: c.shipperRate,
          carrierPricePerKm: c.carrierRate,
          direction: 'ONE_WAY',
          isActive: true,
          createdById: approverUserId,
        },
      });
      counts.corridorsCreated++;
      console.log(`   [+] Created corridor: ${c.name} (${c.distanceKm}km, shipper: ${c.shipperRate}, carrier: ${c.carrierRate} ETB/km)`);
    } else {
      await prisma.corridor.update({
        where: { id: existing.id },
        data: {
          distanceKm: c.distanceKm,
          pricePerKm: c.shipperRate,
          shipperPricePerKm: c.shipperRate,
          carrierPricePerKm: c.carrierRate,
          isActive: true,
        },
      });
      counts.corridorsUpdated++;
      console.log(`   [=] Corridor exists: ${c.name} (updated rates)`);
    }
  }

  console.log('');

  // ============================================================================
  // 4. ETHIOPIAN LOCATIONS (ensure 5 cities exist)
  // ============================================================================
  console.log('4. Ensuring Ethiopian locations exist...\n');

  const locationsData = [
    { name: 'Addis Ababa', region: 'Addis Ababa', latitude: 9.0054, longitude: 38.7636 },
    { name: 'Dire Dawa', region: 'Dire Dawa', latitude: 9.6011, longitude: 41.8505 },
    { name: 'Mekelle', region: 'Tigray', latitude: 13.4967, longitude: 39.4753 },
    { name: 'Djibouti', region: 'Djibouti', latitude: 11.5883, longitude: 43.1450 },
    { name: 'Hawassa', region: 'SNNPR', latitude: 7.0624, longitude: 38.4764 },
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
      counts.locationsCreated++;
      console.log(`   [+] Created location: ${locData.name}`);
    } else {
      counts.locationsExisting++;
      console.log(`   [=] Location exists: ${locData.name}`);
    }
    locationMap[locData.name] = location.id;
  }

  console.log('');

  // ============================================================================
  // 5. TRUCKS (23 new — with DEMO- prefix plates)
  // ============================================================================
  console.log('5. Cleaning up and creating demo trucks...\n');

  // Clean up DEMO-* data for idempotent re-runs
  // Order matters: postings → match proposals → trips → loads → trucks
  await prisma.truckPosting.deleteMany({
    where: { truck: { licensePlate: { startsWith: 'DEMO-' } } },
  });
  await prisma.matchProposal.deleteMany({
    where: { truck: { licensePlate: { startsWith: 'DEMO-' } } },
  });

  // Delete trips for loads that have DEMO trucks assigned
  const demoTrucks = await prisma.truck.findMany({
    where: { licensePlate: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const demoTruckIds = demoTrucks.map(t => t.id);

  if (demoTruckIds.length > 0) {
    // Delete journal lines -> entries for loads with demo trucks
    const demoLoads = await prisma.load.findMany({
      where: { assignedTruckId: { in: demoTruckIds } },
      select: { id: true },
    });
    const demoLoadIds = demoLoads.map(l => l.id);

    if (demoLoadIds.length > 0) {
      const journalEntries = await prisma.journalEntry.findMany({
        where: { loadId: { in: demoLoadIds } },
        select: { id: true },
      });
      if (journalEntries.length > 0) {
        await prisma.journalLine.deleteMany({
          where: { journalEntryId: { in: journalEntries.map(j => j.id) } },
        });
        await prisma.journalEntry.deleteMany({
          where: { id: { in: journalEntries.map(j => j.id) } },
        });
      }

      await prisma.trip.deleteMany({
        where: { loadId: { in: demoLoadIds } },
      });
    }

    // Unassign trucks from loads before deleting trucks
    await prisma.load.updateMany({
      where: { assignedTruckId: { in: demoTruckIds } },
      data: { assignedTruckId: null },
    });
  }

  // Also delete demo loads that we created (identified by shipper orgs + description pattern)
  const demoShipperIds = shipperOrgs.map(o => o.id);
  await prisma.load.deleteMany({
    where: {
      shipperId: { in: demoShipperIds },
      cargoDescription: { startsWith: 'DEMO:' },
    },
  });

  // Now delete demo trucks
  await prisma.truck.deleteMany({
    where: { licensePlate: { startsWith: 'DEMO-' } },
  });
  console.log('   [x] Cleaned up old DEMO-* trucks, postings, loads, trips\n');

  const trucksData = [
    // Selam Transport (8 trucks)
    { plate: 'DEMO-ST-DV1', type: 'DRY_VAN' as const, capacity: 15000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-DV2', type: 'DRY_VAN' as const, capacity: 18000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-DV3', type: 'DRY_VAN' as const, capacity: 20000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-FB1', type: 'FLATBED' as const, capacity: 20000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-FB2', type: 'FLATBED' as const, capacity: 25000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-RF1', type: 'REFRIGERATED' as const, capacity: 10000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-RF2', type: 'REFRIGERATED' as const, capacity: 12000, city: 'Addis Ababa', org: 'Selam Transport' },
    { plate: 'DEMO-ST-CT1', type: 'CONTAINER' as const, capacity: 30000, city: 'Addis Ababa', org: 'Selam Transport' },

    // Abay Logistics (5 trucks)
    { plate: 'DEMO-AL-DV1', type: 'DRY_VAN' as const, capacity: 12000, city: 'Addis Ababa', org: 'Abay Logistics' },
    { plate: 'DEMO-AL-DV2', type: 'DRY_VAN' as const, capacity: 15000, city: 'Addis Ababa', org: 'Abay Logistics' },
    { plate: 'DEMO-AL-FB1', type: 'FLATBED' as const, capacity: 18000, city: 'Addis Ababa', org: 'Abay Logistics' },
    { plate: 'DEMO-AL-FB2', type: 'FLATBED' as const, capacity: 22000, city: 'Addis Ababa', org: 'Abay Logistics' },
    { plate: 'DEMO-AL-RF1', type: 'REFRIGERATED' as const, capacity: 8000, city: 'Addis Ababa', org: 'Abay Logistics' },

    // Eastern Cargo (4 trucks)
    { plate: 'DEMO-EC-DV1', type: 'DRY_VAN' as const, capacity: 15000, city: 'Dire Dawa', org: 'Eastern Cargo' },
    { plate: 'DEMO-EC-DV2', type: 'DRY_VAN' as const, capacity: 18000, city: 'Dire Dawa', org: 'Eastern Cargo' },
    { plate: 'DEMO-EC-FB1', type: 'FLATBED' as const, capacity: 20000, city: 'Dire Dawa', org: 'Eastern Cargo' },
    { plate: 'DEMO-EC-CT1', type: 'CONTAINER' as const, capacity: 25000, city: 'Dire Dawa', org: 'Eastern Cargo' },

    // Northern Express (3 trucks)
    { plate: 'DEMO-NE-DV1', type: 'DRY_VAN' as const, capacity: 15000, city: 'Mekelle', org: 'Northern Express' },
    { plate: 'DEMO-NE-FB1', type: 'FLATBED' as const, capacity: 18000, city: 'Mekelle', org: 'Northern Express' },
    { plate: 'DEMO-NE-RF1', type: 'REFRIGERATED' as const, capacity: 10000, city: 'Mekelle', org: 'Northern Express' },

    // Rift Valley Haulers (3 trucks)
    { plate: 'DEMO-RV-DV1', type: 'DRY_VAN' as const, capacity: 12000, city: 'Hawassa', org: 'Rift Valley Haulers' },
    { plate: 'DEMO-RV-DV2', type: 'DRY_VAN' as const, capacity: 12000, city: 'Addis Ababa', org: 'Rift Valley Haulers' },
    { plate: 'DEMO-RV-DV3', type: 'DRY_VAN' as const, capacity: 12000, city: 'Dire Dawa', org: 'Rift Valley Haulers' },
  ];

  const truckMap: Record<string, string> = {}; // plate -> id
  const truckOrgMap: Record<string, string> = {}; // plate -> orgId

  for (const t of trucksData) {
    const orgId = carrierOrgs.find(o => o.name === t.org)!.id;
    const approvedById = adminUser?.id ?? userMap[t.org].id;

    const truck = await prisma.truck.create({
      data: {
        carrierId: orgId,
        licensePlate: t.plate,
        truckType: t.type,
        capacity: t.capacity,
        lengthM: 12,
        currentCity: t.city,
        isAvailable: true,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: approvedById,
        contactName: `Driver ${t.plate}`,
        contactPhone: '+251955500000',
      },
    });
    truckMap[t.plate] = truck.id;
    truckOrgMap[t.plate] = orgId;
    counts.trucksCreated++;
    console.log(`   [+] Created truck: ${t.plate} (${t.type}, ${t.capacity / 1000}T, ${t.city})`);
  }

  console.log('');

  // ============================================================================
  // 6. LOADS (20 total: 8 posted + 4 assigned + 8 completed)
  // ============================================================================
  console.log('6. Creating demo loads...\n');

  // Helper to get org ID by name
  const getShipperOrgId = (name: string) => shipperOrgs.find(o => o.name === name)!.id;
  const getCarrierOrgId = (name: string) => carrierOrgs.find(o => o.name === name)!.id;
  const getShipperUserId = (orgName: string) => userMap[orgName].id;

  // --- 6a. 8 POSTED loads (no truck assigned) ---
  console.log('   --- POSTED Loads ---');

  const postedLoadsData = [
    { shipper: 'Ethio Agri Export', pickup: 'Addis Ababa', delivery: 'Djibouti', type: 'DRY_VAN' as const, weight: 14000, desc: 'DEMO: Coffee beans for export - Grade 1 Yirgacheffe', pickupDays: 3, deliveryDays: 6 },
    { shipper: 'Ethio Agri Export', pickup: 'Addis Ababa', delivery: 'Dire Dawa', type: 'FLATBED' as const, weight: 18000, desc: 'DEMO: Agricultural machinery and equipment', pickupDays: 2, deliveryDays: 4 },
    { shipper: 'Merkato Trading PLC', pickup: 'Addis Ababa', delivery: 'Mekelle', type: 'DRY_VAN' as const, weight: 12000, desc: 'DEMO: Consumer electronics and household goods', pickupDays: 4, deliveryDays: 7 },
    { shipper: 'Merkato Trading PLC', pickup: 'Addis Ababa', delivery: 'Hawassa', type: 'REFRIGERATED' as const, weight: 8000, desc: 'DEMO: Frozen food products for retail chains', pickupDays: 1, deliveryDays: 2 },
    { shipper: 'Dire Industries', pickup: 'Dire Dawa', delivery: 'Djibouti', type: 'CONTAINER' as const, weight: 22000, desc: 'DEMO: Containerized industrial equipment for export', pickupDays: 5, deliveryDays: 7 },
    { shipper: 'Dire Industries', pickup: 'Dire Dawa', delivery: 'Addis Ababa', type: 'FLATBED' as const, weight: 16000, desc: 'DEMO: Steel construction materials', pickupDays: 3, deliveryDays: 5 },
    { shipper: 'Mekelle Textiles', pickup: 'Mekelle', delivery: 'Addis Ababa', type: 'DRY_VAN' as const, weight: 10000, desc: 'DEMO: Textile goods and garments for domestic market', pickupDays: 2, deliveryDays: 5 },
    { shipper: 'Hawassa Foods', pickup: 'Hawassa', delivery: 'Addis Ababa', type: 'REFRIGERATED' as const, weight: 6000, desc: 'DEMO: Fresh produce and dairy from SNNPR region', pickupDays: 1, deliveryDays: 2 },
  ];

  const postedLoadIds: string[] = [];

  for (const ld of postedLoadsData) {
    const load = await prisma.load.create({
      data: {
        shipperId: getShipperOrgId(ld.shipper),
        createdById: getShipperUserId(ld.shipper),
        pickupCity: ld.pickup,
        deliveryCity: ld.delivery,
        truckType: ld.type,
        weight: ld.weight,
        cargoDescription: ld.desc,
        pickupDate: daysFromNow(ld.pickupDays),
        deliveryDate: daysFromNow(ld.deliveryDays),
        status: 'POSTED',
        postedAt: new Date(),
        bookMode: 'REQUEST',
        fullPartial: 'FULL',
      },
    });
    postedLoadIds.push(load.id);
    counts.loadsCreated++;
    console.log(`   [+] POSTED: ${ld.pickup} -> ${ld.delivery} (${ld.type}, ${ld.weight / 1000}T) [${ld.shipper}]`);
  }

  // --- 6b. 4 ASSIGNED loads (with trucks + trips) ---
  console.log('\n   --- ASSIGNED Loads (with trips) ---');

  const assignedLoadsData = [
    {
      shipper: 'Ethio Agri Export', carrier: 'Selam Transport', truck: 'DEMO-ST-DV1',
      pickup: 'Addis Ababa', delivery: 'Djibouti', type: 'DRY_VAN' as const, weight: 15000,
      desc: 'DEMO: Sesame seeds export shipment', tripStatus: 'PICKUP_PENDING' as const,
      pickupDays: 1, deliveryDays: 4,
    },
    {
      shipper: 'Merkato Trading PLC', carrier: 'Eastern Cargo', truck: 'DEMO-EC-DV1',
      pickup: 'Addis Ababa', delivery: 'Dire Dawa', type: 'DRY_VAN' as const, weight: 14000,
      desc: 'DEMO: Retail merchandise for Dire Dawa stores', tripStatus: 'IN_TRANSIT' as const,
      pickupDays: -1, deliveryDays: 1,
    },
    {
      shipper: 'Dire Industries', carrier: 'Abay Logistics', truck: 'DEMO-AL-FB1',
      pickup: 'Dire Dawa', delivery: 'Addis Ababa', type: 'FLATBED' as const, weight: 18000,
      desc: 'DEMO: Industrial raw materials shipment', tripStatus: 'IN_TRANSIT' as const,
      pickupDays: -2, deliveryDays: 1,
    },
    {
      shipper: 'Mekelle Textiles', carrier: 'Northern Express', truck: 'DEMO-NE-DV1',
      pickup: 'Mekelle', delivery: 'Addis Ababa', type: 'DRY_VAN' as const, weight: 12000,
      desc: 'DEMO: Finished textile products for Merkato market', tripStatus: 'DELIVERED' as const,
      pickupDays: -5, deliveryDays: -1,
    },
  ];

  const assignedTruckPlates: string[] = [];

  for (const ld of assignedLoadsData) {
    const truckId = truckMap[ld.truck];
    const carrierId = getCarrierOrgId(ld.carrier);
    const shipperId = getShipperOrgId(ld.shipper);

    const load = await prisma.load.create({
      data: {
        shipperId: shipperId,
        createdById: getShipperUserId(ld.shipper),
        pickupCity: ld.pickup,
        deliveryCity: ld.delivery,
        truckType: ld.type,
        weight: ld.weight,
        cargoDescription: ld.desc,
        pickupDate: daysFromNow(ld.pickupDays),
        deliveryDate: daysFromNow(ld.deliveryDays),
        status: 'ASSIGNED',
        postedAt: daysAgo(3),
        assignedTruckId: truckId,
        assignedAt: daysAgo(1),
        bookMode: 'REQUEST',
        fullPartial: 'FULL',
        trackingUrl: `demo-track-${ld.truck.toLowerCase()}`,
        trackingEnabled: true,
      },
    });

    // Create trip
    const tripData: any = {
      loadId: load.id,
      truckId: truckId,
      carrierId: carrierId,
      shipperId: shipperId,
      status: ld.tripStatus,
      pickupCity: ld.pickup,
      deliveryCity: ld.delivery,
      trackingUrl: `demo-trip-${ld.truck.toLowerCase()}`,
      trackingEnabled: true,
      estimatedDistanceKm: ld.pickup === 'Addis Ababa' && ld.delivery === 'Djibouti' ? 910 : 453,
    };

    // Set timestamps based on trip status
    if (ld.tripStatus === 'PICKUP_PENDING' || ld.tripStatus === 'IN_TRANSIT' || ld.tripStatus === 'DELIVERED') {
      tripData.startedAt = daysAgo(1);
    }
    if (ld.tripStatus === 'IN_TRANSIT' || ld.tripStatus === 'DELIVERED') {
      tripData.pickedUpAt = daysAgo(1);
    }
    if (ld.tripStatus === 'DELIVERED') {
      tripData.deliveredAt = new Date();
    }

    await prisma.trip.create({ data: tripData });

    // Mark truck as unavailable
    await prisma.truck.update({
      where: { id: truckId },
      data: { isAvailable: false },
    });

    assignedTruckPlates.push(ld.truck);
    counts.loadsCreated++;
    counts.tripsCreated++;
    console.log(`   [+] ASSIGNED: ${ld.pickup} -> ${ld.delivery} (${ld.truck}, trip: ${ld.tripStatus})`);
  }

  // --- 6c. 8 COMPLETED loads (historical, past 30 days) ---
  console.log('\n   --- COMPLETED Loads (historical) ---');

  const completedLoadsData = [
    { shipper: 'Ethio Agri Export', carrier: 'Selam Transport', truck: 'DEMO-ST-DV2', pickup: 'Addis Ababa', delivery: 'Djibouti', type: 'DRY_VAN' as const, weight: 18000, desc: 'DEMO: Coffee export lot AA-2024-001', daysAgoCompleted: 3 },
    { shipper: 'Ethio Agri Export', carrier: 'Selam Transport', truck: 'DEMO-ST-CT1', pickup: 'Addis Ababa', delivery: 'Djibouti', type: 'CONTAINER' as const, weight: 28000, desc: 'DEMO: Containerized flower export shipment', daysAgoCompleted: 7 },
    { shipper: 'Merkato Trading PLC', carrier: 'Abay Logistics', truck: 'DEMO-AL-DV1', pickup: 'Addis Ababa', delivery: 'Dire Dawa', type: 'DRY_VAN' as const, weight: 11000, desc: 'DEMO: Consumer goods for Eastern markets', daysAgoCompleted: 5 },
    { shipper: 'Merkato Trading PLC', carrier: 'Selam Transport', truck: 'DEMO-ST-RF1', pickup: 'Addis Ababa', delivery: 'Mekelle', type: 'REFRIGERATED' as const, weight: 9000, desc: 'DEMO: Refrigerated pharmaceutical products', daysAgoCompleted: 10 },
    { shipper: 'Dire Industries', carrier: 'Eastern Cargo', truck: 'DEMO-EC-FB1', pickup: 'Dire Dawa', delivery: 'Djibouti', type: 'FLATBED' as const, weight: 19000, desc: 'DEMO: Heavy machinery for port delivery', daysAgoCompleted: 14 },
    { shipper: 'Mekelle Textiles', carrier: 'Northern Express', truck: 'DEMO-NE-FB1', pickup: 'Mekelle', delivery: 'Addis Ababa', type: 'FLATBED' as const, weight: 16000, desc: 'DEMO: Textile raw materials and fabrics', daysAgoCompleted: 18 },
    { shipper: 'Hawassa Foods', carrier: 'Rift Valley Haulers', truck: 'DEMO-RV-DV1', pickup: 'Hawassa', delivery: 'Addis Ababa', type: 'DRY_VAN' as const, weight: 10000, desc: 'DEMO: Processed food products', daysAgoCompleted: 22 },
    { shipper: 'Hawassa Foods', carrier: 'Abay Logistics', truck: 'DEMO-AL-DV2', pickup: 'Addis Ababa', delivery: 'Hawassa', type: 'DRY_VAN' as const, weight: 14000, desc: 'DEMO: Packaging materials for food industry', daysAgoCompleted: 25 },
  ];

  for (const ld of completedLoadsData) {
    const truckId = truckMap[ld.truck];
    const carrierId = getCarrierOrgId(ld.carrier);
    const shipperId = getShipperOrgId(ld.shipper);

    const load = await prisma.load.create({
      data: {
        shipperId: shipperId,
        createdById: getShipperUserId(ld.shipper),
        pickupCity: ld.pickup,
        deliveryCity: ld.delivery,
        truckType: ld.type,
        weight: ld.weight,
        cargoDescription: ld.desc,
        pickupDate: daysAgo(ld.daysAgoCompleted + 5),
        deliveryDate: daysAgo(ld.daysAgoCompleted + 1),
        status: 'COMPLETED',
        postedAt: daysAgo(ld.daysAgoCompleted + 7),
        assignedTruckId: truckId,
        assignedAt: daysAgo(ld.daysAgoCompleted + 5),
        bookMode: 'REQUEST',
        fullPartial: 'FULL',
        podSubmitted: true,
        podSubmittedAt: daysAgo(ld.daysAgoCompleted),
        podVerified: true,
        podVerifiedAt: daysAgo(ld.daysAgoCompleted),
        settlementStatus: 'PAID',
        settledAt: daysAgo(ld.daysAgoCompleted),
        trackingUrl: `demo-completed-${ld.truck.toLowerCase()}-${ld.daysAgoCompleted}`,
      },
    });

    // Create completed trip
    await prisma.trip.create({
      data: {
        loadId: load.id,
        truckId: truckId,
        carrierId: carrierId,
        shipperId: shipperId,
        status: 'COMPLETED',
        pickupCity: ld.pickup,
        deliveryCity: ld.delivery,
        trackingUrl: `demo-trip-completed-${ld.truck.toLowerCase()}-${ld.daysAgoCompleted}`,
        startedAt: daysAgo(ld.daysAgoCompleted + 4),
        pickedUpAt: daysAgo(ld.daysAgoCompleted + 4),
        deliveredAt: daysAgo(ld.daysAgoCompleted + 1),
        completedAt: daysAgo(ld.daysAgoCompleted),
        shipperConfirmed: true,
        shipperConfirmedAt: daysAgo(ld.daysAgoCompleted),
      },
    });

    counts.loadsCreated++;
    counts.tripsCreated++;
    console.log(`   [+] COMPLETED: ${ld.pickup} -> ${ld.delivery} (${ld.truck}, ${ld.daysAgoCompleted}d ago)`);
  }

  console.log('');

  // ============================================================================
  // 7. FINANCIAL ACCOUNTS (wallets for 10 orgs + platform revenue)
  // ============================================================================
  console.log('7. Creating financial accounts...\n');

  const shipperBalances = [500000, 350000, 200000, 150000, 100000];
  const carrierBalances = [100000, 80000, 60000, 40000, 20000];

  for (let i = 0; i < shipperOrgs.length; i++) {
    const org = shipperOrgs[i];
    let wallet = await prisma.financialAccount.findFirst({
      where: { organizationId: org.id, accountType: 'SHIPPER_WALLET' },
    });

    if (!wallet) {
      wallet = await prisma.financialAccount.create({
        data: {
          organizationId: org.id,
          accountType: 'SHIPPER_WALLET',
          balance: shipperBalances[i],
          currency: 'ETB',
          isActive: true,
        },
      });
      counts.walletsCreated++;
      console.log(`   [+] Created shipper wallet: ${org.name} (${shipperBalances[i].toLocaleString()} ETB)`);
    } else {
      await prisma.financialAccount.update({
        where: { id: wallet.id },
        data: { balance: shipperBalances[i], isActive: true },
      });
      counts.walletsUpdated++;
      console.log(`   [=] Shipper wallet exists: ${org.name} (updated to ${shipperBalances[i].toLocaleString()} ETB)`);
    }
  }

  for (let i = 0; i < carrierOrgs.length; i++) {
    const org = carrierOrgs[i];
    let wallet = await prisma.financialAccount.findFirst({
      where: { organizationId: org.id, accountType: 'CARRIER_WALLET' },
    });

    if (!wallet) {
      wallet = await prisma.financialAccount.create({
        data: {
          organizationId: org.id,
          accountType: 'CARRIER_WALLET',
          balance: carrierBalances[i],
          currency: 'ETB',
          isActive: true,
        },
      });
      counts.walletsCreated++;
      console.log(`   [+] Created carrier wallet: ${org.name} (${carrierBalances[i].toLocaleString()} ETB)`);
    } else {
      await prisma.financialAccount.update({
        where: { id: wallet.id },
        data: { balance: carrierBalances[i], isActive: true },
      });
      counts.walletsUpdated++;
      console.log(`   [=] Carrier wallet exists: ${org.name} (updated to ${carrierBalances[i].toLocaleString()} ETB)`);
    }
  }

  // Platform revenue account
  let platformAccount = await prisma.financialAccount.findFirst({
    where: { accountType: 'PLATFORM_REVENUE', organizationId: null },
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
    counts.walletsCreated++;
    console.log('   [+] Created platform revenue account');
  } else {
    console.log('   [=] Platform revenue account exists');
  }

  // --- Create journal entries for completed loads ---
  console.log('\n   Creating journal entries for completed loads...');

  const completedLoads = await prisma.load.findMany({
    where: {
      status: 'COMPLETED',
      cargoDescription: { startsWith: 'DEMO:' },
    },
    include: { shipper: true },
  });

  for (const load of completedLoads) {
    // Check if journal entry already exists
    const existingEntry = await prisma.journalEntry.findFirst({
      where: { loadId: load.id },
    });
    if (existingEntry) continue;

    const shipperWallet = await prisma.financialAccount.findFirst({
      where: { organizationId: load.shipperId, accountType: 'SHIPPER_WALLET' },
    });

    if (shipperWallet && platformAccount) {
      // Service fee amount (approximate: distance * shipper rate per km * 0.1 for demo)
      const feeAmount = 5000 + Math.floor(Math.random() * 10000);

      await prisma.journalEntry.create({
        data: {
          transactionType: 'SERVICE_FEE_DEDUCT',
          description: `Service fee for load ${load.id.substring(0, 8)} (${load.pickupCity} -> ${load.deliveryCity})`,
          reference: load.id,
          loadId: load.id,
          lines: {
            create: [
              {
                amount: feeAmount,
                isDebit: true,
                accountId: shipperWallet.id,
              },
              {
                amount: feeAmount,
                isDebit: false,
                accountId: platformAccount.id,
              },
            ],
          },
        },
      });
      counts.journalEntriesCreated++;
    }
  }
  console.log(`   [+] Created ${counts.journalEntriesCreated} journal entries`);

  console.log('');

  // ============================================================================
  // 8. TRUCK POSTINGS (15 active — for trucks NOT on active trips)
  // ============================================================================
  console.log('8. Creating truck postings...\n');

  // Get all demo trucks that are NOT assigned to active trips
  const availableTrucks = trucksData.filter(t => !assignedTruckPlates.includes(t.plate));

  // Take 15 for postings
  const postingTrucks = availableTrucks.slice(0, 15);

  for (const t of postingTrucks) {
    const truckId = truckMap[t.plate];
    const orgId = carrierOrgs.find(o => o.name === t.org)!.id;
    const userId = userMap[t.org].id;
    const originCityId = locationMap[t.city];

    if (!originCityId) {
      console.log(`   [!] No location found for ${t.city}, skipping ${t.plate}`);
      continue;
    }

    await prisma.truckPosting.create({
      data: {
        truckId: truckId,
        carrierId: orgId,
        createdById: userId,
        originCityId: originCityId,
        availableFrom: new Date(),
        availableTo: daysFromNow(7),
        status: 'ACTIVE',
        contactName: `Driver ${t.plate}`,
        contactPhone: '+251955500000',
        fullPartial: 'FULL',
        availableWeight: t.capacity,
        availableLength: 12,
      },
    });
    counts.postingsCreated++;
    console.log(`   [+] Created posting: ${t.plate} (${t.type}) in ${t.city}`);
  }

  console.log('');

  // ============================================================================
  // 9. MATCH PROPOSALS (5 pending)
  // ============================================================================
  console.log('9. Creating match proposals...\n');

  // Use dispatcher@test.com if available, otherwise first carrier admin
  const proposerId = dispatcherUser?.id ?? userMap['Selam Transport'].id;

  // Match some posted loads to available trucks
  const proposalPairs = [
    { loadIdx: 0, truck: 'DEMO-ST-DV3', carrier: 'Selam Transport' },   // Coffee to Djibouti -> Selam DRY_VAN
    { loadIdx: 1, truck: 'DEMO-ST-FB1', carrier: 'Selam Transport' },   // Agri machinery -> Selam FLATBED
    { loadIdx: 2, truck: 'DEMO-AL-DV2', carrier: 'Abay Logistics' },    // Electronics to Mekelle -> Abay DRY_VAN
    { loadIdx: 4, truck: 'DEMO-EC-CT1', carrier: 'Eastern Cargo' },     // Container to Djibouti -> Eastern CONTAINER
    { loadIdx: 6, truck: 'DEMO-NE-FB1', carrier: 'Northern Express' },  // Textiles from Mekelle -> Northern FLATBED
  ];

  for (const pp of proposalPairs) {
    if (!postedLoadIds[pp.loadIdx]) continue;

    const carrierId = getCarrierOrgId(pp.carrier);
    const truckId = truckMap[pp.truck];

    await prisma.matchProposal.create({
      data: {
        loadId: postedLoadIds[pp.loadIdx],
        truckId: truckId,
        carrierId: carrierId,
        proposedById: proposerId,
        status: 'PENDING',
        notes: `Recommended match based on route and truck type compatibility`,
        expiresAt: daysFromNow(2), // 48 hours
      },
    });
    counts.proposalsCreated++;
    console.log(`   [+] Proposal: Load #${pp.loadIdx + 1} -> ${pp.truck} (${pp.carrier})`);
  }

  console.log('');

  // ============================================================================
  // 10. NOTIFICATIONS (20 recent)
  // ============================================================================
  console.log('10. Creating notifications...\n');

  // Collect all demo user IDs
  const allDemoUserIds: string[] = [];
  for (const key of Object.keys(userMap)) {
    allDemoUserIds.push(userMap[key].id);
  }

  const notificationTypes = [
    { type: 'LOAD_REQUEST', title: 'New Load Request', message: 'A new load has been posted matching your truck availability on the Addis Ababa - Djibouti corridor.' },
    { type: 'MATCH_PROPOSAL', title: 'Match Proposal Received', message: 'A dispatcher has proposed a match for your truck. Review and approve to accept the assignment.' },
    { type: 'POD_SUBMITTED', title: 'POD Submitted', message: 'Proof of delivery has been submitted for your shipment. Please review and confirm delivery.' },
    { type: 'SETTLEMENT_COMPLETE', title: 'Settlement Completed', message: 'Your service fee settlement has been processed. Check your wallet for updated balance.' },
    { type: 'GPS_OFFLINE', title: 'GPS Signal Lost', message: 'GPS signal lost for truck DEMO-ST-DV1. Last known location: Addis Ababa, 2 hours ago.' },
    { type: 'LOAD_REQUEST', title: 'Load Expiring Soon', message: 'Your posted load from Dire Dawa to Djibouti will expire in 24 hours. Consider extending.' },
    { type: 'MATCH_PROPOSAL', title: 'Proposal Expiring', message: 'A match proposal for your truck is expiring in 6 hours. Please respond.' },
    { type: 'POD_SUBMITTED', title: 'POD Verified', message: 'Proof of delivery for load from Mekelle to Addis Ababa has been verified by the shipper.' },
    { type: 'SETTLEMENT_COMPLETE', title: 'Wallet Topped Up', message: 'Your shipper wallet has been credited with 50,000 ETB. New balance available.' },
    { type: 'GPS_OFFLINE', title: 'Truck Back Online', message: 'GPS signal restored for truck DEMO-EC-DV2. Current location: Dire Dawa highway.' },
    { type: 'LOAD_REQUEST', title: 'Load Assigned', message: 'Your load from Addis Ababa to Djibouti has been assigned to Selam Transport.' },
    { type: 'MATCH_PROPOSAL', title: 'Proposal Accepted', message: 'Carrier has accepted your match proposal. Trip is now being tracked.' },
    { type: 'POD_SUBMITTED', title: 'Delivery Confirmation Needed', message: 'The carrier has marked delivery as complete. Please confirm receipt of goods.' },
    { type: 'SETTLEMENT_COMPLETE', title: 'Invoice Generated', message: 'Service fee invoice generated for completed trips this week. Total: 15,450 ETB.' },
    { type: 'GPS_OFFLINE', title: 'Route Deviation Alert', message: 'Truck DEMO-AL-FB1 has deviated from the expected route. Current heading suggests alternate path.' },
    { type: 'LOAD_REQUEST', title: 'New Truck Available', message: 'A new refrigerated truck is available in Addis Ababa matching your cargo requirements.' },
    { type: 'MATCH_PROPOSAL', title: 'Auto-Match Found', message: 'System found an excellent match (92% score) for your posted load. Review the proposal.' },
    { type: 'POD_SUBMITTED', title: 'Document Upload Required', message: 'Please upload proof of delivery photos for your completed trip to Djibouti.' },
    { type: 'SETTLEMENT_COMPLETE', title: 'Payment Received', message: 'Settlement payment of 38,500 ETB has been credited to your carrier wallet.' },
    { type: 'GPS_OFFLINE', title: 'Geofence Entry', message: 'Truck DEMO-ST-DV2 has entered the Djibouti port area. Delivery imminent.' },
  ];

  for (let i = 0; i < notificationTypes.length; i++) {
    const notif = notificationTypes[i];
    const userId = allDemoUserIds[i % allDemoUserIds.length];

    await prisma.notification.create({
      data: {
        userId: userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        read: i < 5 ? false : Math.random() > 0.5, // First 5 unread, rest random
        createdAt: daysAgo(Math.floor(Math.random() * 7)), // Within last week
      },
    });
    counts.notificationsCreated++;
  }
  console.log(`   [+] Created ${counts.notificationsCreated} notifications across demo users`);

  console.log('');

  // ============================================================================
  // 11. DOCUMENTS (Company & Truck Documents for Verification Queue)
  // ============================================================================
  console.log('11. Creating verification documents...\n');

  // Track document counts
  let companyDocsCreated = 0;
  let truckDocsCreated = 0;

  // Company Document Types (from CompanyDocumentType enum)
  const companyDocTypes = [
    'COMPANY_LICENSE',
    'TIN_CERTIFICATE',
    'BUSINESS_REGISTRATION',
    'TRADE_LICENSE',
  ] as const;

  // Truck Document Types (from TruckDocumentType enum)
  const truckDocTypes = [
    'TITLE_DEED',
    'REGISTRATION',
    'INSURANCE',
    'ROAD_WORTHINESS',
  ] as const;

  // Sample PDF URLs for demo documents (publicly accessible)
  const samplePdfUrls = [
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    'https://www.africau.edu/images/default/sample.pdf',
    'https://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf',
    'https://www.orimi.com/pdf-test.pdf',
  ];

  // Create company documents for each org (2 per org, varied statuses)
  const allOrgs = [...shipperOrgs, ...carrierOrgs];
  const statuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

  for (let i = 0; i < allOrgs.length; i++) {
    const org = allOrgs[i];
    const userId = Object.values(userMap).find(u => u.id)?.id || allDemoUserIds[0];

    // Create 2 documents per org
    for (let j = 0; j < 2; j++) {
      const docType = companyDocTypes[(i + j) % companyDocTypes.length];
      const status = statuses[(i + j) % statuses.length];

      // Check if document already exists
      const existing = await prisma.companyDocument.findFirst({
        where: {
          organizationId: org.id,
          type: docType,
        },
      });

      if (!existing) {
        await prisma.companyDocument.create({
          data: {
            organizationId: org.id,
            type: docType,
            fileName: `${org.name.toLowerCase().replace(/\s+/g, '-')}-${docType.toLowerCase()}.pdf`,
            fileUrl: samplePdfUrls[(i + j) % samplePdfUrls.length],
            fileSize: 50000 + Math.floor(Math.random() * 100000),
            mimeType: 'application/pdf',
            verificationStatus: status,
            uploadedById: userId,
            uploadedAt: daysAgo(10 + i),
            verifiedById: status !== 'PENDING' ? (adminUser?.id || userId) : null,
            verifiedAt: status !== 'PENDING' ? daysAgo(5 + i) : null,
            rejectionReason: status === 'REJECTED' ? 'Document expired or illegible. Please upload a valid copy.' : null,
            expiresAt: daysFromNow(365),
          },
        });
        companyDocsCreated++;
        console.log(`   [+] Company doc: ${org.name} - ${docType} (${status})`);
      }
    }
  }

  // Create truck documents for demo trucks (2 per truck, varied statuses)
  const demoTruckList = Object.keys(truckMap);

  for (let i = 0; i < Math.min(demoTruckList.length, 10); i++) {
    const plate = demoTruckList[i];
    const truckId = truckMap[plate];
    const orgId = truckOrgMap[plate];
    const userId = Object.values(userMap).find(u => u.id)?.id || allDemoUserIds[0];

    // Create 2 documents per truck
    for (let j = 0; j < 2; j++) {
      const docType = truckDocTypes[(i + j) % truckDocTypes.length];
      const status = statuses[(i + j) % statuses.length];

      // Check if document already exists
      const existing = await prisma.truckDocument.findFirst({
        where: {
          truckId: truckId,
          type: docType,
        },
      });

      if (!existing) {
        await prisma.truckDocument.create({
          data: {
            truckId: truckId,
            type: docType,
            fileName: `${plate.toLowerCase()}-${docType.toLowerCase()}.pdf`,
            fileUrl: samplePdfUrls[(i + j) % samplePdfUrls.length],
            fileSize: 30000 + Math.floor(Math.random() * 80000),
            mimeType: 'application/pdf',
            verificationStatus: status,
            uploadedById: userId,
            uploadedAt: daysAgo(8 + i),
            verifiedById: status !== 'PENDING' ? (adminUser?.id || userId) : null,
            verifiedAt: status !== 'PENDING' ? daysAgo(3 + i) : null,
            rejectionReason: status === 'REJECTED' ? 'Document does not match vehicle registration. Please re-upload.' : null,
            expiresAt: daysFromNow(180),
          },
        });
        truckDocsCreated++;
        console.log(`   [+] Truck doc: ${plate} - ${docType} (${status})`);
      }
    }
  }

  console.log(`\n   Created ${companyDocsCreated} company docs, ${truckDocsCreated} truck docs`);

  console.log('');

  // ============================================================================
  // 12. SUMMARY
  // ============================================================================
  console.log('========================================');
  console.log('  DEMO SEED COMPLETED SUCCESSFULLY');
  console.log('========================================\n');

  console.log('Entity Counts:');
  console.log(`  Organizations:   ${counts.orgsCreated} created, ${counts.orgsUpdated} updated`);
  console.log(`  Users:           ${counts.usersCreated} created, ${counts.usersUpdated} updated`);
  console.log(`  Corridors:       ${counts.corridorsCreated} created, ${counts.corridorsUpdated} updated`);
  console.log(`  Locations:       ${counts.locationsCreated} created, ${counts.locationsExisting} existing`);
  console.log(`  Trucks:          ${counts.trucksCreated} created`);
  console.log(`  Loads:           ${counts.loadsCreated} created`);
  console.log(`  Trips:           ${counts.tripsCreated} created`);
  console.log(`  Journal Entries: ${counts.journalEntriesCreated} created`);
  console.log(`  Wallets:         ${counts.walletsCreated} created, ${counts.walletsUpdated} updated`);
  console.log(`  Truck Postings:  ${counts.postingsCreated} created`);
  console.log(`  Match Proposals: ${counts.proposalsCreated} created`);
  console.log(`  Notifications:   ${counts.notificationsCreated} created`);
  console.log(`  Documents:       ${companyDocsCreated} company, ${truckDocsCreated} truck`);
  console.log('');

  console.log('Demo Shipper Users (password: password):');
  console.log('  - agri-shipper@demo.com      (Ethio Agri Export)');
  console.log('  - merkato-shipper@demo.com   (Merkato Trading PLC)');
  console.log('  - dire-shipper@demo.com      (Dire Industries)');
  console.log('  - mekelle-shipper@demo.com   (Mekelle Textiles)');
  console.log('  - hawassa-shipper@demo.com   (Hawassa Foods)');
  console.log('');

  console.log('Demo Carrier Users (password: password):');
  console.log('  - selam-admin@demo.com       (Selam Transport - admin)');
  console.log('  - selam-driver@demo.com      (Selam Transport - driver)');
  console.log('  - abay-admin@demo.com        (Abay Logistics - admin)');
  console.log('  - abay-driver@demo.com       (Abay Logistics - driver)');
  console.log('  - eastern-admin@demo.com     (Eastern Cargo - admin)');
  console.log('  - eastern-driver@demo.com    (Eastern Cargo - driver)');
  console.log('  - northern-admin@demo.com    (Northern Express - admin)');
  console.log('  - northern-driver@demo.com   (Northern Express - driver)');
  console.log('  - riftvalley-admin@demo.com  (Rift Valley Haulers - admin)');
  console.log('  - riftvalley-driver@demo.com (Rift Valley Haulers - driver)');
  console.log('');

  console.log('Demo Trucks: 23 total (DEMO-* prefix)');
  console.log('  Selam Transport:     8 (DV x3, FB x2, RF x2, CT x1)');
  console.log('  Abay Logistics:      5 (DV x2, FB x2, RF x1)');
  console.log('  Eastern Cargo:       4 (DV x2, FB x1, CT x1)');
  console.log('  Northern Express:    3 (DV x1, FB x1, RF x1)');
  console.log('  Rift Valley Haulers: 3 (DV x3)');
  console.log('');

  console.log('Demo Loads: 20 total');
  console.log('  POSTED:    8 (various routes, future dates)');
  console.log('  ASSIGNED:  4 (with active trips)');
  console.log('  COMPLETED: 8 (historical, past 30 days, with journal entries)');
  console.log('');

  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
