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
  GET: getEscalations,
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

const _adminSession = createMockSession({
  userId: "admin-user-1",
  role: "ADMIN",
  organizationId: "admin-org-1",
  status: "ACTIVE",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escalationPayload(overrides: Record<string, unknown> = {}) {
  return {
    escalationType: "LATE_DELIVERY",
    title: "Carrier is significantly late",
    description: "Expected yesterday, no updates",
    priority: "MEDIUM",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Load Escalations — POST /api/loads/[id]/escalations", () => {
  let seed: SeedData;
  // A load with the assigned carrier so carrier session can escalate
  const assignedLoadId = "load-with-carrier-assigned";

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin user record (needed for db.user.findUnique inside route)
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

    // Assign the existing test truck to the test load so carrier has access
    await db.load.update({
      where: { id: seed.load.id },
      data: { assignedTruckId: seed.truck.id },
    });

    // Also create a separate load with the truck already assigned for carrier tests
    await db.load.create({
      data: {
        id: assignedLoadId,
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Assigned load for escalation tests",
        shipperId: seed.shipperOrg.id,
        createdById: "shipper-user-1",
        assignedTruckId: seed.truck.id,
        postedAt: new Date(),
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

  it("shipper can escalate own load → 200 with escalation object", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      { body: escalationPayload() }
    );
    const res = await callHandler(createEscalation, req, {
      id: seed.load.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("escalation");
    expect(body.escalation).toHaveProperty("id");
    expect(body.escalation).toHaveProperty("escalationType", "LATE_DELIVERY");
    expect(body.escalation).toHaveProperty("priority");
  });

  it("assigned carrier can escalate their load → 200", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${assignedLoadId}/escalations`,
      {
        body: escalationPayload({
          escalationType: "TRUCK_BREAKDOWN",
          title: "Truck broke down mid-route",
        }),
      }
    );
    const res = await callHandler(createEscalation, req, {
      id: assignedLoadId,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("escalation");
    expect(body.escalation).toHaveProperty("escalationType", "TRUCK_BREAKDOWN");
    // TRUCK_BREAKDOWN auto-escalates priority to HIGH
    expect(body.escalation.priority).toBe("HIGH");
  });

  it("CARRIER_NO_SHOW type auto-sets priority to HIGH", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      {
        body: escalationPayload({
          escalationType: "CARRIER_NO_SHOW",
          title: "Carrier did not show up",
          priority: "LOW", // should be overridden to HIGH by route logic
        }),
      }
    );
    const res = await callHandler(createEscalation, req, {
      id: seed.load.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.escalation).toHaveProperty("escalationType", "CARRIER_NO_SHOW");
    // Route auto-upgrades CARRIER_NO_SHOW to HIGH regardless of submitted priority
    expect(body.escalation.priority).toBe("HIGH");
  });

  // N2-3: notifyExceptionAssigned must include loadId in metadata (S10 fix)
  it("escalation with assignedTo calls notifyExceptionAssigned with loadId", async () => {
    setAuthSession(shipperSession);
    jest.clearAllMocks();

    // Create a dispatcher user to assign to
    await db.user.upsert({
      where: { id: "dispatcher-for-notify-test" },
      update: {},
      create: {
        id: "dispatcher-for-notify-test",
        email: "dispatcher-notify@test.com",
        role: "DISPATCHER",
        firstName: "Notify",
        lastName: "Dispatcher",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      {
        body: escalationPayload({
          assignedTo: "dispatcher-for-notify-test",
          escalationType: "DOCUMENTATION",
        }),
      }
    );
    const res = await callHandler(createEscalation, req, { id: seed.load.id });
    expect(res.status).toBe(200);

    const { notifyExceptionAssigned } = require("@/lib/notifications");
    expect(notifyExceptionAssigned).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "dispatcher-for-notify-test",
        loadId: seed.load.id,
      })
    );
  });

  it("unrelated user (different org, not dispatcher/admin) → 403", async () => {
    const unrelated = createMockSession({
      userId: "unrelated-carrier-user",
      role: "CARRIER",
      organizationId: "unrelated-carrier-org",
      status: "ACTIVE",
    });

    // Create user record so db.user.findUnique resolves
    await db.user.create({
      data: {
        id: "unrelated-carrier-user",
        email: "unrelated-carrier@test.com",
        role: "CARRIER",
        organizationId: "unrelated-carrier-org",
        firstName: "Unrelated",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    setAuthSession(unrelated);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      { body: escalationPayload() }
    );
    const res = await callHandler(createEscalation, req, {
      id: seed.load.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/permission/i);
  });

  it("returns 400 for invalid escalationType (Zod validation)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      {
        body: escalationPayload({
          escalationType: "INVALID_TYPE_XYZ",
        }),
      }
    );
    const res = await callHandler(createEscalation, req, {
      id: seed.load.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`,
      { body: escalationPayload() }
    );
    const res = await callHandler(createEscalation, req, {
      id: seed.load.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });
});

describe("Load Escalations — GET /api/loads/[id]/escalations", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Ensure shipper user record exists
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

  it("returns 200 with escalations array and count for shipper on own load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`
    );
    const res = await callHandler(getEscalations, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("escalations");
    expect(Array.isArray(body.escalations)).toBe(true);
    expect(body).toHaveProperty("count");
    expect(typeof body.count).toBe("number");
  });

  it("returns 403 for unrelated user on GET escalations", async () => {
    const unrelated = createMockSession({
      userId: "unrelated-get-user",
      role: "SHIPPER",
      organizationId: "unrelated-get-org",
      status: "ACTIVE",
    });

    await db.user.create({
      data: {
        id: "unrelated-get-user",
        email: "unrelated-get@test.com",
        role: "SHIPPER",
        organizationId: "unrelated-get-org",
        firstName: "Unrelated",
        lastName: "GetUser",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    setAuthSession(unrelated);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`
    );
    const res = await callHandler(getEscalations, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/permission/i);
  });

  it("returns 401 when unauthenticated for GET escalations", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/escalations`
    );
    const res = await callHandler(getEscalations, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });
});
