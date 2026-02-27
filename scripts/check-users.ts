import { db } from "../lib/db";

async function main() {
  const users = await db.user.findMany({
    where: { email: { contains: "testfreightet" } },
    select: { id: true, email: true, status: true, role: true },
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
