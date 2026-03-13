/**
 * G-M17-5: Load Detail — myPendingRequest field
 *
 * GET /api/loads/[id] returns myPendingRequest for carriers
 *
 * T1: Carrier with existing PENDING request → myPendingRequest populated
 * T2: Carrier with no request → myPendingRequest is null
 * T3: Shipper viewing load → myPendingRequest is null
 * T4: Carrier with CANCELLED request (not PENDING) → myPendingRequest is null
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
}));

// Import handler AFTER mocks
const { GET: getLoad } = require("@/app/api/loads/[id]/route");

describe("G-M17-5: Load Detail myPendingRequest", () => {
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

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(async () => {
    clearAllStores();
  });

  beforeEach(() => {
    setAuthSession(carrierSession);
  });

  it("T1: carrier with PENDING request → myPendingRequest populated", async () => {
    // Create a PENDING load request for the carrier's truck on seed.load
    await db.loadRequest.create({
      data: {
        id: "pending-lr-1",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        requestedById: "carrier-user-1",
        shipperId: seed.shipperOrg.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}`
    );
    const res = await callHandler(getLoad, req, { id: seed.load.id });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.load.myPendingRequest).toBeDefined();
    expect(data.load.myPendingRequest).not.toBeNull();
    expect(data.load.myPendingRequest.id).toBe("pending-lr-1");
    expect(data.load.myPendingRequest.status).toBe("PENDING");
    expect(data.load.myPendingRequest.createdAt).toBeDefined();
  });

  it("T2: carrier with no request → myPendingRequest is null", async () => {
    // Create a load with no requests from this carrier
    await db.load.create({
      data: {
        id: "no-request-load",
        status: "POSTED",
        pickupCity: "Mekelle",
        deliveryCity: "Axum",
        pickupDate: new Date(Date.now() + 86_400_000),
        deliveryDate: new Date(Date.now() + 2 * 86_400_000),
        truckType: "FLATBED",
        weight: 5000,
        cargoDescription: "No request test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/loads/no-request-load"
    );
    const res = await callHandler(getLoad, req, { id: "no-request-load" });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.load.myPendingRequest).toBeNull();
  });

  it("T3: shipper viewing load → myPendingRequest is null", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}`
    );
    const res = await callHandler(getLoad, req, { id: seed.load.id });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.load.myPendingRequest).toBeNull();
  });

  it("T4: carrier with CANCELLED request (not PENDING) → myPendingRequest is null", async () => {
    // Create a load + CANCELLED request
    await db.load.create({
      data: {
        id: "cancelled-req-load",
        status: "POSTED",
        pickupCity: "Hawassa",
        deliveryCity: "Arba Minch",
        pickupDate: new Date(Date.now() + 86_400_000),
        deliveryDate: new Date(Date.now() + 2 * 86_400_000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Cancelled request test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
      },
    });

    await db.loadRequest.create({
      data: {
        id: "cancelled-lr-1",
        loadId: "cancelled-req-load",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        requestedById: "carrier-user-1",
        shipperId: seed.shipperOrg.id,
        status: "CANCELLED",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/loads/cancelled-req-load"
    );
    const res = await callHandler(getLoad, req, {
      id: "cancelled-req-load",
    });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.load.myPendingRequest).toBeNull();
  });
});
