import { db } from '../lib/db';
async function main() {
  const shippers = await db.user.findMany({
    where: { role: 'SHIPPER' },
    include: { organization: { select: { name: true } } },
  });
  console.log('All shippers:');
  shippers.forEach(s => {
    const orgName = s.organization ? s.organization.name : 'none';
    console.log(`- ${s.email} | org: ${orgName}`);
  });
}
main().catch(console.error).finally(() => db.$disconnect());
