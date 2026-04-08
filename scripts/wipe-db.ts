/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Destructive: TRUNCATE every public-schema table in dev DB.
 *
 * Guards:
 *   - NODE_ENV must NOT be "production"
 *   - Must pass --yes-i-know-this-deletes-everything flag
 *
 * Usage:
 *   npx tsx scripts/wipe-db.ts --yes-i-know-this-deletes-everything
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to wipe in NODE_ENV=production");
    process.exit(1);
  }
  if (!process.argv.includes("--yes-i-know-this-deletes-everything")) {
    console.error(
      "Refusing to wipe without --yes-i-know-this-deletes-everything"
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma_%'`
  );
  if (tables.length === 0) {
    console.log("No tables found in public schema.");
    await prisma.$disconnect();
    return;
  }

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  console.log(`Truncating ${tables.length} tables...`);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`
  );
  console.log("OK: all tables truncated.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
