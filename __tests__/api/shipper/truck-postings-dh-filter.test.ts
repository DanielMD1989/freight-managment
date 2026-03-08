/**
 * Shipper Truck Search — DH-O/DH-D Radius Filter Tests (Round A18)
 *
 * Blueprint v1.2 §3: the load's pickup point must fall within the truck's
 * DH-O radius AND the load's delivery point must fall within the truck's
 * DH-D radius. Trucks outside either radius are filtered out.
 *
 * Tests (DF-1 … DF-6):
 * DF-1: truck within DH-O + DH-D → included
 * DF-2: truck beyond DH-O → excluded
 * DF-3: truck beyond DH-D → excluded
 * DF-4: truck with NULL DH preferences → always included (flexible)
 * DF-5: truck with NULL destination → passes DH-D regardless
 * DF-6: no origin/dest params → no radius filter applied
 */

// @jest-environment node

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
} from "../../utils/routeTestUtils";

// ─── Module-level mocks ────────────────────────────────────────────────────────

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

// Mock calculateDistanceKm so we can control DH distances per test
const mockCalculateDistanceKm = jest.fn();
jest.mock("@/lib/geo", () => ({
  calculateDistanceKm: (...args: unknown[]) => mockCalculateDistanceKm(...args),
}));

// Route handler — imported AFTER all mocks
const { GET: getTruckPostings } = require("@/app/api/truck-postings/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  email: "shipper@test.com",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
});

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const ORIGIN_CITY_ID = "dh-city-origin";
const DEST_CITY_ID = "dh-city-dest";
const TRUCK_ID = "dh-truck-1";
const POSTING_WITH_DH_ID = "dh-posting-with-dh";
const POSTING_NO_DH_ID = "dh-posting-no-dh";
const POSTING_NO_DEST_ID = "dh-posting-no-dest";

