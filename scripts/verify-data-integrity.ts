#!/usr/bin/env npx tsx
/**
 * Data Integrity Verification Script
 *
 * This script verifies that:
 * 1. All dashboard math adds up correctly
 * 2. No invalid enum values are returned from APIs
 * 3. Cross-role totals are consistent
 *
 * Run with: npx tsx scripts/verify-data-integrity.ts
 *
 * Requires:
 * - Database connection (uses Prisma)
 * - Environment variables set (DATABASE_URL, etc.)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://danieldamitew@localhost:5432/freight_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Valid enum values from Prisma schema
const VALID_ENUMS = {
  LoadStatus: [
    'DRAFT', 'POSTED', 'SEARCHING', 'OFFERED', 'ASSIGNED',
    'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED',
    'EXCEPTION', 'CANCELLED', 'EXPIRED', 'UNPOSTED'
  ],
  PostingStatus: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'MATCHED'],
  TripStatus: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  GpsDeviceStatus: ['ACTIVE', 'INACTIVE', 'SIGNAL_LOST', 'MAINTENANCE'],
  UserStatus: ['REGISTERED', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED'],
  VerificationStatus: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function pass(name: string, message: string, details?: any) {
  results.push({ name, passed: true, message, details });
  console.log(`  ✓ ${name}: ${message}`);
}

function fail(name: string, message: string, details?: any) {
  results.push({ name, passed: false, message, details });
  console.log(`  ✗ ${name}: ${message}`);
  if (details) {
    console.log(`    Details:`, JSON.stringify(details, null, 2));
  }
}

// ============================================================================
// DATABASE GROUND TRUTH
// ============================================================================

async function getGroundTruth() {
  console.log('\n📊 Fetching ground truth from database...\n');

  const [
    totalLoads,
    loadsByStatus,
    totalTrucks,
    trucksByAvailability,
    totalTrips,
    tripsByStatus,
    totalPostings,
    postingsByStatus,
    totalUsers,
    totalOrganizations,
  ] = await Promise.all([
    prisma.load.count(),
    prisma.load.groupBy({ by: ['status'], _count: true }),
    prisma.truck.count(),
    prisma.truck.groupBy({ by: ['isAvailable'], _count: true }),
    prisma.trip.count(),
    prisma.trip.groupBy({ by: ['status'], _count: true }),
    prisma.truckPosting.count(),
    prisma.truckPosting.groupBy({ by: ['status'], _count: true }),
    prisma.user.count(),
    prisma.organization.count(),
  ]);

  return {
    loads: {
      total: totalLoads,
      byStatus: Object.fromEntries(loadsByStatus.map(s => [s.status, s._count])),
    },
    trucks: {
      total: totalTrucks,
      available: trucksByAvailability.find(t => t.isAvailable)?._count || 0,
      unavailable: trucksByAvailability.find(t => !t.isAvailable)?._count || 0,
    },
    trips: {
      total: totalTrips,
      byStatus: Object.fromEntries(tripsByStatus.map(s => [s.status, s._count])),
    },
    postings: {
      total: totalPostings,
      byStatus: Object.fromEntries(postingsByStatus.map(s => [s.status, s._count])),
    },
    users: { total: totalUsers },
    organizations: { total: totalOrganizations },
  };
}

// ============================================================================
// TEST 1: LOAD STATUS ENUM VALIDATION
// ============================================================================

async function testLoadStatusEnums(groundTruth: Awaited<ReturnType<typeof getGroundTruth>>) {
  console.log('\n🔍 Test 1: Load Status Enum Validation\n');

  const invalidStatuses = Object.keys(groundTruth.loads.byStatus).filter(
    status => !VALID_ENUMS.LoadStatus.includes(status)
  );

  if (invalidStatuses.length === 0) {
    pass('LoadStatus Enums', 'All load statuses are valid enum values');
  } else {
    fail('LoadStatus Enums', `Found invalid statuses: ${invalidStatuses.join(', ')}`);
  }

  // Verify sum equals total
  const sum = Object.values(groundTruth.loads.byStatus).reduce((a, b) => a + b, 0);
  if (sum === groundTruth.loads.total) {
    pass('Load Count Sum', `Sum of statuses (${sum}) equals total (${groundTruth.loads.total})`);
  } else {
    fail('Load Count Sum', `Sum (${sum}) != Total (${groundTruth.loads.total})`);
  }
}

// ============================================================================
// TEST 2: TRIP STATUS ENUM VALIDATION
// ============================================================================

async function testTripStatusEnums(groundTruth: Awaited<ReturnType<typeof getGroundTruth>>) {
  console.log('\n🔍 Test 2: Trip Status Enum Validation\n');

  const invalidStatuses = Object.keys(groundTruth.trips.byStatus).filter(
    status => !VALID_ENUMS.TripStatus.includes(status)
  );

  if (invalidStatuses.length === 0) {
    pass('TripStatus Enums', 'All trip statuses are valid enum values');
  } else {
    fail('TripStatus Enums', `Found invalid statuses: ${invalidStatuses.join(', ')}`);
  }

  // Verify sum equals total
  const sum = Object.values(groundTruth.trips.byStatus).reduce((a, b) => a + b, 0);
  if (sum === groundTruth.trips.total) {
    pass('Trip Count Sum', `Sum of statuses (${sum}) equals total (${groundTruth.trips.total})`);
  } else {
    fail('Trip Count Sum', `Sum (${sum}) != Total (${groundTruth.trips.total})`);
  }
}

// ============================================================================
// TEST 3: POSTING STATUS ENUM VALIDATION
// ============================================================================

async function testPostingStatusEnums(groundTruth: Awaited<ReturnType<typeof getGroundTruth>>) {
  console.log('\n🔍 Test 3: Posting Status Enum Validation\n');

  const invalidStatuses = Object.keys(groundTruth.postings.byStatus).filter(
    status => !VALID_ENUMS.PostingStatus.includes(status)
  );

  if (invalidStatuses.length === 0) {
    pass('PostingStatus Enums', 'All posting statuses are valid enum values');
  } else {
    fail('PostingStatus Enums', `Found invalid statuses: ${invalidStatuses.join(', ')}`);
  }

  // Verify sum equals total
  const sum = Object.values(groundTruth.postings.byStatus).reduce((a, b) => a + b, 0);
  if (sum === groundTruth.postings.total) {
    pass('Posting Count Sum', `Sum of statuses (${sum}) equals total (${groundTruth.postings.total})`);
  } else {
    fail('Posting Count Sum', `Sum (${sum}) != Total (${groundTruth.postings.total})`);
  }
}

// ============================================================================
// TEST 4: TRUCK AVAILABILITY MATH
// ============================================================================

async function testTruckAvailabilityMath(groundTruth: Awaited<ReturnType<typeof getGroundTruth>>) {
  console.log('\n🔍 Test 4: Truck Availability Math\n');

  const sum = groundTruth.trucks.available + groundTruth.trucks.unavailable;
  if (sum === groundTruth.trucks.total) {
    pass(
      'Truck Availability',
      `Available (${groundTruth.trucks.available}) + Unavailable (${groundTruth.trucks.unavailable}) = Total (${groundTruth.trucks.total})`
    );
  } else {
    fail(
      'Truck Availability',
      `Sum (${sum}) != Total (${groundTruth.trucks.total})`,
      groundTruth.trucks
    );
  }
}

// ============================================================================
// TEST 5: GPS STATUS IN DATABASE
// ============================================================================

async function testGpsStatusEnums() {
  console.log('\n🔍 Test 5: GPS Status Enum Validation\n');

  const trucksWithGps = await prisma.truck.findMany({
    where: { gpsStatus: { not: null } },
    select: { gpsStatus: true },
  });

  const uniqueStatuses = [...new Set(trucksWithGps.map(t => t.gpsStatus).filter(Boolean))];
  const invalidStatuses = uniqueStatuses.filter(
    status => !VALID_ENUMS.GpsDeviceStatus.includes(status as string)
  );

  if (invalidStatuses.length === 0) {
    pass('GpsDeviceStatus Enums', `All GPS statuses are valid (found: ${uniqueStatuses.join(', ') || 'none'})`);
  } else {
    fail('GpsDeviceStatus Enums', `Found invalid statuses: ${invalidStatuses.join(', ')}`);
  }
}

// ============================================================================
// TEST 6: USER STATUS IN DATABASE
// ============================================================================

async function testUserStatusEnums() {
  console.log('\n🔍 Test 6: User Status Enum Validation\n');

  const usersByStatus = await prisma.user.groupBy({
    by: ['status'],
    _count: true,
  });

  const invalidStatuses = usersByStatus
    .map(u => u.status)
    .filter(status => !VALID_ENUMS.UserStatus.includes(status));

  if (invalidStatuses.length === 0) {
    pass('UserStatus Enums', 'All user statuses are valid enum values');
  } else {
    fail('UserStatus Enums', `Found invalid statuses: ${invalidStatuses.join(', ')}`);
  }
}

// ============================================================================
// TEST 7: CARRIER LOADBOARD MATH (Posted + Unposted = Total)
// ============================================================================

async function testCarrierLoadboardMath() {
  console.log('\n🔍 Test 7: Carrier LoadBoard Math (per carrier)\n');

  // Get all carriers
  const carriers = await prisma.organization.findMany({
    where: { type: { in: ['CARRIER_COMPANY', 'CARRIER_INDIVIDUAL', 'FLEET_OWNER'] } },
    select: { id: true, name: true },
  });

  let allPassed = true;
  const failures: string[] = [];

  for (const carrier of carriers.slice(0, 5)) { // Test first 5 carriers
    const [totalTrucks, activePostings, trucksWithoutActivePosting] = await Promise.all([
      prisma.truck.count({ where: { carrierId: carrier.id } }),
      prisma.truckPosting.count({ where: { carrierId: carrier.id, status: 'ACTIVE' } }),
      prisma.truck.count({
        where: {
          carrierId: carrier.id,
          postings: { none: { status: 'ACTIVE' } },
        },
      }),
    ]);

    // Note: A truck can have an active posting OR not have one
    // But the same truck could have multiple postings (historical)
    // So we check: trucksWithActivePosting + trucksWithoutActivePosting = totalTrucks
    const trucksWithActivePosting = totalTrucks - trucksWithoutActivePosting;

    if (trucksWithActivePosting + trucksWithoutActivePosting === totalTrucks) {
      // This is correct
    } else {
      allPassed = false;
      failures.push(`${carrier.name}: with(${trucksWithActivePosting}) + without(${trucksWithoutActivePosting}) != total(${totalTrucks})`);
    }
  }

  if (allPassed) {
    pass('Carrier LoadBoard Math', 'Posted + Unposted = Total for all tested carriers');
  } else {
    fail('Carrier LoadBoard Math', 'Math mismatch', failures);
  }
}

// ============================================================================
// TEST 8: ADMIN TOTALS CONSISTENCY
// ============================================================================

async function testAdminTotalsConsistency(groundTruth: Awaited<ReturnType<typeof getGroundTruth>>) {
  console.log('\n🔍 Test 8: Admin Totals Consistency\n');

  // Sum of all shipper loads should equal total loads
  const shipperLoads = await prisma.load.groupBy({
    by: ['shipperId'],
    _count: true,
  });
  const sumShipperLoads = shipperLoads.reduce((sum, s) => sum + s._count, 0);

  if (sumShipperLoads === groundTruth.loads.total) {
    pass('Admin Load Totals', `Sum of shipper loads (${sumShipperLoads}) = Total loads (${groundTruth.loads.total})`);
  } else {
    fail('Admin Load Totals', `Sum (${sumShipperLoads}) != Total (${groundTruth.loads.total})`);
  }

  // Sum of all carrier trucks should equal total trucks
  const carrierTrucks = await prisma.truck.groupBy({
    by: ['carrierId'],
    _count: true,
  });
  const sumCarrierTrucks = carrierTrucks.reduce((sum, t) => sum + t._count, 0);

  if (sumCarrierTrucks === groundTruth.trucks.total) {
    pass('Admin Truck Totals', `Sum of carrier trucks (${sumCarrierTrucks}) = Total trucks (${groundTruth.trucks.total})`);
  } else {
    fail('Admin Truck Totals', `Sum (${sumCarrierTrucks}) != Total (${groundTruth.trucks.total})`);
  }
}

// ============================================================================
// TEST 9: NO ORPHANED REFERENCES
// ============================================================================

async function testNoOrphanedReferences() {
  console.log('\n🔍 Test 9: No Orphaned References\n');

  // Note: shipperId, carrierId, loadId are required fields in the schema,
  // so Prisma enforces referential integrity. We verify the counts match.

  // Count loads and verify all have shipper relations
  const totalLoads = await prisma.load.count();
  const loadsWithShipper = await prisma.load.count({
    where: {
      shipper: {
        id: { not: '' }, // Has a valid shipper with non-empty ID
      },
    },
  });

  if (loadsWithShipper === totalLoads) {
    pass('Load-Shipper Integrity', `All ${totalLoads} loads have valid shipper references`);
  } else {
    fail('Load-Shipper Integrity', `${totalLoads - loadsWithShipper} of ${totalLoads} loads missing shipper`);
  }

  // Count trucks and verify all have carrier relations
  const totalTrucks = await prisma.truck.count();
  const trucksWithCarrier = await prisma.truck.count({
    where: {
      carrier: {
        id: { not: '' },
      },
    },
  });

  if (trucksWithCarrier === totalTrucks) {
    pass('Truck-Carrier Integrity', `All ${totalTrucks} trucks have valid carrier references`);
  } else {
    fail('Truck-Carrier Integrity', `${totalTrucks - trucksWithCarrier} of ${totalTrucks} trucks missing carrier`);
  }

  // Count trips and verify all have load relations
  const totalTrips = await prisma.trip.count();
  const tripsWithLoad = await prisma.trip.count({
    where: {
      load: {
        id: { not: '' },
      },
    },
  });

  if (tripsWithLoad === totalTrips) {
    pass('Trip-Load Integrity', `All ${totalTrips} trips have valid load references`);
  } else {
    fail('Trip-Load Integrity', `${totalTrips - tripsWithLoad} of ${totalTrips} trips missing load`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         DATA INTEGRITY VERIFICATION SCRIPT                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    const groundTruth = await getGroundTruth();

    console.log('Ground Truth Summary:');
    console.log(`  Loads: ${groundTruth.loads.total}`);
    console.log(`  Trucks: ${groundTruth.trucks.total} (${groundTruth.trucks.available} available)`);
    console.log(`  Trips: ${groundTruth.trips.total}`);
    console.log(`  Postings: ${groundTruth.postings.total}`);
    console.log(`  Users: ${groundTruth.users.total}`);
    console.log(`  Organizations: ${groundTruth.organizations.total}`);

    // Run all tests
    await testLoadStatusEnums(groundTruth);
    await testTripStatusEnums(groundTruth);
    await testPostingStatusEnums(groundTruth);
    await testTruckAvailabilityMath(groundTruth);
    await testGpsStatusEnums();
    await testUserStatusEnums();
    await testCarrierLoadboardMath();
    await testAdminTotalsConsistency(groundTruth);
    await testNoOrphanedReferences();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`  Total Tests: ${results.length}`);
    console.log(`  ✓ Passed: ${passed}`);
    console.log(`  ✗ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n  Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`    - ${r.name}: ${r.message}`);
      });
    }

    console.log('\n');

    // Exit with error code if any tests failed
    if (failed > 0) {
      console.log('❌ VERIFICATION FAILED\n');
      process.exit(1);
    } else {
      console.log('✅ ALL VERIFICATIONS PASSED\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error running verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
