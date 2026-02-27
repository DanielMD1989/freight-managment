import { db } from "../lib/db";
async function main() {
  const shippers = await db.user.findMany({
    where: { role: "SHIPPER" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
    },
    take: 3,
  });
  console.log("Shipper users:", JSON.stringify(shippers, null, 2));
}
main()
  .catch(console.error)
  .finally(() => db.$disconnect());
