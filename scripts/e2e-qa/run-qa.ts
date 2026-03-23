/**
 * Real-World E2E QA — Full Platform Validation
 *
 * Wipes the database, seeds from scratch, and runs every critical API flow
 * as a real user would on Day 1 of the platform.
 *
 * Usage:
 *   npx tsx scripts/e2e-qa/run-qa.ts
 *
 * Requires: Next.js dev server running on localhost:3000
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://danieldamitew@localhost:5432/freight_db?schema=public";

const pool = new Pool({ connectionString: DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CONTEXT_PATH = path.join(__dirname, ".qa-context.json");

// ---------------------------------------------------------------------------
// Shared state (written to .qa-context.json at the end)
// ---------------------------------------------------------------------------
interface QAContext {
  superAdminToken: string;
  superAdminUserId: string;
  adminToken: string;
  adminUserId: string;
  dispatcherToken: string;
  dispatcherUserId: string;
  shipperToken: string;
  shipperUserId: string;
  shipperOrgId: string;
  carrierToken: string;
  carrierUserId: string;
  carrierOrgId: string;
  truckId: string;
  truckPostingId: string;
  gpsDeviceId: string;
  loadId: string;
  load2Id: string;
  tripId: string;
  trip2Id: string;
  truckRequestId: string;
  addisLocationId: string;
  credentials: Record<string, { email: string; password: string }>;
}

const ctx: Partial<QAContext> = {
  credentials: {
    superadmin: { email: "superadmin@test.com", password: "Test123!" },
    admin: { email: "admin@freightflow.et", password: "Admin@2024!" },
    dispatcher: { email: "dispatcher@test.et", password: "Dispatch@2024!" },
    shipper: { email: "shipper@addisfreight.et", password: "Shipper@2024!" },
    carrier: {
      email: "carrier@tigraytransport.et",
      password: "Carrier@2024!",
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function header(phase: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${phase}`);
  console.log(`${"═".repeat(60)}`);
}

async function test(
  id: string,
  name: string,
  fn: () => Promise<void>
): Promise<boolean> {
  try {
    await fn();
    console.log(`  ✓ PASS — ${id}: ${name}`);
    passCount++;
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ FAIL — ${id}: ${name}`);
    console.error(`    ${msg}`);
    failCount++;
    return false;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function api(
  method: string,
  urlPath: string,
  opts: {
    token?: string;
    body?: Record<string, unknown>;
    formData?: FormData;
    expectStatus?: number | number[];
  } = {}
): Promise<{ status: number; data: Record<string, unknown> }> {
  const url = `${BASE_URL}${urlPath}`;
  const headers: Record<string, string> = {
    "x-client-type": "mobile",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const fetchOpts: RequestInit = { method, headers };

  if (opts.formData) {
    fetchOpts.body = opts.formData;
  } else if (opts.body) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, fetchOpts);
  let data: Record<string, unknown>;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text };
  }

  const expected = opts.expectStatus
    ? Array.isArray(opts.expectStatus)
      ? opts.expectStatus
      : [opts.expectStatus]
    : undefined;

  if (expected && !expected.includes(res.status)) {
    throw new Error(
      `Expected ${expected.join("|")} but got ${res.status}: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  return { status: res.status, data };
}

async function login(
  email: string,
  password: string
): Promise<{ token: string; user: Record<string, unknown> }> {
  const { data } = await api("POST", "/api/auth/login", {
    body: { email, password },
    expectStatus: 200,
  });
  assert(!!data.sessionToken, `No sessionToken for ${email}`);
  return {
    token: data.sessionToken as string,
    user: data.user as Record<string, unknown>,
  };
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function dayAfterTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// PHASE 0 — Database Reset & Super Admin Seed
// ---------------------------------------------------------------------------
async function phase0() {
  header("PHASE 0: Database Reset & Super Admin Seed");

  await test("0.1", "Truncate all tables", async () => {
    await pool.query(`
      TRUNCATE TABLE
        "gps_positions", "load_events", "notifications", "audit_logs",
        "journal_lines", "journal_entries", "wallet_deposits",
        "match_proposals", "load_requests", "truck_requests", "load_escalations",
        "trip_pods", "trips", "loads", "truck_postings", "truck_documents",
        "company_documents", "documents", "trucks", "gps_devices",
        "saved_searches", "automation_rule_executions", "automation_rules",
        "security_events", "invitations", "device_tokens", "user_mfa",
        "password_reset_tokens", "sessions", "disputes", "withdrawal_requests",
        "financial_accounts",
        "users", "organizations", "corridors"
      CASCADE;
    `);
  });

  let superAdminId = "";

  await test("0.2", "Seed super admin", async () => {
    const hash = await bcrypt.hash("Test123!", 10);
    const user = await prisma.user.create({
      data: {
        email: "superadmin@test.com",
        passwordHash: hash,
        firstName: "Super",
        lastName: "Admin",
        phone: "+251900000000",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isActive: true,
      },
    });
    superAdminId = user.id;
    ctx.superAdminUserId = user.id;
  });

  await test("0.3", "Seed corridors", async () => {
    const corridors = [
      {
        name: "Addis Ababa - Dire Dawa",
        originRegion: "Addis Ababa",
        destinationRegion: "Dire Dawa",
        distanceKm: 453,
        pricePerKm: 2.5,
        carrierPricePerKm: 2.5,
      },
      {
        name: "Addis Ababa - Djibouti",
        originRegion: "Addis Ababa",
        destinationRegion: "Djibouti",
        distanceKm: 910,
        pricePerKm: 3.0,
        carrierPricePerKm: 3.0,
      },
      {
        name: "Addis Ababa - Mekelle",
        originRegion: "Addis Ababa",
        destinationRegion: "Mekelle",
        distanceKm: 783,
        pricePerKm: 2.5,
        carrierPricePerKm: 2.5,
      },
      {
        name: "Addis Ababa - Hawassa",
        originRegion: "Addis Ababa",
        destinationRegion: "Hawassa",
        distanceKm: 275,
        pricePerKm: 2.0,
        carrierPricePerKm: 1.8,
      },
    ];

    for (const c of corridors) {
      await prisma.corridor.create({
        data: {
          name: c.name,
          originRegion: c.originRegion,
          destinationRegion: c.destinationRegion,
          distanceKm: c.distanceKm,
          pricePerKm: c.pricePerKm,
          shipperPricePerKm: c.pricePerKm,
          carrierPricePerKm: c.carrierPricePerKm,
          direction: "BIDIRECTIONAL",
          isActive: true,
          createdById: superAdminId,
        },
      });
    }
  });

  await test("0.4", "Verify clean state", async () => {
    const users = await pool.query("SELECT COUNT(*)::int AS c FROM users");
    assert(users.rows[0].c === 1, `Expected 1 user, got ${users.rows[0].c}`);

    const orgs = await pool.query(
      "SELECT COUNT(*)::int AS c FROM organizations"
    );
    assert(orgs.rows[0].c === 0, `Expected 0 orgs, got ${orgs.rows[0].c}`);

    const corr = await pool.query("SELECT COUNT(*)::int AS c FROM corridors");
    assert(corr.rows[0].c === 4, `Expected 4 corridors, got ${corr.rows[0].c}`);

    const locs = await pool.query(
      "SELECT COUNT(*)::int AS c FROM ethiopian_locations"
    );
    assert(locs.rows[0].c > 0, `No ethiopian_locations — run seed first`);
  });
}

// ---------------------------------------------------------------------------
// PHASE 1 — Super Admin Login + Create Admin
// ---------------------------------------------------------------------------
async function phase1() {
  header("PHASE 1: Super Admin Login + Create Admin");

  await test("1.1", "Super Admin Login", async () => {
    const { token, user } = await login("superadmin@test.com", "Test123!");
    assert(user.role === "SUPER_ADMIN", `Role is ${user.role}`);
    ctx.superAdminToken = token;
  });

  await test("1.2", "Create Admin User", async () => {
    const { data } = await api("POST", "/api/admin/users", {
      token: ctx.superAdminToken,
      body: {
        firstName: "Abebe",
        lastName: "Girma",
        email: "admin@freightflow.et",
        password: "Admin@2024!",
        phone: "+251911000001",
      },
      expectStatus: 201,
    });
    const user = data.user as Record<string, unknown>;
    assert(user.role === "ADMIN", `Role is ${user.role}`);
    ctx.adminUserId = user.id as string;
  });

  await test("1.3", "Verify Audit Log", async () => {
    const { data } = await api("GET", "/api/admin/audit-logs", {
      token: ctx.superAdminToken,
      expectStatus: 200,
    });
    // Audit logs response could be { logs: [...] } or { auditLogs: [...] }
    const logs = (data.logs || data.auditLogs || data) as unknown[];
    assert(
      Array.isArray(logs) && logs.length > 0,
      "No audit log entries found"
    );
  });
}

// ---------------------------------------------------------------------------
// PHASE 2 — Admin Login + Dispatcher Setup
// ---------------------------------------------------------------------------
async function phase2() {
  header("PHASE 2: Admin Login + Dispatcher Setup");

  await test("2.1", "Admin Login", async () => {
    const { token, user } = await login("admin@freightflow.et", "Admin@2024!");
    assert(user.role === "ADMIN", `Role is ${user.role}`);
    ctx.adminToken = token;
  });

  await test("2.2", "Admin Cannot Create Admin (permission)", async () => {
    await api("POST", "/api/admin/users", {
      token: ctx.adminToken,
      body: {
        firstName: "X",
        lastName: "Y",
        email: "x@y.com",
        password: "Test123!",
      },
      expectStatus: 403,
    });
  });

  await test("2.3", "Register + Activate Dispatcher", async () => {
    // Register
    const { data: regData } = await api("POST", "/api/auth/register", {
      body: {
        email: "dispatcher@test.et",
        password: "Dispatch@2024!",
        firstName: "Dawit",
        lastName: "Teshome",
        role: "DISPATCHER",
      },
      expectStatus: 201,
    });
    const regUser = regData.user as Record<string, unknown>;
    assert(regUser.status === "REGISTERED", `Status is ${regUser.status}`);
    ctx.dispatcherUserId = regUser.id as string;

    // Admin activates
    await api("POST", `/api/admin/users/${ctx.dispatcherUserId}/verify`, {
      token: ctx.adminToken,
      body: { status: "ACTIVE" },
      expectStatus: 200,
    });

    // Login
    const { token } = await login("dispatcher@test.et", "Dispatch@2024!");
    ctx.dispatcherToken = token;
  });
}

// ---------------------------------------------------------------------------
// PHASE 3 — Shipper Registration & Approval
// ---------------------------------------------------------------------------
async function phase3() {
  header("PHASE 3: Shipper Registration & Approval");

  await test("3.1", "Register Shipper", async () => {
    const { data } = await api("POST", "/api/auth/register", {
      body: {
        email: "shipper@addisfreight.et",
        password: "Shipper@2024!",
        firstName: "Meron",
        lastName: "Haile",
        role: "SHIPPER",
        companyName: "Addis Freight Solutions",
        taxId: "ET123456789",
      },
      expectStatus: 201,
    });
    const user = data.user as Record<string, unknown>;
    assert(!!user.organizationId, "No organizationId on shipper");
    ctx.shipperUserId = user.id as string;
    ctx.shipperOrgId = user.organizationId as string;
    ctx.shipperToken = data.sessionToken as string;

    // DB verify: FinancialAccount should exist
    const fa = await prisma.financialAccount.findFirst({
      where: { organizationId: ctx.shipperOrgId },
    });
    assert(!!fa, "FinancialAccount not created for shipper org");
  });

  await test("3.2", "Admin Sets User to PENDING_VERIFICATION", async () => {
    await api("POST", `/api/admin/users/${ctx.shipperUserId}/verify`, {
      token: ctx.adminToken,
      body: { status: "PENDING_VERIFICATION" },
      expectStatus: 200,
    });
  });

  await test("3.3", "Admin Approves Shipper Org", async () => {
    const { data } = await api(
      "POST",
      `/api/admin/organizations/${ctx.shipperOrgId}/verify`,
      {
        token: ctx.adminToken,
        expectStatus: 200,
      }
    );
    const org = data.organization as Record<string, unknown>;
    assert(org.isVerified === true, `isVerified is ${org.isVerified}`);
    assert(
      org.verificationStatus === "APPROVED",
      `verificationStatus is ${org.verificationStatus}`
    );

    // Check user is now ACTIVE
    const dbUser = await prisma.user.findUnique({
      where: { id: ctx.shipperUserId },
    });
    assert(dbUser?.status === "ACTIVE", `User status is ${dbUser?.status}`);
  });

  await test("3.4", "Shipper Re-Login (fresh ACTIVE token)", async () => {
    const { token, user } = await login(
      "shipper@addisfreight.et",
      "Shipper@2024!"
    );
    ctx.shipperToken = token;
    assert(
      (user as Record<string, unknown>).role === "SHIPPER",
      "Wrong role on re-login"
    );
  });

  await test("3.5", "Admin Tops Up Shipper Wallet", async () => {
    const { data } = await api(
      "POST",
      `/api/admin/users/${ctx.shipperUserId}/wallet/topup`,
      {
        token: ctx.adminToken,
        body: { amount: 50000, paymentMethod: "MANUAL", notes: "QA test seed" },
        expectStatus: 200,
      }
    );
    // Response has updatedBalance or newBalance
    const balance = (data.updatedBalance ?? data.newBalance) as number;
    assert(balance === 50000, `Balance is ${balance}, expected 50000`);
  });

  await test("3.6", "Verify Transaction Sign (M31 fix)", async () => {
    const { data } = await api("GET", "/api/wallet/transactions", {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const txns = data.transactions as Array<Record<string, unknown>>;
    assert(txns.length > 0, "No transactions found");
    const deposit = txns.find(
      (t) => t.transactionType === "DEPOSIT" || t.type === "DEPOSIT"
    );
    assert(!!deposit, "No DEPOSIT transaction found");
    const amt = deposit!.amount as number;
    assert(
      amt > 0,
      `DEPOSIT amount is ${amt} — should be positive (M31 fix broken)`
    );
  });
}

// ---------------------------------------------------------------------------
// PHASE 4 — Carrier Registration, Truck, GPS, Posting
// ---------------------------------------------------------------------------
async function phase4() {
  header("PHASE 4: Carrier Registration, Truck, GPS, Posting");

  await test("4.1", "Register Carrier", async () => {
    const { data } = await api("POST", "/api/auth/register", {
      body: {
        email: "carrier@tigraytransport.et",
        password: "Carrier@2024!",
        firstName: "Hailu",
        lastName: "Gebre",
        role: "CARRIER",
        companyName: "Tigray Transport PLC",
        carrierType: "CARRIER_COMPANY",
        taxId: "ET987654321",
      },
      expectStatus: 201,
    });
    const user = data.user as Record<string, unknown>;
    ctx.carrierUserId = user.id as string;
    ctx.carrierOrgId = user.organizationId as string;
    assert(!!ctx.carrierOrgId, "No organizationId on carrier");
  });

  await test("4.2", "Admin Activates Carrier", async () => {
    // Set to PENDING_VERIFICATION first
    await api("POST", `/api/admin/users/${ctx.carrierUserId}/verify`, {
      token: ctx.adminToken,
      body: { status: "PENDING_VERIFICATION" },
      expectStatus: 200,
    });
    // Verify org
    await api("POST", `/api/admin/organizations/${ctx.carrierOrgId}/verify`, {
      token: ctx.adminToken,
      expectStatus: 200,
    });
  });

  await test("4.3", "Carrier Re-Login", async () => {
    const { token } = await login(
      "carrier@tigraytransport.et",
      "Carrier@2024!"
    );
    ctx.carrierToken = token;
  });

  await test("4.4", "Admin Tops Up Carrier Wallet", async () => {
    const { data } = await api(
      "POST",
      `/api/admin/users/${ctx.carrierUserId}/wallet/topup`,
      {
        token: ctx.adminToken,
        body: {
          amount: 50000,
          paymentMethod: "MANUAL",
          notes: "QA test seed carrier",
        },
        expectStatus: 200,
      }
    );
    const balance = (data.updatedBalance ?? data.newBalance) as number;
    assert(balance === 50000, `Carrier balance is ${balance}`);
  });

  await test("4.5", "Carrier Creates Truck (with GPS IMEI)", async () => {
    // GPS device must be provided at truck creation time via `imei` field.
    // PATCH /api/trucks/:id does NOT accept gpsDeviceId.
    const { data } = await api("POST", "/api/trucks", {
      token: ctx.carrierToken,
      body: {
        truckType: "DRY_VAN",
        licensePlate: "ET-AA-12345",
        capacity: 15000,
        lengthM: 12,
        currentCity: "Addis Ababa",
        contactName: "Hailu Gebre",
        contactPhone: "+251922222222",
        imei: "358497210123457",
      },
      expectStatus: 201,
    });
    const truck = (data.truck ?? data) as Record<string, unknown>;
    assert(
      truck.approvalStatus === "PENDING",
      `approvalStatus is ${truck.approvalStatus}`
    );
    ctx.truckId = truck.id as string;
    if (truck.gpsDeviceId) ctx.gpsDeviceId = truck.gpsDeviceId as string;
  });

  await test("4.6", "Admin Approves Truck", async () => {
    const { data } = await api("POST", `/api/trucks/${ctx.truckId}/approve`, {
      token: ctx.adminToken,
      body: { action: "APPROVE" },
      expectStatus: 200,
    });
    const truck = (data.truck ?? data) as Record<string, unknown>;
    assert(
      truck.approvalStatus === "APPROVED",
      `approvalStatus is ${truck.approvalStatus}`
    );
  });

  await test("4.7", "Verify GPS Device Linked to Truck", async () => {
    // GPS was linked during truck creation. Verify via DB.
    const truck = await prisma.truck.findUnique({
      where: { id: ctx.truckId },
      select: { gpsDeviceId: true },
    });
    assert(!!truck?.gpsDeviceId, "Truck has no GPS device linked");
    ctx.gpsDeviceId = truck!.gpsDeviceId!;

    // Verify device is ACTIVE
    const device = await prisma.gpsDevice.findUnique({
      where: { id: ctx.gpsDeviceId },
    });
    assert(
      device?.status === "ACTIVE",
      `GPS device status is ${device?.status}`
    );
  });

  await test("4.8", "Carrier Posts Truck to Marketplace", async () => {
    // Get Addis Ababa location ID
    const { data: locData } = await api(
      "GET",
      "/api/ethiopian-locations?search=Addis+Ababa",
      {
        token: ctx.carrierToken,
        expectStatus: 200,
      }
    );
    const locations = (locData.locations ?? locData) as Array<
      Record<string, unknown>
    >;
    assert(locations.length > 0, "No locations found for Addis Ababa");
    ctx.addisLocationId = locations[0].id as string;

    const { data } = await api("POST", "/api/truck-postings", {
      token: ctx.carrierToken,
      body: {
        truckId: ctx.truckId,
        originCityId: ctx.addisLocationId,
        availableFrom: tomorrow(),
        fullPartial: "FULL",
        availableWeight: 15000,
        contactName: "Hailu Gebre",
        contactPhone: "+251922222222",
      },
      expectStatus: [200, 201],
    });
    const posting = (data.posting ?? data) as Record<string, unknown>;
    assert(posting.status === "ACTIVE", `Posting status is ${posting.status}`);
    ctx.truckPostingId = posting.id as string;
  });
}

// ---------------------------------------------------------------------------
// PHASE 5 — Load Posting & Matching
// ---------------------------------------------------------------------------
async function phase5() {
  header("PHASE 5: Load Posting & Matching");

  await test("5.1", "Shipper Posts Load", async () => {
    const { data } = await api("POST", "/api/loads", {
      token: ctx.shipperToken,
      body: {
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: tomorrow(),
        deliveryDate: dayAfterTomorrow(),
        truckType: "DRY_VAN",
        weight: 12000,
        cargoDescription: "Construction materials - cement bags and rebar",
        fullPartial: "FULL",
        bookMode: "REQUEST",
        status: "POSTED",
      },
      expectStatus: 201,
    });
    const load = (data.load ?? data) as Record<string, unknown>;
    assert(load.status === "POSTED", `Load status is ${load.status}`);
    ctx.loadId = load.id as string;
  });

  await test("5.2", "Shipper Searches Trucks", async () => {
    const { data } = await api("GET", "/api/truck-postings?status=ACTIVE", {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const postings = (data.postings ?? data.truckPostings ?? data) as unknown[];
    assert(
      Array.isArray(postings) && postings.length >= 1,
      `Expected >=1 posting, got ${Array.isArray(postings) ? postings.length : 0}`
    );
  });

  await test("5.3", "Wallet Gate Test (402)", async () => {
    // Set high minimumBalance
    await api("PATCH", `/api/admin/users/${ctx.shipperUserId}/wallet`, {
      token: ctx.adminToken,
      body: { minimumBalance: 9999999 },
      expectStatus: 200,
    });

    // Attempt truck request → should be 402
    await api("POST", "/api/truck-requests", {
      token: ctx.shipperToken,
      body: { loadId: ctx.loadId, truckId: ctx.truckId },
      expectStatus: 402,
    });

    // Reset
    await api("PATCH", `/api/admin/users/${ctx.shipperUserId}/wallet`, {
      token: ctx.adminToken,
      body: { minimumBalance: 0 },
      expectStatus: 200,
    });
  });

  await test("5.4", "Shipper Sends Truck Request", async () => {
    const { data } = await api("POST", "/api/truck-requests", {
      token: ctx.shipperToken,
      body: {
        loadId: ctx.loadId,
        truckId: ctx.truckId,
        notes: "Please arrive by 8am",
        expiresInHours: 24,
      },
      expectStatus: [200, 201],
    });
    const req = (data.request ?? data) as Record<string, unknown>;
    assert(req.status === "PENDING", `Request status is ${req.status}`);
    ctx.truckRequestId = req.id as string;
  });

  await test("5.5", "Carrier Accepts Request", async () => {
    await api("POST", `/api/truck-requests/${ctx.truckRequestId}/respond`, {
      token: ctx.carrierToken,
      body: { action: "APPROVE" },
      expectStatus: 200,
    });
  });

  await test("5.6", "Verify Marketplace Cleanup", async () => {
    const { data } = await api("GET", `/api/loads/${ctx.loadId}`, {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const load = (data.load ?? data) as Record<string, unknown>;
    assert(
      load.status === "ASSIGNED",
      `Load status is ${load.status}, expected ASSIGNED`
    );
    assert(
      !!load.assignedTruckId,
      "No assignedTruckId on load after acceptance"
    );

    // Find trip
    const trip = await prisma.trip.findFirst({
      where: { loadId: ctx.loadId },
    });
    assert(!!trip, "No trip created for load");
    ctx.tripId = trip!.id;
  });
}

// ---------------------------------------------------------------------------
// PHASE 6 — Trip Execution
// ---------------------------------------------------------------------------
async function phase6() {
  header("PHASE 6: Trip Execution");

  await test("6.1", "ASSIGNED → PICKUP_PENDING", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "PICKUP_PENDING" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(trip.status === "PICKUP_PENDING", `Status is ${trip.status}`);
  });

  await test("6.2", "PICKUP_PENDING → IN_TRANSIT", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "IN_TRANSIT" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(trip.status === "IN_TRANSIT", `Status is ${trip.status}`);
  });

  await test("6.3", "Dispatcher Monitors Trip", async () => {
    const { data } = await api("GET", `/api/trips/${ctx.tripId}`, {
      token: ctx.dispatcherToken,
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(
      trip.status === "IN_TRANSIT",
      `Dispatcher sees status ${trip.status}`
    );
  });

  await test("6.4", "IN_TRANSIT → DELIVERED", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "DELIVERED" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(trip.status === "DELIVERED", `Status is ${trip.status}`);
  });

  await test("6.5", "POD Upload", async () => {
    // Create a minimal 1x1 red PNG (68 bytes)
    const pngHeader = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52, // IHDR chunk
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x01, // 1x1
      0x08,
      0x02,
      0x00,
      0x00,
      0x00,
      0x90,
      0x77,
      0x53, // 8-bit RGB
      0xde,
      0x00,
      0x00,
      0x00,
      0x0c,
      0x49,
      0x44,
      0x41, // IDAT
      0x54,
      0x08,
      0xd7,
      0x63,
      0xf8,
      0xcf,
      0xc0,
      0x00, // data
      0x00,
      0x00,
      0x02,
      0x00,
      0x01,
      0xe2,
      0x21,
      0xbc, // data
      0x33,
      0x00,
      0x00,
      0x00,
      0x00,
      0x49,
      0x45,
      0x4e, // IEND
      0x44,
      0xae,
      0x42,
      0x60,
      0x82,
    ]);

    const blob = new Blob([pngHeader], { type: "image/png" });
    const formData = new FormData();
    formData.append("file", blob, "pod-proof.png");
    formData.append("notes", "QA test POD");

    await api("POST", `/api/trips/${ctx.tripId}/pod`, {
      token: ctx.carrierToken,
      formData,
      expectStatus: [200, 201],
    });
  });

  await test("6.6", "DELIVERED → COMPLETED", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "COMPLETED" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(trip.status === "COMPLETED", `Status is ${trip.status}`);
  });

  await test("6.7", "Invalid Transition (terminal state)", async () => {
    await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "IN_TRANSIT" },
      expectStatus: 400,
    });
  });
}

// ---------------------------------------------------------------------------
// PHASE 7 — Fee Calculation & Wallet Verification
// ---------------------------------------------------------------------------
async function phase7() {
  header("PHASE 7: Fee Calculation & Wallet Verification");

  await test("7.1", "Shipper Fee Deduction", async () => {
    const { data } = await api("GET", "/api/wallet/transactions", {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const txns = data.transactions as Array<Record<string, unknown>>;
    const feeTxn = txns.find(
      (t) =>
        t.transactionType === "SERVICE_FEE_DEDUCT" ||
        t.type === "SERVICE_FEE_DEDUCT"
    );
    assert(!!feeTxn, "No SERVICE_FEE_DEDUCT transaction for shipper");
    const amt = feeTxn!.amount as number;
    assert(amt < 0, `Shipper fee amount is ${amt}, expected negative`);
    console.log(`    Fee amount: ${amt} ETB (corridor ~453km × 2.5 = ~1132.5)`);
  });

  await test("7.2", "Carrier Fee Deduction", async () => {
    const { data } = await api("GET", "/api/wallet/transactions", {
      token: ctx.carrierToken,
      expectStatus: 200,
    });
    const txns = data.transactions as Array<Record<string, unknown>>;
    const feeTxn = txns.find(
      (t) =>
        t.transactionType === "SERVICE_FEE_DEDUCT" ||
        t.type === "SERVICE_FEE_DEDUCT"
    );
    assert(!!feeTxn, "No SERVICE_FEE_DEDUCT transaction for carrier");
    const amt = feeTxn!.amount as number;
    assert(amt < 0, `Carrier fee amount is ${amt}, expected negative`);
    console.log(`    Fee amount: ${amt} ETB`);
  });

  await test("7.3", "Admin Revenue Check", async () => {
    const { data } = await api("GET", "/api/admin/analytics", {
      token: ctx.adminToken,
      expectStatus: 200,
    });
    const summary = data.summary as Record<string, unknown>;
    const revenue = summary?.revenue as Record<string, unknown> | null;
    assert(!!revenue, "No revenue data in analytics");
    // At least one fee metric should be > 0
    const collected =
      ((revenue.serviceFeeCollected as number) ?? 0) +
      ((revenue.shipperFeeCollected as number) ?? 0) +
      ((revenue.carrierFeeCollected as number) ?? 0);
    assert(collected > 0, `Total fees collected is ${collected}`);
  });
}

// ---------------------------------------------------------------------------
// PHASE 8 — Exception Flow
// ---------------------------------------------------------------------------
async function phase8() {
  header("PHASE 8: Exception Flow");

  await test(
    "8.1",
    "Create Second Trip (load + request + accept)",
    async () => {
      // Post new load
      const { data: loadData } = await api("POST", "/api/loads", {
        token: ctx.shipperToken,
        body: {
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: tomorrow(),
          deliveryDate: dayAfterTomorrow(),
          truckType: "DRY_VAN",
          weight: 8000,
          cargoDescription: "Textile shipment - garment bales for export",
          fullPartial: "FULL",
          bookMode: "REQUEST",
          status: "POSTED",
        },
        expectStatus: 201,
      });
      const load2 = (loadData.load ?? loadData) as Record<string, unknown>;
      ctx.load2Id = load2.id as string;

      // Ensure an active truck posting exists (may have been consumed by trip 1)
      const existingPosting = await prisma.truckPosting.findFirst({
        where: { truckId: ctx.truckId, status: "ACTIVE" },
      });
      if (!existingPosting) {
        await api("POST", "/api/truck-postings", {
          token: ctx.carrierToken,
          body: {
            truckId: ctx.truckId,
            originCityId: ctx.addisLocationId,
            availableFrom: tomorrow(),
            fullPartial: "FULL",
            availableWeight: 15000,
            contactName: "Hailu Gebre",
            contactPhone: "+251922222222",
          },
          expectStatus: [200, 201],
        });
      }

      // Shipper sends truck request
      await api("POST", "/api/truck-requests", {
        token: ctx.shipperToken,
        body: {
          loadId: ctx.load2Id,
          truckId: ctx.truckId,
          expiresInHours: 24,
        },
        expectStatus: [200, 201],
      });

      // Find the pending request
      const req = await prisma.truckRequest.findFirst({
        where: { loadId: ctx.load2Id, status: "PENDING" },
      });
      assert(!!req, "No pending truck request for load2");

      // Carrier accepts
      await api("POST", `/api/truck-requests/${req!.id}/respond`, {
        token: ctx.carrierToken,
        body: { action: "APPROVE" },
        expectStatus: 200,
      });

      // Find trip
      const trip2 = await prisma.trip.findFirst({
        where: { loadId: ctx.load2Id },
      });
      assert(!!trip2, "No trip created for load2");
      ctx.trip2Id = trip2!.id;

      // Walk to IN_TRANSIT
      await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
        token: ctx.carrierToken,
        body: { status: "PICKUP_PENDING" },
        expectStatus: 200,
      });
      await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
        token: ctx.carrierToken,
        body: { status: "IN_TRANSIT" },
        expectStatus: 200,
      });
    }
  );

  await test("8.2", "Carrier Reports Exception", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
      token: ctx.carrierToken,
      body: {
        status: "EXCEPTION",
        exceptionReason: "Vehicle breakdown on Addis-Adama expressway",
      },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(trip.status === "EXCEPTION", `Status is ${trip.status}`);
  });

  await test("8.3", "Dispatcher Sees Exception", async () => {
    const { data } = await api("GET", `/api/trips/${ctx.trip2Id}`, {
      token: ctx.dispatcherToken,
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assert(trip.status === "EXCEPTION", `Status is ${trip.status}`);
  });

  await test("8.4", "Admin Resolves Exception → IN_TRANSIT", async () => {
    await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
      token: ctx.adminToken,
      body: { status: "IN_TRANSIT" },
      expectStatus: 200,
    });
  });

  await test("8.5", "Complete Second Trip", async () => {
    await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
      token: ctx.carrierToken,
      body: { status: "DELIVERED" },
      expectStatus: 200,
    });

    // Upload POD (required before COMPLETED)
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const podForm = new FormData();
    podForm.append(
      "file",
      new Blob([pngBytes], { type: "image/png" }),
      "pod-trip2.png"
    );
    podForm.append("notes", "QA POD trip 2");
    await api("POST", `/api/trips/${ctx.trip2Id}/pod`, {
      token: ctx.carrierToken,
      formData: podForm,
      expectStatus: [200, 201],
    });

    await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
      token: ctx.carrierToken,
      body: { status: "COMPLETED" },
      expectStatus: 200,
    });

    // Verify fee deduction
    const { data } = await api("GET", "/api/wallet/transactions", {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const txns = data.transactions as Array<Record<string, unknown>>;
    const fees = txns.filter(
      (t) =>
        t.transactionType === "SERVICE_FEE_DEDUCT" ||
        t.type === "SERVICE_FEE_DEDUCT"
    );
    assert(fees.length >= 2, `Expected >=2 fee deductions, got ${fees.length}`);
  });
}

// ---------------------------------------------------------------------------
// PHASE 9 — Analytics Verification
// ---------------------------------------------------------------------------
async function phase9() {
  header("PHASE 9: Analytics Verification");

  await test("9.1", "Admin Analytics", async () => {
    const { data } = await api("GET", "/api/admin/analytics", {
      token: ctx.adminToken,
      expectStatus: 200,
    });
    const summary = data.summary as Record<string, unknown>;
    const loads = summary.loads as Record<string, unknown>;
    const trips = summary.trips as Record<string, unknown>;

    assert(
      (loads.total as number) >= 2,
      `loads.total is ${loads.total}, expected >=2`
    );
    assert(
      (trips.completed as number) >= 1,
      `trips.completed is ${trips.completed}, expected >=1`
    );
  });

  await test("9.2", "Dispatcher Dashboard", async () => {
    const { data } = await api("GET", "/api/dispatcher/dashboard", {
      token: ctx.dispatcherToken,
      expectStatus: 200,
    });
    const stats = data.stats as Record<string, unknown>;
    assert(!!stats, "No stats in dispatcher dashboard");
  });
}

// ---------------------------------------------------------------------------
// PHASE 10 — Edge Cases & Security
// ---------------------------------------------------------------------------
async function phase10() {
  header("PHASE 10: Edge Cases & Security");

  await test("10.1", "Cross-Role: Shipper cannot GET /api/trucks", async () => {
    await api("GET", "/api/trucks", {
      token: ctx.shipperToken,
      expectStatus: 403,
    });
  });

  await test("10.2", "Unauthenticated Access", async () => {
    await api("GET", "/api/loads", {
      expectStatus: 401,
    });
  });

  await test("10.3", "Document Lock After Approval", async () => {
    // Attempt upload to locked org with a valid PNG (magic bytes matter)
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pngBytes], { type: "image/png" }),
      "test-doc.png"
    );
    formData.append("type", "BUSINESS_REGISTRATION");
    formData.append("entityType", "company");
    formData.append("entityId", ctx.shipperOrgId!);

    const { status } = await api("POST", "/api/documents/upload", {
      token: ctx.shipperToken,
      formData,
    });
    // 403 = Forbidden, 423 = Locked — both indicate documents are locked
    assert(
      status === 403 || status === 423,
      `Expected 403/423 for locked org upload, got ${status}`
    );
  });

  await test("10.4", "Wallet Gate on Carrier Side", async () => {
    // Set high minimum
    await api("PATCH", `/api/admin/users/${ctx.carrierUserId}/wallet`, {
      token: ctx.adminToken,
      body: { minimumBalance: 9999999 },
      expectStatus: 200,
    });

    // Carrier tries to browse loads → 402
    const { status } = await api("GET", "/api/loads", {
      token: ctx.carrierToken,
    });
    assert(
      status === 402,
      `Expected 402 for carrier wallet gate, got ${status}`
    );

    // Reset
    await api("PATCH", `/api/admin/users/${ctx.carrierUserId}/wallet`, {
      token: ctx.adminToken,
      body: { minimumBalance: 0 },
      expectStatus: 200,
    });
  });

  await test("10.5", "Notification Existence", async () => {
    const { data } = await api("GET", "/api/notifications", {
      token: ctx.carrierToken,
      expectStatus: 200,
    });
    const notifs = (data.notifications ?? data) as unknown[];
    assert(
      Array.isArray(notifs) && notifs.length >= 1,
      `Expected >=1 notification, got ${Array.isArray(notifs) ? notifs.length : 0}`
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   FREIGHT MANAGEMENT — Real-World E2E QA Suite          ║");
  console.log("║   Testing against: " + BASE_URL.padEnd(38) + "║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  try {
    await phase0();
    await phase1();
    await phase2();
    await phase3();
    await phase4();
    await phase5();
    await phase6();
    await phase7();
    await phase8();
    await phase9();
    await phase10();
  } catch (err) {
    console.error("\n💥 FATAL ERROR:", err);
  }

  // Write context for Playwright
  fs.writeFileSync(CONTEXT_PATH, JSON.stringify(ctx, null, 2));
  console.log(`\n📄 Context written to ${CONTEXT_PATH}`);

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log(`${"═".repeat(60)}\n`);

  await prisma.$disconnect();
  await pool.end();

  process.exit(failCount > 0 ? 1 : 0);
}

main();
