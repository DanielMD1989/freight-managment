/**
 * Script to create test users for the freight management platform
 * Run with: npx tsx create-test-users.ts
 */

import { db } from './lib/db';
import { hashPassword } from './lib/auth';

async function createTestUsers() {
  console.log('Creating test users...');

  try {
    // Test password
    const password = 'Test123!';
    const passwordHash = await hashPassword(password);

    // Create Shipper user
    const shipper = await db.user.upsert({
      where: { email: 'shipper@test.com' },
      update: {},
      create: {
        email: 'shipper@test.com',
        passwordHash,
        firstName: 'John',
        lastName: 'Shipper',
        role: 'SHIPPER',
        phone: '+251911000001',
      },
    });
    console.log('✅ Created shipper:', shipper.email);

    // Create Carrier user
    const carrier = await db.user.upsert({
      where: { email: 'carrier@test.com' },
      update: {},
      create: {
        email: 'carrier@test.com',
        passwordHash,
        firstName: 'Jane',
        lastName: 'Carrier',
        role: 'CARRIER',
        phone: '+251911000002',
      },
    });
    console.log('✅ Created carrier:', carrier.email);

    // Create Admin user
    const admin = await db.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        phone: '+251911000003',
      },
    });
    console.log('✅ Created admin:', admin.email);

    console.log('\n✅ Test users created successfully!');
    console.log('\nLogin credentials:');
    console.log('==================');
    console.log('Shipper: shipper@test.com / Test123!');
    console.log('Carrier: carrier@test.com / Test123!');
    console.log('Admin: admin@test.com / Test123!');
    console.log('==================\n');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await db.$disconnect();
  }
}

createTestUsers();