describe("Truck Postings — DH-O/DH-D Radius Filter (A18)", () => {
  beforeAll(async () => {
    await seedTestData();

    // Ethiopian locations with known coordinates
    await db.ethiopianLocation.create({
      data: {
        id: ORIGIN_CITY_ID,
        name: "DH Origin City",
        region: "Addis Ababa",
        isActive: true,
        latitude: 9.0,
        longitude: 38.7,
      },
    });
    await db.ethiopianLocation.create({
      data: {
        id: DEST_CITY_ID,
        name: "DH Destination City",
        region: "SNNPR",
        isActive: true,
        latitude: 7.0,
        longitude: 38.5,
      },
    });

    // Truck owned by carrier-org-1
    await db.truck.create({
      data: {
        id: TRUCK_ID,
        truckType: "DRY_VAN",
        licensePlate: "AA-DH-001",
        capacity: 10000,
        isAvailable: true,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
      },
    });

    // Posting with explicit DH preferences (DH-O: 100 km, DH-D: 200 km)
    await db.truckPosting.create({
      data: {
        id: POSTING_WITH_DH_ID,
        truckId: TRUCK_ID,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        originCityId: ORIGIN_CITY_ID,
        originCityName: "DH Origin City",
        destinationCityId: DEST_CITY_ID,
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "DH Carrier",
        contactPhone: "+251911000099",
        preferredDhToOriginKm: 100,
        preferredDhAfterDeliveryKm: 200,
      },
    });

    // Posting with NULL DH preferences (always flexible)
    await db.truckPosting.create({
      data: {
        id: POSTING_NO_DH_ID,
        truckId: TRUCK_ID,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        originCityId: ORIGIN_CITY_ID,
        originCityName: "DH Origin City",
        destinationCityId: DEST_CITY_ID,
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "DH Carrier Flex",
        contactPhone: "+251911000098",
        preferredDhToOriginKm: null,
        preferredDhAfterDeliveryKm: null,
      },
    });

    // Posting with no declared destination (DH-D skipped)
    await db.truckPosting.create({
      data: {
        id: POSTING_NO_DEST_ID,
        truckId: TRUCK_ID,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        originCityId: ORIGIN_CITY_ID,
        originCityName: "DH Origin City",
        destinationCityId: null,
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "DH Carrier No Dest",
        contactPhone: "+251911000097",
        preferredDhToOriginKm: 100,
        preferredDhAfterDeliveryKm: 50, // would fail if checked, but dest is null
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: 0 km (same city — exact match semantics)
    mockCalculateDistanceKm.mockReturnValue(0);
  });

  // DF-1: truck within DH-O + DH-D → included
  it("DF-1: truck within DH-O and DH-D → included in results", async () => {
    // DH-O=50 ≤ pref 100; DH-D=100 ≤ pref 200
    mockCalculateDistanceKm
      .mockReturnValueOnce(50) // DH-O check
      .mockReturnValueOnce(100); // DH-D check

    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/truck-postings?originCityId=${ORIGIN_CITY_ID}&destinationCityId=${DEST_CITY_ID}`
    );
    const res = await getTruckPostings(req);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    const ids = (data.postings ?? data.truckPostings ?? []).map(
      (p: { id: string }) => p.id
    );
    expect(ids).toContain(POSTING_WITH_DH_ID);
  });

  // DF-2: truck beyond DH-O → excluded
  it("DF-2: truck beyond DH-O radius → excluded from results", async () => {
    // DH-O=200 > pref 100 → fails
    mockCalculateDistanceKm.mockReturnValueOnce(200);

    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/truck-postings?originCityId=${ORIGIN_CITY_ID}&destinationCityId=${DEST_CITY_ID}`
    );
    const res = await getTruckPostings(req);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    const ids = (data.postings ?? data.truckPostings ?? []).map(
      (p: { id: string }) => p.id
    );
    expect(ids).not.toContain(POSTING_WITH_DH_ID);
  });

  // DF-3: truck beyond DH-D → excluded
  it("DF-3: truck beyond DH-D radius → excluded from results", async () => {
    // DH-O=50 passes; DH-D=300 > pref 200 → fails
    mockCalculateDistanceKm
      .mockReturnValueOnce(50) // DH-O passes
      .mockReturnValueOnce(300); // DH-D fails

    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/truck-postings?originCityId=${ORIGIN_CITY_ID}&destinationCityId=${DEST_CITY_ID}`
    );
    const res = await getTruckPostings(req);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    const ids = (data.postings ?? data.truckPostings ?? []).map(
      (p: { id: string }) => p.id
    );
    expect(ids).not.toContain(POSTING_WITH_DH_ID);
  });

  // DF-4: truck with NULL DH preferences → always included
  it("DF-4: truck with NULL DH preferences → always included regardless of distance", async () => {
    // Even with large distances, null preferences = flexible
    mockCalculateDistanceKm.mockReturnValue(9999);

    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/truck-postings?originCityId=${ORIGIN_CITY_ID}&destinationCityId=${DEST_CITY_ID}`
    );
    const res = await getTruckPostings(req);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    const ids = (data.postings ?? data.truckPostings ?? []).map(
      (p: { id: string }) => p.id
    );
    expect(ids).toContain(POSTING_NO_DH_ID);
  });

  // DF-5: truck with NULL destination → passes DH-D check regardless
  it("DF-5: truck with NULL destination → DH-D not checked, always passes", async () => {
    // DH-O=50 passes; no destination → DH-D skipped (posting_no_dest has pref=50 which would fail if checked)
    mockCalculateDistanceKm.mockReturnValueOnce(50); // only DH-O is called

    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/truck-postings?originCityId=${ORIGIN_CITY_ID}&destinationCityId=${DEST_CITY_ID}`
    );
    const res = await getTruckPostings(req);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    const ids = (data.postings ?? data.truckPostings ?? []).map(
      (p: { id: string }) => p.id
    );
    expect(ids).toContain(POSTING_NO_DEST_ID);
  });

  // DF-6: no origin/dest params → no radius filter applied
  it("DF-6: no origin/dest params → filter skipped, all ACTIVE postings returned", async () => {
    setAuthSession(shipperSession);
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await getTruckPostings(req);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    const ids = (data.postings ?? data.truckPostings ?? []).map(
      (p: { id: string }) => p.id
    );
    // All three DH-filter postings should be present (no filter applied)
    expect(ids).toContain(POSTING_WITH_DH_ID);
    expect(ids).toContain(POSTING_NO_DH_ID);
    expect(ids).toContain(POSTING_NO_DEST_ID);
    // calculateDistanceKm should NOT have been called
    expect(mockCalculateDistanceKm).not.toHaveBeenCalled();
  });
});
