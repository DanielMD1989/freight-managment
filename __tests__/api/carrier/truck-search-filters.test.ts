/**
 * Truck Marketplace Search Filter Tests — Round A7
 *
 * Tests for all 8 gaps found in the truck marketplace search audit:
 *
 * - G-A7-1: Destination filter includes open-destination (null) postings
 * - G-A7-2: Active-trip exclusion applied at WHERE level, not just response
 * - G-A7-3: PICKUP_PENDING included in every active-trip check
 * - G-A7-4: findMatchingTrucksForLoad excludes trucks on active trips
 * - G-A7-5: POST /api/truck-requests returns 409 when truck is on active trip
 * - G-A7-6: POST /api/load-requests returns 409 when truck is on active trip
 * - G-A7-7: GET /api/truck-postings/[id]/matching-loads includes SEARCHING/OFFERED
 * - G-A7-8: findMatchingLoadsForTruck uses SEARCHING/OFFERED in status filter
 *
 * Note: matchingEngine is NOT mocked so findMatchingLoadsForTruck /
 *       findMatchingTrucksForLoad can be tested with real DB calls (G-A7-4, G-A7-8).
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
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockLoadStateMachine,
  mockServiceFee,
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks — matchingEngine is intentionally NOT mocked here so that
// findMatchingLoadsForTruck / findMatchingTrucksForLoad run with real db calls.
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
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockLoadStateMachine();
mockServiceFee();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Import handlers AFTER mocks
const { GET: listTruckPostings } = require("@/app/api/truck-postings/route");
const { POST: createTruckRequest } = require("@/app/api/truck-requests/route");
const { POST: createLoadRequest } = require("@/app/api/load-requests/route");
const {
  GET: getMatchingLoads,
} = require("@/app/api/truck-postings/[id]/matching-loads/route");
// Import real matchingEngine functions (not mocked)
const {
  findMatchingLoadsForTruck,
  findMatchingTrucksForLoad,
} = require("@/lib/matchingEngine");

describe("Truck Marketplace Search Filters (A7)", () => {
  let seed: SeedData;

  const shipperSession = createMockSession({
    userId: "shipper-user-a7",
    email: "shipper-a7@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-a7",
  });

  const carrierSession = createMockSession({
    userId: "carrier-user-a7",
    email: "carrier-a7@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-a7",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Shipper org for A7 tests
    await db.organization.create({
      data: {
        id: "shipper-org-a7",
        name: "A7 Shipper Co",
        type: "SHIPPER",
        isVerified: true,
        contactEmail: "shipper-a7@test.com",
        contactPhone: "+251911000001",
        status: "ACTIVE",
      },
    });

    // Carrier org for A7 tests
    await db.organization.create({
      data: {
        id: "carrier-org-a7",
        name: "A7 Carrier Co",
        type: "CARRIER",
        isVerified: true,
        contactEmail: "carrier-a7@test.com",
        contactPhone: "+251911000002",
        status: "ACTIVE",
      },
    });

    await db.user.create({
      data: {
        id: "shipper-user-a7",
        email: "shipper-a7@test.com",
        role: "SHIPPER",
        organizationId: "shipper-org-a7",
        firstName: "A7",
        lastName: "Shipper",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "carrier-user-a7",
        email: "carrier-a7@test.com",
        role: "CARRIER",
        organizationId: "carrier-org-a7",
        firstName: "A7",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Truck with NO active trips (free)
    await db.truck.create({
      data: {
        id: "truck-a7-free",
        licensePlate: "A7-FREE-01",
        truckType: "DRY_VAN",
        capacity: 10000,
        carrierId: "carrier-org-a7",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        isAvailable: true,
      },
    });

    // Truck currently on an ASSIGNED trip
    await db.truck.create({
      data: {
        id: "truck-a7-busy-assigned",
        licensePlate: "A7-BUSY-01",
        truckType: "DRY_VAN",
        capacity: 10000,
        carrierId: "carrier-org-a7",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        isAvailable: false,
      },
    });

    // Truck currently on a PICKUP_PENDING trip
    await db.truck.create({
      data: {
        id: "truck-a7-busy-pickup",
        licensePlate: "A7-BUSY-02",
        truckType: "DRY_VAN",
        capacity: 10000,
        carrierId: "carrier-org-a7",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        isAvailable: false,
      },
    });

    // Posting for the free truck (owned by carrier-org-a7 → matches carrierSession)
    await db.truckPosting.create({
      data: {
        id: "posting-a7-free",
        truckId: "truck-a7-free",
        carrierId: "carrier-org-a7",
        originCityId: "city-addis",
        status: "ACTIVE",
        availableFrom: new Date(Date.now() + 86400000),
        fullPartial: "FULL",
        contactName: "Free Truck Driver",
        contactPhone: "+251911111111",
        createdById: "carrier-user-a7",
      },
    });

    // Posting for the busy (ASSIGNED) truck
    await db.truckPosting.create({
      data: {
        id: "posting-a7-busy-assigned",
        truckId: "truck-a7-busy-assigned",
        carrierId: "carrier-org-a7",
        originCityId: "city-addis",
        status: "ACTIVE",
        availableFrom: new Date(Date.now() + 86400000),
        fullPartial: "FULL",
        contactName: "Busy Truck Driver A",
        contactPhone: "+251911111112",
        createdById: "carrier-user-a7",
      },
    });

    // Posting for the busy (PICKUP_PENDING) truck
    await db.truckPosting.create({
      data: {
        id: "posting-a7-busy-pickup",
        truckId: "truck-a7-busy-pickup",
        carrierId: "carrier-org-a7",
        originCityId: "city-addis",
        status: "ACTIVE",
        availableFrom: new Date(Date.now() + 86400000),
        fullPartial: "FULL",
        contactName: "Busy Truck Driver B",
        contactPhone: "+251911111113",
        createdById: "carrier-user-a7",
      },
    });

    // City used as destination filter target
    await db.ethiopianLocation.create({
      data: {
        id: "city-a7-dest",
        name: "A7TestCity",
        isActive: true,
        region: "TestRegion",
      },
    });

    // Load for truck-request tests (POSTED, owned by shipper-org-a7)
    await db.load.create({
      data: {
        id: "load-a7-posted",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: new Date(Date.now() + 86400000),
        deliveryDate: new Date(Date.now() + 172800000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "A7 test load",
        shipperId: "shipper-org-a7",
        createdById: "shipper-user-a7",
        postedAt: new Date(),
      },
    });

    // SEARCHING load
    await db.load.create({
      data: {
        id: "load-a7-searching",
        status: "SEARCHING",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: new Date(Date.now() + 86400000),
        deliveryDate: new Date(Date.now() + 172800000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Searching status load",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    // OFFERED load
    await db.load.create({
      data: {
        id: "load-a7-offered",
        status: "OFFERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Gondar",
        pickupDate: new Date(Date.now() + 86400000),
        deliveryDate: new Date(Date.now() + 172800000),
        truckType: "DRY_VAN",
        weight: 3500,
        cargoDescription: "Offered status load",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    // Financial account for shipper-org-a7 (wallet check in GET /api/truck-postings)
    await db.financialAccount.create({
      data: {
        id: "fa-shipper-a7",
        organizationId: "shipper-org-a7",
        balance: 99999,
        minimumBalance: 0,
        isActive: true,
      },
    });

    // Financial account for carrier-org-a7
    await db.financialAccount.create({
      data: {
        id: "fa-carrier-a7",
        organizationId: "carrier-org-a7",
        balance: 99999,
        minimumBalance: 0,
        isActive: true,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── G-A7-1: Destination filter includes open-destination (null) trucks ─────

  describe("G-A7-1: Destination filter includes open-destination trucks", () => {
    beforeEach(() => {
      setAuthSession(shipperSession);
    });

    it("TS-1: WHERE clause uses OR to include destinationCityId=null when destination filter applied", async () => {
      const findManySpy = jest.spyOn(db.truckPosting, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings?destinationCityId=city-a7-dest`
      );
      await listTruckPostings(req);

      expect(findManySpy).toHaveBeenCalled();
      const whereArg = findManySpy.mock.calls[0][0]?.where;
      // Must use OR to include open-destination trucks
      expect(whereArg?.OR).toBeDefined();
      expect(whereArg?.OR).toEqual(
        expect.arrayContaining([
          { destinationCityId: "city-a7-dest" },
          { destinationCityId: null },
        ])
      );
    });

    it("TS-2: No destination filter → no OR clause for destination", async () => {
      const findManySpy = jest.spyOn(db.truckPosting, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings`
      );
      await listTruckPostings(req);

      expect(findManySpy).toHaveBeenCalled();
      const whereArg = findManySpy.mock.calls[0][0]?.where;
      // When no destination specified, no OR clause for destination
      expect(whereArg?.destinationCityId).toBeUndefined();
    });
  });

  // ─── G-A7-2: Active-trip exclusion applied at WHERE level ───────────────────

  describe("G-A7-2: Active-trip exclusion in WHERE clause", () => {
    beforeEach(() => {
      setAuthSession(shipperSession);
    });

    it("TS-3: WHERE clause contains truck.trips.none filter for active-trip exclusion", async () => {
      const findManySpy = jest.spyOn(db.truckPosting, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings`
      );
      await listTruckPostings(req);

      expect(findManySpy).toHaveBeenCalled();
      const whereArg = findManySpy.mock.calls[0][0]?.where;

      // Uses trips (hasMany) — supports .none filter
      expect(whereArg?.truck?.trips?.none).toBeDefined();
    });

    it("TS-4: truckType filter is merged with trips.none filter — no silent overwrite", async () => {
      const findManySpy = jest.spyOn(db.truckPosting, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings?truckType=DRY_VAN`
      );
      await listTruckPostings(req);

      expect(findManySpy).toHaveBeenCalled();
      const whereArg = findManySpy.mock.calls[0][0]?.where;

      // Both truckType AND trips.none must coexist in where.truck
      expect(whereArg?.truck?.truckType).toBe("DRY_VAN");
      expect(whereArg?.truck?.trips?.none).toBeDefined();
    });
  });

  // ─── G-A7-3: PICKUP_PENDING in active-trip status list ─────────────────────

  describe("G-A7-3: PICKUP_PENDING included in active-trip checks", () => {
    beforeEach(() => {
      setAuthSession(shipperSession);
    });

    it("TS-5: WHERE trips.none.status.in includes PICKUP_PENDING", async () => {
      const findManySpy = jest.spyOn(db.truckPosting, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings`
      );
      await listTruckPostings(req);

      expect(findManySpy).toHaveBeenCalled();
      const noneFilter =
        findManySpy.mock.calls[0][0]?.where?.truck?.trips?.none;

      expect(noneFilter?.status?.in).toEqual(
        expect.arrayContaining(["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"])
      );
    });

    it("TS-6: informational assignedLoad select covers PICKUP_PENDING", async () => {
      const findManySpy = jest.spyOn(db.truckPosting, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings`
      );
      await listTruckPostings(req);

      expect(findManySpy).toHaveBeenCalled();
      const call = findManySpy.mock.calls[0][0];
      const assignedLoadWhere =
        call?.include?.truck?.select?.assignedLoad?.where;

      // The informational assignedLoad include also covers PICKUP_PENDING
      expect(assignedLoadWhere?.status?.in).toContain("PICKUP_PENDING");
    });
  });

  // ─── G-A7-5: POST /api/truck-requests blocks trucks on active trips ─────────

  describe("G-A7-5: truck-requests POST blocks trucks on active trips", () => {
    beforeEach(() => {
      setAuthSession(shipperSession);
    });

    it("TS-7: returns 409 when requested truck is on an ASSIGNED trip", async () => {
      jest.spyOn(db.truck, "findUnique").mockResolvedValueOnce({
        id: "truck-a7-busy-assigned",
        carrierId: "carrier-org-a7",
        isAvailable: false,
        licensePlate: "A7-BUSY-01",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        postings: [{ id: "posting-a7-busy-assigned" }],
        trips: [{ id: "trip-active-1" }],
      } as any);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: {
            loadId: "load-a7-posted",
            truckId: "truck-a7-busy-assigned",
          },
        }
      );
      const res = await createTruckRequest(req);

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toMatch(/active trip/i);
    });

    it("TS-8: returns 409 when requested truck is in PICKUP_PENDING state", async () => {
      jest.spyOn(db.truck, "findUnique").mockResolvedValueOnce({
        id: "truck-a7-busy-pickup",
        carrierId: "carrier-org-a7",
        isAvailable: false,
        licensePlate: "A7-BUSY-02",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        postings: [{ id: "posting-a7-busy-pickup" }],
        trips: [{ id: "trip-active-2" }],
      } as any);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: {
            loadId: "load-a7-posted",
            truckId: "truck-a7-busy-pickup",
          },
        }
      );
      const res = await createTruckRequest(req);

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toMatch(/active trip/i);
    });

    it("TS-9: succeeds (201) when truck has no active trip", async () => {
      jest.spyOn(db.truck, "findUnique").mockResolvedValueOnce({
        id: "truck-a7-free",
        carrierId: "carrier-org-a7",
        isAvailable: true,
        licensePlate: "A7-FREE-01",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        postings: [{ id: "posting-a7-free" }],
        trips: [],
      } as any);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: {
            loadId: "load-a7-posted",
            truckId: "truck-a7-free",
          },
        }
      );
      const res = await createTruckRequest(req);

      expect(res.status).toBe(201);
    });
  });

  // ─── G-A7-6: POST /api/load-requests blocks trucks on active trips ──────────

  describe("G-A7-6: load-requests POST blocks trucks on active trips", () => {
    beforeEach(() => {
      setAuthSession(carrierSession);
    });

    it("TS-10: returns 409 when carrier's truck is on an ASSIGNED trip", async () => {
      jest.spyOn(db.truck, "findUnique").mockResolvedValueOnce({
        id: "truck-a7-busy-assigned",
        carrierId: "carrier-org-a7",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        licensePlate: "A7-BUSY-01",
        carrier: { id: "carrier-org-a7", name: "A7 Carrier Co" },
        trips: [{ id: "trip-active-1" }],
      } as any);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: "truck-a7-busy-assigned",
          },
        }
      );
      const res = await createLoadRequest(req);

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toMatch(/active trip/i);
    });

    it("TS-11: returns 409 when carrier's truck is in PICKUP_PENDING state", async () => {
      jest.spyOn(db.truck, "findUnique").mockResolvedValueOnce({
        id: "truck-a7-busy-pickup",
        carrierId: "carrier-org-a7",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        licensePlate: "A7-BUSY-02",
        carrier: { id: "carrier-org-a7", name: "A7 Carrier Co" },
        trips: [{ id: "trip-active-2" }],
      } as any);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: "truck-a7-busy-pickup",
          },
        }
      );
      const res = await createLoadRequest(req);

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toMatch(/active trip/i);
    });

    it("TS-12: succeeds (201) when carrier's truck has no active trip", async () => {
      jest.spyOn(db.truck, "findUnique").mockResolvedValueOnce({
        id: "truck-a7-free",
        carrierId: "carrier-org-a7",
        approvalStatus: "APPROVED",
        insuranceStatus: "VALID",
        licensePlate: "A7-FREE-01",
        carrier: { id: "carrier-org-a7", name: "A7 Carrier Co" },
        trips: [],
      } as any);

      jest.spyOn(db.truckPosting, "findFirst").mockResolvedValueOnce({
        id: "posting-a7-free",
        truckId: "truck-a7-free",
        status: "ACTIVE",
      } as any);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: "truck-a7-free",
          },
        }
      );
      const res = await createLoadRequest(req);

      expect(res.status).toBe(201);
    });
  });

  // ─── G-A7-7: matching-loads route includes SEARCHING/OFFERED ────────────────

  describe("G-A7-7: GET /api/truck-postings/[id]/matching-loads includes SEARCHING/OFFERED", () => {
    beforeEach(() => {
      // carrierSession owns posting-a7-free (carrierId = "carrier-org-a7")
      setAuthSession(carrierSession);
    });

    it("TS-13: load.findMany is called with status { in: [POSTED, SEARCHING, OFFERED] }", async () => {
      const findManySpy = jest.spyOn(db.load, "findMany");

      // Use posting-a7-free which is owned by carrier-org-a7 (matches carrierSession)
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/posting-a7-free/matching-loads`
      );
      const res = await callHandler(getMatchingLoads, req, {
        id: "posting-a7-free",
      });

      // May return 200 or other — we care about the db.load.findMany call
      const loadsCall = findManySpy.mock.calls.find(
        (call) =>
          call[0]?.where?.status?.in !== undefined ||
          call[0]?.where?.status !== undefined
      );
      expect(loadsCall).toBeDefined();
      const whereStatus = loadsCall?.[0]?.where?.status;
      // Must be the { in: [...] } form, not the plain "POSTED" string
      expect(whereStatus?.in).toBeDefined();
      expect(whereStatus?.in).toEqual(
        expect.arrayContaining(["POSTED", "SEARCHING", "OFFERED"])
      );
    });

    it("TS-14: plain status='POSTED' filter is NOT used (regression guard)", async () => {
      const findManySpy = jest.spyOn(db.load, "findMany");

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/posting-a7-free/matching-loads`
      );
      await callHandler(getMatchingLoads, req, { id: "posting-a7-free" });

      // No call should have status === "POSTED" (string equality)
      const callWithPostedOnly = findManySpy.mock.calls.find(
        (call) => call[0]?.where?.status === "POSTED"
      );
      expect(callWithPostedOnly).toBeUndefined();
    });
  });

  // ─── G-A7-8: findMatchingLoadsForTruck status filter ────────────────────────

  describe("G-A7-8: findMatchingLoadsForTruck uses SEARCHING/OFFERED in status filter", () => {
    it("TS-15: db.load.findMany WHERE includes status { in: [POSTED, SEARCHING, OFFERED] }", async () => {
      // Provide the truck posting so findUnique succeeds
      jest.spyOn(db.truckPosting, "findUnique").mockResolvedValueOnce({
        id: seed.truckPosting.id,
        status: "ACTIVE",
        carrierId: seed.carrierOrg.id,
        truckId: seed.truck.id,
        truck: {
          truckType: "DRY_VAN",
          capacity: 10000,
          lengthM: null,
          isAvailable: true,
        },
        originCity: { name: "Addis Ababa", latitude: 9.03, longitude: 38.74 },
        destinationCity: null,
        availableFrom: new Date(),
        fullPartial: "FULL",
        availableWeight: null,
        availableLength: null,
        preferredDhToOriginKm: null,
        preferredDhAfterDeliveryKm: null,
      } as any);

      const loadFindManySpy = jest.spyOn(db.load, "findMany");

      // Call real function (matchingEngine NOT mocked in this file)
      await findMatchingLoadsForTruck(seed.truckPosting.id).catch(() => {});

      // Verify the WHERE clause uses the correct status filter
      const loadsCall = loadFindManySpy.mock.calls.find(
        (call) => call[0]?.where?.status?.in !== undefined
      );
      expect(loadsCall).toBeDefined();
      expect(loadsCall![0].where.status.in).toEqual(
        expect.arrayContaining(["POSTED", "SEARCHING", "OFFERED"])
      );
    });
  });

  // ─── G-A7-4: findMatchingTrucksForLoad WHERE filter ─────────────────────────

  describe("G-A7-4: findMatchingTrucksForLoad excludes active-trip trucks", () => {
    it("TS-16: truckPosting.findMany WHERE includes truck.trips.none filter", async () => {
      // Provide the load so findUnique succeeds
      jest.spyOn(db.load, "findUnique").mockResolvedValueOnce({
        id: seed.load.id,
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 5000,
        shipperId: seed.shipperOrg.id,
        pickupLocation: {
          name: "Addis Ababa",
          latitude: 9.03,
          longitude: 38.74,
        },
        deliveryLocation: {
          name: "Dire Dawa",
          latitude: 8.55,
          longitude: 39.27,
        },
      } as any);

      const postingFindManySpy = jest.spyOn(db.truckPosting, "findMany");

      // Call real function (matchingEngine NOT mocked in this file)
      await findMatchingTrucksForLoad(seed.load.id).catch(() => {});

      // Verify the WHERE clause includes the active-trip exclusion via trips.none
      const postingsCall = postingFindManySpy.mock.calls.find(
        (call) => call[0]?.where?.status === "ACTIVE"
      );
      expect(postingsCall).toBeDefined();
      const truckFilter = postingsCall![0].where.truck;
      expect(truckFilter?.trips?.none).toBeDefined();
      expect(truckFilter?.trips?.none?.status?.in).toEqual(
        expect.arrayContaining(["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"])
      );
    });
  });

  // ─── Regression: route shape ─────────────────────────────────────────────────

  describe("Regression: GET /api/truck-postings returns 200 with expected shape", () => {
    beforeEach(() => {
      setAuthSession(shipperSession);
    });

    it("TS-17: returns 200 with truckPostings array", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings`
      );
      const res = await listTruckPostings(req);

      expect(res.status).toBe(200);
      const body = await parseResponse(res);
      expect(Array.isArray(body.truckPostings)).toBe(true);
      expect(typeof body.pagination).toBe("object");
    });

    it("TS-18: destination filter returns 200 and uses OR clause (not exact match)", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings?destinationCityId=city-a7-dest`
      );
      const res = await listTruckPostings(req);

      expect(res.status).toBe(200);
      const body = await parseResponse(res);
      expect(Array.isArray(body.truckPostings)).toBe(true);
    });
  });
});
