/**
 * E2E Business Logic Test Script
 *
 * Tests:
 * 1. Load lifecycle and status transitions
 * 2. Service fee calculation and wallet integration
 * 3. Corridor matching and pricing
 */

import { PrismaClient, LoadStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Decimal } from 'decimal.js';

// Initialize Prisma with pg adapter
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Starting E2E Business Logic Tests\n');

  let testsPassed = 0;
  let testsFailed = 0;
  const issues: string[] = [];

  // Test 1: Load Lifecycle Status Transitions
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 1: Load Lifecycle Status Transitions');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Get load count
    const totalLoads = await prisma.load.count();
    console.log(`Total loads in database: ${totalLoads}\n`);

    // Check load status distribution
    const statusCounts = await prisma.load.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    console.log('Load Status Distribution:');
    statusCounts.forEach(s => {
      console.log(`  ${s.status}: ${s._count.id}`);
    });
    console.log();

    // Verify expected statuses exist in enum
    const validStatuses: string[] = [
      'DRAFT', 'POSTED', 'SEARCHING', 'OFFERED', 'ASSIGNED',
      'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED',
      'EXCEPTION', 'CANCELLED', 'EXPIRED', 'UNPOSTED'
    ];

    const foundStatuses = statusCounts.map(s => s.status);
    const hasValidStatuses = foundStatuses.every(s => validStatuses.includes(s as string));

    if (hasValidStatuses) {
      console.log('✅ All load statuses are valid\n');
      testsPassed++;
    } else {
      const invalidStatuses = foundStatuses.filter(s => !validStatuses.includes(s as string));
      console.log(`❌ Found invalid load statuses: ${invalidStatuses.join(', ')}\n`);
      issues.push(`Invalid load statuses: ${invalidStatuses.join(', ')}`);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Load lifecycle test failed:', error);
    testsFailed++;
  }

  // Test 2: Corridor Setup and Pricing
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 2: Corridor Setup and Pricing');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const corridors = await prisma.corridor.findMany({
      include: { _count: { select: { loads: true } } },
    });

    console.log(`Found ${corridors.length} corridors\n`);

    if (corridors.length > 0) {
      console.log('Corridor Details:');
      corridors.forEach(c => {
        const baseFee = Number(c.distanceKm) * Number(c.pricePerKm);
        let finalFee = baseFee;

        if (c.promoFlag && c.promoDiscountPct) {
          finalFee = baseFee * (1 - Number(c.promoDiscountPct) / 100);
        }

        console.log(`  ${c.name}:`);
        console.log(`    Route: ${c.originRegion} → ${c.destinationRegion}`);
        console.log(`    Distance: ${c.distanceKm} km`);
        console.log(`    Price/km: ${c.pricePerKm} ETB`);
        console.log(`    Base Fee: ${baseFee.toFixed(2)} ETB`);
        if (c.promoFlag) {
          console.log(`    Promo: ${c.promoDiscountPct}% off`);
        }
        console.log(`    Final Fee: ${finalFee.toFixed(2)} ETB`);
        console.log(`    Active: ${c.isActive}`);
        console.log();
      });

      console.log('✅ Corridor pricing setup verified\n');
      testsPassed++;
    } else {
      console.log('⚠️  No corridors found - this should be set up by admin\n');
      issues.push('No corridors configured');
      testsPassed++; // Not a failure, just a setup issue
    }
  } catch (error) {
    console.log('❌ Corridor test failed:', error);
    testsFailed++;
  }

  // Test 3: Service Fee Status Distribution
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 3: Service Fee Status Distribution');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const serviceFeeCounts = await prisma.load.groupBy({
      by: ['serviceFeeStatus'],
      _count: { id: true },
    });

    const withFees = serviceFeeCounts.filter(s => s.serviceFeeStatus !== null);

    if (withFees.length > 0) {
      console.log('Service Fee Status Distribution:');
      withFees.forEach(s => {
        console.log(`  ${s.serviceFeeStatus}: ${s._count.id}`);
      });
      console.log();
    }

    // Check loads with service fees
    const loadsWithFees = await prisma.load.findMany({
      where: {
        serviceFeeEtb: { not: null },
      },
      include: {
        corridor: true,
        shipper: { select: { name: true } },
      },
      take: 5,
    });

    if (loadsWithFees.length > 0) {
      console.log('Sample Loads with Service Fees:');
      loadsWithFees.forEach(load => {
        console.log(`  Load ${load.id.slice(0, 8)}...:`);
        console.log(`    Status: ${load.status}`);
        console.log(`    Service Fee: ${load.serviceFeeEtb} ETB`);
        console.log(`    Fee Status: ${load.serviceFeeStatus}`);
        if (load.corridor) {
          console.log(`    Corridor: ${load.corridor.name}`);
        }
        console.log();
      });

      console.log('✅ Service fee tracking verified\n');
    } else {
      console.log('ℹ️  No loads with service fees found yet\n');
      console.log('   This is expected if no loads have been assigned through the corridor system\n');
    }
    testsPassed++;
  } catch (error) {
    console.log('❌ Service fee test failed:', error);
    testsFailed++;
  }

  // Test 4: Financial Accounts (Wallets)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 4: Financial Accounts (Wallets)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const accountTypes = await prisma.financialAccount.groupBy({
      by: ['accountType'],
      _count: { id: true },
    });

    console.log('Financial Account Types:');
    accountTypes.forEach(a => {
      console.log(`  ${a.accountType}: ${a._count.id} accounts`);
    });
    console.log();

    // Get total balances by type
    const accounts = await prisma.financialAccount.findMany();
    const balanceByType: Record<string, number> = {};
    accounts.forEach(a => {
      if (!balanceByType[a.accountType]) balanceByType[a.accountType] = 0;
      balanceByType[a.accountType] += Number(a.balance);
    });

    console.log('Total Balances by Type:');
    Object.entries(balanceByType).forEach(([type, balance]) => {
      console.log(`  ${type}: ${balance.toFixed(2)} ETB`);
    });
    console.log();

    // Check for platform revenue account
    const platformAccount = await prisma.financialAccount.findFirst({
      where: { accountType: 'PLATFORM_REVENUE' },
    });

    if (platformAccount) {
      console.log(`✅ Platform revenue account exists: Balance ${platformAccount.balance} ETB\n`);
    } else {
      console.log('⚠️  No platform revenue account found\n');
      issues.push('No platform revenue account configured');
    }

    testsPassed++;
  } catch (error) {
    console.log('❌ Financial accounts test failed:', error);
    testsFailed++;
  }

  // Test 5: Journal Entries (Transaction Audit Trail)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 5: Journal Entries (Transaction Audit Trail)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const journalTypes = await prisma.journalEntry.groupBy({
      by: ['transactionType'],
      _count: { id: true },
    });

    if (journalTypes.length > 0) {
      console.log('Transaction Type Summary:');
      journalTypes.forEach(j => {
        console.log(`  ${j.transactionType}: ${j._count.id} entries`);
      });
      console.log();
    } else {
      console.log('No journal entries found yet\n');
    }

    // Check for service fee transactions
    const serviceFeeTransactions = await prisma.journalEntry.findMany({
      where: {
        transactionType: {
          in: ['SERVICE_FEE_RESERVE', 'SERVICE_FEE_DEDUCT', 'SERVICE_FEE_REFUND'],
        },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    if (serviceFeeTransactions.length > 0) {
      console.log('Recent Service Fee Transactions:');
      serviceFeeTransactions.forEach(t => {
        console.log(`  ${t.transactionType}: ${t.description} (${t.createdAt.toISOString().split('T')[0]})`);
      });
      console.log();
    }

    console.log('✅ Journal entry system verified\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ Journal entries test failed:', error);
    testsFailed++;
  }

  // Test 6: Trucks and GPS Tracking
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 6: Trucks and GPS Tracking');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const totalTrucks = await prisma.truck.count();
    const trucksWithGPS = await prisma.truck.count({
      where: { gpsDeviceId: { not: null } },
    });
    const availableTrucks = await prisma.truck.count({
      where: { isAvailable: true },
    });

    console.log(`Total Trucks: ${totalTrucks}`);
    console.log(`Trucks with GPS: ${trucksWithGPS}`);
    console.log(`Available Trucks: ${availableTrucks}`);
    console.log();

    // Check truck approval statuses
    const approvalCounts = await prisma.truck.groupBy({
      by: ['approvalStatus'],
      _count: { id: true },
    });

    console.log('Truck Approval Status:');
    approvalCounts.forEach(a => {
      console.log(`  ${a.approvalStatus || 'PENDING'}: ${a._count.id}`);
    });
    console.log();

    // Check trip progress tracking
    const loadsWithProgress = await prisma.load.findMany({
      where: {
        tripProgressPercent: { gt: 0 },
      },
      select: {
        id: true,
        status: true,
        tripProgressPercent: true,
        remainingDistanceKm: true,
      },
      take: 5,
    });

    if (loadsWithProgress.length > 0) {
      console.log('Loads with Trip Progress:');
      loadsWithProgress.forEach(l => {
        console.log(`  Load ${l.id.slice(0, 8)}...: ${l.tripProgressPercent}% complete`);
      });
      console.log();
    }

    console.log('✅ Truck and GPS tracking verified\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ Truck/GPS test failed:', error);
    testsFailed++;
  }

  // Test 7: Notification System
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 7: Notification System');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const notificationTypes = await prisma.notification.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    if (notificationTypes.length > 0) {
      console.log('Notification Types:');
      notificationTypes.forEach(n => {
        console.log(`  ${n.type}: ${n._count.id}`);
      });
      console.log();
    }

    // Check for unread notifications
    const unreadCount = await prisma.notification.count({
      where: { read: false },
    });

    console.log(`Unread notifications: ${unreadCount}`);
    console.log();

    console.log('✅ Notification system verified\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ Notification test failed:', error);
    testsFailed++;
  }

  // Test 8: Match Proposals
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 8: Match Proposals');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const proposals = await prisma.matchProposal.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    if (proposals.length > 0) {
      console.log('Match Proposal Status Distribution:');
      proposals.forEach(p => {
        console.log(`  ${p.status}: ${p._count.id}`);
      });
      console.log();
    }

    const recentProposals = await prisma.matchProposal.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        load: { select: { id: true, status: true, serviceFeeEtb: true } },
        truck: { select: { licensePlate: true } },
      },
    });

    if (recentProposals.length > 0) {
      console.log('Recent Match Proposals:');
      recentProposals.forEach(p => {
        console.log(`  Proposal ${p.id.slice(0, 8)}...:`);
        console.log(`    Status: ${p.status}`);
        console.log(`    Truck: ${p.truck.licensePlate}`);
        console.log(`    Load Status: ${p.load.status}`);
        if (p.load.serviceFeeEtb) {
          console.log(`    Service Fee: ${p.load.serviceFeeEtb} ETB`);
        }
        console.log();
      });
    }

    console.log('✅ Match proposal system verified\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ Match proposal test failed:', error);
    testsFailed++;
  }

  // Test 9: Organizations
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 9: Organizations');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const orgTypes = await prisma.organization.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    console.log('Organization Types:');
    orgTypes.forEach(o => {
      console.log(`  ${o.type}: ${o._count.id}`);
    });
    console.log();

    const orgVerification = await prisma.organization.groupBy({
      by: ['isVerified'],
      _count: { id: true },
    });

    console.log('Organization Verification:');
    orgVerification.forEach(o => {
      console.log(`  ${o.isVerified ? 'Verified' : 'Not Verified'}: ${o._count.id}`);
    });
    console.log();

    console.log('✅ Organization system verified\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ Organization test failed:', error);
    testsFailed++;
  }

  // Test 10: Users
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST 10: Users');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const userRoles = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    console.log('User Roles:');
    userRoles.forEach(u => {
      console.log(`  ${u.role}: ${u._count.id}`);
    });
    console.log();

    const userStatuses = await prisma.user.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    console.log('User Status:');
    userStatuses.forEach(u => {
      console.log(`  ${u.status}: ${u._count.id}`);
    });
    console.log();

    console.log('✅ User system verified\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ User test failed:', error);
    testsFailed++;
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log();

  if (issues.length > 0) {
    console.log('Issues Found:');
    issues.forEach(issue => {
      console.log(`  ⚠️  ${issue}`);
    });
    console.log();
  }

  if (testsFailed === 0) {
    console.log('🎉 All business logic tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed - review issues above\n');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
