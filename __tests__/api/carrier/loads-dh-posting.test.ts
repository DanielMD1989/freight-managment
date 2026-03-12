/**
 * G-M16 Tests: Server-side DH from TruckPosting + requireActiveUser
 *
 * T1: truckPostingId for CARRIER → posting fetched, ownership verified
 * T2: truckPostingId for wrong org → DH filter NOT applied
 * T3: truckPostingId with DH values + city coords → geo filter activates
 * T4: requireActiveUser blocks PENDING_VERIFICATION carrier
 * T5: pickupCity/deliveryCity params hit API correctly
 * T6: Legacy raw DH params still work for non-CARRIER
 * T7: truckPostingId with null DH preferences → no DH filter (all loads returned)
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
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Mock geo — return 50km so it's within typical DH limits
const mockCalculateDistanceKm = jest.fn(() => 50);
jest.mock("@/lib/geo", () => ({
  calculateDistanceKm: (...args: any[]) => mockCalculateDistanceKm(...args),
  isValidCoordinate: jest.fn(() => true),
}));

// Import handler AFTER mocks
const { GET } = require("@/app/api/loads/route");

describe("G-M16: Server-side DH from TruckPosting", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "other-carrier-org",
  });

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-1",
    email: "dispatcher@test.com",
    role: "DISPATCHER",
    status: "ACTIVE",
    organizationId: "dispatcher-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create ethiopian locations with coordinates
    await db.ethiopianLocation.create({
      data: {
        id: "city-addis",
        name: "Addis Ababa",
        latitude: 9.02,
        longitude: 38.75,
        region: "Addis Ababa",
      },
    });

    await db.ethiopianLocation.create({
      data: {
        id: "city-dire",
        name: "Dire Dawa",
        latitude: 9.6,
        longitude: 41.85,
        region: "Dire Dawa",
      },
    });

    // Update truck posting with DH values and destination
    await db.truckPosting.update({
      where: { id: seed.truckPosting.id },
      data: {
        preferredDhToOriginKm: 100,
        preferredDhAfterDeliveryKm: 150,
        destinationCityId: "city-dire",
      },
    });

    // Update load with coordinates for geo filter to work
    await db.load.update({
      where: { id: seed.load.id },
      data: {
        originLat: 9.02,
        originLon: 38.75,
        destinationLat: 9.6,
        destinationLon: 41.85,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateDistanceKm.mockReturnValue(50); // Within DH limits
  });

  it("T1: truckPostingId for CARRIER → posting fetched, DH filter applied", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads?truckPostingId=${seed.truckPosting.id}`
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.loads).toBeDefined();
    // Geo filter should have been triggered (calculateDistanceKm called)
    expect(mockCalculateDistanceKm).toHaveBeenCalled();
  });

  it("T2: truckPostingId for wrong org → DH filter NOT applied", async () => {
    setAuthSession(otherCarrierSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads?truckPostingId=${seed.truckPosting.id}`
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.loads).toBeDefined();
    // Geo filter should NOT have been triggered (ownership check failed)
    expect(mockCalculateDistanceKm).not.toHaveBeenCalled();
  });

  it("T3: truckPostingId with DH + coords → loads outside DH excluded", async () => {
    setAuthSession(carrierSession);

    // Make distance exceed DH-O limit (100km)
    mockCalculateDistanceKm.mockReturnValue(200);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads?truckPostingId=${seed.truckPosting.id}`
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    // Load should be filtered out because 200km > 100km DH-O limit
    expect(data.loads.length).toBe(0);
  });

  it("T4: PENDING_VERIFICATION carrier → 403", async () => {
    const pendingSession = createMockSession({
      userId: "carrier-user-1",
      email: "carrier@test.com",
      role: "CARRIER",
      status: "PENDING_VERIFICATION",
      organizationId: "carrier-org-1",
    });
    setAuthSession(pendingSession);

    const req = createRequest("GET", "http://localhost:3000/api/loads");

    const res = await GET(req);
    // requireActiveUser should block with 403
    expect(res.status).toBe(403);
  });

  it("T5: pickupCity/deliveryCity params filter loads correctly", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/loads?pickupCity=Addis&deliveryCity=Dire"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    // The seed load has pickupCity="Addis Ababa" which contains "Addis"
    expect(data.loads).toBeDefined();
  });

  it("T6: Legacy raw DH params work for DISPATCHER (no truckPostingId)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/loads?carrierLat=9.02&carrierLon=38.75&dhOMaxKm=300"
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.loads).toBeDefined();
    // Geo filter should have been triggered via legacy params
    expect(mockCalculateDistanceKm).toHaveBeenCalled();
  });

  it("T7: truckPostingId with null DH preferences → no DH filter", async () => {
    setAuthSession(carrierSession);

    // Create a posting without DH preferences
    const noDhPosting = await db.truckPosting.create({
      data: {
        id: "posting-no-dh",
        truckId: seed.truck.id,
        carrierId: "carrier-org-1",
        originCityId: "city-addis",
        originCityName: "Addis Ababa",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "Test",
        contactPhone: "+251911000002",
        // No preferredDhToOriginKm or preferredDhAfterDeliveryKm
      },
    });

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads?truckPostingId=${noDhPosting.id}`
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.loads).toBeDefined();
    // No DH filter → calculateDistanceKm should NOT be called
    expect(mockCalculateDistanceKm).not.toHaveBeenCalled();
    // All marketplace loads returned (no DH filtering)
    expect(data.loads.length).toBeGreaterThan(0);
  });
});
