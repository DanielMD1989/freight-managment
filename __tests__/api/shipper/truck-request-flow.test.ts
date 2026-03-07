// @jest-environment node
/**
 * Round A8 — Shipper Request Flow: Gap Tests
 *
 * Covers:
 *  G-A8-2  Approve cancels pending requests from OTHER shippers targeting same truck
 *  G-A8-3  Truck request creation transitions load POSTED → OFFERED
 *  G-A8-4  DELETE /api/truck-requests/[id] adds cache invalidation + LoadEvent
 *  G-A8-5  GET  /api/truck-requests/[id]  is visible to DISPATCHER
 *
 * Note: G-A8-1 (mobile routing) is tested in
 *       mobile/__tests__/utils/notificationRouting.test.ts
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
  SeedData,
} from "../../utils/routeTestUtils";

// ── All mocks BEFORE require() ───────────────────────────────────────────────
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

// ── Route handlers AFTER mocks ───────────────────────────────────────────────
const { POST: createTruckRequest } = require("@/app/api/truck-requests/route");
const {
  GET: getTruckRequest,
  DELETE: deleteTruckRequest,
} = require("@/app/api/truck-requests/[id]/route");
const {
  POST: respondToTruckRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");

// ── Sessions ─────────────────────────────────────────────────────────────────
const shipperSession = createMockSession({
  userId: "a8-shipper-user-1",
  role: "SHIPPER",
  organizationId: "a8-shipper-org-1",
  status: "ACTIVE",
});

const shipperSession2 = createMockSession({
  userId: "a8-shipper-user-2",
  role: "SHIPPER",
  organizationId: "a8-shipper-org-2",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "a8-carrier-user-1",
  role: "CARRIER",
  organizationId: "a8-carrier-org-1",
  status: "ACTIVE",
});

const dispatcherSession = createMockSession({
  userId: "a8-dispatcher-user-1",
  role: "DISPATCHER",
  organizationId: "a8-dispatcher-org-1",
  status: "ACTIVE",
});

// ── Shared test data ─────────────────────────────────────────────────────────

let seed: SeedData;

// IDs that are stable across all tests in this file
const TRUCK_ID = "a8-truck-001";
const LOAD_A_ID = "a8-load-001"; // Shipper 1's load
const LOAD_B_ID = "a8-load-002"; // Shipper 2's load — same truck targeted

beforeAll(async () => {
  seed = await seedTestData();

  // Primary shipper org for this test file (organizationId used in shipperSession)
  await db.organization.create({
    data: {
      id: "a8-shipper-org-1",
      name: "A8 Primary Shipper",
      type: "IMPORT_EXPORT",
      contactEmail: "s1@test.com",
      contactPhone: "+251900000011",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.user.create({
    data: {
      id: "a8-shipper-user-1",
      email: "s1@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "A8",
      lastName: "Shipper",
      phone: "+251900000011",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "a8-shipper-org-1",
    },
  });

  // Second shipper org + user
  await db.organization.create({
    data: {
      id: "a8-shipper-org-2",
      name: "Second Shipper Co",
      type: "IMPORT_EXPORT",
      contactEmail: "s2@test.com",
      contactPhone: "+251900000022",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.user.create({
    data: {
      id: "a8-shipper-user-2",
      email: "s2@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Second",
      lastName: "Shipper",
      phone: "+251900000022",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "a8-shipper-org-2",
    },
  });

  // Carrier org + user
  await db.organization.create({
    data: {
      id: "a8-carrier-org-1",
      name: "A8 Carrier Inc",
      type: "CARRIER_COMPANY",
      contactEmail: "c1@test.com",
      contactPhone: "+251900000033",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.user.create({
    data: {
      id: "a8-carrier-user-1",
      email: "c1@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "A8",
      lastName: "Carrier",
      phone: "+251900000033",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "a8-carrier-org-1",
    },
  });

  // Dispatcher user
  await db.user.create({
    data: {
      id: "a8-dispatcher-user-1",
      email: "d1@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "A8",
      lastName: "Dispatcher",
      phone: "+251900000044",
      role: "DISPATCHER",
      status: "ACTIVE",
    },
  });

  // Truck owned by a8-carrier-org-1
  await db.truck.create({
    data: {
      id: TRUCK_ID,
      licensePlate: "A8-TRK-001",
      truckType: "DRY_VAN",
      capacity: 10000,
      carrierId: "a8-carrier-org-1",
      approvalStatus: "APPROVED",
      isAvailable: true,
    },
  });
  await db.truckPosting.create({
    data: {
      id: "a8-posting-001",
      truckId: TRUCK_ID,
      carrierId: "a8-carrier-org-1",
      status: "ACTIVE",
      availableFrom: new Date(),
    },
  });

  // Financial accounts for wallet validation (a8-shipper-org-1 + a8-carrier-org-1)
  await db.financialAccount.create({
    data: {
      id: "a8-shipper-wallet",
      organizationId: "a8-shipper-org-1",
      accountType: "SHIPPER_WALLET",
      balance: 99999,
      isActive: true,
    },
  });
  await db.financialAccount.create({
    data: {
      id: "a8-carrier-wallet",
      organizationId: "a8-carrier-org-1",
      accountType: "CARRIER_WALLET",
      balance: 99999,
      isActive: true,
    },
  });
  await db.financialAccount.create({
    data: {
      id: "a8-shipper2-wallet",
      organizationId: "a8-shipper-org-2",
      accountType: "SHIPPER_WALLET",
      balance: 99999,
      isActive: true,
    },
  });
  await db.financialAccount.create({
    data: {
      id: "a8-carrier-wallet-2",
      organizationId: "a8-carrier-org-1",
      accountType: "CARRIER_WALLET",
      balance: 99999,
      isActive: true,
    },
  });

  // Load A — belongs to a8-shipper-org-1 (shipperSession)
  await db.load.create({
    data: {
      id: LOAD_A_ID,
      status: "POSTED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "A8 test cargo A",
      shipperId: "a8-shipper-org-1",
      createdById: "a8-shipper-user-1",
      postedAt: new Date(),
    },
  });

  // Load B — belongs to a8-shipper-org-2 (shipperSession2)
  await db.load.create({
    data: {
      id: LOAD_B_ID,
      status: "POSTED",
      pickupCity: "Adama",
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 3000,
      cargoDescription: "A8 test cargo B",
      shipperId: "a8-shipper-org-2",
      createdById: "a8-shipper-user-2",
      postedAt: new Date(),
    },
  });
});

afterAll(() => {
  clearAllStores();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// G-A8-3: POST creates truck request → load transitions POSTED → OFFERED
// ══════════════════════════════════════════════════════════════════════════════

describe("G-A8-3 — truck request creation transitions load POSTED → OFFERED", () => {
  const OFFERED_LOAD_ID = "a8-offered-load-001";

  beforeAll(async () => {
    // Fresh POSTED load
    await db.load.create({
      data: {
        id: OFFERED_LOAD_ID,
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "OFFERED transition test",
        shipperId: "a8-shipper-org-1",
        createdById: "a8-shipper-user-1",
        postedAt: new Date(),
      },
    });
  });

  beforeEach(() => {
    setAuthSession(shipperSession);
  });

  it("A8-3a: load status is POSTED before request", async () => {
    const load = await db.load.findUnique({ where: { id: OFFERED_LOAD_ID } });
    expect(load?.status).toBe("POSTED");
  });

  it("A8-3b: after truck request created, load status becomes OFFERED", async () => {
    const req = createRequest("POST", "http://localhost/api/truck-requests", {
      body: {
        loadId: OFFERED_LOAD_ID,
        truckId: TRUCK_ID,
        expiresInHours: 24,
      },
    });
    const res = await createTruckRequest(req);
    expect(res.status).toBe(201);

    // Load must now be OFFERED
    const updated = await db.load.findUnique({
      where: { id: OFFERED_LOAD_ID },
    });
    expect(updated?.status).toBe("OFFERED");
  });

  it("A8-3c: if load is already OFFERED or SEARCHING, status is not changed", async () => {
    // Manually set load to SEARCHING
    const SEARCHING_LOAD_ID = "a8-searching-load-001";
    await db.load.create({
      data: {
        id: SEARCHING_LOAD_ID,
        status: "SEARCHING",
        pickupCity: "Addis Ababa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "Already searching",
        shipperId: "a8-shipper-org-1",
        createdById: "a8-shipper-user-1",
        postedAt: new Date(),
      },
    });

    const secondTruck = "a8-truck-002";
    await db.truck.create({
      data: {
        id: secondTruck,
        licensePlate: "A8-TRK-002",
        truckType: "DRY_VAN",
        capacity: 8000,
        carrierId: "a8-carrier-org-1",
        approvalStatus: "APPROVED",
        isAvailable: true,
      },
    });
    await db.truckPosting.create({
      data: {
        id: "a8-posting-002",
        truckId: secondTruck,
        carrierId: "a8-carrier-org-1",
        status: "ACTIVE",
        availableFrom: new Date(),
      },
    });

    const req = createRequest("POST", "http://localhost/api/truck-requests", {
      body: {
        loadId: SEARCHING_LOAD_ID,
        truckId: secondTruck,
        expiresInHours: 24,
      },
    });
    const res = await createTruckRequest(req);
    expect(res.status).toBe(201);

    const updated = await db.load.findUnique({
      where: { id: SEARCHING_LOAD_ID },
    });
    // Should remain SEARCHING, not change to OFFERED
    expect(updated?.status).toBe("SEARCHING");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// G-A8-2: Approve cancels sibling PENDING requests for same truck on other loads
// ══════════════════════════════════════════════════════════════════════════════

describe("G-A8-2 — approve cancels other-load pending requests for same truck", () => {
  const REQUEST_A_ID = "a8-req-a-001"; // Shipper1 → Truck X for Load A
  const REQUEST_B_ID = "a8-req-b-001"; // Shipper2 → Truck X for Load B

  beforeAll(async () => {
    // Shipper 1's pending request for Load A → Truck X
    await db.truckRequest.create({
      data: {
        id: REQUEST_A_ID,
        loadId: LOAD_A_ID,
        truckId: TRUCK_ID,
        shipperId: "a8-shipper-org-1",
        requestedById: "a8-shipper-user-1",
        carrierId: "a8-carrier-org-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Shipper 2's pending request for Load B → same Truck X
    await db.truckRequest.create({
      data: {
        id: REQUEST_B_ID,
        loadId: LOAD_B_ID,
        truckId: TRUCK_ID,
        shipperId: "a8-shipper-org-2",
        requestedById: "a8-shipper-user-2",
        carrierId: "a8-carrier-org-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  beforeEach(() => {
    setAuthSession(carrierSession);
  });

  it("A8-2a: before approve, Load B request for same truck is PENDING", async () => {
    const req = await db.truckRequest.findUnique({
      where: { id: REQUEST_B_ID },
    });
    expect(req?.status).toBe("PENDING");
  });

  it("A8-2b: carrier approves Load A request → Load B request is CANCELLED", async () => {
    const req = createRequest(
      "POST",
      `http://localhost/api/truck-requests/${REQUEST_A_ID}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await respondToTruckRequest(req, {
      params: Promise.resolve({ id: REQUEST_A_ID }),
    });

    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.load?.status).toBe("ASSIGNED");

    // Load B's request for the same truck must now be CANCELLED
    const reqB = await db.truckRequest.findUnique({
      where: { id: REQUEST_B_ID },
    });
    expect(reqB?.status).toBe("CANCELLED");
  });

  it("A8-2b-control: Load A's own request is APPROVED (not CANCELLED)", async () => {
    const reqA = await db.truckRequest.findUnique({
      where: { id: REQUEST_A_ID },
    });
    expect(reqA?.status).toBe("APPROVED");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// G-A8-4: DELETE /api/truck-requests/[id] — cache invalidation + LoadEvent
// ══════════════════════════════════════════════════════════════════════════════

describe("G-A8-4 — DELETE cancel has cache invalidation and LoadEvent", () => {
  const DELETE_REQ_ID = "a8-del-req-001";
  const DELETE_LOAD_ID = "a8-del-load-001";

  beforeAll(async () => {
    await db.load.create({
      data: {
        id: DELETE_LOAD_ID,
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Jimma",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "Delete cancel test",
        shipperId: "a8-shipper-org-1",
        createdById: "a8-shipper-user-1",
        postedAt: new Date(),
      },
    });

    await db.truckRequest.create({
      data: {
        id: DELETE_REQ_ID,
        loadId: DELETE_LOAD_ID,
        truckId: TRUCK_ID,
        shipperId: "a8-shipper-org-1",
        requestedById: "a8-shipper-user-1",
        carrierId: "a8-carrier-org-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  beforeEach(() => {
    setAuthSession(shipperSession);
  });

  it("A8-4: DELETE returns 200, creates LoadEvent, and invalidates cache", async () => {
    const { CacheInvalidation } = require("@/lib/cache");
    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-requests/${DELETE_REQ_ID}`,
      {}
    );
    const res = await deleteTruckRequest(req, {
      params: Promise.resolve({ id: DELETE_REQ_ID }),
    });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.message).toMatch(/cancelled/i);

    // LoadEvent must exist
    const events = await db.loadEvent.findMany({
      where: { loadId: DELETE_LOAD_ID, eventType: "REQUEST_CANCELLED" },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Cache must have been invalidated
    expect(CacheInvalidation.load).toHaveBeenCalledWith(DELETE_LOAD_ID);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// G-A8-5: GET /api/truck-requests/[id] — Dispatcher can access detail
// ══════════════════════════════════════════════════════════════════════════════

describe("G-A8-5 — GET /api/truck-requests/[id] accessible to DISPATCHER", () => {
  const DETAIL_REQ_ID = "a8-detail-req-001";
  const DETAIL_LOAD_ID = "a8-detail-load-001";

  beforeAll(async () => {
    await db.load.create({
      data: {
        id: DETAIL_LOAD_ID,
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "Dispatcher detail test",
        shipperId: "a8-shipper-org-1",
        createdById: "a8-shipper-user-1",
        postedAt: new Date(),
      },
    });

    await db.truckRequest.create({
      data: {
        id: DETAIL_REQ_ID,
        loadId: DETAIL_LOAD_ID,
        truckId: TRUCK_ID,
        shipperId: "a8-shipper-org-1",
        requestedById: "a8-shipper-user-1",
        carrierId: "a8-carrier-org-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  it("A8-5a: DISPATCHER can GET truck request detail → 200", async () => {
    setAuthSession(dispatcherSession);
    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${DETAIL_REQ_ID}`,
      {}
    );
    const res = await getTruckRequest(req, {
      params: Promise.resolve({ id: DETAIL_REQ_ID }),
    });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.request?.id ?? body.id).toBeDefined();
  });

  it("A8-5b: SHIPPER who owns the load can GET detail → 200", async () => {
    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${DETAIL_REQ_ID}`,
      {}
    );
    const res = await getTruckRequest(req, {
      params: Promise.resolve({ id: DETAIL_REQ_ID }),
    });
    expect(res.status).toBe(200);
  });

  it("A8-5c: CARRIER who owns the truck can GET detail → 200", async () => {
    setAuthSession(
      createMockSession({
        userId: "a8-carrier-user-x",
        role: "CARRIER",
        organizationId: "a8-carrier-org-1",
        status: "ACTIVE",
      })
    );
    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${DETAIL_REQ_ID}`,
      {}
    );
    const res = await getTruckRequest(req, {
      params: Promise.resolve({ id: DETAIL_REQ_ID }),
    });
    expect(res.status).toBe(200);
  });

  it("A8-5d: unrelated SHIPPER cannot GET detail → 404", async () => {
    setAuthSession(shipperSession2); // belongs to a8-shipper-org-2, not the load's org
    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${DETAIL_REQ_ID}`,
      {}
    );
    const res = await getTruckRequest(req, {
      params: Promise.resolve({ id: DETAIL_REQ_ID }),
    });
    expect(res.status).toBe(404);
  });
});
