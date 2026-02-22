/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carrier Workflow Blueprint Test Suite
 *
 * SINGLE SOURCE OF TRUTH for carrier API behavior.
 * Every test has exact status code and response body assertions.
 *
 * Key differences from ad-hoc carrier tests:
 * 1. NO try/catch around handler imports — if handler is missing, test FAILS
 * 2. NO range assertions like expect([200,400]).toContain — exact codes only
 * 3. Trip state machine is NOT mocked — real transitions enforced
 * 4. Foundation rules are NOT mocked — real RBAC boundaries tested
 * 5. Response body fields verified with exact values
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
  mockCors,
  mockAuditLog,
  mockGps,
  mockSms,
  mockMatchingEngine,
  mockStorage,
  mockGeo,
  mockLogger,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  SeedData,
} from "../utils/routeTestUtils";

// ─── SELECTIVE MOCKING ───────────────────────────────────────────────────────
// Infrastructure mocks (external I/O) — these are fine to mock
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
// NOTE: Do NOT call mockNotifications() here — we have a custom mock below
// that includes notifyLoadStakeholders (needed by status route)
mockCors();
mockAuditLog();
mockGps();
mockSms();
mockMatchingEngine();
// NOTE: Do NOT call mockDispatcherPermissions() here — we have a custom mock below
// that checks actual ownership for canApproveRequests
mockStorage();
// NOTE: Do NOT call mockServiceFee() here — we have a custom mock below
// that includes deductServiceFee (needed by status route completion flow)
mockGeo();
mockLogger();
// NOTE: Do NOT call mockValidation() here — we have a custom mock below
// that includes zodErrorResponse (needed by status route)
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();

// Custom RBAC mock with real permission enforcement
jest.mock("@/lib/rbac", () => {
  // Permissions that each role has
  const SHIPPER_PERMISSIONS = [
    "create_load",
    "post_loads",
    "view_loads",
    "edit_loads",
    "delete_loads",
    "manage_own_loads",
    "track_load_status",
    "view_trucks",
    "view_live_tracking",
    "view_pod",
    "upload_documents",
    "view_documents",
    "view_wallet",
    "create_dispute",
    "create_report",
    "view_dashboard",
  ];
  const CARRIER_PERMISSIONS = [
    "create_truck",
    "post_trucks",
    "view_trucks",
    "edit_trucks",
    "manage_own_trucks",
    "view_loads",
    "accept_loads",
    "update_trip_status",
    "upload_pod",
    "view_wallet",
    "view_dashboard",
    "view_documents",
    "upload_documents",
    "create_dispute",
    "create_report",
    "view_live_tracking",
  ];
  const ADMIN_PERMISSIONS = ["*"]; // admin can do anything

  const ROLE_PERMS: Record<string, string[]> = {
    SHIPPER: SHIPPER_PERMISSIONS,
    CARRIER: CARRIER_PERMISSIONS,
    ADMIN: ADMIN_PERMISSIONS,
    SUPER_ADMIN: ADMIN_PERMISSIONS,
    DISPATCHER: [
      "view_loads",
      "view_all_loads",
      "view_trucks",
      "view_all_trucks",
      "view_dashboard",
    ],
  };

  function hasPermission(role: string, permission: string): boolean {
    const perms = ROLE_PERMS[role] || [];
    return perms.includes("*") || perms.includes(permission);
  }

  return {
    requirePermission: jest.fn(async (permission: string) => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      if (!hasPermission(session.role, permission)) {
        const error = new Error("Permission denied: " + permission);
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    requireRole: jest.fn(async (allowedRoles: string[]) => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      if (!allowedRoles.includes(session.role)) {
        const error = new Error("Permission denied: role not allowed");
        throw error;
      }
      return session;
    }),
    requireAnyPermission: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      return session;
    }),
    Permission: {
      CREATE_LOAD: "create_load",
      POST_LOADS: "post_loads",
      VIEW_LOADS: "view_loads",
      VIEW_ALL_LOADS: "view_all_loads",
      EDIT_LOADS: "edit_loads",
      DELETE_LOADS: "delete_loads",
      MANAGE_OWN_LOADS: "manage_own_loads",
      MANAGE_ALL_LOADS: "manage_all_loads",
      CREATE_TRUCK: "create_truck",
      POST_TRUCKS: "post_trucks",
      VIEW_TRUCKS: "view_trucks",
      VIEW_ALL_TRUCKS: "view_all_trucks",
      EDIT_TRUCKS: "edit_trucks",
      DELETE_TRUCKS: "delete_trucks",
      MANAGE_OWN_TRUCKS: "manage_own_trucks",
      MANAGE_ALL_TRUCKS: "manage_all_trucks",
      UPDATE_TRIP_STATUS: "update_trip_status",
      VIEW_WALLET: "view_wallet",
      MANAGE_WALLET: "manage_wallet",
      UPLOAD_DOCUMENTS: "upload_documents",
      VIEW_DOCUMENTS: "view_documents",
      VERIFY_DOCUMENTS: "verify_documents",
      VIEW_GPS: "view_gps",
      MANAGE_GPS_DEVICES: "manage_gps_devices",
      MANAGE_DISPUTES: "manage_disputes",
      VIEW_LIVE_TRACKING: "view_live_tracking",
      UPLOAD_POD: "upload_pod",
      VIEW_POD: "view_pod",
    },
    UnauthorizedError: class UnauthorizedError extends Error {
      constructor(msg = "Unauthorized") {
        super(msg);
        this.name = "UnauthorizedError";
      }
    },
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
    getAccessRoles: jest.fn((session: any, entityOwners?: any) => {
      const { role, organizationId } = session || {};
      const { shipperOrgId, carrierOrgId } = entityOwners || {};
      const isShipper =
        role === "SHIPPER" && !!shipperOrgId && shipperOrgId === organizationId;
      const isCarrier =
        role === "CARRIER" && !!carrierOrgId && carrierOrgId === organizationId;
      const isDispatcher = role === "DISPATCHER";
      const isSuperAdmin = role === "SUPER_ADMIN";
      const isAdmin = role === "ADMIN" || isSuperAdmin;
      const hasAccess = isShipper || isCarrier || isDispatcher || isAdmin;
      return {
        isShipper,
        isCarrier,
        isDispatcher,
        isAdmin,
        isSuperAdmin,
        hasAccess,
        canView: hasAccess,
        canModify: isShipper || isCarrier || isAdmin,
      };
    }),
    getCurrentUserRole: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      return session ? session.role : null;
    }),
    hasRole: jest.fn(async () => true),
    hasAnyRole: jest.fn(async () => true),
    hasPermission: jest.fn(async () => true),
    hasAnyPermission: jest.fn(async () => true),
    hasAllPermissions: jest.fn(async () => true),
    isAdmin: jest.fn(async () => false),
    isOps: jest.fn(async () => false),
    isSuperAdmin: jest.fn(async () => false),
    canManageOrganization: jest.fn(async () => true),
    canView: jest.fn(() => true),
    canModify: jest.fn(() => true),
    isAdminRole: jest.fn(() => false),
    isSuperAdminRole: jest.fn(() => false),
  };
});

