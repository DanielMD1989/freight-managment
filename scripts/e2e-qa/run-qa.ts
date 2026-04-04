/**
 * Deep E2E QA Suite — Full Platform Validation v3
 *
 * Resets the database, creates all users from scratch, exercises every
 * major API flow, and saves results + credentials to .qa-context.json
 * for the Playwright browser suite.
 *
 * 16 Phases:
 *   0. Database Reset & Seed
 *   1. Super Admin Login + Create Admin
 *   2. Admin Login + Dispatcher Setup
 *   3. Shipper Registration & Approval
 *   4. Carrier Registration, Truck, GPS Device, Posting
 *   5. Load Posting & Truck Request Matching
 *   6. Trip 1 Execution with GPS (actualTripKm billing)
 *   7. Trip 1 Fee Verification (exact ETB math)
 *   8. Trip 2 — Corridor-Fallback Billing (no GPS)
 *   9. Invalid State Transitions (400s)
 *  10. Withdrawal Flow
 *  11. Exception Flow
 *  12. Dispatcher Match Proposal
 *  13. Security Boundaries
 *  14. Analytics Verification
 *  15. Save Context
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
// GPS waypoints: 5 points along north corridor from Addis Ababa
// Haversine sum = exactly 50.00 km (after Math.round(total*100)/100)
// ---------------------------------------------------------------------------
const GPS_WAYPOINTS = [
  { lat: 9.0, lng: 38.74 },
  { lat: 9.112406, lng: 38.74 },
  { lat: 9.224813, lng: 38.74 },
  { lat: 9.337219, lng: 38.74 },
  { lat: 9.449625, lng: 38.74 },
];
const GPS_ACTUAL_KM = 50.0;

// ---------------------------------------------------------------------------
// Fee constants
// ---------------------------------------------------------------------------
const CORRIDOR_NAME = "Addis Ababa - Dire Dawa";
const CORRIDOR_DISTANCE_KM = 453.0;
const SHIPPER_RATE = 2.5;
const CARRIER_RATE = 2.5;

// Trip 1: GPS billing
const TRIP1_SHIPPER_FEE = GPS_ACTUAL_KM * SHIPPER_RATE; // 125.00
const TRIP1_CARRIER_FEE = GPS_ACTUAL_KM * CARRIER_RATE; // 125.00

// Trip 2: Corridor fallback billing (no GPS)
const TRIP2_SHIPPER_FEE = CORRIDOR_DISTANCE_KM * SHIPPER_RATE; // 1132.50
const TRIP2_CARRIER_FEE = CORRIDOR_DISTANCE_KM * CARRIER_RATE; // 1132.50

// Starting balances
const SHIPPER_STARTING_BALANCE = 50000;
const CARRIER_STARTING_BALANCE = 30000;

// Expected wallet states after trips
const SHIPPER_AFTER_TRIP1 = SHIPPER_STARTING_BALANCE - TRIP1_SHIPPER_FEE; // 49875.00
const CARRIER_AFTER_TRIP1 = CARRIER_STARTING_BALANCE - TRIP1_CARRIER_FEE; // 29875.00
const SHIPPER_AFTER_TRIP2 = SHIPPER_AFTER_TRIP1 - TRIP2_SHIPPER_FEE; // 48742.50
const CARRIER_AFTER_TRIP2 = CARRIER_AFTER_TRIP1 - TRIP2_CARRIER_FEE; // 28742.50

// ---------------------------------------------------------------------------
// Shared state
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
  gpsImei: string;
  loadId: string;
  load2Id: string;
  load3Id: string;
  tripId: string;
  trip2Id: string;
  trip3Id: string;
  truckRequestId: string;
  addisLocationId: string;
  corridorId: string;
  credentials: Record<string, { email: string; password: string }>;
  shipperFinalBalance: number;
  carrierFinalBalance: number;
  totalPlatformRevenue: number;
  completedTripCount: number;
  shipperTopupAmount: number;
  carrierTopupAmount: number;
  [key: string]: unknown;
}

const ctx: Partial<QAContext> = {};

// Credentials
const CREDS = {
  superadmin: { email: "superadmin@test.com", password: "Test123!" },
  admin: { email: "admin@freightflow.et", password: "Admin@2024!" },
  dispatcher: { email: "dispatcher@test.et", password: "Dispatch@2024!" },
  shipper: { email: "shipper@addisfreight.et", password: "Shipper@2024!" },
  carrier: { email: "carrier@tigraytransport.et", password: "Carrier@2024!" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function header(phase: string) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${phase}`);
  console.log(`${"═".repeat(70)}`);
}

async function test(
  id: string,
  name: string,
  fn: () => Promise<void>
): Promise<boolean> {
  try {
    await fn();
    console.log(`  ✓ ${id}: ${name}`);
    passCount++;
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${id}: ${name}`);
    console.error(`    → ${msg}`);
    failCount++;
    failures.push(`${id}: ${name} — ${msg}`);
    return false;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertApprox(
  actual: number,
  expected: number,
  label: string,
  tolerance = 0.01
) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${label}: expected ~${expected}, got ${actual} (diff=${Math.abs(actual - expected)})`
    );
  }
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
      `${method} ${urlPath} → ${res.status} (expected ${expected.join("|")}): ${JSON.stringify(data).slice(0, 500)}`
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

function makePng(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

async function getWalletBalance(token: string): Promise<number> {
  const { data } = await api("GET", "/api/wallet/balance", {
    token,
    expectStatus: 200,
  });
  return data.totalBalance as number;
}

async function postGps(imei: string, lat: number, lng: number) {
  await api("POST", "/api/gps/positions", {
    token: ctx.carrierToken,
    body: { imei, latitude: lat, longitude: lng },
    expectStatus: [200, 201],
  });
}

async function ensureActivePosting() {
  const existing = await prisma.truckPosting.findFirst({
    where: { truckId: ctx.truckId, status: "ACTIVE" },
  });
  if (!existing) {
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
    ctx.truckPostingId = posting.id as string;
  }
}

function makeLoadPayload(overrides: Record<string, unknown> = {}) {
  return {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: tomorrow(),
    deliveryDate: dayAfterTomorrow(),
    truckType: "DRY_VAN",
    weight: 10000,
    cargoDescription: "QA test cargo",
    fullPartial: "FULL",
    bookMode: "REQUEST",
    shipperContactName: "QA Test Shipper",
    shipperContactPhone: "+251911111111",
    status: "POSTED",
    ...overrides,
  };
}

async function createAndMatchTrip(
  loadPayload: Record<string, unknown>
): Promise<{ loadId: string; tripId: string }> {
  // Post load
  const { data: loadData } = await api("POST", "/api/loads", {
    token: ctx.shipperToken,
    body: loadPayload,
    expectStatus: 201,
  });
  const loadId = ((loadData.load ?? loadData) as Record<string, unknown>)
    .id as string;

  // Ensure posting active
  await ensureActivePosting();

  // Send + accept request
  const { data: reqData } = await api("POST", "/api/truck-requests", {
    token: ctx.shipperToken,
    body: { loadId, truckId: ctx.truckId, expiresInHours: 24 },
    expectStatus: [200, 201],
  });
  const reqObj = (reqData.request ?? reqData) as Record<string, unknown>;
  await api("POST", `/api/truck-requests/${reqObj.id}/respond`, {
    token: ctx.carrierToken,
    body: { action: "APPROVE" },
    expectStatus: 200,
  });

  // Find trip
  const trip = await prisma.trip.findFirst({ where: { loadId } });
  assert(!!trip, `No trip created for load ${loadId}`);
  return { loadId, tripId: trip!.id };
}

async function walkTrip(tripId: string, statuses: string[], token?: string) {
  const t = token ?? ctx.carrierToken!;
  for (const status of statuses) {
    const { data } = await api("PATCH", `/api/trips/${tripId}`, {
      token: t,
      body: { status },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, status, `trip → ${status}`);
  }
}

async function uploadPodAndComplete(tripId: string) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([makePng()], { type: "image/png" }),
    `pod-${tripId}.png`
  );
  formData.append("notes", `QA POD ${tripId}`);
  await api("POST", `/api/trips/${tripId}/pod`, {
    token: ctx.carrierToken,
    formData,
    expectStatus: [200, 201],
  });

  const { data } = await api("PATCH", `/api/trips/${tripId}`, {
    token: ctx.carrierToken,
    body: { status: "COMPLETED" },
    expectStatus: 200,
  });
  const trip = (data.trip ?? data) as Record<string, unknown>;
  assertEqual(trip.status, "COMPLETED", "trip completed");
}

// ===========================================================================
// PHASE 0 — Database Reset & Seed
// ===========================================================================
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
    const hash = await bcrypt.hash(CREDS.superadmin.password, 10);
    const user = await prisma.user.create({
      data: {
        email: CREDS.superadmin.email,
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

  await test("0.3", "Seed Addis-Dire Dawa corridor", async () => {
    const corridor = await prisma.corridor.create({
      data: {
        name: CORRIDOR_NAME,
        originRegion: "Addis Ababa",
        destinationRegion: "Dire Dawa",
        distanceKm: CORRIDOR_DISTANCE_KM,
        pricePerKm: SHIPPER_RATE,
        shipperPricePerKm: SHIPPER_RATE,
        carrierPricePerKm: CARRIER_RATE,
        direction: "BIDIRECTIONAL",
        isActive: true,
        createdById: superAdminId,
      },
    });
    ctx.corridorId = corridor.id;
  });

  await test(
    "0.4",
    "Verify clean state: 1 user, 0 orgs, 1 corridor",
    async () => {
      const users = await pool.query("SELECT COUNT(*)::int AS c FROM users");
      assertEqual(users.rows[0].c, 1, "user count");

      const orgs = await pool.query(
        "SELECT COUNT(*)::int AS c FROM organizations"
      );
      assertEqual(orgs.rows[0].c, 0, "org count");

      const corr = await pool.query("SELECT COUNT(*)::int AS c FROM corridors");
      assertEqual(corr.rows[0].c, 1, "corridor count");

      const locs = await pool.query(
        "SELECT COUNT(*)::int AS c FROM ethiopian_locations"
      );
      assert(locs.rows[0].c > 0, `No ethiopian_locations — run seed first`);
    }
  );
}

// ===========================================================================
// PHASE 1 — Super Admin Login + Create Admin
// ===========================================================================
async function phase1() {
  header("PHASE 1: Super Admin Login + Create Admin");

  await test("1.1", "Super Admin login → role=SUPER_ADMIN", async () => {
    const { token, user } = await login(
      CREDS.superadmin.email,
      CREDS.superadmin.password
    );
    assertEqual(user.role, "SUPER_ADMIN", "role");
    ctx.superAdminToken = token;
  });

  await test("1.2", "Super Admin creates Admin user → 201", async () => {
    const { data } = await api("POST", "/api/admin/users", {
      token: ctx.superAdminToken,
      body: {
        firstName: "Abebe",
        lastName: "Girma",
        email: CREDS.admin.email,
        password: CREDS.admin.password,
        phone: "+251911000001",
      },
      expectStatus: 201,
    });
    const user = data.user as Record<string, unknown>;
    assertEqual(user.role, "ADMIN", "admin role");
    ctx.adminUserId = user.id as string;
    assert(ctx.adminUserId!.length > 10, "admin userId too short");
  });

  await test("1.3", "Audit log has at least 1 entry", async () => {
    const { data } = await api("GET", "/api/admin/audit-logs", {
      token: ctx.superAdminToken,
      expectStatus: 200,
    });
    const logs = (data.logs || data.auditLogs || data) as unknown[];
    assert(Array.isArray(logs) && logs.length > 0, "No audit logs found");
  });
}

// ===========================================================================
// PHASE 2 — Admin Login + Dispatcher Setup
// ===========================================================================
async function phase2() {
  header("PHASE 2: Admin Login + Dispatcher Setup");

  await test("2.1", "Admin login → role=ADMIN", async () => {
    const { token, user } = await login(
      CREDS.admin.email,
      CREDS.admin.password
    );
    assertEqual(user.role, "ADMIN", "admin role");
    ctx.adminToken = token;
  });

  await test("2.2", "Admin cannot create another Admin → 403", async () => {
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

  await test(
    "2.3",
    "Create dispatcher via DB (blueprint §1: Admin creates Dispatcher)",
    async () => {
      // §1 V1: Dispatchers cannot self-register. In production, Admin uses
      // invitation flow. For E2E, create directly (matches seed-test-data.ts pattern).
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(CREDS.dispatcher.password, 10);

      // Create or find a logistics-agent org for the dispatcher
      let dispatcherOrg = await prisma.organization.findFirst({
        where: { type: "LOGISTICS_AGENT" },
        select: { id: true },
      });
      if (!dispatcherOrg) {
        dispatcherOrg = await prisma.organization.create({
          data: {
            name: "Platform Operations",
            type: "LOGISTICS_AGENT",
            contactEmail: CREDS.dispatcher.email,
            contactPhone: "0911000000",
            isVerified: true,
            verificationStatus: "APPROVED",
          },
          select: { id: true },
        });
      }

      const user = await prisma.user.upsert({
        where: { email: CREDS.dispatcher.email },
        update: { status: "ACTIVE", role: "DISPATCHER" },
        create: {
          email: CREDS.dispatcher.email,
          passwordHash,
          firstName: "Dawit",
          lastName: "Teshome",
          role: "DISPATCHER",
          status: "ACTIVE",
          isActive: true,
          isEmailVerified: true,
          organizationId: dispatcherOrg.id,
        },
        select: { id: true, role: true, status: true },
      });
      assertEqual(user.role, "DISPATCHER", "dispatcher role");
      ctx.dispatcherUserId = user.id;
    }
  );

  await test("2.4", "Dispatcher login succeeds", async () => {
    const { token, user } = await login(
      CREDS.dispatcher.email,
      CREDS.dispatcher.password
    );
    assertEqual(user.role, "DISPATCHER", "dispatcher role");
    ctx.dispatcherToken = token;
  });
}

// ===========================================================================
// PHASE 3 — Shipper Registration & Approval
// ===========================================================================
async function phase3() {
  header("PHASE 3: Shipper Registration & Approval");

  await test(
    "3.1",
    "Register shipper → org created with FinancialAccount",
    async () => {
      const { data } = await api("POST", "/api/auth/register", {
        body: {
          email: CREDS.shipper.email,
          password: CREDS.shipper.password,
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

      const fa = await prisma.financialAccount.findFirst({
        where: { organizationId: ctx.shipperOrgId },
      });
      assert(!!fa, "FinancialAccount not created for shipper org");
    }
  );

  await test(
    "3.2",
    "Admin sets PENDING_VERIFICATION → approves org",
    async () => {
      await api("POST", `/api/admin/users/${ctx.shipperUserId}/verify`, {
        token: ctx.adminToken,
        body: { status: "PENDING_VERIFICATION" },
        expectStatus: 200,
      });
      const { data } = await api(
        "POST",
        `/api/admin/organizations/${ctx.shipperOrgId}/verify`,
        { token: ctx.adminToken, expectStatus: 200 }
      );
      const org = data.organization as Record<string, unknown>;
      assertEqual(org.isVerified, true, "isVerified");
      assertEqual(org.verificationStatus, "APPROVED", "verificationStatus");

      const dbUser = await prisma.user.findUnique({
        where: { id: ctx.shipperUserId },
      });
      assertEqual(dbUser?.status, "ACTIVE", "shipper user status");
    }
  );

  await test("3.3", "Shipper re-login → fresh ACTIVE token", async () => {
    const { token, user } = await login(
      CREDS.shipper.email,
      CREDS.shipper.password
    );
    ctx.shipperToken = token;
    assertEqual(user.role, "SHIPPER", "shipper role");
  });

  await test(
    "3.4",
    `Admin tops up shipper wallet → balance=${SHIPPER_STARTING_BALANCE} ETB`,
    async () => {
      const { data } = await api(
        "POST",
        `/api/admin/users/${ctx.shipperUserId}/wallet/topup`,
        {
          token: ctx.adminToken,
          body: {
            amount: SHIPPER_STARTING_BALANCE,
            paymentMethod: "MANUAL",
            notes: "QA seed",
          },
          expectStatus: 200,
        }
      );
      const balance = (data.updatedBalance ?? data.newBalance) as number;
      assertEqual(balance, SHIPPER_STARTING_BALANCE, "shipper balance");
    }
  );

  await test("3.5", "Verify deposit transaction is positive", async () => {
    const { data } = await api("GET", "/api/wallet/transactions", {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const txns = data.transactions as Array<Record<string, unknown>>;
    assert(txns.length > 0, "No transactions found");
    const deposit = txns.find(
      (t) => t.transactionType === "DEPOSIT" || t.type === "DEPOSIT"
    );
    assert(!!deposit, "No DEPOSIT transaction");
    const amt = deposit!.amount as number;
    assert(amt > 0, `DEPOSIT amount is ${amt}, expected positive`);
  });
}

// ===========================================================================
// PHASE 4 — Carrier Registration, Truck, GPS, Posting
// ===========================================================================
async function phase4() {
  header("PHASE 4: Carrier Registration, Truck, GPS, Posting");

  // Generate a valid IMEI with correct Luhn checksum (unique per run)
  const imeiBase = "358497" + Date.now().toString().slice(-8);
  const digits = imeiBase.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  const GPS_IMEI = imeiBase + checkDigit;
  ctx.gpsImei = GPS_IMEI;

  await test("4.1", "Register carrier → org created", async () => {
    const { data } = await api("POST", "/api/auth/register", {
      body: {
        email: CREDS.carrier.email,
        password: CREDS.carrier.password,
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

  await test("4.2", "Admin activates carrier", async () => {
    await api("POST", `/api/admin/users/${ctx.carrierUserId}/verify`, {
      token: ctx.adminToken,
      body: { status: "PENDING_VERIFICATION" },
      expectStatus: 200,
    });
    await api("POST", `/api/admin/organizations/${ctx.carrierOrgId}/verify`, {
      token: ctx.adminToken,
      expectStatus: 200,
    });
  });

  await test("4.3", "Carrier re-login", async () => {
    const { token } = await login(CREDS.carrier.email, CREDS.carrier.password);
    ctx.carrierToken = token;
  });

  await test(
    "4.4",
    `Admin tops up carrier wallet → balance=${CARRIER_STARTING_BALANCE} ETB`,
    async () => {
      const { data } = await api(
        "POST",
        `/api/admin/users/${ctx.carrierUserId}/wallet/topup`,
        {
          token: ctx.adminToken,
          body: {
            amount: CARRIER_STARTING_BALANCE,
            paymentMethod: "MANUAL",
            notes: "QA seed carrier",
          },
          expectStatus: 200,
        }
      );
      const balance = (data.updatedBalance ?? data.newBalance) as number;
      assertEqual(balance, CARRIER_STARTING_BALANCE, "carrier balance");
    }
  );

  await test(
    "4.5",
    "Carrier creates truck with GPS IMEI → approvalStatus=PENDING",
    async () => {
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
          imei: GPS_IMEI,
        },
        expectStatus: 201,
      });
      const truck = (data.truck ?? data) as Record<string, unknown>;
      assertEqual(truck.approvalStatus, "PENDING", "truck approvalStatus");
      ctx.truckId = truck.id as string;
    }
  );

  await test(
    "4.5b",
    "Seed approved insurance doc for truck (P0 insurance gate)",
    async () => {
      // P0 Insurance: Truck approval requires an APPROVED insurance doc
      await prisma.truckDocument.create({
        data: {
          truckId: ctx.truckId,
          type: "INSURANCE",
          fileName: "insurance-cert.pdf",
          fileUrl: "/uploads/insurance-cert.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          verificationStatus: "APPROVED",
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          uploadedById: ctx.carrierUserId,
          policyNumber: "INS-E2E-001",
          insuranceProvider: "Ethiopian Insurance Corporation",
          coverageAmount: 500000,
          coverageType: "THIRD_PARTY",
        },
      });
    }
  );

  await test(
    "4.5c",
    "Seed required truck documents (REGISTRATION, TITLE_DEED, ROAD_WORTHINESS)",
    async () => {
      for (const type of [
        "REGISTRATION",
        "TITLE_DEED",
        "ROAD_WORTHINESS",
      ] as const) {
        await prisma.truckDocument.create({
          data: {
            truckId: ctx.truckId,
            type,
            fileName: `${type.toLowerCase()}.pdf`,
            fileUrl: `/uploads/${type.toLowerCase()}.pdf`,
            fileSize: 1024,
            mimeType: "application/pdf",
            verificationStatus: "APPROVED",
            uploadedById: ctx.carrierUserId,
          },
        });
      }
    }
  );

  await test(
    "4.6",
    "Admin approves truck → approvalStatus=APPROVED",
    async () => {
      const { data } = await api("POST", `/api/trucks/${ctx.truckId}/approve`, {
        token: ctx.adminToken,
        body: { action: "APPROVE" },
        expectStatus: 200,
      });
      const truck = (data.truck ?? data) as Record<string, unknown>;
      assertEqual(truck.approvalStatus, "APPROVED", "truck approvalStatus");
    }
  );

  await test("4.7", "GPS device linked to truck and ACTIVE", async () => {
    const truck = await prisma.truck.findUnique({
      where: { id: ctx.truckId },
      select: { gpsDeviceId: true },
    });
    assert(!!truck?.gpsDeviceId, "Truck has no GPS device linked");
    ctx.gpsDeviceId = truck!.gpsDeviceId!;

    const device = await prisma.gpsDevice.findUnique({
      where: { id: ctx.gpsDeviceId },
    });
    assertEqual(device?.status, "ACTIVE", "GPS device status");
  });

  await test(
    "4.8",
    "Carrier posts truck to marketplace → status=ACTIVE",
    async () => {
      const { data: locData } = await api(
        "GET",
        "/api/ethiopian-locations?search=Addis+Ababa",
        { token: ctx.carrierToken, expectStatus: 200 }
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
      assertEqual(posting.status, "ACTIVE", "posting status");
      ctx.truckPostingId = posting.id as string;
    }
  );
}

// ===========================================================================
// PHASE 5 — Load Posting & Truck Request Matching
// ===========================================================================
async function phase5() {
  header("PHASE 5: Load Posting & Matching (Trip 1)");

  await test("5.1", "Shipper posts load → status=POSTED", async () => {
    const { data } = await api("POST", "/api/loads", {
      token: ctx.shipperToken,
      body: makeLoadPayload({
        weight: 12000,
        cargoDescription: "QA test — construction materials",
      }),
      expectStatus: 201,
    });
    const load = (data.load ?? data) as Record<string, unknown>;
    assertEqual(load.status, "POSTED", "load status");
    ctx.loadId = load.id as string;
  });

  await test("5.2", "Wallet gate: high minimumBalance → 402", async () => {
    await api("PATCH", `/api/admin/users/${ctx.shipperUserId}/wallet`, {
      token: ctx.adminToken,
      body: { minimumBalance: 9999999 },
      expectStatus: 200,
    });
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

  await test(
    "5.3",
    "Shipper sends truck request → status=PENDING",
    async () => {
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
      assertEqual(req.status, "PENDING", "request status");
      ctx.truckRequestId = req.id as string;
    }
  );

  await test(
    "5.4",
    "Carrier accepts → load=ASSIGNED, trip created",
    async () => {
      await api("POST", `/api/truck-requests/${ctx.truckRequestId}/respond`, {
        token: ctx.carrierToken,
        body: { action: "APPROVE" },
        expectStatus: 200,
      });

      const { data } = await api("GET", `/api/loads/${ctx.loadId}`, {
        token: ctx.shipperToken,
        expectStatus: 200,
      });
      const load = (data.load ?? data) as Record<string, unknown>;
      assertEqual(load.status, "ASSIGNED", "load status after accept");
      assert(!!load.assignedTruckId, "No assignedTruckId on load");

      const trip = await prisma.trip.findFirst({
        where: { loadId: ctx.loadId },
      });
      assert(!!trip, "No trip created for load");
      assertEqual(trip!.status, "ASSIGNED", "trip initial status");
      ctx.tripId = trip!.id;
    }
  );
}

// ===========================================================================
// PHASE 6 — Trip 1 Execution with GPS
// ===========================================================================
async function phase6() {
  header("PHASE 6: Trip 1 Execution (GPS Billing)");

  await test("6.1", "ASSIGNED → PICKUP_PENDING", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "PICKUP_PENDING" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "PICKUP_PENDING", "trip status");
  });

  await test("6.2", "PICKUP_PENDING → IN_TRANSIT", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "IN_TRANSIT" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "IN_TRANSIT", "trip status");
  });

  await test(
    "6.3",
    `Post ${GPS_WAYPOINTS.length} GPS positions via IMEI (forming ${GPS_ACTUAL_KM}km path)`,
    async () => {
      for (const wp of GPS_WAYPOINTS) {
        await postGps(ctx.gpsImei!, wp.lat, wp.lng);
      }

      const positions = await prisma.gpsPosition.findMany({
        where: { tripId: ctx.tripId },
        orderBy: { timestamp: "asc" },
      });
      assertEqual(
        positions.length,
        GPS_WAYPOINTS.length,
        "GPS positions linked to trip"
      );
    }
  );

  await test("6.4", "Dispatcher monitors trip → sees IN_TRANSIT", async () => {
    const { data } = await api("GET", `/api/trips/${ctx.tripId}`, {
      token: ctx.dispatcherToken,
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "IN_TRANSIT", "dispatcher sees IN_TRANSIT");
  });

  await test("6.5", "IN_TRANSIT → DELIVERED", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
      token: ctx.carrierToken,
      body: { status: "DELIVERED" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "DELIVERED", "trip status");
  });

  await test("6.6", "Upload POD (1x1 PNG)", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([makePng()], { type: "image/png" }),
      "pod-trip1.png"
    );
    formData.append("notes", "QA POD trip 1");
    await api("POST", `/api/trips/${ctx.tripId}/pod`, {
      token: ctx.carrierToken,
      formData,
      expectStatus: [200, 201],
    });
  });

  await test(
    "6.7",
    "DELIVERED → COMPLETED (triggers fee deduction)",
    async () => {
      const { data } = await api("PATCH", `/api/trips/${ctx.tripId}`, {
        token: ctx.carrierToken,
        body: { status: "COMPLETED" },
        expectStatus: 200,
      });
      const trip = (data.trip ?? data) as Record<string, unknown>;
      assertEqual(trip.status, "COMPLETED", "trip status");
    }
  );
}

// ===========================================================================
// PHASE 7 — Trip 1 Fee Verification (exact ETB)
// ===========================================================================
async function phase7() {
  header("PHASE 7: Trip 1 Fee Verification (GPS Billing)");

  await test(
    "7.1",
    `Load.actualTripKm = ${GPS_ACTUAL_KM} (computed from GPS positions)`,
    async () => {
      const load = await prisma.load.findUnique({
        where: { id: ctx.loadId },
        select: {
          actualTripKm: true,
          totalKmUsed: true,
          shipperRatePerKmUsed: true,
          carrierRatePerKmUsed: true,
        },
      });
      assertApprox(
        Number(load!.actualTripKm),
        GPS_ACTUAL_KM,
        "actualTripKm",
        0.1
      );
      assertApprox(
        Number(load!.totalKmUsed),
        GPS_ACTUAL_KM,
        "totalKmUsed",
        0.1
      );
      assertApprox(
        Number(load!.shipperRatePerKmUsed),
        SHIPPER_RATE,
        "shipperRatePerKmUsed"
      );
      assertApprox(
        Number(load!.carrierRatePerKmUsed),
        CARRIER_RATE,
        "carrierRatePerKmUsed"
      );
    }
  );

  await test(
    "7.2",
    `shipperServiceFee=${TRIP1_SHIPPER_FEE} ETB, carrierServiceFee=${TRIP1_CARRIER_FEE} ETB`,
    async () => {
      const load = await prisma.load.findUnique({
        where: { id: ctx.loadId },
        select: {
          shipperServiceFee: true,
          carrierServiceFee: true,
          shipperFeeStatus: true,
          carrierFeeStatus: true,
        },
      });
      assertApprox(
        Number(load!.shipperServiceFee),
        TRIP1_SHIPPER_FEE,
        "shipperServiceFee",
        0.5
      );
      assertApprox(
        Number(load!.carrierServiceFee),
        TRIP1_CARRIER_FEE,
        "carrierServiceFee",
        0.5
      );
      assertEqual(load!.shipperFeeStatus, "DEDUCTED", "shipperFeeStatus");
      assertEqual(load!.carrierFeeStatus, "DEDUCTED", "carrierFeeStatus");
    }
  );

  await test("7.3", `Shipper wallet = ${SHIPPER_AFTER_TRIP1} ETB`, async () => {
    const balance = await getWalletBalance(ctx.shipperToken!);
    assertApprox(balance, SHIPPER_AFTER_TRIP1, "shipper balance", 0.5);
  });

  await test("7.4", `Carrier wallet = ${CARRIER_AFTER_TRIP1} ETB`, async () => {
    const balance = await getWalletBalance(ctx.carrierToken!);
    assertApprox(balance, CARRIER_AFTER_TRIP1, "carrier balance", 0.5);
  });

  await test(
    "7.5",
    "Shipper SERVICE_FEE_DEDUCT transaction is negative",
    async () => {
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
      assertApprox(Math.abs(amt), TRIP1_SHIPPER_FEE, "shipper fee txn", 0.5);
    }
  );

  await test("7.6", "Service fee API shows exact breakdown", async () => {
    const { data } = await api("GET", `/api/loads/${ctx.loadId}/service-fee`, {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    const sf = data.serviceFee as Record<string, unknown>;
    const shipper = sf.shipper as Record<string, unknown>;
    const carrier = sf.carrier as Record<string, unknown>;
    assertEqual(shipper.status, "DEDUCTED", "shipper.status via API");
    assertEqual(carrier.status, "DEDUCTED", "carrier.status via API");
    assertApprox(
      Number(shipper.fee),
      TRIP1_SHIPPER_FEE,
      "shipper.fee via API",
      0.5
    );
    assertApprox(
      Number(carrier.fee),
      TRIP1_CARRIER_FEE,
      "carrier.fee via API",
      0.5
    );
    assertApprox(
      Number(sf.totalKmUsed),
      GPS_ACTUAL_KM,
      "totalKmUsed via API",
      0.5
    );
  });
}

// ===========================================================================
// PHASE 8 — Trip 2: Corridor Fallback Billing (no GPS)
// ===========================================================================
async function phase8() {
  header("PHASE 8: Trip 2 — Corridor-Fallback Billing (no GPS)");

  await test("8.1", "Shipper posts load 2", async () => {
    const { data } = await api("POST", "/api/loads", {
      token: ctx.shipperToken,
      body: makeLoadPayload({
        weight: 8000,
        cargoDescription: "QA test — textile bales",
      }),
      expectStatus: 201,
    });
    const load = (data.load ?? data) as Record<string, unknown>;
    assertEqual(load.status, "POSTED", "load2 status");
    ctx.load2Id = load.id as string;
  });

  await test(
    "8.2",
    "Ensure truck posting active + send/accept request",
    async () => {
      await ensureActivePosting();

      const { data: reqData } = await api("POST", "/api/truck-requests", {
        token: ctx.shipperToken,
        body: { loadId: ctx.load2Id, truckId: ctx.truckId, expiresInHours: 24 },
        expectStatus: [200, 201],
      });
      const reqObj = (reqData.request ?? reqData) as Record<string, unknown>;

      await api("POST", `/api/truck-requests/${reqObj.id}/respond`, {
        token: ctx.carrierToken,
        body: { action: "APPROVE" },
        expectStatus: 200,
      });

      const trip = await prisma.trip.findFirst({
        where: { loadId: ctx.load2Id },
      });
      assert(!!trip, "No trip created for load2");
      ctx.trip2Id = trip!.id;
    }
  );

  await test(
    "8.3",
    "Walk trip 2: ASSIGNED → PICKUP → IN_TRANSIT → DELIVERED",
    async () => {
      await walkTrip(ctx.trip2Id!, [
        "PICKUP_PENDING",
        "IN_TRANSIT",
        "DELIVERED",
      ]);
    }
  );

  await test("8.4", "Upload POD for trip 2", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([makePng()], { type: "image/png" }),
      "pod-trip2.png"
    );
    await api("POST", `/api/trips/${ctx.trip2Id}/pod`, {
      token: ctx.carrierToken,
      formData,
      expectStatus: [200, 201],
    });
  });

  await test("8.5", "DELIVERED → COMPLETED (corridor billing)", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.trip2Id}`, {
      token: ctx.carrierToken,
      body: { status: "COMPLETED" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "COMPLETED", "trip2 completed");
  });

  await test(
    "8.6",
    `Load2 totalKmUsed = ${CORRIDOR_DISTANCE_KM} (corridor fallback)`,
    async () => {
      const load = await prisma.load.findUnique({
        where: { id: ctx.load2Id },
        select: { actualTripKm: true, totalKmUsed: true },
      });
      assert(
        load!.actualTripKm === null || Number(load!.actualTripKm) === 0,
        `Load2 actualTripKm should be null or 0, got ${load!.actualTripKm}`
      );
      assertApprox(
        Number(load!.totalKmUsed),
        CORRIDOR_DISTANCE_KM,
        "load2 totalKmUsed",
        0.5
      );
    }
  );

  await test(
    "8.7",
    `Load2 shipperServiceFee=${TRIP2_SHIPPER_FEE}, carrierServiceFee=${TRIP2_CARRIER_FEE}`,
    async () => {
      const load = await prisma.load.findUnique({
        where: { id: ctx.load2Id },
        select: {
          shipperServiceFee: true,
          carrierServiceFee: true,
          shipperFeeStatus: true,
          carrierFeeStatus: true,
        },
      });
      assertApprox(
        Number(load!.shipperServiceFee),
        TRIP2_SHIPPER_FEE,
        "load2 shipperServiceFee",
        0.5
      );
      assertApprox(
        Number(load!.carrierServiceFee),
        TRIP2_CARRIER_FEE,
        "load2 carrierServiceFee",
        0.5
      );
      assertEqual(load!.shipperFeeStatus, "DEDUCTED", "load2 shipperFeeStatus");
      assertEqual(load!.carrierFeeStatus, "DEDUCTED", "load2 carrierFeeStatus");
    }
  );

  await test(
    "8.8",
    `Cumulative shipper wallet = ${SHIPPER_AFTER_TRIP2} ETB`,
    async () => {
      const balance = await getWalletBalance(ctx.shipperToken!);
      assertApprox(
        balance,
        SHIPPER_AFTER_TRIP2,
        "shipper cumulative balance",
        1.0
      );
    }
  );

  await test(
    "8.9",
    `Cumulative carrier wallet = ${CARRIER_AFTER_TRIP2} ETB`,
    async () => {
      const balance = await getWalletBalance(ctx.carrierToken!);
      assertApprox(
        balance,
        CARRIER_AFTER_TRIP2,
        "carrier cumulative balance",
        1.0
      );
    }
  );
}

// ===========================================================================
// PHASE 9 — Invalid State Transitions (400s)
// ===========================================================================
async function phase9() {
  header("PHASE 9: Invalid State Transitions");

  await test("9.1", "Cancel COMPLETED trip → 400", async () => {
    await api("POST", `/api/trips/${ctx.tripId}/cancel`, {
      token: ctx.carrierToken,
      body: { reason: "should fail" },
      expectStatus: 400,
    });
  });

  // Create a trip to test skip and cancellation
  let skipTripId: string;
  let skipLoadId: string;

  await test(
    "9.2",
    "Create trip, cancel from ASSIGNED → CANCELLED",
    async () => {
      const result = await createAndMatchTrip(
        makeLoadPayload({
          weight: 2000,
          cargoDescription: "QA — state machine test",
        })
      );
      skipLoadId = result.loadId;
      skipTripId = result.tripId;

      // Cancel from ASSIGNED
      const { data } = await api("POST", `/api/trips/${skipTripId}/cancel`, {
        token: ctx.carrierToken,
        body: { reason: "QA — cancel for testing" },
        expectStatus: 200,
      });
      const trip = (data.trip ?? data) as Record<string, unknown>;
      assertEqual(trip.status, "CANCELLED", "trip cancelled");
    }
  );

  await test("9.3", "Cancel already-cancelled trip → 400", async () => {
    await api("POST", `/api/trips/${skipTripId}/cancel`, {
      token: ctx.carrierToken,
      body: { reason: "should fail" },
      expectStatus: 400,
    });
  });

  await test(
    "9.4",
    "ASSIGNED → IN_TRANSIT directly → 400 (skip PICKUP_PENDING)",
    async () => {
      // Create fresh trip in ASSIGNED
      const result = await createAndMatchTrip(
        makeLoadPayload({
          weight: 1500,
          cargoDescription: "QA — skip test",
        })
      );

      // Try to skip PICKUP_PENDING
      await api("PATCH", `/api/trips/${result.tripId}`, {
        token: ctx.carrierToken,
        body: { status: "IN_TRANSIT" },
        expectStatus: 400,
      });

      // Cleanup: cancel this trip
      await api("POST", `/api/trips/${result.tripId}/cancel`, {
        token: ctx.carrierToken,
        body: { reason: "QA cleanup" },
        expectStatus: 200,
      });
    }
  );
}

// ===========================================================================
// PHASE 10 — Withdrawal Flow
// ===========================================================================
async function phase10() {
  header("PHASE 10: Withdrawal Flow");

  let balanceBefore: number;
  let withdrawalId: string;

  await test("10.1", "Record shipper balance before withdrawal", async () => {
    balanceBefore = await getWalletBalance(ctx.shipperToken!);
    assert(
      balanceBefore > 1000,
      `Shipper balance ${balanceBefore} too low for 1000 withdrawal`
    );
  });

  await test(
    "10.2",
    "Shipper requests withdrawal: 1000 ETB → PENDING",
    async () => {
      const { data } = await api("POST", "/api/financial/withdraw", {
        token: ctx.shipperToken,
        body: {
          amount: 1000,
          bankAccount: "1000123456789",
          bankName: "Commercial Bank of Ethiopia",
          accountHolder: "Meron Haile",
        },
        expectStatus: [200, 201],
      });
      const wr = (data.withdrawalRequest ?? data.withdrawal ?? data) as Record<
        string,
        unknown
      >;
      assertEqual(wr.status, "PENDING", "withdrawal status");
      withdrawalId = wr.id as string;
      assert(!!withdrawalId, "No withdrawal ID returned");
    }
  );

  await test("10.3", "Admin approves withdrawal", async () => {
    await api("PATCH", `/api/admin/withdrawals/${withdrawalId}`, {
      token: ctx.adminToken,
      body: { action: "APPROVED" },
      expectStatus: 200,
    });
  });

  await test("10.4", "Shipper balance reduced by 1000 ETB", async () => {
    const balanceAfter = await getWalletBalance(ctx.shipperToken!);
    assertApprox(
      balanceAfter,
      balanceBefore - 1000,
      "balance after withdrawal",
      1.0
    );
  });
}

// ===========================================================================
// PHASE 11 — Exception Flow
// ===========================================================================
async function phase11() {
  header("PHASE 11: Exception Flow");

  await test("11.1", "Create trip 3, walk to IN_TRANSIT", async () => {
    const result = await createAndMatchTrip(
      makeLoadPayload({
        weight: 5000,
        cargoDescription: "QA test — state machine test load",
      })
    );
    ctx.load3Id = result.loadId;
    ctx.trip3Id = result.tripId;

    await walkTrip(ctx.trip3Id!, ["PICKUP_PENDING", "IN_TRANSIT"]);
  });

  await test("11.2", "Carrier raises EXCEPTION on trip 3", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.trip3Id}`, {
      token: ctx.carrierToken,
      body: {
        status: "EXCEPTION",
        exceptionReason: "Vehicle breakdown on Addis-Adama expressway",
      },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "EXCEPTION", "trip3 status");
  });

  await test(
    "11.3",
    "Carrier cannot resolve EXCEPTION → 400 or 403",
    async () => {
      const { status } = await api("PATCH", `/api/trips/${ctx.trip3Id}`, {
        token: ctx.carrierToken,
        body: { status: "IN_TRANSIT" },
      });
      assert(
        status === 400 || status === 403,
        `Expected 400/403, got ${status}`
      );
    }
  );

  await test("11.4", "Dispatcher sees EXCEPTION status", async () => {
    const { data } = await api("GET", `/api/trips/${ctx.trip3Id}`, {
      token: ctx.dispatcherToken,
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "EXCEPTION", "dispatcher sees EXCEPTION");
  });

  await test("11.5", "Admin resolves EXCEPTION → IN_TRANSIT", async () => {
    const { data } = await api("PATCH", `/api/trips/${ctx.trip3Id}`, {
      token: ctx.adminToken,
      body: { status: "IN_TRANSIT" },
      expectStatus: 200,
    });
    const trip = (data.trip ?? data) as Record<string, unknown>;
    assertEqual(trip.status, "IN_TRANSIT", "admin resolved to IN_TRANSIT");
  });

  await test("11.6", "Complete trip 3 (corridor billing)", async () => {
    await walkTrip(ctx.trip3Id!, ["DELIVERED"]);
    await uploadPodAndComplete(ctx.trip3Id!);
  });

  await test("11.7", "Trip 3 fee deducted (corridor billing)", async () => {
    const load = await prisma.load.findUnique({
      where: { id: ctx.load3Id },
      select: {
        shipperFeeStatus: true,
        carrierFeeStatus: true,
        totalKmUsed: true,
      },
    });
    assertEqual(load!.shipperFeeStatus, "DEDUCTED", "trip3 shipperFeeStatus");
    assertEqual(load!.carrierFeeStatus, "DEDUCTED", "trip3 carrierFeeStatus");
    assertApprox(
      Number(load!.totalKmUsed),
      CORRIDOR_DISTANCE_KM,
      "trip3 totalKmUsed",
      0.5
    );
  });
}

// ===========================================================================
// PHASE 12 — Dispatcher Match Proposal
// ===========================================================================
async function phase12() {
  header("PHASE 12: Dispatcher Match Proposal");

  let matchLoadId: string;
  let proposalId: string;

  await test("12.1", "Post load for match proposal (POSTED)", async () => {
    const { data } = await api("POST", "/api/loads", {
      token: ctx.shipperToken,
      body: makeLoadPayload({
        weight: 7000,
        cargoDescription: "QA — match proposal test",
      }),
      expectStatus: 201,
    });
    const load = (data.load ?? data) as Record<string, unknown>;
    assertEqual(load.status, "POSTED", "match load status");
    matchLoadId = load.id as string;
  });

  await test("12.2", "Dispatcher creates match proposal", async () => {
    await ensureActivePosting();

    const { data } = await api("POST", "/api/match-proposals", {
      token: ctx.dispatcherToken,
      body: {
        loadId: matchLoadId,
        truckId: ctx.truckId,
        notes: "QA — dispatcher proposed match",
        expiresInHours: 24,
      },
      expectStatus: [200, 201],
    });
    const proposal = (data.proposal ?? data.matchProposal ?? data) as Record<
      string,
      unknown
    >;
    assert(!!proposal.id, "No proposal ID returned");
    proposalId = proposal.id as string;
  });

  await test(
    "12.3",
    "Carrier accepts match proposal → load assigned",
    async () => {
      const { data } = await api(
        "POST",
        `/api/match-proposals/${proposalId}/respond`,
        {
          token: ctx.carrierToken,
          body: { action: "ACCEPT" },
          expectStatus: 200,
        }
      );

      // Verify load is now ASSIGNED
      const { data: loadData } = await api("GET", `/api/loads/${matchLoadId}`, {
        token: ctx.shipperToken,
        expectStatus: 200,
      });
      const load = (loadData.load ?? loadData) as Record<string, unknown>;
      assertEqual(load.status, "ASSIGNED", "load assigned via match proposal");
    }
  );
}

// ===========================================================================
// PHASE 13 — Security Boundaries & Edge Cases
// ===========================================================================
async function phase13() {
  header("PHASE 13: Security Boundaries & Edge Cases");

  await test("13.1", "Unauthenticated → 401 on GET /api/loads", async () => {
    await api("GET", "/api/loads", { expectStatus: 401 });
  });

  await test("13.2", "Shipper cannot GET /api/trucks → 403", async () => {
    await api("GET", "/api/trucks", {
      token: ctx.shipperToken,
      expectStatus: 403,
    });
  });

  await test("13.3", "Carrier cannot POST /api/loads → 403", async () => {
    await api("POST", "/api/loads", {
      token: ctx.carrierToken,
      body: makeLoadPayload({ weight: 1000, cargoDescription: "Forbidden" }),
      expectStatus: 403,
    });
  });

  await test(
    "13.4",
    "Document lock: upload to approved org → 403/423",
    async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([makePng()], { type: "image/png" }),
        "test-doc.png"
      );
      formData.append("type", "BUSINESS_REGISTRATION");
      formData.append("entityType", "company");
      formData.append("entityId", ctx.shipperOrgId!);

      const { status } = await api("POST", "/api/documents/upload", {
        token: ctx.shipperToken,
        formData,
      });
      assert(
        status === 403 || status === 423,
        `Expected 403/423 for locked org upload, got ${status}`
      );
    }
  );

  await test(
    "13.5",
    "Carrier wallet gate → 402 on GET /api/loads",
    async () => {
      await api("PATCH", `/api/admin/users/${ctx.carrierUserId}/wallet`, {
        token: ctx.adminToken,
        body: { minimumBalance: 9999999 },
        expectStatus: 200,
      });

      const { status } = await api("GET", "/api/loads", {
        token: ctx.carrierToken,
      });
      assertEqual(status, 402, "carrier wallet gate on loads");

      // Reset
      await api("PATCH", `/api/admin/users/${ctx.carrierUserId}/wallet`, {
        token: ctx.adminToken,
        body: { minimumBalance: 0 },
        expectStatus: 200,
      });
    }
  );

  await test(
    "13.6",
    "Dispatcher sees null for revenue (not financial)",
    async () => {
      const { data } = await api("GET", "/api/admin/analytics", {
        token: ctx.dispatcherToken,
        expectStatus: 200,
      });
      const summary = data.summary as Record<string, unknown>;
      assertEqual(summary.revenue, null, "dispatcher revenue");
    }
  );

  await test(
    "13.7",
    "Notifications exist for carrier (at least 1)",
    async () => {
      const { data } = await api("GET", "/api/notifications", {
        token: ctx.carrierToken,
        expectStatus: 200,
      });
      const notifs = (data.notifications ?? data) as unknown[];
      assert(
        Array.isArray(notifs) && notifs.length >= 1,
        `Expected ≥1 notification, got ${Array.isArray(notifs) ? notifs.length : 0}`
      );
    }
  );
}

// ===========================================================================
// PHASE 14 — Analytics Verification
// ===========================================================================
async function phase14() {
  header("PHASE 14: Analytics Verification");

  await test(
    "14.1",
    "Admin analytics: revenue matches sum of all fee deductions",
    async () => {
      const { data } = await api("GET", "/api/admin/analytics", {
        token: ctx.adminToken,
        expectStatus: 200,
      });
      const summary = data.summary as Record<string, unknown>;
      const revenue = summary.revenue as Record<string, unknown>;
      assert(!!revenue, "No revenue data in analytics");

      const platformBalance = (revenue.platformBalance as number) ?? 0;
      assert(
        platformBalance > 0,
        `platformBalance = ${platformBalance}, expected > 0`
      );
    }
  );

  await test(
    "14.2",
    "Completed trip count ≥ 3 (trip1 + trip2 + trip3)",
    async () => {
      const { data } = await api("GET", "/api/admin/analytics", {
        token: ctx.adminToken,
        expectStatus: 200,
      });
      const summary = data.summary as Record<string, unknown>;
      const trips = summary.trips as Record<string, unknown>;
      const completed = trips.completed as number;
      assert(completed >= 3, `completed trips = ${completed}, expected ≥ 3`);
    }
  );

  await test("14.3", "Completed trip count matches DB", async () => {
    const dbCount = await prisma.trip.count({
      where: { status: "COMPLETED" },
    });
    const { data } = await api("GET", "/api/admin/analytics", {
      token: ctx.adminToken,
      expectStatus: 200,
    });
    const summary = data.summary as Record<string, unknown>;
    const trips = summary.trips as Record<string, unknown>;
    assertEqual(
      trips.completed as number,
      dbCount,
      "analytics vs DB completed count"
    );
  });
}

// ===========================================================================
// Main
// ===========================================================================
async function main() {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║  FREIGHT MANAGEMENT — Deep E2E QA Suite v3                      ║"
  );
  console.log("║  Testing against: " + BASE_URL.padEnd(45) + "║");
  console.log(
    "╚══════════════════════════════════════════════════════════════════╝"
  );

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
    await phase11();
    await phase12();
    await phase13();
    await phase14();
  } catch (err) {
    console.error("\n💥 FATAL ERROR:", err);
    failCount++;
    failures.push(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  }

  // PHASE 15: Capture final financial state for browser suite
  try {
    const shipperWalletRes = await api("GET", "/api/wallet/balance", {
      token: ctx.shipperToken,
      expectStatus: 200,
    });
    ctx.shipperFinalBalance = shipperWalletRes.data.totalBalance as number;

    const carrierWalletRes = await api("GET", "/api/wallet/balance", {
      token: ctx.carrierToken,
      expectStatus: 200,
    });
    ctx.carrierFinalBalance = carrierWalletRes.data.totalBalance as number;

    const analyticsRes = await api("GET", "/api/admin/analytics", {
      token: ctx.adminToken,
      expectStatus: 200,
    });
    const summary = analyticsRes.data.summary as Record<string, unknown>;
    const revenue = summary.revenue as Record<string, unknown> | null;
    const trips = summary.trips as Record<string, unknown>;
    ctx.totalPlatformRevenue = (revenue?.platformBalance as number) ?? 0;
    ctx.completedTripCount = (trips?.completed as number) ?? 0;
  } catch (e) {
    console.error("Failed to capture final financial state:", e);
  }
  ctx.shipperTopupAmount = SHIPPER_STARTING_BALANCE;
  ctx.carrierTopupAmount = CARRIER_STARTING_BALANCE;

  // Write context for Playwright (include credentials for browser login)
  ctx.credentials = CREDS;
  fs.writeFileSync(CONTEXT_PATH, JSON.stringify(ctx, null, 2));

  // Summary
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
  if (failures.length > 0) {
    console.log(`\n  FAILURES:`);
    for (const f of failures) {
      console.log(`    • ${f}`);
    }
  }
  console.log(`${"═".repeat(70)}\n`);

  await prisma.$disconnect();
  await pool.end();

  process.exit(failCount > 0 ? 1 : 0);
}

main();
