/**
 * Reset password for test shipper
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2] || 'shipper1@testfreightet.com';
  const newPassword = 'test123';

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hashedPassword }
  });

  console.log('Password reset for:', user.email);
  console.log('New password: test123');

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