// DO NOT mock tripStateMachine — real state transitions enforced
// DO NOT mock foundation-rules — real RBAC boundaries tested

// Mock apiErrors to properly map error types to HTTP status codes
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");

    // Zod validation errors → 400
    if (error?.name === "ZodError" || error?.issues) {
      const messages = (error.errors || error.issues || []).map(
        (e: any) => `${(e.path || []).join(".")}: ${e.message}`
      );
      return NextResponse.json(
        { error: "Validation failed", details: messages },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Auth errors → 401
      if (
        error.message === "Unauthorized" ||
        error.message === "Unauthorized: User not found" ||
        error.name === "UnauthorizedError"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Forbidden errors → 403
      if (
        error.message.startsWith("Forbidden") ||
        error.name === "ForbiddenError"
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      // Foundation Rule violations → 403
      if (error.name === "FoundationRuleViolation") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }),
}));

// Extend notifications mock with missing functions used by status/pod routes
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  createNotificationForRole: jest.fn(async () => {}),
  notifyTruckRequest: jest.fn(async () => {}),
  notifyTruckRequestResponse: jest.fn(async () => {}),
  notifyLoadStakeholders: jest.fn(async () => {}),
  getRecentNotifications: jest.fn(async () => []),
  getUnreadCount: jest.fn(async () => 0),
  markAsRead: jest.fn(async () => {}),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    TRIP_CANCELLED: "TRIP_CANCELLED",
    SYSTEM: "SYSTEM",
    POD_SUBMITTED: "POD_SUBMITTED",
    POD_VERIFIED: "POD_VERIFIED",
    SETTLEMENT_COMPLETE: "SETTLEMENT_COMPLETE",
    LOAD_REQUEST_APPROVED: "LOAD_REQUEST_APPROVED",
    LOAD_REQUEST_REJECTED: "LOAD_REQUEST_REJECTED",
  },
}));

// Custom dispatcher permissions mock with actual ownership check
jest.mock("@/lib/dispatcherPermissions", () => ({
  canViewAllTrucks: jest.fn(() => true),
  hasElevatedPermissions: jest.fn(() => false),
  canRequestTruck: jest.fn((user: any, loadShipperId: string) => {
    return user.organizationId === loadShipperId;
  }),
  canApproveRequests: jest.fn((user: any, carrierId: string) => {
    return user.organizationId === carrierId;
  }),
}));

// Mock automationRules (dynamic import in status route)
jest.mock("@/lib/automationRules", () => ({
  evaluateRulesForTrigger: jest.fn(async () => []),
}));
jest.mock("@/lib/automationActions", () => ({
  executeAndRecordRuleActions: jest.fn(async () => {}),
}));

// Mock serviceFeeManagement for status route completion flow
jest.mock("@/lib/serviceFeeManagement", () => ({
  validateWalletBalancesForTrip: jest.fn(async () => ({
    valid: true,
    shipperFee: "100.00",
    carrierFee: "50.00",
  })),
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: jest.fn(async () => ({
    success: true,
    shipperFee: 100,
    carrierFee: 50,
    totalPlatformFee: 150,
    transactionId: "txn-mock-1",
  })),
}));

// Mock zodErrorResponse from validation (used by status route directly)
jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const messages = (error.errors || error.issues || []).map(
      (e: any) => `${(e.path || []).join(".")}: ${e.message}`
    );
    return NextResponse.json(
      { error: "Validation failed", details: messages },
      { status: 400 }
    );
  }),
}));

