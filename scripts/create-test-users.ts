import { db } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function createTestUsers() {
  try {
    console.log('Creating test users...\n');

    const password = await hashPassword('Test123!');

    // Create shipper org & user
    let shipperOrg = await db.organization.findFirst({ where: { name: 'Test Shipper' } });
    if (!shipperOrg) {
      shipperOrg = await db.organization.create({
        data: {
          name: 'Test Shipper',
          type: 'SHIPPER',
          contactEmail: 'shipper@test.com',
          contactPhone: '+251911000001',
          isVerified: true,
        },
      });
    }

    let shipperUser = await db.user.findUnique({ where: { email: 'shipper@test.com' } });
    if (!shipperUser) {
      shipperUser = await db.user.create({
        data: {
          email: 'shipper@test.com',
          passwordHash: password,
          firstName: 'Test',
          lastName: 'Shipper',
          phone: '+251911000001',
          role: 'SHIPPER',
          status: 'ACTIVE',
          isActive: true,
          organizationId: shipperOrg.id,
        },
      });
      console.log('✅ Created shipper: shipper@test.com / Test123!');
    } else {
      await db.user.update({ where: { id: shipperUser.id }, data: { status: 'ACTIVE' } });
      console.log('✅ Shipper exists, status set to ACTIVE: shipper@test.com / Test123!');
    }

    // Create carrier org & user
    let carrierOrg = await db.organization.findFirst({ where: { name: 'Test Carrier' } });
    if (!carrierOrg) {
      carrierOrg = await db.organization.create({
        data: {
          name: 'Test Carrier',
          type: 'CARRIER_COMPANY',
          contactEmail: 'carrier@test.com',
          contactPhone: '+251911000002',
          isVerified: true,
        },
      });
    }

    let carrierUser = await db.user.findUnique({ where: { email: 'carrier@test.com' } });
    if (!carrierUser) {
      carrierUser = await db.user.create({
        data: {
          email: 'carrier@test.com',
          passwordHash: password,
          firstName: 'Test',
          lastName: 'Carrier',
          phone: '+251911000002',
          role: 'CARRIER',
          status: 'ACTIVE',
          isActive: true,
          organizationId: carrierOrg.id,
        },
      });
      console.log('✅ Created carrier: carrier@test.com / Test123!');
    } else {
      await db.user.update({ where: { id: carrierUser.id }, data: { status: 'ACTIVE' } });
      console.log('✅ Carrier exists, status set to ACTIVE: carrier@test.com / Test123!');
    }

    console.log('\n✨ Done! Login at http://localhost:3000/login');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

createTestUsers();
