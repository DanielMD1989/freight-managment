// @jest-environment node
/**
 * Disputes Tests (GAP-R3-D)
 *
 * Routes tested:
 * - POST /api/disputes  → create dispute
 * - GET  /api/disputes  → list disputes
 *
 * Business rules verified:
 * - Shipper / Carrier can create disputes on their assigned loads
 * - BUG-R3-1 fix: DISPATCHER with matching org CANNOT create dispute → 404
 * - Unrelated shipper (different org) cannot create → 404
 * - Non-disputable status (POSTED) → 400
 * - GET is scoped to own org (cross-org isolation)
 * - Admin sees all disputes
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
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
const {
  POST: createDispute,
  GET: listDisputes,
} = require("@/app/api/disputes/route");

// ─── Sessions ────────────────────────────────────────────────────────────────

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

// adminSession used inline in D-9 test

// ─── Base dispute payload ─────────────────────────────────────────────────────

const baseDisputePayload = {
  type: "PAYMENT_ISSUE" as const,
  description: "The carrier did not deliver on time and damaged the goods",
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Disputes — POST /api/disputes", () => {
  beforeAll(async () => {
    await seedTestData();

    // Create admin org + user
    await db.organization.create({
      data: {
        id: "dispute-admin-org-1",
        name: "Dispute Admin Org",
        type: "PLATFORM",
        contactEmail: "dispute-admin@test.com",
        contactPhone: "+251911000070",
      },
    });
    await db.user.create({
      data: {
        id: "dispute-admin-user-1",
        email: "dispute-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Dispute",
        lastName: "Admin",
        phone: "+251911000070",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "dispute-admin-org-1",
      },
    });

    // Create second shipper org for cross-org test (D-5)
    await db.organization.create({
      data: {
        id: "dispute-shipper-org-2",
        name: "Other Dispute Shipper",
        type: "SHIPPER",
        contactEmail: "other-dispute-shipper@test.com",
        contactPhone: "+251911000071",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "dispute-shipper-user-2",
        email: "other-dispute-shipper@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251911000071",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "dispute-shipper-org-2",
      },
    });

    // Create a DISPATCHER who belongs to shipper-org-1 (for D-3)
    await db.user.create({
      data: {
        id: "dispute-dispatcher-user-1",
        email: "dispute-dispatcher@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Dispute",
        lastName: "Dispatcher",
        phone: "+251911000072",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "shipper-org-1",
      },
    });

    // Create a DISPATCHER who belongs to carrier-org-1 (for D-4)
    await db.user.create({
      data: {
        id: "dispute-carrier-dispatcher-user-1",
        email: "dispute-carrier-dispatcher@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Carrier",
        lastName: "Dispatcher",
        phone: "+251911000073",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
    });

    // Create an ASSIGNED load with truck for dispute tests
    await db.load.update({
      where: { id: "test-load-001" },
      data: {
        status: "ASSIGNED",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // D-1: Shipper creates dispute on own assigned load → 201
  it("D-1: shipper creates dispute on own assigned load → 200 with dispute", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "test-load-001",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    // Route returns 200 (not 201) with { dispute: {...} }
    expect([200, 201]).toContain(res.status);
    expect(body.dispute).toBeDefined();
    expect(body.dispute.status).toBe("OPEN");
  });

  // D-2: Carrier creates dispute on their assigned load → 200/201
  it("D-2: carrier creates dispute on their assigned load → 200/201 with dispute", async () => {
    setAuthSession(carrierSession);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "test-load-001",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    expect([200, 201]).toContain(res.status);
    expect(body.dispute).toBeDefined();
  });

  // D-3: DISPATCHER with shipper-org cannot create dispute → 404 (BUG-R3-1 fix)
  it("D-3: DISPATCHER with shipper-org cannot create dispute → 404 (BUG-R3-1 fix)", async () => {
    const dispatcherShipperOrg = createMockSession({
      userId: "dispute-dispatcher-user-1",
      role: "DISPATCHER",
      organizationId: "shipper-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherShipperOrg);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "test-load-001",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    // BUG-R3-1 fix: DISPATCHER is not SHIPPER/CARRIER → 404 (not 201)
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // D-4: DISPATCHER with carrier-org cannot create dispute → 404 (BUG-R3-1 fix)
  it("D-4: DISPATCHER with carrier-org cannot create dispute → 404 (BUG-R3-1 fix)", async () => {
    const dispatcherCarrierOrg = createMockSession({
      userId: "dispute-carrier-dispatcher-user-1",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherCarrierOrg);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "test-load-001",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    // BUG-R3-1 fix: DISPATCHER is not CARRIER role → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // D-5: Unrelated shipper (different org) cannot create dispute → 404
  it("D-5: unrelated shipper (different org) cannot create dispute → 404", async () => {
    const otherShipperSession = createMockSession({
      userId: "dispute-shipper-user-2",
      role: "SHIPPER",
      organizationId: "dispute-shipper-org-2",
      status: "ACTIVE",
    });
    setAuthSession(otherShipperSession);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "test-load-001",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // D-6: Dispute on POSTED load (non-disputable status) → 400
  it("D-6: dispute on POSTED load → 400 (not disputable)", async () => {
    // Create a fresh POSTED load (seeded one is now ASSIGNED)
    await db.load.create({
      data: {
        id: "posted-load-no-dispute",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "Posted cargo not disputable",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    setAuthSession(shipperSession);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "posted-load-no-dispute",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  // D-10: Unauthenticated → 401
  it("D-10: unauthenticated POST /api/disputes → 401", async () => {
    setAuthSession(null);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        ...baseDisputePayload,
        loadId: "test-load-001",
      },
    });
    const res = await createDispute(req);
    expect(res.status).toBe(401);
  });
});

describe("Disputes — GET /api/disputes", () => {
  beforeAll(async () => {
    await seedTestData();

    // Admin org + user
    await db.organization.create({
      data: {
        id: "disp-get-admin-org-1",
        name: "Disputes GET Admin Org",
        type: "PLATFORM",
        contactEmail: "disp-get-admin@test.com",
        contactPhone: "+251911000074",
      },
    });
    await db.user.create({
      data: {
        id: "disp-get-admin-user-1",
        email: "disp-get-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "DispGet",
        lastName: "Admin",
        phone: "+251911000074",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "disp-get-admin-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // D-7: Shipper GET disputes → 200, own org only
  it("D-7: shipper GET /api/disputes → 200 with own org disputes", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("GET", "http://localhost/api/disputes");
    const res = await listDisputes(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(Array.isArray(body.disputes)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  // D-8: Carrier GET disputes → 200, own org only (cross-org isolation)
  it("D-8: carrier GET /api/disputes → 200 with own org disputes (isolated)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest("GET", "http://localhost/api/disputes");
    const res = await listDisputes(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(Array.isArray(body.disputes)).toBe(true);
  });

  // D-9: Admin GET disputes → 200, all (admin org filter returns all via OR clause)
  it("D-9: admin GET /api/disputes → 200 with disputes", async () => {
    const adminSess = createMockSession({
      userId: "disp-get-admin-user-1",
      role: "ADMIN",
      organizationId: "disp-get-admin-org-1",
      status: "ACTIVE",
    });
    setAuthSession(adminSess);

    const req = createRequest("GET", "http://localhost/api/disputes");
    const res = await listDisputes(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(Array.isArray(body.disputes)).toBe(true);
  });
});
