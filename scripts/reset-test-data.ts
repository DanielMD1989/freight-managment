/**
 * Reset Test Data Script
 *
 * Deletes all test loads, truck postings, and related requests
 * Then creates varied test data for carriers and shippers
 */

import { PrismaClient, TruckType, LoadStatus, PostingStatus, VerificationStatus, RequestStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://danieldamitew@localhost:5432/freight_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting test data reset...\n');

  // Step 1: Delete existing data in correct order (respecting foreign keys)
  console.log('Deleting existing test data...');

  try {
    // Delete requests first (they reference loads/trucks)
    const deletedLoadRequests = await prisma.loadRequest.deleteMany({});
    console.log(`  - Deleted ${deletedLoadRequests.count} load requests`);
  } catch (e: any) {
    console.log(`  - LoadRequest table doesn't exist or is empty`);
  }

  try {
    const deletedTruckRequests = await prisma.truckRequest.deleteMany({});
    console.log(`  - Deleted ${deletedTruckRequests.count} truck requests`);
  } catch (e: any) {
    console.log(`  - TruckRequest table doesn't exist or is empty`);
  }

  try {
    const deletedMatchProposals = await prisma.matchProposal.deleteMany({});
    console.log(`  - Deleted ${deletedMatchProposals.count} match proposals`);
  } catch (e: any) {
    console.log(`  - MatchProposal table doesn't exist or is empty`);
  }

  try {
    // Delete truck postings
    const deletedPostings = await prisma.truckPosting.deleteMany({});
    console.log(`  - Deleted ${deletedPostings.count} truck postings`);
  } catch (e: any) {
    console.log(`  - TruckPosting table error: ${e.message}`);
  }

  try {
    // Delete load events first (they reference loads)
    const deletedLoadEvents = await prisma.loadEvent.deleteMany({});
    console.log(`  - Deleted ${deletedLoadEvents.count} load events`);
  } catch (e: any) {
    console.log(`  - LoadEvent table error: ${e.message}`);
  }

  try {
    // Delete loads (need to unassign trucks first)
    await prisma.load.updateMany({
      data: { assignedTruckId: null }
    });
    const deletedLoads = await prisma.load.deleteMany({});
    console.log(`  - Deleted ${deletedLoads.count} loads`);
  } catch (e: any) {
    console.log(`  - Load table error: ${e.message}`);
  }

  console.log('\nTest data deleted successfully!\n');

  // Step 2: Get existing users and organizations
  const shippers = await prisma.organization.findMany({
    where: { type: 'SHIPPER' },
    include: { users: true },
    take: 4,
  });

  const carriers = await prisma.organization.findMany({
    where: { type: { in: ['CARRIER_COMPANY', 'CARRIER_INDIVIDUAL', 'FLEET_OWNER'] } },
    include: { users: true, trucks: true },
    take: 4,
  });

  console.log(`Found ${shippers.length} shipper organizations`);
  console.log(`Found ${carriers.length} carrier organizations\n`);

  if (shippers.length === 0 || carriers.length === 0) {
    console.log('ERROR: No shippers or carriers found. Please run seed script first.');
    return;
  }

  // Get Ethiopian locations
  const locations = await prisma.ethiopianLocation.findMany({ take: 10 });
  if (locations.length < 2) {
    console.log('ERROR: Not enough locations found. Please seed locations first.');
    return;
  }

  console.log(`Found ${locations.length} Ethiopian locations\n`);

  // Step 3: Create varied truck postings for carriers
  console.log('Creating truck postings for carriers...');

  const truckTypes: TruckType[] = ['FLATBED', 'REFRIGERATED', 'CONTAINER', 'DRY_VAN', 'TANKER'];
  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  // Carrier 1: 3 trucks with postings
  if (carriers[0]) {
    const carrier = carriers[0];
    const user = carrier.users[0];
    console.log(`  Creating 3 truck postings for ${carrier.name}...`);

    for (let i = 0; i < 3; i++) {
      // First check if truck exists
      let truck = carrier.trucks[i];
      if (!truck) {
        // Create new truck
        truck = await prisma.truck.create({
          data: {
            carrierId: carrier.id,
            licensePlate: `AA-${carrier.id.slice(-4)}-T${i + 1}`,
            truckType: truckTypes[i % truckTypes.length],
            capacity: 20000 + i * 5000,
            isAvailable: true,
            approvalStatus: 'APPROVED',
            contactName: user?.firstName || 'Driver',
            contactPhone: carrier.contactPhone || '0911111111',
          },
        });
      } else {
        // Ensure truck is approved
        await prisma.truck.update({
          where: { id: truck.id },
          data: { approvalStatus: 'APPROVED' },
        });
      }

      // Create posting for truck
      const originCity = locations[i % locations.length];
      const destCity = locations[(i + 1) % locations.length];

      await prisma.truckPosting.create({
        data: {
          truckId: truck.id,
          carrierId: carrier.id,
          createdById: user?.id || carrier.users[0]?.id || '',
          status: 'ACTIVE',
          originCityId: originCity.id,
          destinationCityId: destCity.id,
          availableFrom: now,
          availableTo: futureDate,
          contactName: user?.firstName || 'Driver',
          contactPhone: carrier.contactPhone || '0911111111',
          fullPartial: 'FULL',
        },
      });
    }
  }

  // Carrier 2: 2 trucks with postings
  if (carriers[1]) {
    const carrier = carriers[1];
    const user = carrier.users[0];
    console.log(`  Creating 2 truck postings for ${carrier.name}...`);

    for (let i = 0; i < 2; i++) {
      let truck = carrier.trucks[i];
      if (!truck) {
        truck = await prisma.truck.create({
          data: {
            carrierId: carrier.id,
            licensePlate: `BB-${carrier.id.slice(-4)}-T${i + 1}`,
            truckType: truckTypes[(i + 2) % truckTypes.length],
            capacity: 15000 + i * 10000,
            isAvailable: true,
            approvalStatus: 'APPROVED',
            contactName: user?.firstName || 'Driver',
            contactPhone: carrier.contactPhone || '0912222222',
          },
        });
      } else {
        await prisma.truck.update({
          where: { id: truck.id },
          data: { approvalStatus: 'APPROVED' },
        });
      }

      const originCity = locations[(i + 3) % locations.length];
      const destCity = locations[(i + 4) % locations.length];

      await prisma.truckPosting.create({
        data: {
          truckId: truck.id,
          carrierId: carrier.id,
          createdById: user?.id || carrier.users[0]?.id || '',
          status: 'ACTIVE',
          originCityId: originCity.id,
          destinationCityId: destCity.id,
          availableFrom: now,
          availableTo: futureDate,
          contactName: user?.firstName || 'Driver',
          contactPhone: carrier.contactPhone || '0912222222',
          fullPartial: 'FULL',
        },
      });
    }
  }

  // Carrier 3: 1 truck with posting
  if (carriers[2]) {
    const carrier = carriers[2];
    const user = carrier.users[0];
    console.log(`  Creating 1 truck posting for ${carrier.name}...`);

    let truck = carrier.trucks[0];
    if (!truck) {
      truck = await prisma.truck.create({
        data: {
          carrierId: carrier.id,
          licensePlate: `CC-${carrier.id.slice(-4)}-T1`,
          truckType: 'REFRIGERATED',
          capacity: 25000,
          isAvailable: true,
          approvalStatus: 'APPROVED',
          contactName: user?.firstName || 'Driver',
          contactPhone: carrier.contactPhone || '0913333333',
        },
      });
    } else {
      await prisma.truck.update({
        where: { id: truck.id },
        data: { approvalStatus: 'APPROVED' },
      });
    }

    const originCity = locations[5 % locations.length];
    const destCity = locations[6 % locations.length];

    await prisma.truckPosting.create({
      data: {
        truckId: truck.id,
        carrierId: carrier.id,
        createdById: user?.id || carrier.users[0]?.id || '',
        status: 'ACTIVE',
        originCityId: originCity.id,
        destinationCityId: destCity.id,
        availableFrom: now,
        availableTo: futureDate,
        contactName: user?.firstName || 'Driver',
        contactPhone: carrier.contactPhone || '0913333333',
        fullPartial: 'FULL',
      },
    });
  }

  // Step 4: Create varied loads for shippers
  console.log('\nCreating loads for shippers...');

  const loadCounts = [10, 5, 2, 1]; // Different number of loads per shipper

  for (let s = 0; s < shippers.length && s < loadCounts.length; s++) {
    const shipper = shippers[s];
    const user = shipper.users[0];
    const numLoads = loadCounts[s];

    console.log(`  Creating ${numLoads} loads for ${shipper.name}...`);

    for (let i = 0; i < numLoads; i++) {
      const originCity = locations[i % locations.length];
      const destCity = locations[(i + 1) % locations.length];
      const pickupDate = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
      const deliveryDate = new Date(pickupDate.getTime() + 2 * 24 * 60 * 60 * 1000);

      await prisma.load.create({
        data: {
          shipperId: shipper.id,
          createdById: user?.id || shipper.users[0]?.id || '',
          status: 'POSTED',
          postedAt: now,
          pickupCityId: originCity.id,
          pickupCity: originCity.name,
          pickupDate: pickupDate,
          deliveryCityId: destCity.id,
          deliveryCity: destCity.name,
          deliveryDate: deliveryDate,
          truckType: truckTypes[i % truckTypes.length],
          weight: 5000 + (i * 1000),
          rate: 15000 + (i * 2000),
          totalFareEtb: 15000 + (i * 2000),
          cargoDescription: `Test cargo ${i + 1} from ${shipper.name}`,
          shipperContactName: user?.firstName || 'Contact',
          shipperContactPhone: shipper.contactPhone || '0914444444',
        },
      });
    }
  }

  // Count final data
  const totalPostings = await prisma.truckPosting.count({ where: { status: 'ACTIVE' } });
  const totalLoads = await prisma.load.count({ where: { status: 'POSTED' } });
  const totalTrucks = await prisma.truck.count({ where: { approvalStatus: 'APPROVED' } });

  console.log('\n=== Test Data Summary ===');
  console.log(`Total active truck postings: ${totalPostings}`);
  console.log(`Total posted loads: ${totalLoads}`);
  console.log(`Total approved trucks: ${totalTrucks}`);
  console.log('\nTest data reset complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
