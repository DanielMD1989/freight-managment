import { db } from '../lib/db';

async function main() {
  console.log('Activating carrier user...');

  // Find the carrier user
  const user = await db.user.findFirst({
    where: { email: 'carrier1@testfreightet.com' },
    select: { id: true, email: true, status: true }
  });

  console.log('Current user status:', user);

  if (user) {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' }
    });
    console.log('User activated:', updated.email, updated.status);
  } else {
    console.log('User not found');
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
