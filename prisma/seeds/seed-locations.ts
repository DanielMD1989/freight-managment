/**
 * Seed Script: Ethiopian Locations
 *
 * Populates the EthiopianLocation table with 70+ cities and towns
 * for the freight management platform.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx prisma/seeds/seed-locations.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  ethiopianLocations,
  getTotalLocations,
  getUniqueRegions,
} from "./ethiopian-locations";

// Initialize Prisma with PostgreSQL adapter
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

async function main() {
  console.log("🌍 Starting Ethiopian Locations Seed...\n");

  // Clear existing locations (optional - comment out if you want to preserve existing data)
  console.log("🗑️  Clearing existing locations...");
  const deletedCount = await prisma.ethiopianLocation.deleteMany({});
  console.log(`   Deleted ${deletedCount.count} existing locations\n`);

  console.log(`📊 Total locations to seed: ${getTotalLocations()}`);
  console.log(`📍 Regions covered: ${getUniqueRegions().length}\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors: { name: string; error: string }[] = [];

  // Seed each location
  for (const location of ethiopianLocations) {
    try {
      await prisma.ethiopianLocation.create({
        data: {
          name: location.name,
          nameEthiopic: location.nameEthiopic,
          region: location.region,
          zone: location.zone,
          latitude: location.latitude,
          longitude: location.longitude,
          type: location.type,
          population: location.population,
          aliases: location.aliases || [],
          isActive: true,
        },
      });

      successCount++;
      process.stdout.write(
        `\r✅ Seeded: ${successCount}/${getTotalLocations()} locations`
      );
    } catch (error) {
      errorCount++;
      errors.push({
        name: location.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("\n");

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📈 SEEDING SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Successfully seeded: ${successCount} locations`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log("");

  if (errors.length > 0) {
    console.log("❌ ERROR DETAILS:");
    errors.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
    console.log("");
  }

  // Regional breakdown
  console.log("📍 REGIONAL BREAKDOWN:");
  const regions = getUniqueRegions();
  for (const region of regions.sort()) {
    const count = await prisma.ethiopianLocation.count({
      where: { region },
    });
    console.log(`   ${region.padEnd(25)} : ${count} locations`);
  }
  console.log("");

  // Sample queries
  console.log("🔍 SAMPLE QUERIES:");
  const totalCount = await prisma.ethiopianLocation.count();
  console.log(`   Total locations in DB: ${totalCount}`);

  const cities = await prisma.ethiopianLocation.count({
    where: { type: "CITY" },
  });
  console.log(`   Cities: ${cities}`);

  const towns = await prisma.ethiopianLocation.count({
    where: { type: "TOWN" },
  });
  console.log(`   Towns: ${towns}`);
  console.log("");

  // Show some example locations
  console.log("📌 SAMPLE LOCATIONS:");
  const samples = await prisma.ethiopianLocation.findMany({
    take: 5,
    orderBy: { population: "desc" },
    select: {
      name: true,
      nameEthiopic: true,
      region: true,
      latitude: true,
      longitude: true,
      population: true,
    },
  });

  samples.forEach((loc) => {
    console.log(
      `   ${loc.name.padEnd(20)} (${loc.nameEthiopic || "N/A".padEnd(10)}) - ${loc.region.padEnd(20)} [${loc.latitude}, ${loc.longitude}] Pop: ${loc.population?.toLocaleString() || "N/A"}`
    );
  });
  console.log("");

  console.log("✨ Ethiopian Locations seeding completed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error during seeding:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
