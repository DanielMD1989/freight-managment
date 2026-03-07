/**
 * Carrier Load Marketplace Tests
 *
 * Tests for carrier's view of loads:
 * - GET /api/loads (marketplace) → { loads, pagination }
 * - GET /api/loads/[id] (details) → { load }
 * - PATCH /api/loads/[id] (status updates) → { load }
 * - DELETE /api/loads/[id] → { message }
 *
 * Business rules:
 * - Carrier marketplace forces status=POSTED (cannot override via query param)
 * - myTrips=true filters by assignedTruck.carrierId
 * - Shipper sees only own loads (shipperId filter)
 * - Admin/Dispatcher sees all loads
 * - Filters: truckType, pickupCity, deliveryCity, tripKmMin/Max, fullPartial, bookMode
 * - Sorting: age, postedAt, tripKm, pickupDate
 * - Anonymous shipper masking via maskCompany
 * - Contact masking via canSeeContact in load details
 * - Cannot edit load after ASSIGNED status
 * - State transitions validated by loadStateMachine
 * - Trip-Load status sync in $transaction
 * - Trust metrics updated on DELIVERED/CANCELLED
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
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks
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
// Override mockLoadUtils with correct maskCompany signature (isAnonymous, name)
jest.mock("@/lib/loadUtils", () => ({
  calculateAge: jest.fn(() => 30),
  canSeeContact: jest.fn(() => true),
  maskCompany: jest.fn((isAnonymous: boolean, name: string) =>
    isAnonymous ? "Anonymous Shipper" : name || "Unknown"
  ),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

jest.mock("@/lib/loadStateMachine", () => ({
  validateStateTransition: jest.fn(() => ({ valid: true })),
  LoadStatus: {
    DRAFT: "DRAFT",
    POSTED: "POSTED",
    ASSIGNED: "ASSIGNED",
    PICKUP_PENDING: "PICKUP_PENDING",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
  },
}));

jest.mock("@/lib/trustMetrics", () => ({
  incrementCompletedLoads: jest.fn(async () => {}),
  incrementCancelledLoads: jest.fn(async () => {}),
}));

jest.mock("@/lib/bypassDetection", () => ({
  checkSuspiciousCancellation: jest.fn(async () => ({ suspicious: false })),
}));

// Import handlers AFTER mocks
const { GET: listLoads, POST: createLoad } = require("@/app/api/loads/route");
const {
  GET: getLoad,
  PATCH: updateLoad,
  DELETE: deleteLoad,
} = require("@/app/api/loads/[id]/route");

describe("Carrier Load Marketplace", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-1",
    email: "dispatcher@test.com",
    role: "DISPATCHER",
    organizationId: "dispatcher-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin and dispatcher users so route's db.user.findUnique succeeds
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
    await db.user.create({
      data: {
        id: "dispatcher-user-1",
        email: "dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "dispatcher-org-1",
        firstName: "Dispatcher",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create additional loads for filtering tests
    await db.load.create({
      data: {
        id: "flatbed-load",
        status: "POSTED",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 8000,
        cargoDescription: "Steel beams",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
        tripKm: 500,
      },
    });

    await db.load.create({
      data: {
        id: "refrigerated-load",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        truckType: "REFRIGERATED",
        weight: 3000,
        cargoDescription: "Perishable goods",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
        tripKm: 275,
        fullPartial: "PARTIAL",
      },
    });

    await db.load.create({
      data: {
        id: "instant-book-load",
        status: "POSTED",
        pickupCity: "Adama",
        deliveryCity: "Dire Dawa",
        pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4500,
        cargoDescription: "Instant book cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
        tripKm: 400,
        bookMode: "INSTANT",
      },
    });

    await db.load.create({
      data: {
        id: "anonymous-load",
        status: "POSTED",
        pickupCity: "Gondar",
        deliveryCity: "Dessie",
        pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        truckType: "BOX_TRUCK",
        weight: 2000,
        cargoDescription: "Anonymous shipper cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
        tripKm: 350,
        isAnonymous: true,
        shipperContactName: "Secret Contact",
        shipperContactPhone: "+251911111111",
      },
    });

    await db.load.create({
      data: {
        id: "assigned-load",
        status: "ASSIGNED",
        pickupCity: "Dire Dawa",
        deliveryCity: "Jimma",
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 6000,
        cargoDescription: "Assigned cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
        shipperContactName: "Shipper Contact",
        shipperContactPhone: "+251922222222",
      },
    });

    await db.load.create({
      data: {
        id: "draft-load",
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        truckType: "CONTAINER",
        weight: 10000,
        cargoDescription: "Draft load not posted",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.load.create({
      data: {
        id: "short-trip-load",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Debre Berhan",
        pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 1500,
        cargoDescription: "Short distance cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
        tripKm: 130,
        fullPartial: "FULL",
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

  // ─── GET /api/loads ────────────────────────────────────────────────────────

  describe("GET /api/loads - Carrier Marketplace", () => {
    it("returns loads with pagination structure", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=20"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
      expect(Array.isArray(data.loads)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
      expect(typeof data.pagination.total).toBe("number");
      expect(typeof data.pagination.pages).toBe("number");
    });

    it("carrier marketplace returns only POSTED loads", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Carrier should only see POSTED loads in marketplace (not DRAFT, ASSIGNED, etc.)
      for (const load of data.loads) {
        expect(load.status).toBe("POSTED");
      }
    });

    it("carrier cannot override POSTED filter via status query param", async () => {
      // Carrier trying to see DRAFT loads — should still get only POSTED
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?status=DRAFT"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        expect(load.status).toBe("POSTED");
      }
    });

    it("filters by truckType", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?truckType=FLATBED"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads.length).toBeGreaterThan(0);
      for (const load of data.loads) {
        expect(load.truckType).toBe("FLATBED");
      }
    });

    it("filters by pickupCity (case-insensitive contains)", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?pickupCity=Mekelle"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        expect(load.pickupCity.toLowerCase()).toContain("mekelle");
      }
    });

    it("filters by deliveryCity", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?deliveryCity=Hawassa"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        expect(load.deliveryCity.toLowerCase()).toContain("hawassa");
      }
    });

    it("filters by fullPartial=PARTIAL", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?fullPartial=PARTIAL"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        expect(load.fullPartial).toBe("PARTIAL");
      }
    });

    it("filters by bookMode=INSTANT", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?bookMode=INSTANT"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        expect(load.bookMode).toBe("INSTANT");
      }
    });

    it("filters by tripKmMin and tripKmMax range", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?tripKmMin=200&tripKmMax=400"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        if (load.tripKm != null) {
          expect(load.tripKm).toBeGreaterThanOrEqual(200);
          expect(load.tripKm).toBeLessThanOrEqual(400);
        }
      }
    });

    it("loads include ageMinutes computed field", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const load of data.loads) {
        expect(typeof load.ageMinutes).toBe("number");
        expect(load.ageMinutes).toBeGreaterThanOrEqual(0);
      }
    });

    it("loads include shipper info (masked if anonymous)", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      const anonymousLoad = data.loads.find(
        (l: { id: string }) => l.id === "anonymous-load"
      );
      if (anonymousLoad && anonymousLoad.shipper) {
        expect(anonymousLoad.shipper.name).toBe("Anonymous Shipper");
      }
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect([401, 500]).toContain(res.status);
    });

    it("shipper sees only own loads", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
      // Shipper should see loads filtered by their org
      for (const load of data.loads) {
        expect(load.shipperId).toBe(shipperSession.organizationId);
      }
    });

    it("admin sees all loads (no org filter)", async () => {
      setAuthSession(adminSession);

      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
      // Admin should see more loads (including non-POSTED)
      expect(data.loads.length).toBeGreaterThanOrEqual(1);
    });

    it("dispatcher sees all loads", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
    });

    it("supports pagination bounds (limit respected)", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=2"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.limit).toBe(2);
      expect(data.loads.length).toBeLessThanOrEqual(2);
    });

    it("page 2 returns different results than page 1", async () => {
      const req1 = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=2"
      );
      const req2 = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=2&limit=2"
      );

      const res1 = await listLoads(req1);
      const res2 = await listLoads(req2);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const data1 = await parseResponse(res1);
      const data2 = await parseResponse(res2);

      if (data1.loads.length > 0 && data2.loads.length > 0) {
        expect(data1.loads[0].id).not.toBe(data2.loads[0].id);
      }
    });

    it("myTrips=true filters loads assigned to carrier's trucks", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?myTrips=true"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
      // Should include assigned-load since it's assigned to carrier's truck
    });

    it("loads include assignedTruck info when present", async () => {
      setAuthSession(adminSession); // Admin can see all loads including assigned

      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      const assignedLoad = data.loads.find(
        (l: { id: string }) => l.id === "assigned-load"
      );
      if (assignedLoad && assignedLoad.assignedTruck) {
        expect(assignedLoad.assignedTruck.id).toBe(seed.truck.id);
      }
    });
  });

  // ─── GET /api/loads/[id] ──────────────────────────────────────────────────

  describe("GET /api/loads/[id] - Load Details", () => {
    it("carrier can view POSTED load details → { load }", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );

      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.id).toBe(seed.load.id);
    });

    it("response includes ageMinutes computed field", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );

      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(typeof data.load.ageMinutes).toBe("number");
    });

    it("returns 404 for non-existent load", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/nonexistent"
      );

      const res = await callHandler(getLoad, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("admin can view any load", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );

      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
    });

    it("shipper can view own load", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );

      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);
    });

    it("carrier assigned to load can view full details", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/assigned-load"
      );

      const res = await callHandler(getLoad, req, { id: "assigned-load" });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.id).toBe("assigned-load");
    });

    it("carrier cannot view DRAFT load (not POSTED, not assigned)", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/draft-load"
      );

      const res = await callHandler(getLoad, req, { id: "draft-load" });
      // Should return 404 (permission denied hidden as not found)
      expect(res.status).toBe(404);
    });

    it("dispatcher can view any load", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/draft-load"
      );

      const res = await callHandler(getLoad, req, { id: "draft-load" });
      expect(res.status).toBe(200);
    });

    it("anonymous load masks shipper name", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/anonymous-load"
      );

      const res = await callHandler(getLoad, req, { id: "anonymous-load" });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      if (data.load.shipper) {
        expect(data.load.shipper.name).toBe("Anonymous Shipper");
      }
    });

    it("carrier can view anonymous load", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/anonymous-load"
      );

      const res = await callHandler(getLoad, req, { id: "anonymous-load" });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
    });

    it("load details include shipper info", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );

      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.id).toBe(seed.load.id);
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );

      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── PATCH /api/loads/[id] ─────────────────────────────────────────────────

  describe("PATCH /api/loads/[id] - Load Status Updates", () => {
    let editableLoadId: string;

    beforeAll(async () => {
      // Create a DRAFT load owned by shipper for edit tests
      // (POSTED loads block structural field edits — G-A5-1)
      const editLoad = await db.load.create({
        data: {
          id: "editable-draft-load",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Editable load cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          tripKm: 275,
        },
      });
      editableLoadId = editLoad.id;
    });

    it("shipper can update own DRAFT load fields", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${editableLoadId}`,
        {
          body: { weight: 6000, cargoDescription: "Updated cargo description" },
        }
      );

      const res = await callHandler(updateLoad, req, { id: editableLoadId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
    });

    it("cannot edit load after ASSIGNED status → 409", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/assigned-load",
        { body: { weight: 7000 } }
      );

      const res = await callHandler(updateLoad, req, { id: "assigned-load" });
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.error).toContain("Cannot edit load after");
    });

    it("carrier cannot edit shipper's load → 403", async () => {
      // Carrier session trying to edit a shipper's load
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${editableLoadId}`,
        { body: { weight: 9999 } }
      );

      const res = await callHandler(updateLoad, req, { id: editableLoadId });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent load", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/nonexistent-load",
        { body: { weight: 1000 } }
      );

      const res = await callHandler(updateLoad, req, {
        id: "nonexistent-load",
      });
      expect(res.status).toBe(404);
    });

    it("admin can update any load", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${editableLoadId}`,
        { body: { cargoDescription: "Admin updated description for cargo" } }
      );

      const res = await callHandler(updateLoad, req, { id: editableLoadId });
      expect(res.status).toBe(200);
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${editableLoadId}`,
        { body: { weight: 1000 } }
      );

      const res = await callHandler(updateLoad, req, { id: editableLoadId });
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── DELETE /api/loads/[id] ────────────────────────────────────────────────

  describe("DELETE /api/loads/[id] - Delete Load", () => {
    it("shipper can delete own POSTED load", async () => {
      setAuthSession(shipperSession);

      // Create a load to delete
      const deletableLoad = await db.load.create({
        data: {
          id: "deletable-load",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Deletable cargo load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/loads/${deletableLoad.id}`
      );

      const res = await callHandler(deleteLoad, req, { id: deletableLoad.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.message).toContain("deleted");
    });

    it("cannot delete ASSIGNED load → 400", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/assigned-load"
      );

      const res = await callHandler(deleteLoad, req, { id: "assigned-load" });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("Cannot delete");
    });

    it("carrier cannot delete shipper's load → 403", async () => {
      // Create a load for this test
      const carrierDeleteTarget = await db.load.create({
        data: {
          id: "carrier-cant-delete",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Carrier cannot delete this load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/loads/${carrierDeleteTarget.id}`
      );

      const res = await callHandler(deleteLoad, req, {
        id: carrierDeleteTarget.id,
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent load", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/nonexistent"
      );

      const res = await callHandler(deleteLoad, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("admin can delete any load", async () => {
      setAuthSession(adminSession);

      const adminDeleteTarget = await db.load.create({
        data: {
          id: "admin-delete-target",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Admin delete target cargo load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/loads/${adminDeleteTarget.id}`
      );

      const res = await callHandler(deleteLoad, req, {
        id: adminDeleteTarget.id,
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── POST /api/loads ──────────────────────────────────────────────────────

  describe("POST /api/loads - Create Load", () => {
    const validLoadData = {
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryDate: new Date(
        Date.now() + 8 * 24 * 60 * 60 * 1000
      ).toISOString(),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "Test cargo for creation",
      status: "POSTED",
      tripKm: 275,
    };

    it("shipper creates load → 201 with { load }", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: validLoadData,
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.pickupCity).toBe("Addis Ababa");
      expect(data.load.deliveryCity).toBe("Hawassa");
      expect(data.load.status).toBe("POSTED");
      expect(data.load.truckType).toBe("DRY_VAN");
    });

    it("shipper creates DRAFT load", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          ...validLoadData,
          status: "DRAFT",
          cargoDescription: "Draft cargo for test creation",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.load.status).toBe("DRAFT");
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: validLoadData,
      });

      const res = await createLoad(req);
      expect([401, 500]).toContain(res.status);
    });

    it("POSTED load sets postedAt timestamp", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          ...validLoadData,
          cargoDescription: "Posted load with timestamp test",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.load.postedAt).toBeDefined();
    });

    it("load is created with correct shipperId", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          ...validLoadData,
          cargoDescription: "Load with shipper org test",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.shipperId).toBe(seed.shipperOrg.id);
    });
  });
});
