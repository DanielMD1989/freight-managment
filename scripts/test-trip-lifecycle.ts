/**
 * Test Trip Status Lifecycle
 *
 * Tests the complete trip flow:
 * ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED → COMPLETED
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { PrismaClient, TripStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const tripId = 'cmklbvoh4000076ul399je5n4';

// Valid status transitions
const validTransitions: Record<TripStatus, TripStatus[]> = {
  ASSIGNED: ['PICKUP_PENDING', 'CANCELLED'],
  PICKUP_PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

async function updateTripStatus(newStatus: TripStatus): Promise<boolean> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });

  if (!trip) {
    console.log('Trip not found');
    return false;
  }

  // Validate transition
  const allowedTransitions = validTransitions[trip.status];
  if (!allowedTransitions.includes(newStatus)) {
    console.log(`❌ Invalid transition: ${trip.status} → ${newStatus}`);
    console.log(`   Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`);
    return false;
  }

  // Build update data with timestamps
  const updateData: any = {
    status: newStatus,
    updatedAt: new Date(),
  };

  switch (newStatus) {
    case 'PICKUP_PENDING':
      updateData.startedAt = new Date();
      break;
    case 'IN_TRANSIT':
      updateData.pickedUpAt = new Date();
      break;
    case 'DELIVERED':
      updateData.deliveredAt = new Date();
      break;
    case 'COMPLETED':
      updateData.completedAt = new Date();
      updateData.trackingEnabled = false;
      break;
  }

  // Update trip
  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: updateData,
  });

  // Sync load status
  await prisma.load.update({
    where: { id: trip.loadId },
    data: { status: newStatus as any },
  });

  console.log(`✅ ${trip.status} → ${newStatus}`);
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TESTING TRIP STATUS LIFECYCLE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get current trip state
  let trip: any = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      load: { select: { pickupCity: true, deliveryCity: true, status: true } },
      truck: { select: { licensePlate: true } },
      carrier: { select: { name: true } },
      shipper: { select: { name: true } },
    },
  });

  if (!trip) {
    console.log('Trip not found');
    await cleanup();
    return;
  }

  console.log(`Trip ID: ${trip.id}`);
  console.log(`Route: ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}`);
  console.log(`Truck: ${trip.truck?.licensePlate}`);
  console.log(`Carrier: ${trip.carrier?.name}`);
  console.log(`Shipper: ${trip.shipper?.name}`);
  console.log(`Current Status: ${trip.status}`);
  console.log();

  console.log('Testing Status Transitions:');
  console.log('─────────────────────────────────────────────────────────────────');

  // Test each transition
  const transitions: TripStatus[] = ['PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];

  for (const status of transitions) {
    // Check current status before transition
    trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) break;

    // Skip if already past this status
    const statusOrder = ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
    if (statusOrder.indexOf(trip.status) >= statusOrder.indexOf(status)) {
      console.log(`⏭️  Skipping ${status} (already at ${trip.status})`);
      continue;
    }

    const success = await updateTripStatus(status);
    if (!success) break;

    // Small delay to simulate real-world timing
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log();

  // Final verification
  trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      load: { select: { status: true } },
    },
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('FINAL STATE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Trip Status: ${trip?.status}`);
  console.log(`Load Status: ${trip?.load?.status}`);
  console.log(`Started At: ${trip?.startedAt?.toISOString() || 'N/A'}`);
  console.log(`Picked Up At: ${trip?.pickedUpAt?.toISOString() || 'N/A'}`);
  console.log(`Delivered At: ${trip?.deliveredAt?.toISOString() || 'N/A'}`);
  console.log(`Completed At: ${trip?.completedAt?.toISOString() || 'N/A'}`);
  console.log(`Tracking Enabled: ${trip?.trackingEnabled}`);
  console.log();

  // Verify status sync
  if (trip?.status === trip?.load?.status) {
    console.log('✅ Trip and Load status are synchronized');
  } else {
    console.log(`❌ Status mismatch: Trip=${trip?.status}, Load=${trip?.load?.status}`);
  }

  await cleanup();
}

async function cleanup() {
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (error) => {
  console.error('Error:', error);
  await cleanup();
  process.exit(1);
});
