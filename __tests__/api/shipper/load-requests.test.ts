// @jest-environment node
/**
 * Load Requests Tests (SH-9)
 *
 * Routes tested:
 * - POST /api/load-requests           (carrier creates request)
 * - GET  /api/load-requests           (shipper lists incoming requests)
 * - POST /api/load-requests/[id]/respond (shipper approves or rejects)
 *
 * User stories: US-4.7–4.10
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
const {
  POST: createLoadRequest,
  GET: listLoadRequests,
} = require("@/app/api/load-requests/route");
const {
  POST: respondToLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");

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
  userId: "lr-admin-user-1",
  role: "ADMIN",
  organizationId: "lr-admin-org-1",
  status: "ACTIVE",
});

const superAdminSession = createMockSession({
  userId: "lr-superadmin-user-1",
  role: "SUPER_ADMIN",
  organizationId: "lr-admin-org-1",
  status: "ACTIVE",
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Load Requests — POST /api/load-requests", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // GAP-1: Create admin org + users for admin load-request tests
    await db.organization.create({
      data: {
        id: "lr-admin-org-1",
        name: "Load Request Admin Org",
        type: "PLATFORM",
        contactEmail: "lradmin@test.com",
        contactPhone: "+251911000091",
      },
    });
    await db.user.create({
      data: {
        id: "lr-admin-user-1",
        email: "lradmin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "LR",
        lastName: "Admin",
        phone: "+251911000091",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "lr-admin-org-1",
      },
    });
    await db.user.create({
      data: {
        id: "lr-superadmin-user-1",
        email: "lrsuperadmin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "LR",
        lastName: "SuperAdmin",
        phone: "+251911000092",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        organizationId: "lr-admin-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  it("carrier creates a load request → 201, status=PENDING", async () => {
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
          notes: "Available immediately",
          expiresInHours: 24,
        },
      }
    );
    const res = await createLoadRequest(req);
    const body = await parseResponse(res);

    expect([200, 201]).toContain(res.status);
    // Route returns { loadRequest: {...}, message: "..." }
    expect(body.loadRequest).toBeDefined();
    expect(body.loadRequest.loadId).toBe(seed.load.id);
    expect(body.loadRequest.truckId).toBe(seed.truck.id);
    expect(body.loadRequest.status).toBe("PENDING");
  });

  it("shipper (non-carrier) cannot create load request → 403", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: { loadId: seed.load.id, truckId: seed.truck.id },
      }
    );
    const res = await createLoadRequest(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/carrier/i);
  });

  it("duplicate load request for same load-truck pair → 400", async () => {
    // Create an existing PENDING request first
    await db.loadRequest.create({
      data: {
        id: "lr-dup-test",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        shipperId: "shipper-org-1",
        requestedById: "carrier-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: { loadId: seed.load.id, truckId: seed.truck.id },
      }
    );
    const res = await createLoadRequest(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already exists|pending request/i);
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: { loadId: seed.load.id, truckId: seed.truck.id },
      }
    );
    const res = await createLoadRequest(req);
    expect(res.status).toBe(401);
  });

  // GAP-1: ADMIN/SUPER_ADMIN can create load requests on behalf of carriers (BUG-2 fix)

  it("ADMIN can create load request on behalf of carrier → 201, status=PENDING", async () => {
    setAuthSession(adminSession);

    // Create a fresh POSTED load for this test
    await db.load.create({
      data: {
        id: "load-admin-lr-001",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Admin-created load request cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: {
          loadId: "load-admin-lr-001",
          truckId: seed.truck.id,
          notes: "Admin creating on behalf of carrier",
          expiresInHours: 24,
        },
      }
    );
    const res = await createLoadRequest(req);
    const body = await parseResponse(res);

    expect([200, 201]).toContain(res.status);
    expect(body.loadRequest).toBeDefined();
    expect(body.loadRequest.status).toBe("PENDING");
    // carrierId should be the truck's carrier org, not the admin's org
    expect(body.loadRequest.carrierId).toBe("carrier-org-1");
  });

  // GAP-D: DISPATCHER cannot create a load request → 403
  it("GAP-D: DISPATCHER cannot create load request → 403", async () => {
    const dispatcherSession = createMockSession({
      userId: "dispatcher-lr-user-1",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: { loadId: seed.load.id, truckId: seed.truck.id },
      }
    );
    const res = await createLoadRequest(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/carrier/i);
  });

  it("SUPER_ADMIN can create load request → 201, status=PENDING", async () => {
    setAuthSession(superAdminSession);

    await db.load.create({
      data: {
        id: "load-superadmin-lr-001",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2500,
        cargoDescription: "Super admin load request cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: {
          loadId: "load-superadmin-lr-001",
          truckId: seed.truck.id,
          expiresInHours: 24,
        },
      }
    );
    const res = await createLoadRequest(req);
    const body = await parseResponse(res);

    expect([200, 201]).toContain(res.status);
    expect(body.loadRequest).toBeDefined();
    expect(body.loadRequest.status).toBe("PENDING");
  });
});

describe("Load Requests — GET /api/load-requests", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("shipper gets list of incoming load requests → 200", async () => {
    const req = createRequest("GET", "http://localhost:3000/api/load-requests");
    const res = await listLoadRequests(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("loadRequests");
    expect(Array.isArray(body.loadRequests)).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest("GET", "http://localhost:3000/api/load-requests");
    const res = await listLoadRequests(req);
    expect(res.status).toBe(401);
  });

  // GAP-E: DISPATCHER with org lists load requests → 200
  it("GAP-E: DISPATCHER with organizationId gets load requests → 200", async () => {
    const dispatcherWithOrg = createMockSession({
      userId: "dispatcher-with-org-user",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherWithOrg);

    const req = createRequest("GET", "http://localhost:3000/api/load-requests");
    const res = await listLoadRequests(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("loadRequests");
    expect(Array.isArray(body.loadRequests)).toBe(true);
  });

  // GAP-F: DISPATCHER without org → 400 (validates BUG-D fix)
  it("GAP-F: DISPATCHER with null organizationId → 400 (BUG-D fix)", async () => {
    const dispatcherNoOrg = createMockSession({
      userId: "dispatcher-no-org-user",
      role: "DISPATCHER",
      organizationId: undefined,
      status: "ACTIVE",
    });
    setAuthSession(dispatcherNoOrg);

    const req = createRequest("GET", "http://localhost:3000/api/load-requests");
    const res = await listLoadRequests(req);
    const body = await parseResponse(res);

    // BUG-D fix: null-org dispatcher must not leak orphaned records
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/organization/i);
  });
});

describe("Load Requests — POST /api/load-requests/[id]/respond", () => {
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

  it("shipper rejects load request → 200, status=REJECTED", async () => {
    // Create a PENDING load request to reject
    const lr = await db.loadRequest.create({
      data: {
        id: "lr-respond-reject",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        shipperId: "shipper-org-1",
        requestedById: "carrier-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/load-requests/${lr.id}/respond`,
      { body: { action: "REJECT", responseNotes: "Not a good fit" } }
    );
    const res = await callHandler(respondToLoadRequest, req, { id: lr.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request.status).toBe("REJECTED");
  });

  it("shipper approves load request → 200, trip created", async () => {
    // Create a fresh POSTED load for this test (seeded load might already be ASSIGNED)
    const freshLoad = await db.load.create({
      data: {
        id: "load-for-lr-approve",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Test cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const lr = await db.loadRequest.create({
      data: {
        id: "lr-respond-approve",
        loadId: freshLoad.id,
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        shipperId: "shipper-org-1",
        requestedById: "carrier-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/load-requests/${lr.id}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToLoadRequest, req, { id: lr.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request).toBeDefined();
    expect(body.trip).toBeDefined();
    expect(body.trip.status).toBe("ASSIGNED");
  });

  it("non-owner (different org) cannot respond → 404 (resource cloaking)", async () => {
    const lr = await db.loadRequest.create({
      data: {
        id: "lr-cloaking-test",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        shipperId: "shipper-org-1",
        requestedById: "carrier-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Different shipper org trying to respond
    const otherShipper = createMockSession({
      userId: "other-shipper-user",
      role: "SHIPPER",
      organizationId: "other-shipper-org",
      status: "ACTIVE",
    });
    setAuthSession(otherShipper);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/load-requests/${lr.id}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToLoadRequest, req, { id: lr.id });
    await parseResponse(res);

    // Route returns 404 (resource cloaking) for non-owner
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid action", async () => {
    const lr = await db.loadRequest.create({
      data: {
        id: "lr-invalid-action",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        shipperId: "shipper-org-1",
        requestedById: "carrier-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/load-requests/${lr.id}/respond`,
      { body: { action: "INVALID_ACTION" } }
    );
    const res = await callHandler(respondToLoadRequest, req, { id: lr.id });

    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests/any-id/respond",
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToLoadRequest, req, { id: "any-id" });
    expect(res.status).toBe(401);
  });

  // GAP-G: DISPATCHER respond to load request → 404 (resource cloaking)
  it("GAP-G: DISPATCHER cannot respond to load request → 404", async () => {
    // Create a PENDING load request
    const lr = await db.loadRequest.create({
      data: {
        id: "lr-dispatcher-respond-test",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        shipperId: "shipper-org-1",
        requestedById: "carrier-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const dispatcherSession = createMockSession({
      userId: "dispatcher-respond-user",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/load-requests/${lr.id}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToLoadRequest, req, { id: lr.id });

    // Respond is SHIPPER-only. DISPATCHER gets 404 (resource cloaking, not 403)
    expect(res.status).toBe(404);
  });
});
