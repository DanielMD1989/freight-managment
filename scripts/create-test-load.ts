/**
 * Create a test load for Test Shipper 1
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find shipper user for Test Shipper 1
  const shipperUser = await prisma.user.findFirst({
    where: { email: 'shipper1@testfreightet.com' }
  });

  if (!shipperUser || !shipperUser.organizationId) {
    console.log('Test Shipper 1 user not found or has no org');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const load = await prisma.load.create({
    data: {
      shipper: { connect: { id: shipperUser.organizationId } },
      createdBy: { connect: { id: shipperUser.id } },
      pickupCity: 'Mekele',
      deliveryCity: 'Hawassa',
      pickupDate: new Date('2026-01-15'),
      deliveryDate: new Date('2026-01-17'),
      weight: 15000,
      rate: 25000,
      truckType: 'DRY_VAN',
      fullPartial: 'FULL',
      status: 'POSTED',
      cargoDescription: 'Test Shipper 1 - Isolation Test Load',
      postedAt: new Date(),
    }
  });

  console.log('Created test load for Test Shipper 1:');
  console.log('  ID:', load.id);
  console.log('  Route:', load.pickupCity, '->', load.deliveryCity);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