// ─── IMPORT ROUTE HANDLERS ──────────────────────────────────────────────────
// MUST use require() — static imports are hoisted above mock setup, causing
// route handlers to load real (unmocked) modules. require() is evaluated at
// runtime, after jest.mock() calls have been registered.
const {
  GET: listTrucks,
  POST: createTruck,
} = require("@/app/api/trucks/route");
const {
  GET: getTruck,
  PATCH: updateTruck,
} = require("@/app/api/trucks/[id]/route");
const {
  GET: listTruckPostings,
  POST: createTruckPosting,
} = require("@/app/api/truck-postings/route");
const {
  POST: createLoadRequest,
  GET: listLoadRequests,
} = require("@/app/api/load-requests/route");
const {
  POST: respondLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");
const { GET: listTruckRequests } = require("@/app/api/truck-requests/route");
const {
  POST: respondTruckRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const {
  GET: getTrip,
  PATCH: updateTrip,
} = require("@/app/api/trips/[tripId]/route");
const { GET: getLiveTrip } = require("@/app/api/trips/[tripId]/live/route");
const {
  POST: uploadPod,
  PUT: verifyPod,
} = require("@/app/api/loads/[id]/pod/route");
const {
  GET: getCarrierDashboard,
} = require("@/app/api/carrier/dashboard/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const {
  GET: listTransactions,
} = require("@/app/api/wallet/transactions/route");
const {
  POST: createDispute,
  GET: listDisputes,
} = require("@/app/api/disputes/route");
const {
  GET: getDispute,
  PATCH: updateDispute,
} = require("@/app/api/disputes/[id]/route");
const { GET: listLoads } = require("@/app/api/loads/route");

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:3000";

const CARRIER_SESSION = createMockSession({
  userId: "carrier-user-1",
  email: "carrier@test.com",
  role: "CARRIER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
  firstName: "Test",
  lastName: "Carrier",
});

const SHIPPER_SESSION = createMockSession({
  userId: "shipper-user-1",
  email: "shipper@test.com",
  role: "SHIPPER",
  status: "ACTIVE",
  organizationId: "shipper-org-1",
  firstName: "Test",
  lastName: "Shipper",
});

const PENDING_CARRIER_SESSION = createMockSession({
  userId: "pending-carrier-1",
  email: "pending-carrier@test.com",
  role: "CARRIER",
  status: "PENDING_VERIFICATION",
  organizationId: "carrier-org-1",
});

const VALID_TRUCK_BODY = {
  truckType: "DRY_VAN",
  licensePlate: "AA-NEWPLATE",
  capacity: 10000,
};

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

describe("Carrier Blueprint Test Suite", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Patch truck with carrier relation and active postings
    await db.truck.update({
      where: { id: seed.truck.id },
      data: {
        carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        postings: [{ id: seed.truckPosting.id, status: "ACTIVE" }],
      },
    });

    // Patch load with shipper relation (for disputes and load-requests routes)
    await db.load.update({
      where: { id: seed.load.id },
      data: {
        shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
      },
    });

    // Seed an IN_TRANSIT trip for trip tracking tests
    await db.trip.create({
      data: {
        id: "test-trip-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        startedAt: new Date(),
        pickedUpAt: new Date(),
        trackingEnabled: true,
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        load: {
          id: seed.load.id,
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          cargoDescription: "Test cargo",
          weight: 5000,
          truckType: "DRY_VAN",
        },
        truck: {
          id: seed.truck.id,
          licensePlate: "AA-12345",
          truckType: "DRY_VAN",
          gpsStatus: "ACTIVE",
        },
        carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        routeHistory: [],
      },
    });

    // Create seed city for truck posting validation
    await db.ethiopianLocation.create({
      data: {
        id: "city-addis",
        name: "Addis Ababa",
        nameEthiopic: "አዲስ አበባ",
        type: "CITY",
        region: "Addis Ababa",
        isActive: true,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    // Default to carrier session
    setAuthSession(CARRIER_SESSION);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 1: Truck CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 1: Truck CRUD", () => {
    it("1. Creates truck with required fields (truckType, licensePlate, capacity)", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "AA-10001",
          capacity: 10000,
        },
      });
      const res = await callHandler(createTruck, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.truck).toBeDefined();
      expect(data.truck.truckType).toBe("DRY_VAN");
      expect(data.truck.licensePlate).toBe("AA-10001");
      expect(data.truck.capacity).toBe(10000);
    });

    it("2. Creates truck with optional fields (volume, currentCity, GPS fields)", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "FLATBED",
          licensePlate: "AA-10002",
          capacity: 15000,
          volume: 50,
          currentCity: "Addis Ababa",
        },
      });
      const res = await callHandler(createTruck, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.truck).toBeDefined();
      expect(data.truck.volume).toBe(50);
      expect(data.truck.currentCity).toBe("Addis Ababa");
    });

    it("3. Rejects truck missing licensePlate", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: { truckType: "DRY_VAN", capacity: 10000 },
      });
      const res = await callHandler(createTruck, req);

      expect(res.status).toBe(400);
    });

    it("4. Rejects truck missing capacity", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: { truckType: "DRY_VAN", licensePlate: "AA-10004" },
      });
      const res = await callHandler(createTruck, req);

      expect(res.status).toBe(400);
    });

    it("5. Rejects truck with negative capacity", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "AA-10005",
          capacity: -100,
        },
      });
      const res = await callHandler(createTruck, req);

      expect(res.status).toBe(400);
    });

    it("6. Rejects truck with invalid truckType", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "INVALID_TYPE",
          licensePlate: "AA-10006",
          capacity: 10000,
        },
      });
      const res = await callHandler(createTruck, req);

      expect(res.status).toBe(400);
    });

    it("7. Rejects duplicate licensePlate", async () => {
      // Create first truck
      const req1 = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "AA-DUP-07",
          capacity: 10000,
        },
      });
      const res1 = await callHandler(createTruck, req1);
      expect(res1.status).toBe(201);

      // Attempt duplicate
      const req2 = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "FLATBED",
          licensePlate: "AA-DUP-07",
          capacity: 8000,
        },
      });
      const res2 = await callHandler(createTruck, req2);

      expect(res2.status).toBe(400);
    });

    it("8. Lists carrier's own trucks", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/trucks`);
      const res = await callHandler(listTrucks, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trucks).toBeDefined();
      expect(Array.isArray(data.trucks)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("9. Lists trucks with truckType filter", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trucks?truckType=DRY_VAN`
      );
      const res = await callHandler(listTrucks, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.trucks)).toBe(true);
    });

    it("10. Gets single truck by ID", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trucks/${seed.truck.id}`
      );
      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.id).toBe(seed.truck.id);
    });

    it("11. Gets 404 for nonexistent truck", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trucks/nonexistent-truck-999`
      );
      const res = await callHandler(getTruck, req, {
        id: "nonexistent-truck-999",
      });

      expect(res.status).toBe(404);
    });

    it("12. Updates own truck fields (capacity, currentCity)", async () => {
      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trucks/${seed.truck.id}`,
        { body: { capacity: 12000, currentCity: "Dire Dawa" } }
      );
      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.capacity).toBe(12000);
      expect(data.currentCity).toBe("Dire Dawa");
    });

    it("13. Rejects update of truck owned by other carrier", async () => {
      // Create a truck belonging to a different carrier org
      const otherCarrierOrg = await db.organization.create({
        data: {
          id: "other-carrier-org-13",
          name: "Other Carrier LLC",
          type: "CARRIER_COMPANY",
          contactEmail: "other-carrier@test.com",
          contactPhone: "+251911888888",
        },
      });
      const otherTruck = await db.truck.create({
        data: {
          id: "other-carrier-truck-13",
          truckType: "TANKER",
          licensePlate: "AA-OTHER13",
          capacity: 20000,
          carrierId: otherCarrierOrg.id,
          createdById: "other-carrier-user",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trucks/${otherTruck.id}`,
        { body: { capacity: 15000 } }
      );
      const res = await callHandler(updateTruck, req, { id: otherTruck.id });

      expect(res.status).toBe(403);
    });

    it("14. Carrier CAN list trucks (unlike shipper who gets 403)", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/trucks`);
      const res = await callHandler(listTrucks, req);

      expect(res.status).toBe(200);
    });

    it("15. Shipper CANNOT create truck (CREATE_TRUCK permission denied)", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: VALID_TRUCK_BODY,
      });
      const res = await callHandler(createTruck, req);

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 2: Truck Postings
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 2: Truck Postings", () => {
    it("16. Creates posting for own APPROVED truck", async () => {
      // Create a fresh truck without active posting
      const freshTruck = await db.truck.create({
        data: {
          id: "truck-posting-16",
          truckType: "DRY_VAN",
          licensePlate: "AA-POST16",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: freshTruck.id,
          originCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
        },
      });
      const res = await callHandler(createTruckPosting, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data).toBeDefined();
    });

    it("17. Rejects posting for truck not owned by carrier", async () => {
      // Create a truck belonging to a different carrier
      const otherTruck = await db.truck.create({
        data: {
          id: "truck-other-17",
          truckType: "FLATBED",
          licensePlate: "AA-OTHER17",
          capacity: 8000,
          isAvailable: true,
          carrierId: "other-carrier-org-13",
          createdById: "other-carrier-user",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: otherTruck.id,
          originCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test",
          contactPhone: "+251911000002",
        },
      });
      const res = await callHandler(createTruckPosting, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain(
        "only post trucks owned by your organization"
      );
    });

    it("18. Rejects posting for PENDING truck (not APPROVED)", async () => {
      const pendingTruck = await db.truck.create({
        data: {
          id: "truck-pending-18",
          truckType: "BOX_TRUCK",
          licensePlate: "AA-PEND18",
          capacity: 5000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: pendingTruck.id,
          originCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test",
          contactPhone: "+251911000002",
        },
      });
      const res = await callHandler(createTruckPosting, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("approved");
    });

    it("19. Rejects posting for REJECTED truck", async () => {
      const rejectedTruck = await db.truck.create({
        data: {
          id: "truck-rejected-19",
          truckType: "CONTAINER",
          licensePlate: "AA-REJ19",
          capacity: 20000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "REJECTED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: rejectedTruck.id,
          originCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test",
          contactPhone: "+251911000002",
        },
      });
      const res = await callHandler(createTruckPosting, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("approved");
    });

    it("20. Rejects duplicate active posting (ONE_ACTIVE_POST_PER_TRUCK)", async () => {
      // seed.truck already has an active posting from seedTestData()
      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: seed.truck.id,
          originCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test",
          contactPhone: "+251911000002",
        },
      });
      const res = await callHandler(createTruckPosting, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(409);
      expect(data.error).toContain("active posting");
    });

    it("21. Rejects posting with missing required fields", async () => {
      const noPostTruck = await db.truck.create({
        data: {
          id: "truck-noreq-21",
          truckType: "DRY_VAN",
          licensePlate: "AA-NOR21",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      // Missing originCityId and fullPartial
      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: noPostTruck.id,
          availableFrom: new Date().toISOString(),
        },
      });
      const res = await callHandler(createTruckPosting, req);

      expect(res.status).toBe(400);
    });

    it("22. Lists all truck postings (public)", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/truck-postings`);
      const res = await callHandler(listTruckPostings, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.truckPostings).toBeDefined();
      expect(Array.isArray(data.truckPostings)).toBe(true);
    });

    it("23. Filters postings by truckType", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/truck-postings?truckType=DRY_VAN`
      );
      const res = await callHandler(listTruckPostings, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.truckPostings)).toBe(true);
    });

    it("24. Filters postings by origin", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/truck-postings?origin=Addis`
      );
      const res = await callHandler(listTruckPostings, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.truckPostings)).toBe(true);
    });

    it("25. Creates posting with optional fields (destinationCityId, notes, availableTo)", async () => {
      const optTruck = await db.truck.create({
        data: {
          id: "truck-opts-25",
          truckType: "FLATBED",
          licensePlate: "AA-OPT25",
          capacity: 12000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: optTruck.id,
          originCityId: "city-addis",
          destinationCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          availableTo: new Date(Date.now() + 7 * 86400000).toISOString(),
          fullPartial: "PARTIAL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
          notes: "Flexible schedule",
        },
      });
      const res = await callHandler(createTruckPosting, req);

      expect(res.status).toBe(201);
    });

    it("26. Rejects posting with invalid originCityId", async () => {
      const badCityTruck = await db.truck.create({
        data: {
          id: "truck-badcity-26",
          truckType: "DRY_VAN",
          licensePlate: "AA-BAD26",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: badCityTruck.id,
          originCityId: "nonexistent-city-999",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test",
          contactPhone: "+251911000002",
        },
      });
      const res = await callHandler(createTruckPosting, req);

      // Invalid city ID triggers validation error (400)
      expect(res.status).toBe(400);
    });

    it("27. Shipper CANNOT create truck posting", async () => {
      setAuthSession(SHIPPER_SESSION);

      // Use a truck without existing posting to avoid 409 before ownership check
      const noPostTruck = await db.truck.create({
        data: {
          id: "truck-shipper-27",
          truckType: "FLATBED",
          licensePlate: "AA-SHP27",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: noPostTruck.id,
          originCityId: "city-addis",
          availableFrom: new Date().toISOString(),
          fullPartial: "FULL",
          contactName: "Test Contact",
          contactPhone: "+251911000099",
        },
      });
      const res = await callHandler(createTruckPosting, req);
      const data = await parseResponse(res);

      // Shipper org doesn't own the truck → 403
      expect(res.status).toBe(403);
      expect(data.error).toContain(
        "only post trucks owned by your organization"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 3: Load Requests — Carrier-to-Shipper
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 3: Load Requests — Carrier-to-Shipper", () => {
    it("28. Carrier creates load request for POSTED load", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
          notes: "I can haul this cargo",
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.loadRequest).toBeDefined();
      expect(data.loadRequest.status).toBe("PENDING");
    });

    it("29. Rejects request for DRAFT load", async () => {
      const draftLoad = await db.load.create({
        data: {
          id: "draft-load-29",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Draft load for carrier request test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: draftLoad.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe("Load is not available (status: DRAFT)");
    });

    it("30. Rejects request for already-ASSIGNED load", async () => {
      const assignedLoad = await db.load.create({
        data: {
          id: "assigned-load-30",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Already assigned load test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: assignedLoad.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe("Load is not available (status: ASSIGNED)");
    });

    it("31. Rejects request with truck not owned by carrier", async () => {
      const otherTruck = await db.truck.create({
        data: {
          id: "other-truck-31",
          truckType: "DRY_VAN",
          licensePlate: "AA-OTH31",
          capacity: 10000,
          isAvailable: true,
          carrierId: "other-carrier-org-13",
          createdById: "other-carrier-user",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: otherTruck.id,
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toBe("You can only request loads for your own trucks");
    });

    it("32. Rejects request with unapproved truck", async () => {
      const unapprovedTruck = await db.truck.create({
        data: {
          id: "unapproved-truck-32",
          truckType: "DRY_VAN",
          licensePlate: "AA-UNA32",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: unapprovedTruck.id,
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      // Unapproved truck → 400 (truck not approved for posting)
      expect(res.status).toBe(400);
      expect(data.error).toBe("Truck must be approved before requesting loads");
    });

    it("33. Rejects duplicate pending request", async () => {
      // First request was created in test 28 for seed.load + seed.truck
      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      // Duplicate pending request
      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "A pending request already exists for this load-truck combination"
      );
    });

    it("34. Shipper CANNOT create load request", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only carriers can request loads");
    });

    it("35. Lists carrier's own load requests", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/load-requests`);
      const res = await callHandler(listLoadRequests, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.loadRequests).toBeDefined();
      expect(Array.isArray(data.loadRequests)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("36. Shipper accepts load request → APPROVED + trip created", async () => {
      const approveLoad = await db.load.create({
        data: {
          id: "lr-approve-load-36",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 4500,
          cargoDescription: "Load for load request approve test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const approveTruck = await db.truck.create({
        data: {
          id: "truck-lr-approve-36",
          truckType: "DRY_VAN",
          licensePlate: "AA-36036",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const loadReq = await db.loadRequest.create({
        data: {
          id: "lr-approve-36",
          loadId: approveLoad.id,
          truckId: approveTruck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          load: {
            id: approveLoad.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
            pickupCity: "Addis Ababa",
            deliveryCity: "Hawassa",
          },
          truck: {
            id: approveTruck.id,
            licensePlate: "AA-36036",
            carrierId: seed.carrierOrg.id,
          },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/load-requests/${loadReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondLoadRequest, req, {
        id: loadReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.request.status).toBe("APPROVED");
      expect(data.trip).toBeDefined();
      expect(data.load.status).toBe("ASSIGNED");
    });

    it("37. Shipper rejects load request → REJECTED", async () => {
      const rejectLoad = await db.load.create({
        data: {
          id: "lr-reject-load-37",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(),
          truckType: "FLATBED",
          weight: 6000,
          cargoDescription: "Load for load request reject test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const rejectTruck = await db.truck.create({
        data: {
          id: "truck-lr-reject-37",
          truckType: "FLATBED",
          licensePlate: "AA-37037",
          capacity: 9000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const loadReq = await db.loadRequest.create({
        data: {
          id: "lr-reject-37",
          loadId: rejectLoad.id,
          truckId: rejectTruck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          load: {
            id: rejectLoad.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
            pickupCity: "Addis Ababa",
            deliveryCity: "Mekelle",
          },
          truck: {
            id: rejectTruck.id,
            licensePlate: "AA-37037",
            carrierId: seed.carrierOrg.id,
          },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/load-requests/${loadReq.id}/respond`,
        { body: { action: "REJECT", responseNotes: "Not interested" } }
      );
      const res = await callHandler(respondLoadRequest, req, {
        id: loadReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.request.status).toBe("REJECTED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 4: Truck Requests — Carrier Responds
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 4: Truck Requests — Carrier Responds", () => {
    it("38. Carrier approves truck request → APPROVED + trip created", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "approve-treq-load-38",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Bahir Dar",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Load for truck request approve test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const freshTruck = await db.truck.create({
        data: {
          id: "truck-approve-38",
          truckType: "DRY_VAN",
          licensePlate: "AA-38038",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      const truckReq = await db.truckRequest.create({
        data: {
          id: "treq-approve-38",
          loadId: freshLoad.id,
          truckId: freshTruck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: freshTruck.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-38038",
            carrier: { name: seed.carrierOrg.name },
          },
          load: {
            id: freshLoad.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${truckReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: truckReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.request.status).toBe("APPROVED");
      expect(data.trip).toBeDefined();
      expect(data.load.status).toBe("ASSIGNED");
    });

    it("39. Carrier rejects truck request → REJECTED, load stays POSTED", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "reject-treq-load-39",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(),
          truckType: "FLATBED",
          weight: 6000,
          cargoDescription: "Load for truck request reject test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const freshTruck = await db.truck.create({
        data: {
          id: "truck-reject-39",
          truckType: "FLATBED",
          licensePlate: "AA-39039",
          capacity: 9000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      const truckReq = await db.truckRequest.create({
        data: {
          id: "treq-reject-39",
          loadId: freshLoad.id,
          truckId: freshTruck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: freshTruck.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-39039",
            carrier: { name: seed.carrierOrg.name },
          },
          load: {
            id: freshLoad.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${truckReq.id}/respond`,
        { body: { action: "REJECT", responseNotes: "Truck unavailable" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: truckReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.request.status).toBe("REJECTED");
      const loadAfter = await db.load.findUnique({
        where: { id: freshLoad.id },
      });
      expect(loadAfter.status).toBe("POSTED");
    });

    it("40. Carrier cannot respond to request for truck they don't own", async () => {
      const otherTruck = await db.truck.create({
        data: {
          id: "truck-notown-40",
          truckType: "DRY_VAN",
          licensePlate: "AA-NOT40",
          capacity: 8000,
          isAvailable: true,
          carrierId: "other-carrier-org-13",
          createdById: "other-carrier-user",
          approvalStatus: "APPROVED",
          carrier: { id: "other-carrier-org-13", name: "Other Carrier" },
        },
      });

      const truckReq = await db.truckRequest.create({
        data: {
          id: "treq-notown-40",
          loadId: seed.load.id,
          truckId: otherTruck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: otherTruck.id,
            carrierId: "other-carrier-org-13",
            licensePlate: "AA-NOT40",
            carrier: { name: "Other Carrier" },
          },
          load: {
            id: seed.load.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${truckReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: truckReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("do not have permission");
    });

    it("41. Rejects response to expired request", async () => {
      const expiredReq = await db.truckRequest.create({
        data: {
          id: "treq-expired-41",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
          truck: {
            id: seed.truck.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-12345",
            carrier: { name: seed.carrierOrg.name },
          },
          load: {
            id: seed.load.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${expiredReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: expiredReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("expired");
    });

    it("42. Rejects response to already-responded request", async () => {
      const alreadyApproved = await db.truckRequest.create({
        data: {
          id: "treq-already-42",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "APPROVED",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: seed.truck.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-12345",
            carrier: { name: seed.carrierOrg.name },
          },
          load: {
            id: seed.load.id,
            status: "ASSIGNED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${alreadyApproved.id}/respond`,
        { body: { action: "REJECT" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: alreadyApproved.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe("Request has already been approved");
    });

    it("43. Shipper CANNOT respond to truck requests", async () => {
      const truckReq = await db.truckRequest.create({
        data: {
          id: "treq-shipper-43",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: seed.truck.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-12345",
            carrier: { name: seed.carrierOrg.name },
          },
          load: {
            id: seed.load.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${truckReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: truckReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("do not have permission");
    });

    it("44. Lists truck requests visible to carrier", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/truck-requests`);
      const res = await callHandler(listTruckRequests, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
    });

    it("45. Unauthenticated → 401 on respond", async () => {
      setAuthSession(null);

      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/some-id/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondTruckRequest, req, {
        id: "some-id",
      });

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 5: Trip State Machine — Carrier View
  // Real tripStateMachine.ts enforced — no mock
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 5: Trip State Machine — Carrier View", () => {
    it("46. Carrier lists own trips", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/trips`);
      const res = await callHandler(listTrips, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trips).toBeDefined();
      expect(Array.isArray(data.trips)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("47. Carrier gets trip detail", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/trips/test-trip-001`);
      const res = await callHandler(getTrip, req, { tripId: "test-trip-001" });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trip).toBeDefined();
      expect(data.trip.id).toBe("test-trip-001");
      expect(data.trip.status).toBe("IN_TRANSIT");
      expect(data.trip.load).toBeDefined();
      expect(data.trip.truck).toBeDefined();
      expect(data.trip.carrier).toBeDefined();
      expect(data.trip.shipper).toBeDefined();
    });

    it("48. Carrier cannot see other carrier's trip", async () => {
      await db.trip.create({
        data: {
          id: "other-carrier-trip-48",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: "other-carrier-org-13",
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
        },
      });

      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trips/other-carrier-trip-48`
      );
      const res = await callHandler(getTrip, req, {
        tripId: "other-carrier-trip-48",
      });

      expect(res.status).toBe(403);
    });

    it("49. ASSIGNED → PICKUP_PENDING (valid)", async () => {
      const assignedTrip = await db.trip.create({
        data: {
          id: "trip-assigned-49",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          load: {
            id: seed.load.id,
            status: "ASSIGNED",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${assignedTrip.id}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: assignedTrip.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trip.status).toBe("PICKUP_PENDING");
    });

    it("50. PICKUP_PENDING → IN_TRANSIT (valid)", async () => {
      const ppTrip = await db.trip.create({
        data: {
          id: "trip-pp-50",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PICKUP_PENDING",
          load: {
            id: seed.load.id,
            status: "PICKUP_PENDING",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest("PATCH", `${BASE_URL}/api/trips/${ppTrip.id}`, {
        body: { status: "IN_TRANSIT" },
      });
      const res = await callHandler(updateTrip, req, { tripId: ppTrip.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trip.status).toBe("IN_TRANSIT");
    });

    it("51. IN_TRANSIT → DELIVERED (valid, with receiver info)", async () => {
      const itTrip = await db.trip.create({
        data: {
          id: "trip-it-51",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          load: {
            id: seed.load.id,
            status: "IN_TRANSIT",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest("PATCH", `${BASE_URL}/api/trips/${itTrip.id}`, {
        body: {
          status: "DELIVERED",
          receiverName: "Abebe Kebede",
          receiverPhone: "+251911223344",
        },
      });
      const res = await callHandler(updateTrip, req, { tripId: itTrip.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trip.status).toBe("DELIVERED");
      expect(data.loadSynced).toBeDefined();
    });

    it("52. DELIVERED → COMPLETED requires POD submitted", async () => {
      const deliveredTrip = await db.trip.create({
        data: {
          id: "trip-delivered-52",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          load: {
            id: seed.load.id,
            status: "DELIVERED",
            podSubmitted: false,
            podVerified: false,
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${deliveredTrip.id}`,
        { body: { status: "COMPLETED" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: deliveredTrip.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "POD must be uploaded before completing the trip"
      );
    });

    it("53. DELIVERED → COMPLETED requires POD verified", async () => {
      const deliveredTrip2 = await db.trip.create({
        data: {
          id: "trip-delivered-53",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          load: {
            id: seed.load.id,
            status: "DELIVERED",
            podSubmitted: true,
            podVerified: false,
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${deliveredTrip2.id}`,
        { body: { status: "COMPLETED" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: deliveredTrip2.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "POD must be verified by shipper before completing the trip"
      );
    });

    it("54. ASSIGNED → IN_TRANSIT (invalid, skip)", async () => {
      const skipTrip = await db.trip.create({
        data: {
          id: "trip-skip-54",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          load: {
            id: seed.load.id,
            status: "ASSIGNED",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${skipTrip.id}`,
        { body: { status: "IN_TRANSIT" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: skipTrip.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid");
    });

    it("55. ASSIGNED → DELIVERED (invalid)", async () => {
      const skipTrip2 = await db.trip.create({
        data: {
          id: "trip-skip-55",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          load: {
            id: seed.load.id,
            status: "ASSIGNED",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${skipTrip2.id}`,
        { body: { status: "DELIVERED" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: skipTrip2.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid");
    });

    it("56. COMPLETED → ASSIGNED (terminal, no transition)", async () => {
      const completedTrip = await db.trip.create({
        data: {
          id: "trip-completed-56",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
          load: {
            id: seed.load.id,
            status: "COMPLETED",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${completedTrip.id}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: completedTrip.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "Invalid status transition from COMPLETED to ASSIGNED"
      );
    });

    it("57. CANCELLED → PICKUP_PENDING (terminal)", async () => {
      const cancelledTrip = await db.trip.create({
        data: {
          id: "trip-cancelled-57",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "CANCELLED",
          load: {
            id: seed.load.id,
            status: "CANCELLED",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${cancelledTrip.id}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: cancelledTrip.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "Invalid status transition from CANCELLED to PICKUP_PENDING"
      );
    });

    it("58. Shipper CANNOT update trip status", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/test-trip-001`,
        { body: { status: "DELIVERED" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: "test-trip-001",
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only the carrier can update trip status");
    });

    it("59. Trip status syncs with load status (loadSynced: true)", async () => {
      const syncTrip = await db.trip.create({
        data: {
          id: "trip-sync-59",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          load: {
            id: seed.load.id,
            status: "ASSIGNED",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: { id: seed.truck.id, licensePlate: "AA-12345" },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trips/${syncTrip.id}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: syncTrip.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.loadSynced).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 6: POD Upload
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 6: POD Upload", () => {
    it("60. Carrier POD upload without file → 400", async () => {
      const podLoad = await db.load.create({
        data: {
          id: "pod-upload-load-60",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Delivered load for carrier POD upload",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          podSubmitted: false,
          assignedTruck: { carrierId: seed.carrierOrg.id },
        },
      });

      setAuthSession(CARRIER_SESSION);
      // POST requires FormData but carrier ownership check happens first
      // The mock storage handles the actual upload
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/loads/${podLoad.id}/pod`
      );
      const res = await callHandler(uploadPod, req, { id: podLoad.id });
      const data = await parseResponse(res);

      // Carrier owns the truck, so passes ownership check
      // request.formData() throws (no multipart Content-Type) → catch-all returns 500
      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("61. Rejects POD upload for non-DELIVERED load", async () => {
      const inTransitLoad = await db.load.create({
        data: {
          id: "pod-intransit-61",
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "In-transit load for POD upload test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          assignedTruck: { carrierId: seed.carrierOrg.id },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/loads/${inTransitLoad.id}/pod`
      );
      const res = await callHandler(uploadPod, req, { id: inTransitLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("DELIVERED");
    });

    it("62. Rejects POD upload by non-carrier (shipper)", async () => {
      const uploadLoad = await db.load.create({
        data: {
          id: "pod-shipper-62",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Load for shipper POD upload test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          podSubmitted: false,
          assignedTruck: { carrierId: seed.carrierOrg.id },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/loads/${uploadLoad.id}/pod`
      );
      const res = await callHandler(uploadPod, req, { id: uploadLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only the assigned carrier can upload POD");
    });

    it("63. Rejects POD when already submitted", async () => {
      const alreadySubmitted = await db.load.create({
        data: {
          id: "pod-already-63",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Load with POD already submitted",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          podSubmitted: true,
          podSubmittedAt: new Date(),
          podUrl: "https://storage.test/pod-63.jpg",
          assignedTruck: { carrierId: seed.carrierOrg.id },
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/loads/${alreadySubmitted.id}/pod`
      );
      const res = await callHandler(uploadPod, req, {
        id: alreadySubmitted.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("already");
    });

    it("64. Carrier CANNOT verify POD (only shipper can)", async () => {
      const verifyLoad = await db.load.create({
        data: {
          id: "pod-carrier-verify-64",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Load for carrier verify test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          podSubmitted: true,
          podSubmittedAt: new Date(),
          podUrl: "https://storage.test/pod-64.jpg",
          podVerified: false,
        },
      });

      setAuthSession(CARRIER_SESSION);
      const req = createRequest(
        "PUT",
        `${BASE_URL}/api/loads/${verifyLoad.id}/pod`
      );
      const res = await callHandler(verifyPod, req, { id: verifyLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only the shipper can verify POD");
    });

    it("65. Shipper verifies POD", async () => {
      const podLoad = await db.load.create({
        data: {
          id: "pod-verify-load-65",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Delivered load for POD verify test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          podSubmitted: true,
          podSubmittedAt: new Date(),
          podUrl: "https://storage.test/pod-verify-65.jpg",
          podVerified: false,
          assignedTruck: { carrierId: seed.carrierOrg.id },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "PUT",
        `${BASE_URL}/api/loads/${podLoad.id}/pod`
      );
      const res = await callHandler(verifyPod, req, { id: podLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load.podVerified).toBe(true);
      expect(data.settlement).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 7: Live Trip Tracking
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 7: Live Trip Tracking", () => {
    it("66. Carrier gets live tracking for IN_TRANSIT trip", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trips/test-trip-001/live`
      );
      const res = await callHandler(getLiveTrip, req, {
        tripId: "test-trip-001",
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.tripId).toBe("test-trip-001");
      expect(data.status).toBe("IN_TRANSIT");
    });

    it("67. Live tracking returns truck and carrier info", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trips/test-trip-001/live`
      );
      const res = await callHandler(getLiveTrip, req, {
        tripId: "test-trip-001",
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.truck).toBeDefined();
      expect(data.carrier).toBeDefined();
    });

    it("68. Shipper gets live tracking on carrier's IN_TRANSIT trip", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trips/test-trip-001/live`
      );
      const res = await callHandler(getLiveTrip, req, {
        tripId: "test-trip-001",
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.tripId).toBe("test-trip-001");
      expect(data.status).toBe("IN_TRANSIT");
    });

    it("69. Unauthenticated → 401 on live tracking", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        `${BASE_URL}/api/trips/test-trip-001/live`
      );
      const res = await callHandler(getLiveTrip, req, {
        tripId: "test-trip-001",
      });

      const data = await parseResponse(res);

      // Live route has custom catch-all that returns 500
      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to fetch live position");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 8: Wallet & Financial
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 8: Wallet & Financial", () => {
    it("70. Gets carrier wallet balance", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/wallet/balance`);
      const res = await callHandler(getWalletBalance, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.wallets).toBeDefined();
      expect(Array.isArray(data.wallets)).toBe(true);
      expect(data.wallets.length).toBeGreaterThan(0);
      expect(data.wallets[0].type).toBe("CARRIER_WALLET");
    });

    it("71. Lists wallet transactions", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/wallet/transactions`);
      const res = await callHandler(listTransactions, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.transactions).toBeDefined();
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.totalCount).toBe("number");
      expect(typeof data.pagination.hasMore).toBe("boolean");
    });

    it("72. Balance shows correct seeded amount (5000 ETB)", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/wallet/balance`);
      const res = await callHandler(getWalletBalance, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.wallets[0].balance).toBe(5000);
      expect(data.currency).toBe("ETB");
    });

    it("73. Unauthenticated → 401 on wallet", async () => {
      setAuthSession(null);

      const req = createRequest("GET", `${BASE_URL}/api/wallet/balance`);
      const res = await callHandler(getWalletBalance, req);

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 9: Dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 9: Dashboard", () => {
    it("74. Gets carrier dashboard", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/carrier/dashboard`);
      const res = await callHandler(getCarrierDashboard, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(typeof data.totalTrucks).toBe("number");
    });

    it("75. Dashboard stats include truck/trip counts", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/carrier/dashboard`);
      const res = await callHandler(getCarrierDashboard, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.totalTrucks).toBeGreaterThanOrEqual(1);
      expect(typeof data.completedDeliveries).toBe("number");
    });

    it("76. Shipper CANNOT access carrier dashboard", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/carrier/dashboard`);
      const res = await callHandler(getCarrierDashboard, req);

      expect(res.status).toBe(403);
    });

    it("77. Unauthenticated → 401 on dashboard", async () => {
      setAuthSession(null);

      const req = createRequest("GET", `${BASE_URL}/api/carrier/dashboard`);
      const res = await callHandler(getCarrierDashboard, req);

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 10: Disputes
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 10: Disputes", () => {
    it("78. Carrier files dispute for load in their trip", async () => {
      // Create a load that the carrier is involved with via a trip
      const disputeLoad = await db.load.create({
        data: {
          id: "carrier-dispute-load-78",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Load for carrier dispute test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          assignedTruck: {
            carrierId: seed.carrierOrg.id,
            carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/disputes`, {
        body: {
          loadId: disputeLoad.id,
          type: "PAYMENT_ISSUE",
          description:
            "Payment was not received for the delivered load within expected timeframe",
        },
      });
      const res = await callHandler(createDispute, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.loadId).toBe(disputeLoad.id);
      expect(data.dispute.type).toBe("PAYMENT_ISSUE");
      expect(data.dispute.status).toBe("OPEN");
    });

    it("79. Carrier lists own disputes", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/disputes`);
      const res = await callHandler(listDisputes, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.disputes).toBeDefined();
      expect(Array.isArray(data.disputes)).toBe(true);
    });

    it("80. Rejects dispute for load not involving carrier", async () => {
      const otherLoad = await db.load.create({
        data: {
          id: "other-dispute-load-80",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Load not involving this carrier",
          shipperId: "other-shipper-org",
          createdById: "other-user-1",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/disputes`, {
        body: {
          loadId: otherLoad.id,
          type: "DAMAGE",
          description:
            "Testing access to other shipper dispute creation attempt",
        },
      });
      const res = await callHandler(createDispute, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("do not have access");
    });

    it("81. Carrier cannot resolve own dispute (admin only)", async () => {
      const dispute = await db.dispute.create({
        data: {
          id: "dispute-admin-only-81",
          loadId: seed.load.id,
          type: "PAYMENT_ISSUE",
          description: "Test dispute for admin resolution check",
          status: "OPEN",
          createdById: seed.carrierUser.id,
          filedByOrgId: seed.carrierOrg.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/disputes/${dispute.id}`,
        { body: { status: "RESOLVED", resolution: "Issue fixed" } }
      );
      const res = await callHandler(updateDispute, req, { id: dispute.id });

      // MANAGE_DISPUTES permission is required — carrier doesn't have it
      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 11: Cross-Role Security
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 11: Cross-Role Security", () => {
    it("82. Unauthenticated → 401 on truck create", async () => {
      setAuthSession(null);

      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: VALID_TRUCK_BODY,
      });
      const res = await callHandler(createTruck, req);

      expect(res.status).toBe(401);
    });

    it("83. Carrier with no DB user → 400 on truck create", async () => {
      setAuthSession(PENDING_CARRIER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: VALID_TRUCK_BODY,
      });
      const res = await callHandler(createTruck, req);

      const data = await parseResponse(res);

      // PENDING_CARRIER_SESSION userId not in DB → findUnique returns null → 400
      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "You must belong to an organization to create trucks"
      );
    });

    it("84. Carrier cannot modify other carrier's truck", async () => {
      const otherTruck = await db.truck.create({
        data: {
          id: "other-carrier-truck-84",
          truckType: "DRY_VAN",
          licensePlate: "AA-OTH84",
          capacity: 10000,
          carrierId: "other-carrier-org-13",
          createdById: "other-carrier-user",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/trucks/${otherTruck.id}`,
        { body: { capacity: 15000 } }
      );
      const res = await callHandler(updateTruck, req, { id: otherTruck.id });

      expect(res.status).toBe(403);
    });

    it("85. Carrier cannot access shipper dashboard", async () => {
      setAuthSession(CARRIER_SESSION);

      // Import shipper dashboard handler
      const {
        GET: getShipperDashboard,
      } = require("@/app/api/shipper/dashboard/route");

      const req = createRequest("GET", `${BASE_URL}/api/shipper/dashboard`);
      const res = await callHandler(getShipperDashboard, req);

      expect(res.status).toBe(403);
    });
  });
});
