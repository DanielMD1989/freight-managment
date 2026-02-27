/**
 * Script to create test loads for DAT-style load board testing
 * Creates diverse loads with all fields populated
 */

import * as dotenv from "dotenv";
dotenv.config();

import { TruckType, LoadType, BookMode } from "@prisma/client";
import { db as prisma } from "../lib/db";

async function main() {
  console.log("🔍 Finding existing users and organizations...\n");

  // Find shipper and carrier organizations
  const shipperOrg = await prisma.organization.findFirst({
    where: { type: "SHIPPER" },
    include: { users: true },
  });

  const carrierOrg = await prisma.organization.findFirst({
    where: {
      OR: [{ type: "CARRIER_COMPANY" }, { type: "CARRIER_INDIVIDUAL" }],
    },
    include: { users: true },
  });

  if (!shipperOrg || !carrierOrg) {
    console.log("❌ No shipper or carrier organizations found!");
    console.log("Please register users first through the UI");
    return;
  }

  console.log(`✓ Found shipper: ${shipperOrg.name}`);
  console.log(`✓ Found carrier: ${carrierOrg.name}\n`);

  const shipperUser = shipperOrg.users[0];
  if (!shipperUser) {
    console.log("❌ No user found for shipper organization");
    return;
  }

  console.log("🚛 Creating test loads...\n");

  // Test Load 1: Short haul with all fields
  const load1 = await prisma.load.create({
    data: {
      status: "POSTED",
      postedAt: new Date(),
      // Location & Schedule
      pickupCity: "Addis Ababa",
      pickupAddress: "Bole District, Main Road",
      pickupDockHours: "8:00 AM - 5:00 PM",
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      appointmentRequired: true,
      deliveryCity: "Dire Dawa",
      deliveryAddress: "Industrial Zone",
      deliveryDockHours: "9:00 AM - 6:00 PM",
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      // Logistics
      tripKm: 515,
      dhToOriginKm: 25,
      dhAfterDeliveryKm: 30,
      originLat: 9.032,
      originLon: 38.7469,
      destinationLat: 9.6009,
      destinationLon: 41.8663,
      // Load Details
      truckType: TruckType.FLATBED,
      weight: 15000,
      volume: 45,
      cargoDescription:
        "Construction materials - Steel beams and concrete blocks",
      isFullLoad: true,
      fullPartial: LoadType.FULL,
      isFragile: false,
      requiresRefrigeration: false,
      lengthM: 12.5,
      casesCount: 50,
      // Pricing removed - rate negotiated off-platform
      bookMode: BookMode.REQUEST,
      // SPRINT 8: Market pricing (dtpReference, factorRating) removed per TRD
      // Privacy & Safety
      isAnonymous: false,
      shipperContactName: "Ahmed Hassan",
      shipperContactPhone: "+251911234567",
      safetyNotes:
        "Heavy load - requires proper securing. Route via main highway.",
      specialInstructions:
        "Call 30 minutes before arrival at delivery location",
      // Relations
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
    },
  });

  console.log(
    `✓ Created Load 1: ${load1.pickupCity} → ${load1.deliveryCity} (${load1.tripKm} km)`
  );

  // Test Load 2: Long haul refrigerated
  const load2 = await prisma.load.create({
    data: {
      status: "POSTED",
      postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Posted 2 hours ago
      pickupCity: "Hawassa",
      pickupAddress: "Lake Shore Export Center",
      pickupDockHours: "6:00 AM - 2:00 PM",
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      appointmentRequired: true,
      deliveryCity: "Mekelle",
      deliveryAddress: "Cold Storage Facility, Airport Road",
      deliveryDockHours: "24/7",
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      tripKm: 780,
      dhToOriginKm: 15,
      dhAfterDeliveryKm: 20,
      truckType: TruckType.REFRIGERATED,
      weight: 12000,
      volume: 60,
      cargoDescription: "Fresh fish and seafood - Temperature controlled",
      isFullLoad: true,
      fullPartial: LoadType.FULL,
      isFragile: true,
      requiresRefrigeration: true,
      lengthM: 11.0,
      casesCount: 150,
      bookMode: BookMode.INSTANT,
      // SPRINT 8: Market pricing removed per TRD
      isAnonymous: false,
      shipperContactName: "Tsegaye Abebe",
      shipperContactPhone: "+251922345678",
      safetyNotes:
        "CRITICAL: Maintain -18°C throughout journey. Check temperature every 2 hours.",
      specialInstructions: "Must arrive before 6 AM for unloading",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
    },
  });

  console.log(
    `✓ Created Load 2: ${load2.pickupCity} → ${load2.deliveryCity} (${load2.tripKm} km)`
  );

  // Test Load 3: Partial load
  const load3 = await prisma.load.create({
    data: {
      status: "POSTED",
      postedAt: new Date(Date.now() - 30 * 60 * 1000), // Posted 30 minutes ago
      pickupCity: "Bahir Dar",
      pickupAddress: "Tana Industrial Park",
      pickupDockHours: "8:00 AM - 4:00 PM",
      pickupDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      appointmentRequired: false,
      deliveryCity: "Gondar",
      deliveryAddress: "Commercial District, Building 5",
      deliveryDockHours: "9:00 AM - 5:00 PM",
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      tripKm: 180,
      dhToOriginKm: 10,
      dhAfterDeliveryKm: 5,
      truckType: TruckType.DRY_VAN,
      weight: 5000,
      volume: 20,
      cargoDescription: "Electronics and office equipment",
      isFullLoad: false,
      fullPartial: LoadType.PARTIAL,
      isFragile: true,
      requiresRefrigeration: false,
      lengthM: 4.5,
      casesCount: 25,
      bookMode: BookMode.REQUEST,
      // SPRINT 8: Market pricing removed per TRD
      isAnonymous: true, // Anonymous shipper
      shipperContactName: "Contact Hidden",
      shipperContactPhone: "+251933456789",
      safetyNotes: "Fragile electronics - handle with care",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
    },
  });

  console.log(
    `✓ Created Load 3: ${load3.pickupCity} → ${load3.deliveryCity} (${load3.tripKm} km) - PARTIAL`
  );

  // Test Load 4: Tanker load
  const load4 = await prisma.load.create({
    data: {
      status: "POSTED",
      postedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // Posted 5 hours ago
      pickupCity: "Adama",
      pickupAddress: "Fuel Depot, Highway Exit 12",
      pickupDockHours: "24/7",
      pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      appointmentRequired: true,
      deliveryCity: "Jimma",
      deliveryAddress: "Fuel Station Network - Main Terminal",
      deliveryDockHours: "6:00 AM - 10:00 PM",
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      tripKm: 335,
      dhToOriginKm: 20,
      dhAfterDeliveryKm: 25,
      truckType: TruckType.TANKER,
      weight: 25000,
      volume: 30,
      cargoDescription: "Diesel fuel - Hazmat certified drivers only",
      isFullLoad: true,
      fullPartial: LoadType.FULL,
      isFragile: false,
      requiresRefrigeration: false,
      lengthM: 10.0,
      bookMode: BookMode.INSTANT,
      // SPRINT 8: Market pricing removed per TRD
      isAnonymous: false,
      shipperContactName: "Mulugeta Tesfaye",
      shipperContactPhone: "+251944567890",
      safetyNotes:
        "HAZMAT: Diesel fuel transport. Driver must have hazmat certification. No smoking.",
      specialInstructions: "Follow designated fuel transport routes only",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
    },
  });

  console.log(
    `✓ Created Load 4: ${load4.pickupCity} → ${load4.deliveryCity} (${load4.tripKm} km) - TANKER`
  );

  // Test Load 5: Container load
  const load5 = await prisma.load.create({
    data: {
      status: "POSTED",
      postedAt: new Date(Date.now() - 10 * 60 * 1000), // Posted 10 minutes ago
      pickupCity: "Modjo",
      pickupAddress: "Dry Port Container Terminal",
      pickupDockHours: "8:00 AM - 8:00 PM",
      pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      appointmentRequired: true,
      deliveryCity: "Addis Ababa",
      deliveryAddress: "Megenagna Import Warehouse",
      deliveryDockHours: "7:00 AM - 6:00 PM",
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Same day
      tripKm: 75,
      truckType: TruckType.CONTAINER,
      weight: 18000,
      volume: 55,
      cargoDescription:
        "Import goods - Mixed retail merchandise in 40ft container",
      isFullLoad: true,
      fullPartial: LoadType.FULL,
      isFragile: false,
      requiresRefrigeration: false,
      lengthM: 12.2,
      casesCount: 200,
      bookMode: BookMode.REQUEST,
      // SPRINT 8: Market pricing removed per TRD
      isAnonymous: false,
      shipperContactName: "Sara Kebede",
      shipperContactPhone: "+251955678901",
      safetyNotes: "Standard container - inspect seals before departure",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
    },
  });

  console.log(
    `✓ Created Load 5: ${load5.pickupCity} → ${load5.deliveryCity} (${load5.tripKm} km) - CONTAINER`
  );

  // Create load events for all loads
  const loads = [load1, load2, load3, load4, load5];
  for (const load of loads) {
    await prisma.loadEvent.create({
      data: {
        loadId: load.id,
        eventType: "POSTED",
        description: "Load posted to marketplace",
        userId: shipperUser.id,
      },
    });
  }

  console.log("\n✅ Test loads created successfully!\n");
  console.log("📊 Summary:");
  console.log(`   - Total loads: ${loads.length}`);
  console.log(`   - Full loads: 4`);
  console.log(`   - Partial loads: 1`);
  console.log(`   - Instant book: 2`);
  console.log(`   - Request book: 3`);
  console.log(`   - Anonymous: 1`);
  console.log("\n🌐 Access the load board:");
  console.log("   - Shipper: /shipper/loads (My Loads)");
  console.log("   - Carrier: /carrier/loadboard (Find Loads)");
  console.log("\n🧪 Test Features:");
  console.log("   ✓ Sort by: Age, Pickup Date, Trip Distance, Rate, RPM, tRPM");
  console.log(
    "   ✓ Filter by: City, Truck Type, Load Type, Book Mode, Distance, Rate"
  );
  console.log("   ✓ All 20 DAT-style columns visible");
  console.log("   ✓ Pagination (20 per page)");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
