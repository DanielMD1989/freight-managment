/**
 * Carrier Load Search Filter Tests — Round A6
 *
 * Tests for:
 * - G-A6-1: DH-O radius filter (carrierLat/carrierLon/dhOMaxKm)
 * - G-A6-2: DH-D radius filter (destLat/destLon/dhDMaxKm)
 * - G-A6-3: SEARCHING and OFFERED loads visible in carrier marketplace
 *
 * lib/geo.ts is pure math — no mock needed.
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
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockLoadStateMachine,
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
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockLoadStateMachine();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Import handler AFTER mocks
const { GET: listLoads } = require("@/app/api/loads/route");

describe("Carrier Load Search Filters (A6)", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-sf",
    email: "carrier-sf@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-sf",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // addis-coords: origin = Addis Ababa (9.03, 38.74), destination = Dire Dawa (8.55, 39.27)
    await db.load.create({
      data: {
        id: "sf-addis-coords",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        originLat: 9.03,
        originLon: 38.74,
        destinationLat: 8.55,
        destinationLon: 39.27,
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 3000,
        cargoDescription: "Addis to Dire Dawa load with coordinates",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
      },
    });

    // far-coords: origin = Asmara area (~620km from Addis), destination = same far point
    await db.load.create({
      data: {
        id: "sf-far-coords",
        status: "POSTED",
        pickupCity: "Asmara",
        deliveryCity: "Asmara",
        originLat: 14.49,
        originLon: 37.46,
        destinationLat: 14.49,
        destinationLon: 37.46,
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 3000,
        cargoDescription: "Far load with Asmara coordinates",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
      },
    });

    // no-coords: POSTED but no origin/destination coordinates
    await db.load.create({
      data: {
        id: "sf-no-coords",
        status: "POSTED",
        pickupCity: "Hawassa",
        deliveryCity: "Jimma",
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "Load without coordinates",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
      },
    });

    // searching-load: SEARCHING status, near Addis
    await db.load.create({
      data: {
        id: "sf-searching-load",
        status: "SEARCHING",
        pickupCity: "Addis Ababa",
        deliveryCity: "Bahir Dar",
        originLat: 9.03,
        originLon: 38.74,
        destinationLat: 11.59,
        destinationLon: 37.39,
        pickupDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 3500,
        cargoDescription: "Searching status load near Addis",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    // offered-load: OFFERED status, near Addis
    await db.load.create({
      data: {
        id: "sf-offered-load",
        status: "OFFERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Gondar",
        originLat: 9.03,
        originLon: 38.74,
        destinationLat: 12.61,
        destinationLon: 37.47,
        pickupDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2800,
        cargoDescription: "Offered status load near Addis",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    // assigned-load-mkt: ASSIGNED — should be hidden from marketplace
    await db.load.create({
      data: {
        id: "sf-assigned-load-mkt",
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        truckType: "CONTAINER",
        weight: 5000,
        cargoDescription: "Assigned load should not appear in marketplace",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    // draft-load-mkt: DRAFT — should be hidden from marketplace
    await db.load.create({
      data: {
        id: "sf-draft-load-mkt",
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dessie",
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        truckType: "TANKER",
        weight: 4000,
        cargoDescription: "Draft load should not appear in marketplace",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
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

  // ─── DH-O Filter (G-A6-1) ────────────────────────────────────────────

  describe("DH-O radius filter (G-A6-1)", () => {
    it("LS-1: nearby load returned when within dhOMaxKm of carrier position", async () => {
      // Carrier at Addis (9.03, 38.74), load origin also Addis — distance ~0 km
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?carrierLat=9.03&carrierLon=38.74&dhOMaxKm=50"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).toContain("sf-addis-coords");
    });

    it("LS-2: far-coords load excluded when origin is beyond dhOMaxKm", async () => {
      // Carrier at Addis (9.03, 38.74), far-coords at Asmara (~620km away)
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?carrierLat=9.03&carrierLon=38.74&dhOMaxKm=50"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).not.toContain("sf-far-coords");
    });

    it("LS-3: load with no origin coordinates excluded from DH-O results", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?carrierLat=9.03&carrierLon=38.74&dhOMaxKm=50"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).not.toContain("sf-no-coords");
    });

    it("LS-4: dhOMaxKm=0 clamped to 1 — graceful clamp, no error", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?carrierLat=9.03&carrierLon=38.74&dhOMaxKm=0"
      );
      const res = await listLoads(req);
      // Should not error — clamped to 1km, likely returns no results but valid 200
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.loads)).toBe(true);
    });
  });

  // ─── DH-D Filter (G-A6-2) ────────────────────────────────────────────

  describe("DH-D radius filter (G-A6-2)", () => {
    it("LS-5: addis-coords load returned when destination is within dhDMaxKm of home base", async () => {
      // Home base at Dire Dawa (8.55, 39.27), addis-coords destination also Dire Dawa — ~0km
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?destLat=8.55&destLon=39.27&dhDMaxKm=50"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).toContain("sf-addis-coords");
    });

    it("LS-6: far-coords load excluded when delivery is beyond dhDMaxKm from home base", async () => {
      // Home base at Dire Dawa (8.55, 39.27), far-coords destination at Asmara (~700km away)
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?destLat=8.55&destLon=39.27&dhDMaxKm=50"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).not.toContain("sf-far-coords");
    });
  });

  // ─── Combined DH-O + DH-D Filter ─────────────────────────────────────

  describe("Combined DH-O + DH-D (AND logic)", () => {
    it("LS-7: only addis-coords satisfies both DH-O and DH-D constraints", async () => {
      // DH-O: carrier at Addis (9.03, 38.74), within 50km
      // DH-D: home base at Dire Dawa (8.55, 39.27), within 50km
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?carrierLat=9.03&carrierLon=38.74&dhOMaxKm=50&destLat=8.55&destLon=39.27&dhDMaxKm=50"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      // addis-coords: origin=Addis (~0km DH-O), destination=Dire Dawa (~0km DH-D) ✓
      expect(ids).toContain("sf-addis-coords");
      // far-coords: origin=Asmara (>>50km DH-O) ✗
      expect(ids).not.toContain("sf-far-coords");
      // no-coords: missing origin coordinates ✗
      expect(ids).not.toContain("sf-no-coords");
    });
  });

  // ─── Standard Path Regression (no geo params) ────────────────────────

  describe("Standard path (no geo params)", () => {
    it("LS-8: no geo params — standard pagination returns all POSTED/SEARCHING/OFFERED", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?limit=100"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.loads)).toBe(true);
      expect(data.pagination).toBeDefined();
      // All returned loads must be POSTED, SEARCHING, or OFFERED
      const VISIBLE = ["POSTED", "SEARCHING", "OFFERED"];
      for (const load of data.loads) {
        expect(VISIBLE).toContain(load.status);
      }
    });
  });

  // ─── G-A6-3: Status Visibility ────────────────────────────────────────

  describe("G-A6-3: Status visibility in carrier marketplace", () => {
    it("LS-9: SEARCHING load appears in carrier marketplace", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?limit=100"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).toContain("sf-searching-load");
    });

    it("LS-10: OFFERED load appears in carrier marketplace", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?limit=100"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).toContain("sf-offered-load");
    });

    it("LS-11: ASSIGNED load does NOT appear in carrier marketplace", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?limit=100"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).not.toContain("sf-assigned-load-mkt");
    });

    it("LS-12: DRAFT load does NOT appear in carrier marketplace", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?limit=100"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const ids = data.loads.map((l: { id: string }) => l.id);
      expect(ids).not.toContain("sf-draft-load-mkt");
    });
  });
});
