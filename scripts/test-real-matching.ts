/**
 * Test Real-World Freight Matching Logic
 *
 * Verifies:
 * 1. Truck type is a HARD FILTER (incompatible = excluded)
 * 2. DH-O > 200km = excluded
 * 3. Scoring: Route 30%, DH-O 30%, Capacity 20%, Time 20%
 */

import { db } from "../lib/db";
import { findMatchingTrucks } from "../lib/matchingEngine";

async function main() {
  console.log("=".repeat(70));
  console.log("REAL-WORLD FREIGHT MATCHING TEST");
  console.log("=".repeat(70));
  console.log("\nRules:");
  console.log(
    "  1. Incompatible truck types are EXCLUDED (not just low score)"
  );
  console.log("  2. DH-O > 200km is EXCLUDED");
  console.log("  3. Scoring: Route 30% + DH-O 30% + Capacity 20% + Time 20%");
  console.log("=".repeat(70));

  // Get all loads
  const loads = await db.load.findMany({
    where: { status: "POSTED" },
    select: {
      id: true,
      pickupCity: true,
      deliveryCity: true,
      truckType: true,
      weight: true,
      pickupDate: true,
    },
    orderBy: { pickupCity: "asc" },
  });

  // Get all active truck postings
  const truckPostings = await db.truckPosting.findMany({
    where: { status: "ACTIVE" },
    include: {
      truck: {
        select: { truckType: true, capacity: true, licensePlate: true },
      },
      originCity: { select: { name: true } },
      destinationCity: { select: { name: true } },
    },
  });

  console.log(`\n📦 LOADS: ${loads.length} total`);
  loads.forEach((l) => {
    console.log(
      `   ${l.pickupCity} → ${l.deliveryCity} | ${l.truckType} | ${Number(l.weight) / 1000}T`
    );
  });

  console.log(`\n🚛 TRUCKS: ${truckPostings.length} total`);
  truckPostings.forEach((t) => {
    console.log(
      `   ${t.truck?.licensePlate} in ${t.originCity?.name} | ${t.truck?.truckType} | ${Number(t.truck?.capacity) / 1000}T`
    );
  });

  // Prepare truck criteria
  const trucksCriteria = truckPostings.map((t) => ({
    id: t.id,
    currentCity: t.originCity?.name || "",
    destinationCity: t.destinationCity?.name || null,
    availableDate: t.availableFrom,
    truckType: t.truck?.truckType || "",
    maxWeight: t.truck?.capacity ? Number(t.truck.capacity) : null,
    lengthM: t.availableLength ? Number(t.availableLength) : null,
    fullPartial: t.fullPartial,
    licensePlate: t.truck?.licensePlate,
  }));

  console.log("\n" + "=".repeat(70));
  console.log(
    "MATCHING RESULTS (minScore=0 to show all that pass hard filters)"
  );
  console.log("=".repeat(70));

  for (const load of loads) {
    console.log(
      `\n📦 Load: ${load.pickupCity} → ${load.deliveryCity} (${load.truckType}, ${Number(load.weight) / 1000}T)`
    );
    console.log("-".repeat(60));

    const loadCriteria = {
      pickupCity: load.pickupCity || "",
      deliveryCity: load.deliveryCity || "",
      pickupDate: load.pickupDate,
      truckType: load.truckType || "",
      weight: load.weight ? Number(load.weight) : null,
    };

    // Find matches with minScore=0 to see all that pass hard filters
    const matches = findMatchingTrucks(loadCriteria, trucksCriteria, 0);

    if (matches.length === 0) {
      console.log("   ❌ No matching trucks (all filtered out)");
    } else {
      matches.forEach((m) => {
        const emoji =
          m.matchScore >= 80 ? "✅" : m.matchScore >= 60 ? "🔶" : "⚠️";
        console.log(
          `   ${emoji} ${m.licensePlate} (${m.truckType}) in ${m.currentCity}`
        );
        console.log(`      Score: ${m.matchScore} | DH-O: ${m.dhOriginKm}km`);
        console.log(`      ${m.matchReasons.slice(0, 3).join(" | ")}`);
      });
    }

    // Show which trucks were filtered out
    const matchedIds = new Set(matches.map((m) => m.id));
    const filtered = trucksCriteria.filter((t) => !matchedIds.has(t.id));
    if (filtered.length > 0) {
      console.log(`   --- Filtered out (${filtered.length} trucks) ---`);
      filtered.forEach((t) => {
        const reason =
          t.truckType !== load.truckType &&
          !isCompatibleType(load.truckType || "", t.truckType)
            ? "Incompatible type"
            : "DH-O too far";
        console.log(
          `   ❌ ${t.licensePlate} (${t.truckType}) in ${t.currentCity} - ${reason}`
        );
      });
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(70));

  // Test specific expected results
  console.log("\n📋 Expected Results Check:");

  // Load: Addis Ababa → Djibouti, DRY_VAN
  const dryVanLoad = loads.find(
    (l) =>
      l.pickupCity === "Addis Ababa" &&
      l.deliveryCity === "Djibouti" &&
      l.truckType === "DRY_VAN"
  );
  if (dryVanLoad) {
    const matches = findMatchingTrucks(
      {
        pickupCity: dryVanLoad.pickupCity || "",
        deliveryCity: dryVanLoad.deliveryCity || "",
        truckType: dryVanLoad.truckType || "",
        weight: Number(dryVanLoad.weight),
      },
      trucksCriteria,
      0
    );

    const hasAddisaDryVan = matches.some((m) => m.licensePlate === "AA-DV-001");
    const hasAddisaFlatbed = matches.some(
      (m) => m.licensePlate === "AA-FB-002"
    );
    const hasAddisaRefrigerated = matches.some(
      (m) => m.licensePlate === "AA-RF-003"
    );
    const hasDireDawaDryVan = matches.some(
      (m) => m.licensePlate === "DD-DV-001"
    );

    console.log(`\n   Addis→Djibouti DRY_VAN:`);
    console.log(
      `   ✓ AA-DV-001 (DRY_VAN in Addis) included: ${hasAddisaDryVan ? "✅ YES" : "❌ NO"}`
    );
    console.log(
      `   ✓ AA-FB-002 (FLATBED in Addis, compatible) included: ${hasAddisaFlatbed ? "✅ YES" : "❌ NO"}`
    );
    console.log(
      `   ✓ AA-RF-003 (REFRIGERATED, incompatible) excluded: ${!hasAddisaRefrigerated ? "✅ YES" : "❌ NO"}`
    );
    console.log(
      `   ✓ DD-DV-001 (DRY_VAN in Dire Dawa, 450km) excluded: ${!hasDireDawaDryVan ? "✅ YES" : "❌ NO"}`
    );
  }

  // Load: Dire Dawa → Djibouti, DRY_VAN
  const direDawaLoad = loads.find(
    (l) =>
      l.pickupCity === "Dire Dawa" &&
      l.deliveryCity === "Djibouti" &&
      l.truckType === "DRY_VAN"
  );
  if (direDawaLoad) {
    const matches = findMatchingTrucks(
      {
        pickupCity: direDawaLoad.pickupCity || "",
        deliveryCity: direDawaLoad.deliveryCity || "",
        truckType: direDawaLoad.truckType || "",
        weight: Number(direDawaLoad.weight),
      },
      trucksCriteria,
      0
    );

    const hasDireDawaDryVan = matches.some(
      (m) => m.licensePlate === "DD-DV-001"
    );
    const hasAddisaDryVan = matches.some((m) => m.licensePlate === "AA-DV-001");

    console.log(`\n   Dire Dawa→Djibouti DRY_VAN:`);
    console.log(
      `   ✓ DD-DV-001 (DRY_VAN in Dire Dawa) included: ${hasDireDawaDryVan ? "✅ YES" : "❌ NO"}`
    );
    console.log(
      `   ✓ AA-DV-001 (DRY_VAN in Addis, 450km) excluded: ${!hasAddisaDryVan ? "✅ YES" : "❌ NO"}`
    );
  }

  console.log("\n" + "=".repeat(70));
  await db.$disconnect();
}

// Helper to check if truck types are compatible
function isCompatibleType(loadType: string, truckType: string): boolean {
  const generalTypes = ["DRY_VAN", "FLATBED", "CONTAINER", "VAN"];
  const coldTypes = ["REFRIGERATED", "REEFER"];

  const loadNorm = loadType.toUpperCase();
  const truckNorm = truckType.toUpperCase();

  if (generalTypes.includes(loadNorm) && generalTypes.includes(truckNorm))
    return true;
  if (coldTypes.includes(loadNorm) && coldTypes.includes(truckNorm))
    return true;
  return false;
}

main().catch(console.error);
