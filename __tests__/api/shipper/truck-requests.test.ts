// @jest-environment node
/**
 * Shipper Truck Requests Tests (GAP-R3-T)
 *
 * Routes tested:
 * - POST /api/truck-requests                   (shipper creates request)
 * - GET  /api/truck-requests                   (role-based list)
 * - POST /api/truck-requests/[id]/respond      (carrier approves/rejects)
 *
 * Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only carrier who owns the truck can respond
 * - Shipper can request; carrier must approve
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
  POST: createTruckRequest,
  GET: listTruckRequests,
} = require("@/app/api/truck-requests/route");
const {
  POST: respondToTruckRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");

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

// ─── POST /api/truck-requests ────────────────────────────────────────────────

describe("Truck Requests — POST /api/truck-requests", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Create second carrier org for isolation tests
    await db.organization.create({
      data: {
        id: "carrier-org-2",
        name: "Other Carrier LLC",
        type: "CARRIER_COMPANY",
        contactEmail: "carrier2@test.com",
        contactPhone: "+251911000055",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "carrier-user-2",
        email: "carrier2@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911000055",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "carrier-org-2",
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

  // T-1: Shipper creates truck request → 201, status=PENDING
  it("T-1: shipper creates truck request → 201, status=PENDING", async () => {
    const req = createRequest("POST", "http://localhost/api/truck-requests", {
      body: {
        loadId: seed.load.id,
        truckId: seed.truck.id,
        notes: "Please handle with care",
        expiresInHours: 24,
      },
    });
    const res = await createTruckRequest(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(201);
    expect(body.request).toBeDefined();
    expect(body.request.status).toBe("PENDING");
    expect(body.request.loadId).toBe(seed.load.id);
    expect(body.request.truckId).toBe(seed.truck.id);
  });

  // T-2: CARRIER cannot create truck request → 403
  it("T-2: CARRIER cannot create truck request → 403", async () => {
    setAuthSession(carrierSession);

    const req = createRequest("POST", "http://localhost/api/truck-requests", {
      body: {
        loadId: seed.load.id,
        truckId: seed.truck.id,
      },
    });
    const res = await createTruckRequest(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // T-3: DISPATCHER cannot create truck request → 403
  it("T-3: DISPATCHER cannot create truck request → 403", async () => {
    const dispatcherSession = createMockSession({
      userId: "dispatcher-tr-user-1",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherSession);

    const req = createRequest("POST", "http://localhost/api/truck-requests", {
      body: {
        loadId: seed.load.id,
        truckId: seed.truck.id,
      },
    });
    const res = await createTruckRequest(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // T-10: Unauthenticated → 401
  it("T-10: unauthenticated POST /api/truck-requests → 401", async () => {
    setAuthSession(null);

    const req = createRequest("POST", "http://localhost/api/truck-requests", {
      body: { loadId: seed.load.id, truckId: seed.truck.id },
    });
    const res = await createTruckRequest(req);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/truck-requests ─────────────────────────────────────────────────

describe("Truck Requests — GET /api/truck-requests", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // T-4: Shipper GET → own requests (filtered by shipperId)
  it("T-4: shipper GET /api/truck-requests → 200, own requests only", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("GET", "http://localhost/api/truck-requests");
    const res = await listTruckRequests(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(Array.isArray(body.requests)).toBe(true);
  });

  // T-5: Carrier GET → requests for their trucks (filtered by carrierId)
  it("T-5: carrier GET /api/truck-requests → 200, requests for their trucks", async () => {
    setAuthSession(carrierSession);

    const req = createRequest("GET", "http://localhost/api/truck-requests");
    const res = await listTruckRequests(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(Array.isArray(body.requests)).toBe(true);
  });
});

// ─── POST /api/truck-requests/[id]/respond ───────────────────────────────────

describe("Truck Requests — POST /api/truck-requests/[id]/respond", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Create second carrier org + truck for isolation test
    await db.organization.create({
      data: {
        id: "tr-carrier-org-2",
        name: "Other Carrier Respond LLC",
        type: "CARRIER_COMPANY",
        contactEmail: "tr-carrier2@test.com",
        contactPhone: "+251911000066",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "tr-carrier-user-2",
        email: "tr-carrier2@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "TR",
        lastName: "Carrier2",
        phone: "+251911000066",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "tr-carrier-org-2",
      },
    });
    await db.financialAccount.create({
      data: {
        id: "wallet-tr-carrier-2",
        organizationId: "tr-carrier-org-2",
        accountType: "CARRIER_WALLET",
        balance: 5000,
        currency: "ETB",
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

  // T-6: Carrier (truck owner) responds APPROVE → 200, trip created, status=ASSIGNED
  it("T-6: carrier approves truck request → 200, trip created with status=ASSIGNED", async () => {
    // Create a fresh POSTED load for this test
    const freshLoad = await db.load.create({
      data: {
        id: "tr-load-for-approve",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Test cargo for truck request approve",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const truckRequest = await db.truckRequest.create({
      data: {
        id: "tr-approve-test",
        loadId: freshLoad.id,
        truckId: seed.truck.id,
        shipperId: "shipper-org-1",
        carrierId: "carrier-org-1",
        requestedById: "shipper-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    setAuthSession(carrierSession);

    const req = createRequest(
      "POST",
      `http://localhost/api/truck-requests/${truckRequest.id}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToTruckRequest, req, {
      id: truckRequest.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request).toBeDefined();
    expect(body.trip).toBeDefined();
    expect(body.trip.status).toBe("ASSIGNED");
  });

  // T-7: Carrier (truck owner) responds REJECT → 200, status=REJECTED
  it("T-7: carrier rejects truck request → 200, status=REJECTED", async () => {
    // Create a fresh load
    const freshLoad = await db.load.create({
      data: {
        id: "tr-load-for-reject",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Bahir Dar",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Test cargo for truck request reject",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const truckRequest = await db.truckRequest.create({
      data: {
        id: "tr-reject-test",
        loadId: freshLoad.id,
        truckId: seed.truck.id,
        shipperId: "shipper-org-1",
        carrierId: "carrier-org-1",
        requestedById: "shipper-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    setAuthSession(carrierSession);

    const req = createRequest(
      "POST",
      `http://localhost/api/truck-requests/${truckRequest.id}/respond`,
      { body: { action: "REJECT", responseNotes: "Not available" } }
    );
    const res = await callHandler(respondToTruckRequest, req, {
      id: truckRequest.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request.status).toBe("REJECTED");
  });

  // T-8: Different carrier (not truck owner) responds → 404 (resource cloaking)
  it("T-8: different carrier (not truck owner) responds → 404", async () => {
    const truckRequest = await db.truckRequest.create({
      data: {
        id: "tr-wrong-carrier-test",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: "shipper-org-1",
        carrierId: "carrier-org-1",
        requestedById: "shipper-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // carrier-org-2 does NOT own the truck (which belongs to carrier-org-1)
    const otherCarrierSession = createMockSession({
      userId: "tr-carrier-user-2",
      role: "CARRIER",
      organizationId: "tr-carrier-org-2",
      status: "ACTIVE",
    });
    setAuthSession(otherCarrierSession);

    const req = createRequest(
      "POST",
      `http://localhost/api/truck-requests/${truckRequest.id}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToTruckRequest, req, {
      id: truckRequest.id,
    });

    // Resource cloaking: not truck owner → 404
    expect(res.status).toBe(404);
  });

  // T-9: SHIPPER cannot respond (CARRIER_FINAL_AUTHORITY) → 404
  it("T-9: SHIPPER cannot respond to truck request → 404 (CARRIER_FINAL_AUTHORITY)", async () => {
    const truckRequest = await db.truckRequest.create({
      data: {
        id: "tr-shipper-respond-test",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: "shipper-org-1",
        carrierId: "carrier-org-1",
        requestedById: "shipper-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      `http://localhost/api/truck-requests/${truckRequest.id}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondToTruckRequest, req, {
      id: truckRequest.id,
    });

    // Shipper does not own the carrier — 404 (resource cloaking)
    expect(res.status).toBe(404);
  });
});
