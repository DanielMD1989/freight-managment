// @jest-environment node
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

import { db } from "@/lib/db";

// Route handlers — imported AFTER all mocks
const {
  GET: getSettlement,
  POST: postSettle,
} = require("@/app/api/loads/[id]/settle/route");
const {
  GET: getServiceFee,
} = require("@/app/api/loads/[id]/service-fee/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const _carrierSession = createMockSession({
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

// ─── Service Fee Tests ─────────────────────────────────────────────────────────

describe("Load Service Fee — GET /api/loads/[id]/service-fee", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("returns 200 with serviceFee and corridor keys for shipper on own load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("serviceFee");
    expect(body).toHaveProperty("corridor");
    expect(body).toHaveProperty("loadId", seed.load.id);
  });

  it("returns 404 for unrelated carrier (resource cloaking)", async () => {
    // Carrier session org does not match load.shipperId or load.assignedTruck.carrierId
    const unrelatedCarrier = createMockSession({
      userId: "unrelated-carrier-user",
      role: "CARRIER",
      organizationId: "unrelated-carrier-org",
      status: "ACTIVE",
    });
    setAuthSession(unrelatedCarrier);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });
});

// ─── Settlement GET Tests ──────────────────────────────────────────────────────

describe("Load Settlement — GET /api/loads/[id]/settle", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Ensure shipper user record exists for the db.user.findUnique check inside the route
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
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("returns 200 with status and settlement info for shipper on own load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/settle`
    );
    const res = await callHandler(getSettlement, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("loadId", seed.load.id);
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("settlement");
    expect(body.settlement).toHaveProperty("status");
    expect(body.settlement).toHaveProperty("canSettle");
  });

  it("returns 403 for user from unrelated org", async () => {
    const unrelated = createMockSession({
      userId: "unrelated-user-2",
      role: "SHIPPER",
      organizationId: "unrelated-org-2",
      status: "ACTIVE",
    });

    // Create the user record so db.user.findUnique resolves
    await db.user.create({
      data: {
        id: "unrelated-user-2",
        email: "unrelated2@test.com",
        role: "SHIPPER",
        organizationId: "unrelated-org-2",
        firstName: "Unrelated",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    setAuthSession(unrelated);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/settle`
    );
    const res = await callHandler(getSettlement, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── Settlement POST Tests ─────────────────────────────────────────────────────

describe("Load Settlement — POST /api/loads/[id]/settle", () => {
  let seed: SeedData;
  // IDs for loads created inline per-test
  const deliveredLoadId = "load-delivered-for-settle";
  const notDeliveredLoadId = "load-not-delivered";
  const podNotVerifiedLoadId = "load-pod-not-verified";

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin user record
    await db.user.create({
      data: {
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

    // Load that is fully ready for settlement
    await db.load.create({
      data: {
        id: deliveredLoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: true,
        settlementStatus: "PENDING",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Settled cargo",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    // Load that is not yet DELIVERED
    await db.load.create({
      data: {
        id: notDeliveredLoadId,
        status: "IN_TRANSIT",
        podSubmitted: false,
        podVerified: false,
        settlementStatus: "PENDING",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "In transit cargo",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    // Load that is DELIVERED but POD not verified
    await db.load.create({
      data: {
        id: podNotVerifiedLoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: false,
        settlementStatus: "PENDING",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Pending verification cargo",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(adminSession);
  });

  it("admin can successfully trigger settlement for DELIVERED + podVerified load → 200", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${deliveredLoadId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, { id: deliveredLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("settlement");
    expect(body.settlement).toHaveProperty("loadId", deliveredLoadId);
    expect(body.settlement).toHaveProperty("status", "PAID");
  });

  it("returns 403 when shipper attempts to trigger settlement", async () => {
    setAuthSession(shipperSession);

    // Create a fresh deliverable load for this test to avoid idempotency conflict
    const freshLoadId = "load-for-shipper-settle-attempt";
    await db.load.create({
      data: {
        id: freshLoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: true,
        settlementStatus: "PENDING",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Shipper attempt cargo",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${freshLoadId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, { id: freshLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });

  it("returns 400 when load status is not DELIVERED (e.g. IN_TRANSIT)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${notDeliveredLoadId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, { id: notDeliveredLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/settlement requirements/i);
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("returns 400 when podVerified is false", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${podNotVerifiedLoadId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, {
      id: podNotVerifiedLoadId,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/settlement requirements/i);
    expect(body.details.some((d: string) => /POD.*verified/i.test(d))).toBe(
      true
    );
  });

  // GAP-H: SHIPPER POST settle → 403 with full message assertion
  it("GAP-H: SHIPPER cannot trigger settlement — 403 with admin-only message", async () => {
    setAuthSession(shipperSession);

    const gapHLoadId = "load-gap-h-shipper-settle";
    await db.load.create({
      data: {
        id: gapHLoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: true,
        settlementStatus: "PENDING",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "GAP-H shipper settle attempt",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${gapHLoadId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, { id: gapHLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
    expect(body.error).toMatch(/unauthorized/i);
  });

  // GAP-I: DISPATCHER POST settle → 403
  it("GAP-I: DISPATCHER cannot trigger settlement → 403 (admin-only action)", async () => {
    const dispatcherSession = createMockSession({
      userId: "dispatcher-settle-user",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherSession);

    const gapILoadId = "load-gap-i-dispatcher-settle";
    await db.load.create({
      data: {
        id: gapILoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: true,
        settlementStatus: "PENDING",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "GAP-I dispatcher settle attempt",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${gapILoadId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, { id: gapILoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });

  it("returns 409 on double-settlement attempt (already PAID)", async () => {
    setAuthSession(adminSession);

    // Load that was already settled
    const alreadyPaidId = "load-already-paid";
    await db.load.create({
      data: {
        id: alreadyPaidId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: true,
        settlementStatus: "PAID",
        settledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Already paid cargo",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${alreadyPaidId}/settle`,
      { body: {} }
    );
    const res = await callHandler(postSettle, req, { id: alreadyPaidId });
    const body = await parseResponse(res);

    // Pre-transaction validation catches PAID status → 400
    // Inner transaction also catches it → 409 IDEMPOTENCY_CONFLICT
    expect([400, 409]).toContain(res.status);
    expect(body.error).toBeDefined();
  });
});
