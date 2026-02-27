import { db } from "../lib/db";
async function main() {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
  console.log("Admin users:", JSON.stringify(admins, null, 2));
}
main()
  .catch(console.error)
  .finally(() => db.$disconnect());
