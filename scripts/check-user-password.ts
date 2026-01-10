import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUser() {
  const email = 'daniel.mulugeta1989@gmail.com';

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      isActive: true,
      passwordHash: true,
      organizationId: true
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('User found:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  Name:', user.firstName, user.lastName);
  console.log('  Role:', user.role);
  console.log('  Status:', user.status);
  console.log('  isActive:', user.isActive);
  console.log('  organizationId:', user.organizationId);
  console.log('  passwordHash length:', user.passwordHash?.length);
  console.log('  passwordHash starts with $2:', user.passwordHash?.startsWith('$2'));

  // Test some common passwords
  const testPasswords = ['password', 'Password123', 'admin', 'test123', 'Admin123!'];

  console.log('\nTesting common passwords:');
  for (const pwd of testPasswords) {
    const match = await bcrypt.compare(pwd, user.passwordHash);
    if (match) {
      console.log(`  ✓ Password matches: "${pwd}"`);
    }
  }

  await prisma.$disconnect();
}

checkUser().catch(console.error);
