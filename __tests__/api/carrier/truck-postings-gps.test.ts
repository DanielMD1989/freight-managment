/**
 * §11 GPS Tracking Policy — Truck Posting GPS Device Requirement
 *
 * T4: POST /api/truck-postings with no active GPS device → 400
 * T5: POST /api/truck-postings with active GPS device → 201
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  parseResponse,
  seedTestData,
  clearAllStores,
  createGpsDeviceForTruck,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
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
mockSms();

jest.mock("@/lib/foundation-rules", () => ({
  getVisibilityRules: jest.fn((role: string) => ({
    canViewAllTrucks: role !== "SHIPPER",
    canViewAllLoads: role !== "CARRIER",
    canViewOwnTrucksOnly: role === "CARRIER",
    canViewOwnLoadsOnly: role === "SHIPPER",
  })),
  RULE_SHIPPER_DEMAND_FOCUS: {
    id: "SHIPPER_DEMAND_FOCUS",
    description: "Shippers cannot browse truck fleet",
  },
  RULE_ONE_ACTIVE_POST_PER_TRUCK: {
    id: "ONE_ACTIVE_POST_PER_TRUCK",
    description: "One active posting per truck",
  },
  RULE_CARRIER_FINAL_AUTHORITY: {
    id: "CARRIER_FINAL_AUTHORITY",
    description: "Carrier must approve",
  },
  validateOneActivePostPerTruck: jest.fn(() => ({ valid: true })),
  canModifyTruckOwnership: jest.fn((role: string) => role === "CARRIER"),
  canDirectlyAssignLoads: jest.fn((role: string) =>
    ["CARRIER", "ADMIN", "SUPER_ADMIN"].includes(role)
  ),
  canProposeMatches: jest.fn((role: string) =>
    ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(role)
  ),
  canStartTrips: jest.fn((role: string) => role === "CARRIER"),
  canAcceptLoadRequests: jest.fn((role: string) => role === "CARRIER"),
  assertDispatcherCannotAssign: jest.fn(),
  assertCarrierOwnership: jest.fn(),
  assertOneActivePost: jest.fn(),
  FoundationRuleViolation: class FoundationRuleViolation extends Error {
    ruleId: string;
    constructor(ruleId: string, desc: string) {
      super(desc);
      this.ruleId = ruleId;
    }
  },
}));
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  validateIdFormat: jest.fn(() => ({ valid: true })),
  zodErrorResponse: jest.fn((error: unknown) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Import handler AFTER mocks
const { POST: createPosting } = require("@/app/api/truck-postings/route");

describe("§11 GPS Tracking Policy — Truck Posting GPS Requirement", () => {
  let seed: SeedData;
  let originLocation: any;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    originLocation = await db.ethiopianLocation.create({
      data: {
        id: "city-gps-test",
        name: "Addis Ababa",
        nameEthiopic: "አዲስ አበባ",
        region: "Addis Ababa",
        isActive: true,
        latitude: 9.02,
        longitude: 38.75,
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

  // T4: No GPS device → 400
  it("T4: should reject truck posting when no active GPS device → 400", async () => {
    // Create approved truck WITHOUT GPS device
    const truckNoGps = await db.truck.create({
      data: {
        id: "truck-no-gps",
        truckType: "DRY_VAN",
        licensePlate: "NO-GPS-1",
        capacity: 10000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
        // No gpsDeviceId — no GPS device linked
      },
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckNoGps.id,
          originCityId: originLocation.id,
          availableFrom: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
          fullPartial: "FULL",
          contactName: "Test Driver",
          contactPhone: "+251911222333",
        },
      }
    );

    const res = await createPosting(req);
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("GPS device");
  });

  // T4b: GPS device exists but INACTIVE → 400
  it("T4b: should reject truck posting when GPS device is INACTIVE → 400", async () => {
    const inactiveDevice = await db.gpsDevice.create({
      data: {
        id: "gps-inactive-device",
        imei: "INACTIVE_IMEI_001",
        status: "INACTIVE",
      },
    });

    const truckInactiveGps = await db.truck.create({
      data: {
        id: "truck-inactive-gps",
        truckType: "DRY_VAN",
        licensePlate: "INACT-GPS-1",
        capacity: 10000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
        gpsDeviceId: inactiveDevice.id,
      },
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckInactiveGps.id,
          originCityId: originLocation.id,
          availableFrom: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
          fullPartial: "FULL",
          contactName: "Test Driver",
          contactPhone: "+251911222333",
        },
      }
    );

    const res = await createPosting(req);
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("GPS device");
  });

  // T5: Active GPS device → 201
  it("T5: should allow truck posting when active GPS device exists → 201", async () => {
    const truckWithGps = await db.truck.create({
      data: {
        id: "truck-with-gps",
        truckType: "DRY_VAN",
        licensePlate: "GPS-TRK-1",
        capacity: 10000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // Create and link GPS device
    await createGpsDeviceForTruck(truckWithGps.id);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckWithGps.id,
          originCityId: originLocation.id,
          availableFrom: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
          fullPartial: "FULL",
          contactName: "Test Driver",
          contactPhone: "+251911222333",
        },
      }
    );

    const res = await createPosting(req);
    expect(res.status).toBe(201);

    const data = await parseResponse(res);
    expect(data.id).toBeDefined();
    expect(data.truckId).toBe(truckWithGps.id);
    expect(data.status).toBe("ACTIVE");
  });
});
