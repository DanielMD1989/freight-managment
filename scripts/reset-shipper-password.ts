import { db } from '../lib/db';
import * as bcrypt from 'bcryptjs';

async function main() {
  const newPassword = await bcrypt.hash('test123', 10);
  const user = await db.user.update({
    where: { email: 'shipper1@testfreightet.com' },
    data: { passwordHash: newPassword },
  });
  console.log('Password reset for:', user.email);
  console.log('New password: test123');
}
main().catch(console.error).finally(() => db.$disconnect());
