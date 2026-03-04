// @jest-environment node
/**
 * Cross-Role Access Denial Tests (SH-15)
 *
 * Verifies CARRIER_FINAL_AUTHORITY and cross-org isolation rules:
 * - Shippers cannot browse /api/trucks (SHIPPER_DEMAND_FOCUS)
 * - Carriers cannot directly assign loads
 * - Settlement is admin-only
 * - Draft loads from another org are resource-cloaked (404)
 * - Escalations to another org's load are forbidden (403)
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
  SeedData,
} from "../../utils/routeTestUtils";

// All mocks BEFORE require()
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// Route handlers AFTER mocks
const { GET: listTrucks } = require("@/app/api/trucks/route");
const { GET: getLoad } = require("@/app/api/loads/[id]/route");
const { POST: assignLoad } = require("@/app/api/loads/[id]/assign/route");
const { POST: settlLoad } = require("@/app/api/loads/[id]/settle/route");
const {
  POST: createEscalation,
} = require("@/app/api/loads/[id]/escalations/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "carrier-user-1",
  role: "CARRIER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "admin-user-1",
  role: "ADMIN",
  organizationId: "admin-org-1",
  status: "ACTIVE",
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Cross-Role Access — SHIPPER_DEMAND_FOCUS (GET /api/trucks)", () => {
  beforeAll(async () => {
    await seedTestData();
    // Create admin user in DB for GET load test
    await db.user.upsert({
      where: { id: "admin-user-1" },
      update: {},
      create: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("SHIPPER GET /api/trucks → 403 (SHIPPER_DEMAND_FOCUS)", async () => {
    const req = createRequest("GET", "http://localhost:3000/api/trucks");
    const res = await listTrucks(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  it("CARRIER GET /api/trucks → 200", async () => {
    setAuthSession(carrierSession);

    const req = createRequest("GET", "http://localhost:3000/api/trucks");
    const res = await listTrucks(req);

    expect(res.status).toBe(200);
  });

  it("ADMIN GET /api/trucks → 200", async () => {
    setAuthSession(adminSession);

    const req = createRequest("GET", "http://localhost:3000/api/trucks");
    const res = await listTrucks(req);

    expect(res.status).toBe(200);
  });
});

describe("Cross-Role Access — DRAFT load resource cloaking (GET /api/loads/[id])", () => {
  const draftLoadId = "cross-role-draft-load";

  beforeAll(async () => {
    await seedTestData();

    // Ensure shipper user record exists in DB
    await db.user.upsert({
      where: { id: "shipper-user-1" },
      update: {},
      create: {
        id: "shipper-user-1",
        email: "shipper@test.com",
        role: "SHIPPER",
        organizationId: "shipper-org-1",
        firstName: "Test",
        lastName: "Shipper",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
    await db.user.upsert({
      where: { id: "carrier-user-1" },
      update: {},
      create: {
        id: "carrier-user-1",
        email: "carrier@test.com",
        role: "CARRIER",
        organizationId: "carrier-org-1",
        firstName: "Test",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
    await db.user.upsert({
      where: { id: "admin-user-1" },
      update: {},
      create: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create a DRAFT load owned by a DIFFERENT org (not shipper-org-1)
    await db.load.create({
      data: {
        id: draftLoadId,
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Another shipper's draft",
        shipperId: "other-shipper-org", // ← different org
        createdById: "other-shipper-user",
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("SHIPPER viewing another org's DRAFT load → 404 (resource cloaking)", async () => {
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${draftLoadId}`
    );
    const res = await callHandler(getLoad, req, { id: draftLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("CARRIER viewing another org's DRAFT load → 404 (not POSTED, no access)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${draftLoadId}`
    );
    const res = await callHandler(getLoad, req, { id: draftLoadId });

    expect(res.status).toBe(404);
  });

  it("ADMIN can view any load → 200", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${draftLoadId}`
    );
    const res = await callHandler(getLoad, req, { id: draftLoadId });

    expect(res.status).toBe(200);
  });
});

describe("Cross-Role Access — CARRIER_FINAL_AUTHORITY (POST /api/loads/[id]/assign)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
    await db.user.upsert({
      where: { id: "carrier-user-1" },
      update: {},
      create: {
        id: "carrier-user-1",
        email: "carrier@test.com",
        role: "CARRIER",
        organizationId: "carrier-org-1",
        firstName: "Test",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create a truck owned by a DIFFERENT org for the cross-ownership test.
    // After BUG-3 fix, CARRIER passes canAssignLoads; the 404 now comes from
    // the truck ownership check (carrier-org-1 cannot use other-carrier's truck).
    await db.organization.create({
      data: {
        id: "cross-other-carrier-org",
        name: "Cross Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "crossother@example.com",
        contactPhone: "+251911000099",
      },
    });
    await db.truck.create({
      data: {
        id: "cross-other-carrier-truck",
        truckType: "DRY_VAN",
        licensePlate: "XX-CROSS-99",
        capacity: 8000,
        isAvailable: true,
        carrierId: "cross-other-carrier-org",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  it("CARRIER cannot directly assign using another org's truck → 404 (ownership check)", async () => {
    // After BUG-3 fix: CARRIER passes canAssignLoads (CARRIER is in allowed list).
    // The 404 now comes from truck ownership check: carrier-org-1 cannot use
    // a truck owned by cross-other-carrier-org.
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/assign`,
      { body: { truckId: "cross-other-carrier-truck" } }
    );
    const res = await callHandler(assignLoad, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });
});

describe("Cross-Role Access — Settlement admin-only (POST /api/loads/[id]/settle)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("SHIPPER POST settle → 403 (admin-only)", async () => {
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/settle`
    );
    const res = await callHandler(settlLoad, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });

  it("CARRIER POST settle → 403 (admin-only)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/settle`
    );
    const res = await callHandler(settlLoad, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });
});

describe("Cross-Role Access — Escalations cross-org denial", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
    // Create user records so the route's db.user.findUnique returns the correct org
    // (without a user record, user?.organizationId = undefined which can falsely match
    // undefined === undefined when load has no assignedTruck)
    await db.user.upsert({
      where: { id: "unrelated-cross-user" },
      update: {},
      create: {
        id: "unrelated-cross-user",
        email: "unrelateds@test.com",
        role: "SHIPPER",
        organizationId: "unrelated-cross-org",
        firstName: "Unrelated",
        lastName: "Shipper",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
    await db.user.upsert({
      where: { id: "unrelated-carrier-cross" },
      update: {},
      create: {
        id: "unrelated-carrier-cross",
        email: "unrelatedc@test.com",
        role: "CARRIER",
        organizationId: "unrelated-carrier-cross-org",
        firstName: "Unrelated",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("unrelated shipper escalating another org's load → 403", async () => {
    const unrelated = createMockSession({
      userId: "unrelated-cross-user",
      role: "SHIPPER",
      organizationId: "unrelated-cross-org",
      status: "ACTIVE",
    });
    setAuthSession(unrelated);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      {
        body: {
          escalationType: "LATE_DELIVERY",
          title: "Test escalation",
          description: "Cross-org escalation attempt",
          priority: "MEDIUM",
        },
      }
    );
    const res = await callHandler(createEscalation, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  it("unrelated carrier (not assigned) escalating load → 403", async () => {
    const unrelated = createMockSession({
      userId: "unrelated-carrier-cross",
      role: "CARRIER",
      organizationId: "unrelated-carrier-cross-org",
      status: "ACTIVE",
    });
    setAuthSession(unrelated);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      {
        body: {
          escalationType: "LATE_DELIVERY",
          title: "Test",
          description: "Unrelated carrier escalation",
          priority: "MEDIUM",
        },
      }
    );
    const res = await callHandler(createEscalation, req, { id: seed.load.id });
    await parseResponse(res);

    expect(res.status).toBe(403);
  });
});
