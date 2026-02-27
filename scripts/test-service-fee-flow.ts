/**
 * Test Service Fee Flow
 *
 * Tests:
 * 1. Corridor matching
 * 2. Service fee calculation
 * 3. Fee reservation (simulated)
 * 4. Fee deduction (simulated)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Decimal } from "decimal.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧪 Testing Service Fee Flow\n");

  // Test 1: Find corridor
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("TEST 1: Corridor Matching");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  const originRegion = "Addis Ababa";
  const destinationRegion = "Dire Dawa";

  console.log(`Looking for corridor: ${originRegion} → ${destinationRegion}\n`);

  // Check for exact match
  let corridor = await prisma.corridor.findFirst({
    where: {
      originRegion,
      destinationRegion,
      isActive: true,
    },
  });

  if (!corridor) {
    // Check for bidirectional corridor
    corridor = await prisma.corridor.findFirst({
      where: {
        direction: "BIDIRECTIONAL",
        isActive: true,
        OR: [
          { originRegion, destinationRegion },
          { originRegion: destinationRegion, destinationRegion: originRegion },
        ],
      },
    });
  }

  if (corridor) {
    console.log(`✅ Found corridor: ${corridor.name}`);
    console.log(`   Distance: ${corridor.distanceKm} km`);
    console.log(`   Price/km: ${corridor.pricePerKm} ETB`);
    console.log(`   Direction: ${corridor.direction}`);
    console.log();
  } else {
    console.log("❌ No matching corridor found\n");
  }

  // Test 2: Calculate service fee
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("TEST 2: Service Fee Calculation");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  if (corridor) {
    const distanceKm = Number(corridor.distanceKm);
    const pricePerKm = Number(corridor.pricePerKm);
    const baseFee = distanceKm * pricePerKm;
    let finalFee = baseFee;
    let discount = 0;

    if (corridor.promoFlag && corridor.promoDiscountPct) {
      discount = baseFee * (Number(corridor.promoDiscountPct) / 100);
      finalFee = baseFee - discount;
    }

    console.log("Fee Calculation:");
    console.log(
      `   Base Fee: ${distanceKm} km × ${pricePerKm} ETB = ${baseFee.toFixed(2)} ETB`
    );
    if (discount > 0) {
      console.log(
        `   Promo Discount: -${discount.toFixed(2)} ETB (${corridor.promoDiscountPct}%)`
      );
    }
    console.log(`   Final Fee: ${finalFee.toFixed(2)} ETB`);
    console.log();
  }

  // Test 3: Verify platform revenue account exists
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("TEST 3: Platform Revenue Account");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  const platformAccount = await prisma.financialAccount.findFirst({
    where: { accountType: "PLATFORM_REVENUE" },
  });

  if (platformAccount) {
    console.log(`✅ Platform revenue account exists`);
    console.log(`   ID: ${platformAccount.id}`);
    console.log(
      `   Balance: ${platformAccount.balance} ${platformAccount.currency}`
    );
    console.log();
  } else {
    console.log("❌ Platform revenue account missing\n");
  }

  // Test 4: Check shipper wallets
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("TEST 4: Shipper Wallets");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  const shipperWallets = await prisma.financialAccount.findMany({
    where: { accountType: "SHIPPER_WALLET" },
    include: { organization: { select: { name: true } } },
  });

  console.log(`Found ${shipperWallets.length} shipper wallets:`);
  shipperWallets.forEach((w) => {
    console.log(`   ${w.organization?.name}: ${w.balance} ${w.currency}`);
  });
  console.log();

  // Test 5: Check carrier wallets
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("TEST 5: Carrier Wallets");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  const carrierWallets = await prisma.financialAccount.findMany({
    where: { accountType: "CARRIER_WALLET" },
    include: { organization: { select: { name: true } } },
  });

  if (carrierWallets.length > 0) {
    console.log(`Found ${carrierWallets.length} carrier wallets:`);
    carrierWallets.forEach((w) => {
      console.log(`   ${w.organization?.name}: ${w.balance} ${w.currency}`);
    });
  } else {
    console.log("⚠️  No carrier wallets found");
    console.log("   Carriers need wallets for receiving payments");
  }
  console.log();

  // Test 6: Simulate service fee reservation
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("TEST 6: Service Fee Flow Simulation");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  if (corridor && platformAccount && shipperWallets.length > 0) {
    const testShipperWallet = shipperWallets[0];
    const serviceFee =
      Number(corridor.distanceKm) * Number(corridor.pricePerKm);

    console.log("Simulated Service Fee Flow:");
    console.log(`   1. Load assigned on corridor: ${corridor.name}`);
    console.log(`   2. Service fee calculated: ${serviceFee.toFixed(2)} ETB`);
    console.log(
      `   3. Fee reserved from shipper wallet: ${testShipperWallet.organization?.name}`
    );
    console.log(`   4. Load delivered and completed`);
    console.log(`   5. Fee deducted to platform revenue account`);
    console.log();

    // Check if service fee library exists
    const loadWithCorridor = await prisma.load.findFirst({
      where: { corridorId: corridor.id },
    });

    if (loadWithCorridor) {
      console.log(
        `Found load with corridor: ${loadWithCorridor.id.slice(0, 8)}...`
      );
      console.log(`   Service Fee: ${loadWithCorridor.serviceFeeEtb} ETB`);
      console.log(`   Fee Status: ${loadWithCorridor.serviceFeeStatus}`);
    } else {
      console.log("No loads linked to this corridor yet");
      console.log(
        "(Loads will be linked when assigned through the corridor system)"
      );
    }
  } else {
    console.log("⚠️  Cannot simulate - missing components");
    if (!corridor) console.log("   - No corridor");
    if (!platformAccount) console.log("   - No platform revenue account");
    if (shipperWallets.length === 0) console.log("   - No shipper wallets");
  }

  console.log("\n✅ Service Fee Flow Test Complete\n");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
