/**
 * Approve a pending LoadRequest and create a Trip
 *
 * This script demonstrates the full flow:
 * 1. Find pending LoadRequest
 * 2. Approve the request
 * 3. Update Load status to ASSIGNED
 * 4. Mark truck as unavailable
 * 5. Create Trip record
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function approveRequest() {
  const requestId = 'cmkfcc1x70056heulmx4ttghm';

  console.log('=== APPROVING LOAD REQUEST ===');
  console.log(`Request ID: ${requestId}\n`);

  // Get the request with all details
  const request = await prisma.loadRequest.findUnique({
    where: { id: requestId },
    include: {
      load: { include: { shipper: true, pickupLocation: true, deliveryLocation: true } },
      truck: { include: { carrier: true } },
      carrier: true,
      shipper: true,
    },
  });

  if (!request) {
    console.log('Request not found');
    await cleanup();
    return;
  }

  if (request.status !== 'PENDING') {
    console.log(`Request already ${request.status}`);
    await cleanup();
    return;
  }

  console.log('Request Details:');
  console.log(`  Carrier: ${request.carrier?.name}`);
  console.log(`  Truck: ${request.truck?.licensePlate}`);
  console.log(`  Load: ${request.load?.pickupCity} → ${request.load?.deliveryCity}`);
  console.log(`  Shipper: ${request.shipper?.name}`);
  console.log();

  // Check if trip already exists for this load
  const existingTrip = await prisma.trip.findUnique({
    where: { loadId: request.loadId },
  });

  if (existingTrip) {
    console.log('Trip already exists for this load');
    console.log(`Trip ID: ${existingTrip.id}`);
    await cleanup();
    return;
  }

  // Step 1: Update LoadRequest status to APPROVED
  console.log('Step 1: Updating LoadRequest status to APPROVED...');
  const updatedRequest = await prisma.loadRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      respondedAt: new Date(),
    },
  });
  console.log(`  ✅ LoadRequest status: ${updatedRequest.status}`);

  // Step 2: Update Load status to ASSIGNED and assign truck
  console.log('Step 2: Updating Load status to ASSIGNED...');
  const updatedLoad = await prisma.load.update({
    where: { id: request.loadId },
    data: {
      status: 'ASSIGNED',
      assignedTruckId: request.truckId,
      assignedAt: new Date(),
    },
  });
  console.log(`  ✅ Load status: ${updatedLoad.status}`);
  console.log(`  ✅ Load assigned to truck: ${request.truck?.licensePlate}`);

  // Step 3: Update Truck availability
  console.log('Step 3: Updating Truck availability...');
  await prisma.truck.update({
    where: { id: request.truckId },
    data: { isAvailable: false },
  });
  console.log(`  ✅ Truck marked as unavailable`);

  // Step 4: Create Trip
  console.log('Step 4: Creating Trip...');

  // Generate tracking URL
  const shortId = request.loadId.slice(-8);
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const trackingUrl = `trip-${shortId}-${timestamp}-${random}`;

  const trip = await prisma.trip.create({
    data: {
      loadId: request.loadId,
      truckId: request.truckId,
      carrierId: request.truck!.carrierId,
      shipperId: request.load!.shipperId,
      status: 'ASSIGNED',

      // Pickup location
      pickupLat: request.load?.originLat || request.load?.pickupLocation?.latitude || null,
      pickupLng: request.load?.originLon || request.load?.pickupLocation?.longitude || null,
      pickupAddress: request.load?.pickupAddress || null,
      pickupCity: request.load?.pickupCity || request.load?.pickupLocation?.name || null,

      // Delivery location
      deliveryLat: request.load?.destinationLat || request.load?.deliveryLocation?.latitude || null,
      deliveryLng: request.load?.destinationLon || request.load?.deliveryLocation?.longitude || null,
      deliveryAddress: request.load?.deliveryAddress || null,
      deliveryCity: request.load?.deliveryCity || request.load?.deliveryLocation?.name || null,

      // Distance
      estimatedDistanceKm: request.load?.estimatedTripKm || request.load?.tripKm || null,

      // Tracking
      trackingUrl,
      trackingEnabled: true,
    },
  });

  console.log(`  ✅ Trip created!`);
  console.log(`     Trip ID: ${trip.id}`);
  console.log(`     Status: ${trip.status}`);
  console.log(`     Tracking URL: ${trip.trackingUrl}`);
  console.log();

  // Verify Trip relationships
  const verifyTrip = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: {
      load: { select: { pickupCity: true, deliveryCity: true, status: true } },
      truck: { select: { licensePlate: true } },
      carrier: { select: { name: true } },
      shipper: { select: { name: true } },
    },
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TRIP CREATED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Trip ID: ${verifyTrip?.id}`);
  console.log(`Status: ${verifyTrip?.status}`);
  console.log(`Route: ${verifyTrip?.load?.pickupCity} → ${verifyTrip?.load?.deliveryCity}`);
  console.log(`Truck: ${verifyTrip?.truck?.licensePlate}`);
  console.log(`Carrier: ${verifyTrip?.carrier?.name}`);
  console.log(`Shipper: ${verifyTrip?.shipper?.name}`);
  console.log(`Load Status: ${verifyTrip?.load?.status}`);

  await cleanup();
}

async function cleanup() {
  await prisma.$disconnect();
  await pool.end();
}

approveRequest().catch(async (error) => {
  console.error('Error:', error);
  await cleanup();
  process.exit(1);
});
