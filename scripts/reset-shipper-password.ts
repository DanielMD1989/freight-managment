import bcrypt from "bcryptjs";
import { db } from "../lib/db";

async function main() {
  const hash = await bcrypt.hash("shipper123", 12);
  const result = await db.user.updateMany({
    where: { email: "shipper1@testfreightet.com" },
    data: { passwordHash: hash },
  });
  console.log("Updated", result.count, "user(s)");
  console.log("Password reset to: shipper123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
