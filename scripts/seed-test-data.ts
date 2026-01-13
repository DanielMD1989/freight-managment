/**
 * Seed Test Data Script
 *
 * Populates the database with realistic test data for FreightET platform
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 *
 * Creates:
 * - 10 shipper organizations with users and loads
 * - 10 carrier organizations with users, trucks, and postings
 * - 1 admin user
 * - Realistic Ethiopian locations and routes
 * - Various load/truck statuses for testing
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://danieldamitew@localhost:5432/freight_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Ethiopian cities for realistic routing
const ETHIOPIAN_CITIES = [
  'Addis Ababa',
  'Dire Dawa',
  'Mekelle',
  'Gondar',
  'Hawassa',
  'Bahir Dar',
  'Dessie',
  'Jimma',
  'Jijiga',
  'Shashamane',
  'Mojo',
  'Adama',
  'Axum',
  'Harar',
  'Debre Birhan',
];

// Truck types
const TRUCK_TYPES = ['FLATBED', 'DRY_VAN', 'REFRIGERATED', 'CONTAINER', 'TANKER'];

// Cargo types
const CARGO_TYPES = [
  'Electronics',
  'Textiles',
  'Agricultural Products',
  'Construction Materials',
  'Food Products',
  'Machinery',
  'Pharmaceuticals',
  'Consumer Goods',
  'Raw Materials',
  'Beverages',
];

// Helper: Random date within range
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper: Random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper: Random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random phone number
function randomPhone(): string {
  return `+251${randomInt(900000000, 999999999)}`;
}

// Helper: Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting seed process...\n');

  // Clear existing data
  console.log('🗑️  Clearing existing test data...');
  await prisma.savedSearch.deleteMany({});
  await prisma.load.deleteMany({
    where: {
      shipper: {
        name: {
          startsWith: 'Test Shipper',
        },
      },
    },
  });
  await prisma.truckPosting.deleteMany({
    where: {
      carrier: {
        name: {
          startsWith: 'Test Carrier',
        },
      },
    },
  });
  await prisma.truck.deleteMany({
    where: {
      carrier: {
        name: {
          startsWith: 'Test Carrier',
        },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: '@testfreightet.com',
      },
    },
  });
  await prisma.organization.deleteMany({
    where: {
      OR: [
        { name: { startsWith: 'Test Shipper' } },
        { name: { startsWith: 'Test Carrier' } },
      ],
    },
  });

  console.log('✅ Cleared existing test data\n');

  // Create admin user
  console.log('👤 Creating admin user...');
  const adminPassword = await hashPassword('admin123');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@testfreightet.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      phone: '+251911000000',
      isActive: true,
      status: 'ACTIVE', // Set ACTIVE status for admin
    },
  });
  console.log(`✅ Created admin: ${adminUser.email} / password: admin123\n`);

  // Create shipper organizations
  console.log('🏢 Creating shipper organizations...');
  const shippers = [];
  for (let i = 1; i <= 10; i++) {
    const shipperPassword = await hashPassword('shipper123');
    const shipper = await prisma.organization.create({
      data: {
        name: `Test Shipper ${i}`,
        type: 'SHIPPER',
        contactEmail: `shipper${i}@testfreightet.com`,
        contactPhone: randomPhone(),
        isVerified: i <= 7, // 7 out of 10 verified
        users: {
          create: {
            email: `shipper${i}@testfreightet.com`,
            passwordHash: shipperPassword,
            firstName: `Shipper`,
            lastName: `${i}`,
            role: 'SHIPPER',
            phone: randomPhone(),
            isActive: true,
            status: 'ACTIVE', // Set ACTIVE status for test users
          },
        },
      },
      include: {
        users: true,
      },
    });
    shippers.push(shipper);
    console.log(`  ✓ ${shipper.name} (${shipper.contactEmail})`);
  }
  console.log(`✅ Created ${shippers.length} shippers (password: shipper123)\n`);

  // Create carrier organizations with trucks
  console.log('🚛 Creating carrier organizations with trucks...');
  const carriers = [];
  for (let i = 1; i <= 10; i++) {
    const carrierPassword = await hashPassword('carrier123');
    const carrier = await prisma.organization.create({
      data: {
        name: `Test Carrier ${i}`,
        type: 'CARRIER_COMPANY',
        contactEmail: `carrier${i}@testfreightet.com`,
        contactPhone: randomPhone(),
        isVerified: i <= 8, // 8 out of 10 verified
        users: {
          create: {
            email: `carrier${i}@testfreightet.com`,
            passwordHash: carrierPassword,
            firstName: `Carrier`,
            lastName: `${i}`,
            role: 'CARRIER',
            phone: randomPhone(),
            isActive: true,
            status: 'ACTIVE', // Set ACTIVE status for test users
          },
        },
      },
      include: {
        users: true,
      },
    });
    carriers.push(carrier);
    console.log(`  ✓ ${carrier.name} (${carrier.contactEmail})`);
  }
  console.log(`✅ Created ${carriers.length} carriers (password: carrier123)\n`);

  // Create trucks for carriers
  console.log('🚚 Creating trucks...');
  const trucks = [];
  for (const carrier of carriers) {
    const numTrucks = randomInt(2, 5);
    for (let i = 1; i <= numTrucks; i++) {
      const truck = await prisma.truck.create({
        data: {
          carrierId: carrier.id,
          licensePlate: `${randomInt(1, 9)}-${randomInt(10000, 99999)}`,
          truckType: randomElement(TRUCK_TYPES) as any,
          capacity: randomInt(5000, 25000),
          lengthM: randomInt(6, 18),
          currentCity: randomElement(ETHIOPIAN_CITIES),
          isAvailable: true,
        },
      });
      trucks.push(truck);
    }
  }
  console.log(`✅ Created ${trucks.length} trucks\n`);

  // Fetch Ethiopian locations for truck postings
  console.log('📍 Fetching Ethiopian locations...');
  const ethiopianLocations = await prisma.ethiopianLocation.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (ethiopianLocations.length === 0) {
    console.log('⚠️  No Ethiopian locations found in database');
  } else {
    console.log(`✅ Found ${ethiopianLocations.length} Ethiopian locations\n`);
  }

  // Create a map of city names to IDs
  const cityNameToId = new Map(
    ethiopianLocations.map(loc => [loc.name.toLowerCase(), loc.id])
  );

  // Create loads for shippers
  console.log('📦 Creating loads...');
  const statuses = ['POSTED', 'POSTED', 'POSTED', 'POSTED', 'UNPOSTED', 'DRAFT'];
  let loadsCount = 0;

  for (const shipper of shippers) {
    const numLoads = randomInt(5, 15);
    for (let i = 0; i < numLoads; i++) {
      const pickupCity = randomElement(ETHIOPIAN_CITIES);
      let deliveryCity = randomElement(ETHIOPIAN_CITIES);
      // Ensure delivery city is different from pickup
      while (deliveryCity === pickupCity) {
        deliveryCity = randomElement(ETHIOPIAN_CITIES);
      }

      const pickupDate = randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      const deliveryDate = new Date(pickupDate.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000);

      const truckType = randomElement(TRUCK_TYPES) as any;
      const weight = randomInt(1000, 20000);
      const lengthM = randomInt(4, 16);
      const rate = randomInt(10000, 100000);

      await prisma.load.create({
        data: {
          shipper: {
            connect: { id: shipper.id },
          },
          createdBy: {
            connect: { id: shipper.users[0].id },
          },
          pickupCity,
          deliveryCity,
          pickupDate,
          deliveryDate,
          truckType,
          weight,
          lengthM,
          fullPartial: randomElement(['FULL', 'PARTIAL']),
          rate,
          currency: 'ETB',
          status: randomElement(statuses) as any,
          cargoDescription: randomElement(CARGO_TYPES),
          pickupDockHours: `${randomInt(6, 8)}:00 AM - ${randomInt(4, 6)}:00 PM`,
          deliveryDockHours: `${randomInt(7, 9)}:00 AM - ${randomInt(3, 5)}:00 PM`,
          specialInstructions: i % 3 === 0 ? 'Handle with care' : null,
          shipperContactName: `${shipper.users[0].firstName} ${shipper.users[0].lastName}`,
          shipperContactPhone: shipper.contactPhone,
          isAnonymous: i % 5 === 0, // 20% anonymous
          isKept: i % 7 === 0, // Some marked as kept
        },
      });
      loadsCount++;
    }
  }
  console.log(`✅ Created ${loadsCount} loads\n`);

  // Create truck postings for carriers
  console.log('📍 Creating truck postings...');
  const postingStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED'];
  let postingsCount = 0;

  // Get carrier user for each carrier
  const carrierUsers = new Map();
  for (const carrier of carriers) {
    const user = carrier.users[0];
    if (user) {
      carrierUsers.set(carrier.id, user.id);
    }
  }

  for (const truck of trucks) {
    // Each truck gets 1-3 postings
    const numPostings = randomInt(1, 3);
    for (let i = 0; i < numPostings; i++) {
      const currentCity = randomElement(ETHIOPIAN_CITIES);
      let destinationCity = randomElement(ETHIOPIAN_CITIES);
      while (destinationCity === currentCity) {
        destinationCity = randomElement(ETHIOPIAN_CITIES);
      }

      const availableFrom = randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      const status = randomElement(postingStatuses);

      const originCityId = cityNameToId.get(currentCity.toLowerCase());
      const destCityId = destinationCity ? cityNameToId.get(destinationCity.toLowerCase()) : null;

      if (!originCityId) {
        console.log(`⚠️  Skipping posting - city not found: ${currentCity}`);
        continue;
      }

      const createdById = carrierUsers.get(truck.carrierId);
      if (!createdById) {
        console.log(`⚠️  Skipping posting - carrier user not found for truck ${truck.id}`);
        continue;
      }

      await prisma.truckPosting.create({
        data: {
          truck: { connect: { id: truck.id } },
          carrier: { connect: { id: truck.carrierId } },
          createdById,
          originCity: { connect: { id: originCityId } },
          ...(destCityId && i % 2 === 0 ? { destinationCity: { connect: { id: destCityId } } } : {}),
          availableFrom,
          fullPartial: randomElement(['FULL', 'PARTIAL']),
          status: status as any,
          contactName: `Driver ${randomInt(1, 100)}`,
          contactPhone: randomPhone(),
          notes: i % 4 === 0 ? 'Temperature controlled required' : null,
        },
      });
      postingsCount++;
    }
  }
  console.log(`✅ Created ${postingsCount} truck postings\n`);

  // Create some saved searches
  console.log('🔍 Creating saved searches...');
  let savedSearchesCount = 0;

  // Create saved searches for first 3 shippers
  for (let i = 0; i < 3; i++) {
    const shipper = shippers[i];
    const user = shipper.users[0];

    await prisma.savedSearch.create({
      data: {
        userId: user.id,
        type: 'TRUCKS',
        name: `Trucks to ${randomElement(ETHIOPIAN_CITIES)}`,
        criteria: {
          destination: randomElement(ETHIOPIAN_CITIES),
          truckType: randomElement(TRUCK_TYPES),
          minWeight: 5000,
        },
      },
    });
    savedSearchesCount++;

    await prisma.savedSearch.create({
      data: {
        userId: user.id,
        type: 'TRUCKS',
        name: `Available ${randomElement(TRUCK_TYPES)}s`,
        criteria: {
          truckType: randomElement(TRUCK_TYPES),
          verifiedOnly: true,
        },
      },
    });
    savedSearchesCount++;
  }

  // Create saved searches for first 3 carriers
  for (let i = 0; i < 3; i++) {
    const carrier = carriers[i];
    const user = carrier.users[0];

    await prisma.savedSearch.create({
      data: {
        userId: user.id,
        type: 'LOADS',
        name: `Loads from ${randomElement(ETHIOPIAN_CITIES)}`,
        criteria: {
          origin: randomElement(ETHIOPIAN_CITIES),
          truckType: randomElement(TRUCK_TYPES),
        },
      },
    });
    savedSearchesCount++;

    await prisma.savedSearch.create({
      data: {
        userId: user.id,
        type: 'LOADS',
        name: 'High value loads',
        criteria: {
          minRate: 50000,
          verifiedOnly: true,
        },
      },
    });
    savedSearchesCount++;
  }

  console.log(`✅ Created ${savedSearchesCount} saved searches\n`);

  // Print summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY!\n');
  console.log('📊 Summary:');
  console.log(`   • 1 Admin user`);
  console.log(`   • ${shippers.length} Shipper organizations`);
  console.log(`   • ${carriers.length} Carrier organizations`);
  console.log(`   • ${trucks.length} Trucks`);
  console.log(`   • ${loadsCount} Loads`);
  console.log(`   • ${postingsCount} Truck postings`);
  console.log(`   • ${savedSearchesCount} Saved searches\n`);
  console.log('🔐 Test Credentials:');
  console.log('   Admin:    admin@testfreightet.com / admin123');
  console.log('   Shippers: shipper1-10@testfreightet.com / shipper123');
  console.log('   Carriers: carrier1-10@testfreightet.com / carrier123\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
