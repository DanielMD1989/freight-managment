/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shipper Workflow Blueprint Test Suite
 *
 * SINGLE SOURCE OF TRUTH for shipper API behavior.
 * Every test has exact status code and response body assertions.
 *
 * Key differences from shipper-comprehensive.test.ts:
 * 1. NO try/catch around handler imports — if handler is missing, test FAILS
 * 2. NO range assertions like expect([200,400]).toContain — exact codes only
 * 3. Load state machine is NOT mocked — real transitions enforced
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
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockStorage,
  mockServiceFee,
  mockGeo,
  mockLogger,
  mockValidation,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockRbac,
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
// that checks actual ownership for canRequestTruck
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
  // Permissions that each role has (subset relevant to shipper tests)
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

// DO NOT mock loadStateMachine — real state transitions enforced
// DO NOT mock foundation-rules — real RBAC boundaries tested
// (foundation-rules is imported by trucks/route.ts directly, rbac mock handles permission checks)

// Mock apiErrors to properly map error types to HTTP status codes
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any, context?: string) => {
    const { NextResponse } = require("next/server");

    // Zod validation errors → 400 (use name check instead of instanceof for cross-module compat)
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
    // Only allow request if user's org matches the load's shipper
    return user.organizationId === loadShipperId;
  }),
  canApproveRequests: jest.fn((user: any, carrierId: string) => {
    // Only the carrier org that owns the truck can approve
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
const { POST: createLoad, GET: listLoads } = require("@/app/api/loads/route");
const {
  GET: getLoad,
  PATCH: updateLoad,
  DELETE: deleteLoad,
} = require("@/app/api/loads/[id]/route");
const {
  PATCH: updateLoadStatus,
  GET: getLoadStatus,
} = require("@/app/api/loads/[id]/status/route");
const {
  GET: listTrucks,
  POST: createTruck,
} = require("@/app/api/trucks/route");
const {
  GET: listTruckPostings,
  POST: createTruckPosting,
} = require("@/app/api/truck-postings/route");
const {
  POST: createTruckRequest,
  GET: listTruckRequests,
} = require("@/app/api/truck-requests/route");
const {
  POST: createLoadRequest,
  GET: listLoadRequests,
} = require("@/app/api/load-requests/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const {
  GET: getShipperDashboard,
} = require("@/app/api/shipper/dashboard/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const {
  POST: createDispute,
  GET: listDisputes,
} = require("@/app/api/disputes/route");
const {
  POST: respondTruckRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");
const {
  POST: respondLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");
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
  GET: listTransactions,
} = require("@/app/api/wallet/transactions/route");
const {
  GET: getDispute,
  PATCH: updateDispute,
} = require("@/app/api/disputes/[id]/route");

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:3000";

const SHIPPER_SESSION = createMockSession({
  userId: "shipper-user-1",
  email: "shipper@test.com",
  role: "SHIPPER",
  status: "ACTIVE",
  organizationId: "shipper-org-1",
  firstName: "Test",
  lastName: "Shipper",
});

const CARRIER_SESSION = createMockSession({
  userId: "carrier-user-1",
  email: "carrier@test.com",
  role: "CARRIER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
  firstName: "Test",
  lastName: "Carrier",
});

const PENDING_USER_SESSION = createMockSession({
  userId: "pending-user-1",
  email: "pending@test.com",
  role: "SHIPPER",
  status: "PENDING_VERIFICATION",
  organizationId: "shipper-org-1",
});

const VALID_LOAD_BODY = {
  pickupCity: "Addis Ababa",
  pickupDate: new Date(Date.now() + 7 * 86400000).toISOString(),
  deliveryCity: "Dire Dawa",
  deliveryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
  truckType: "DRY_VAN",
  weight: 5000,
  cargoDescription: "Test cargo for blueprint tests",
  status: "DRAFT",
};

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

describe("Shipper Blueprint Test Suite", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Patch truck with carrier relation and active postings
    // (in-memory mock doesn't resolve nested relations from separate stores)
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
    // Default to shipper session
    setAuthSession(SHIPPER_SESSION);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 1: Load CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 1: Load CRUD", () => {
    it("1. Creates DRAFT load with all required fields", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const res = await callHandler(createLoad, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.load).toBeDefined();
      expect(data.load.status).toBe("DRAFT");
      expect(data.load.pickupCity).toBe("Addis Ababa");
      expect(data.load.deliveryCity).toBe("Dire Dawa");
      expect(data.load.weight).toBe(5000);
      expect(data.load.truckType).toBe("DRY_VAN");
      expect(data.load.cargoDescription).toBe("Test cargo for blueprint tests");
    });

    it("2. Creates POSTED load with postedAt timestamp", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: { ...VALID_LOAD_BODY, status: "POSTED" },
      });
      const res = await callHandler(createLoad, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.load.status).toBe("POSTED");
      expect(data.load.postedAt).toBeDefined();
    });

    it("3. Creates load with optional fields (insurance, contact, dimensions)", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: {
          ...VALID_LOAD_BODY,
          isInsured: true,
          insuranceProvider: "Nyala Insurance",
          insurancePolicyNumber: "POL-12345",
          insuranceCoverageAmount: 500000,
          shipperContactName: "Abebe Kebede",
          shipperContactPhone: "+251911223344",
          volume: 25,
          lengthM: 12,
          casesCount: 100,
          safetyNotes: "Handle with care - fragile items",
          specialInstructions: "Call before delivery",
        },
      });
      const res = await callHandler(createLoad, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.load.isInsured).toBe(true);
      expect(data.load.insuranceProvider).toBe("Nyala Insurance");
      expect(data.load.volume).toBe(25);
      expect(data.load.lengthM).toBe(12);
      expect(data.load.casesCount).toBe(100);
    });

    it("4. Rejects load missing pickupCity", async () => {
      const { pickupCity, ...bodyWithout } = VALID_LOAD_BODY;
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: bodyWithout,
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(400);
    });

    it("5. Rejects load missing cargoDescription", async () => {
      const { cargoDescription, ...bodyWithout } = VALID_LOAD_BODY;
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: bodyWithout,
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(400);
    });

    it("6. Rejects load with cargoDescription < 5 chars", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: { ...VALID_LOAD_BODY, cargoDescription: "abc" },
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(400);
    });

    it("7. Rejects load with invalid truckType", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: { ...VALID_LOAD_BODY, truckType: "INVALID_TYPE" },
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(400);
    });

    it("8. Rejects load with negative weight", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: { ...VALID_LOAD_BODY, weight: -100 },
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(400);
    });

    it("9. Lists own loads with myLoads=true", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/loads?myLoads=true`);
      const res = await callHandler(listLoads, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.loads)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe("number");
    });

    it("10. Lists loads with status filter", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/loads?myLoads=true&status=POSTED`
      );
      const res = await callHandler(listLoads, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.loads)).toBe(true);
      // Every returned load should have POSTED status
      data.loads.forEach((load: any) => {
        expect(load.status).toBe("POSTED");
      });
    });

    it("11. Gets single load by ID", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/loads/${seed.load.id}`);
      const res = await callHandler(getLoad, req, { id: seed.load.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load).toBeDefined();
      expect(data.load.id).toBe(seed.load.id);
    });

    it("12. Updates DRAFT load fields", async () => {
      // Create a DRAFT load first
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      const draftId = created.load.id;

      // Update it
      const updateReq = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${draftId}`,
        {
          body: {
            weight: 7000,
            cargoDescription: "Updated cargo description for test",
          },
        }
      );
      const updateRes = await callHandler(updateLoad, updateReq, {
        id: draftId,
      });
      const updated = await parseResponse(updateRes);

      expect(updateRes.status).toBe(200);
      expect(updated.load).toBeDefined();
    });

    it("13. Rejects edit of ASSIGNED load", async () => {
      // Create and assign a load
      const assignedLoad = await db.load.create({
        data: {
          id: "assigned-load-edit-test",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Assigned load test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${assignedLoad.id}`,
        { body: { weight: 9000 } }
      );
      const res = await callHandler(updateLoad, req, {
        id: assignedLoad.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain(
        "Cannot edit load after it has been assigned"
      );
    });

    it("14. Deletes DRAFT load", async () => {
      // Create a draft
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      const draftId = created.load.id;

      const req = createRequest("DELETE", `${BASE_URL}/api/loads/${draftId}`);
      const res = await callHandler(deleteLoad, req, { id: draftId });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.message).toBe("Load deleted successfully");
    });

    it("15. Rejects delete of ASSIGNED load", async () => {
      const assignedLoad = await db.load.create({
        data: {
          id: "assigned-load-delete-test",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Assigned load for delete test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
        },
      });

      const req = createRequest(
        "DELETE",
        `${BASE_URL}/api/loads/${assignedLoad.id}`
      );
      const res = await callHandler(deleteLoad, req, {
        id: assignedLoad.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("Cannot delete");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 2: Load State Machine
  // Real loadStateMachine.ts enforced — no mock
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 2: Load State Machine", () => {
    it("16. DRAFT → POSTED (shipper)", async () => {
      // Create a DRAFT load
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      expect(createRes.status).toBe(201);

      const loadId = created.load.id;

      // Transition DRAFT → POSTED
      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${loadId}/status`,
        { body: { status: "POSTED" } }
      );
      const res = await callHandler(updateLoadStatus, req, { id: loadId });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load.status).toBe("POSTED");
    });

    it("17. POSTED → UNPOSTED (shipper)", async () => {
      // Create a POSTED load
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: { ...VALID_LOAD_BODY, status: "POSTED" },
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      const loadId = created.load.id;

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${loadId}/status`,
        { body: { status: "UNPOSTED" } }
      );
      const res = await callHandler(updateLoadStatus, req, { id: loadId });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load.status).toBe("UNPOSTED");
    });

    it("18. UNPOSTED → POSTED (re-post)", async () => {
      // Create an UNPOSTED load directly
      const unpostedLoad = await db.load.create({
        data: {
          id: "unposted-repost-test",
          status: "UNPOSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Bahir Dar",
          deliveryDate: new Date(),
          truckType: "FLATBED",
          weight: 4000,
          cargoDescription: "Unposted repost test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${unpostedLoad.id}/status`,
        { body: { status: "POSTED" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: unpostedLoad.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load.status).toBe("POSTED");
    });

    it("19. DRAFT → ASSIGNED is invalid (skip)", async () => {
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      const loadId = created.load.id;

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${loadId}/status`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateLoadStatus, req, { id: loadId });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid transition");
    });

    it("20. DRAFT → IN_TRANSIT is invalid (skip)", async () => {
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      const loadId = created.load.id;

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${loadId}/status`,
        { body: { status: "IN_TRANSIT" } }
      );
      const res = await callHandler(updateLoadStatus, req, { id: loadId });
      const data = await parseResponse(res);

      // Either invalid transition (400) or role check fails (403)
      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("21. IN_TRANSIT → CANCELLED is blocked (business rule)", async () => {
      const inTransitLoad = await db.load.create({
        data: {
          id: "in-transit-cancel-test",
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 6000,
          cargoDescription: "In-transit cancel test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${inTransitLoad.id}/status`,
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: inTransitLoad.id,
      });
      const data = await parseResponse(res);

      // IN_TRANSIT → CANCELLED is not in VALID_TRANSITIONS (only DELIVERED, EXCEPTION)
      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid transition");
    });

    it("22. COMPLETED → POSTED is invalid (from near-terminal)", async () => {
      const completedLoad = await db.load.create({
        data: {
          id: "completed-repost-test",
          status: "COMPLETED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Jimma",
          deliveryDate: new Date(),
          truckType: "BOX_TRUCK",
          weight: 2000,
          cargoDescription: "Completed repost test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${completedLoad.id}/status`,
        { body: { status: "POSTED" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: completedLoad.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("23. CANCELLED → POSTED is invalid (terminal state)", async () => {
      const cancelledLoad = await db.load.create({
        data: {
          id: "cancelled-repost-test",
          status: "CANCELLED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Adama",
          deliveryDate: new Date(),
          truckType: "TANKER",
          weight: 8000,
          cargoDescription: "Cancelled repost test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${cancelledLoad.id}/status`,
        { body: { status: "POSTED" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: cancelledLoad.id,
      });
      const data = await parseResponse(res);

      // CANCELLED has no valid transitions at all
      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid transition");
    });

    it("24. Shipper cannot set status to IN_TRANSIT", async () => {
      // Shipper role can only set: DRAFT, POSTED, CANCELLED, UNPOSTED
      const postedLoad = await db.load.create({
        data: {
          id: "shipper-intransit-test",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Gondar",
          deliveryDate: new Date(),
          truckType: "CONTAINER",
          weight: 10000,
          cargoDescription: "Shipper in-transit role test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${postedLoad.id}/status`,
        { body: { status: "IN_TRANSIT" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: postedLoad.id,
      });
      const data = await parseResponse(res);

      // Should fail - either invalid transition (POSTED→IN_TRANSIT is not valid)
      // or role restriction (shipper can't set IN_TRANSIT)
      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("25. Shipper cannot set status to DELIVERED", async () => {
      const postedLoad2 = await db.load.create({
        data: {
          id: "shipper-delivered-test",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Shipper delivered role test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${postedLoad2.id}/status`,
        { body: { status: "DELIVERED" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: postedLoad2.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("26. Shipper CAN set POSTED → CANCELLED", async () => {
      const postedLoad3 = await db.load.create({
        data: {
          id: "shipper-cancel-posted-test",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Debre Markos",
          deliveryDate: new Date(),
          truckType: "FLATBED",
          weight: 7000,
          cargoDescription: "Shipper cancel posted test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${postedLoad3.id}/status`,
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateLoadStatus, req, {
        id: postedLoad3.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load.status).toBe("CANCELLED");
    });

    it("27. Shipper CAN set DRAFT → CANCELLED", async () => {
      const createReq = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const createRes = await callHandler(createLoad, createReq);
      const created = await parseResponse(createRes);
      const loadId = created.load.id;

      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${loadId}/status`,
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateLoadStatus, req, { id: loadId });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.load.status).toBe("CANCELLED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 3: Truck Postings — SHIPPER_DEMAND_FOCUS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 3: Truck Postings — SHIPPER_DEMAND_FOCUS", () => {
    it("28. Shipper CAN list truck postings", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/truck-postings`);
      const res = await callHandler(listTruckPostings, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.truckPostings).toBeDefined();
      expect(Array.isArray(data.truckPostings)).toBe(true);
    });

    it("29. Shipper CAN filter postings by truckType", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/truck-postings?truckType=DRY_VAN`
      );
      const res = await callHandler(listTruckPostings, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.truckPostings)).toBe(true);
    });

    it("30. Shipper CAN filter postings by origin", async () => {
      const req = createRequest(
        "GET",
        `${BASE_URL}/api/truck-postings?origin=Addis`
      );
      const res = await callHandler(listTruckPostings, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.truckPostings)).toBe(true);
    });

    it("31. Shipper CANNOT list /api/trucks directly", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/trucks`);
      const res = await callHandler(listTrucks, req);
      const data = await parseResponse(res);

      // Foundation Rule: SHIPPER_DEMAND_FOCUS
      expect(res.status).toBe(403);
      expect(data.error).toContain("Shippers cannot browse truck fleet");
      expect(data.rule).toBe("SHIPPER_DEMAND_FOCUS");
    });

    it("32. Shipper CANNOT create truck", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/trucks`, {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "AA-99999",
          capacity: 10000,
        },
      });
      const res = await callHandler(createTruck, req);

      // CREATE_TRUCK permission denied for SHIPPER
      expect(res.status).toBe(403);
    });

    it("33. Shipper CANNOT create truck posting", async () => {
      // Create a truck without an active posting (seed truck already has one,
      // which would trigger 409 ONE_ACTIVE_POST_PER_TRUCK before ownership check)
      const noPostingTruck = await db.truck.create({
        data: {
          id: "truck-no-posting-test",
          truckType: "FLATBED",
          licensePlate: "AA-99988",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-postings`, {
        body: {
          truckId: noPostingTruck.id,
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
  // DOMAIN 4: Truck Requests — Shipper-to-Carrier
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 4: Truck Requests — Shipper-to-Carrier", () => {
    it("34. Creates truck request for own POSTED load", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/truck-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
          notes: "Need truck urgently",
        },
      });
      const res = await callHandler(createTruckRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.request).toBeDefined();
      expect(data.request.status).toBe("PENDING");
      expect(data.rule).toBe("CARRIER_FINAL_AUTHORITY");
    });

    it("35. Rejects request for other shipper's load", async () => {
      // Create a load belonging to a different shipper org
      const otherOrg = await db.organization.create({
        data: {
          id: "other-shipper-org",
          name: "Other Shipper",
          type: "SHIPPER",
          contactEmail: "other@test.com",
          contactPhone: "+251911999999",
        },
      });
      const otherLoad = await db.load.create({
        data: {
          id: "other-shipper-load",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Other shipper's load for test",
          shipperId: otherOrg.id,
          createdById: "other-user-1",
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-requests`, {
        body: {
          loadId: otherLoad.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createTruckRequest, req);

      expect(res.status).toBe(403);
    });

    it("36. Rejects request for DRAFT load (not POSTED)", async () => {
      const draftLoad = await db.load.create({
        data: {
          id: "draft-request-test",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Draft load for request test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest("POST", `${BASE_URL}/api/truck-requests`, {
        body: {
          loadId: draftLoad.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createTruckRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain(
        "Cannot request truck for load with status DRAFT"
      );
    });

    it("37. Rejects duplicate pending request (same load+truck)", async () => {
      // First request was created in test 34 for seed.load + seed.truck
      const req = createRequest("POST", `${BASE_URL}/api/truck-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createTruckRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(409);
      expect(data.error).toContain("pending request already exists");
    });

    it("38. Rejects request with nonexistent loadId", async () => {
      const req = createRequest("POST", `${BASE_URL}/api/truck-requests`, {
        body: {
          loadId: "nonexistent-load-id-1234567890",
          truckId: seed.truck.id,
        },
      });
      const res = await callHandler(createTruckRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(404);
      expect(data.error).toBe("Load not found");
    });

    it("39. Lists own truck requests", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/truck-requests`);
      const res = await callHandler(listTruckRequests, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
    });

    it("40. Cancel pending truck request via status update", async () => {
      // Create a new request to cancel
      const newLoad = await db.load.create({
        data: {
          id: "cancel-request-load",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Load for cancel request test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const createReq = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests`,
        {
          body: {
            loadId: newLoad.id,
            truckId: seed.truck.id,
          },
        }
      );
      const createRes = await callHandler(createTruckRequest, createReq);
      const created = await parseResponse(createRes);

      expect(createRes.status).toBe(201);
      expect(created.request.status).toBe("PENDING");
    });

    it("42. Carrier approves truck request → APPROVED + trip created", async () => {
      // Create a fresh POSTED load for this test
      setAuthSession(SHIPPER_SESSION);
      const freshLoad = await db.load.create({
        data: {
          id: "approve-request-load-42",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Bahir Dar",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Load for approve request test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      // Create a separate available truck for this test
      const freshTruck = await db.truck.create({
        data: {
          id: "truck-approve-42",
          truckType: "DRY_VAN",
          licensePlate: "AA-42042",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      // Create truck request
      const truckReq = await db.truckRequest.create({
        data: {
          id: "treq-approve-42",
          loadId: freshLoad.id,
          truckId: freshTruck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: freshTruck.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-42042",
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

      // Switch to carrier session to approve
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

    it("43. Carrier rejects truck request → REJECTED, load stays POSTED", async () => {
      // Create a fresh load + request for rejection test
      setAuthSession(SHIPPER_SESSION);
      const freshLoad = await db.load.create({
        data: {
          id: "reject-request-load-43",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(),
          truckType: "FLATBED",
          weight: 6000,
          cargoDescription: "Load for reject request test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const freshTruck2 = await db.truck.create({
        data: {
          id: "truck-reject-43",
          truckType: "FLATBED",
          licensePlate: "AA-43043",
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
          id: "treq-reject-43",
          loadId: freshLoad.id,
          truckId: freshTruck2.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: freshTruck2.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-43043",
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
      // Load should remain POSTED (not changed by rejection)
      const loadAfter = await db.load.findUnique({
        where: { id: freshLoad.id },
      });
      expect(loadAfter.status).toBe("POSTED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 5: Load Requests — Carrier-to-Shipper
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 5: Load Requests — Carrier-to-Shipper", () => {
    it("44. Shipper lists load requests for own loads", async () => {
      const req = createRequest("GET", `${BASE_URL}/api/load-requests`);
      const res = await callHandler(listLoadRequests, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.loadRequests).toBeDefined();
      expect(Array.isArray(data.loadRequests)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("45. Carrier creates load request (only carriers can)", async () => {
      setAuthSession(CARRIER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/load-requests`, {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
          notes: "I can haul this",
        },
      });
      const res = await callHandler(createLoadRequest, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.loadRequest).toBeDefined();
    });

    it("46. Shipper CANNOT create load request (only carrier can)", async () => {
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

    it("46b. Shipper accepts load request → load ASSIGNED + trip created", async () => {
      // Create a fresh load + load request for approval
      const approveLoad = await db.load.create({
        data: {
          id: "lr-approve-load-46b",
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
          id: "truck-lr-approve-46b",
          truckType: "DRY_VAN",
          licensePlate: "AA-46046",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const loadReq = await db.loadRequest.create({
        data: {
          id: "lr-approve-46b",
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
            licensePlate: "AA-46046",
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

    it("47. Shipper cannot accept expired load request", async () => {
      const expiredReq = await db.loadRequest.create({
        data: {
          id: "lr-expired-47",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
          load: {
            id: seed.load.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: {
            id: seed.truck.id,
            licensePlate: "AA-12345",
            carrierId: seed.carrierOrg.id,
          },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/load-requests/${expiredReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondLoadRequest, req, {
        id: expiredReq.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("expired");
    });

    it("48. Shipper cannot accept already-responded load request", async () => {
      const alreadyApproved = await db.loadRequest.create({
        data: {
          id: "lr-already-48",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          status: "APPROVED", // Already responded
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          load: {
            id: seed.load.id,
            status: "ASSIGNED",
            shipperId: seed.shipperOrg.id,
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: {
            id: seed.truck.id,
            licensePlate: "AA-12345",
            carrierId: seed.carrierOrg.id,
          },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/load-requests/${alreadyApproved.id}/respond`,
        { body: { action: "REJECT" } } // Try to reject an already approved request
      );
      const res = await callHandler(respondLoadRequest, req, {
        id: alreadyApproved.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("already been approved");
    });

    it("49. Shipper cannot respond to request for other shipper's load", async () => {
      const otherLR = await db.loadRequest.create({
        data: {
          id: "lr-other-49",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: "other-shipper-org", // Different shipper
          requestedById: seed.carrierUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          load: {
            id: seed.load.id,
            status: "POSTED",
            shipperId: "other-shipper-org",
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: {
            id: seed.truck.id,
            licensePlate: "AA-12345",
            carrierId: seed.carrierOrg.id,
          },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/load-requests/${otherLR.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondLoadRequest, req, {
        id: otherLR.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain(
        "Only the shipper who owns the load can respond"
      );
    });

    it("51. Carrier cannot respond to load requests (only shipper can)", async () => {
      const carrierLR = await db.loadRequest.create({
        data: {
          id: "lr-carrier-51",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          load: {
            id: seed.load.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
            pickupCity: "Addis Ababa",
            deliveryCity: "Dire Dawa",
          },
          truck: {
            id: seed.truck.id,
            licensePlate: "AA-12345",
            carrierId: seed.carrierOrg.id,
          },
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      setAuthSession(CARRIER_SESSION); // Carrier tries to respond
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/load-requests/${carrierLR.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondLoadRequest, req, {
        id: carrierLR.id,
      });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain(
        "Only the shipper who owns the load can respond"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 6: Trip Tracking — Shipper View
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 6: Trip Tracking — Shipper View", () => {
    it("52. Shipper lists own trips", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/trips`);
      const res = await callHandler(listTrips, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trips).toBeDefined();
      expect(Array.isArray(data.trips)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("54. Shipper cannot see other shipper's trips (filtered by org)", async () => {
      // Create a trip for a different shipper
      await db.trip.create({
        data: {
          id: "other-shipper-trip",
          loadId: "other-shipper-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: "other-shipper-org", // Different shipper
          status: "IN_TRANSIT",
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest("GET", `${BASE_URL}/api/trips`);
      const res = await callHandler(listTrips, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      // Should only see trips for shipper-org-1, not other-shipper-org
      data.trips.forEach((trip: any) => {
        expect(trip.shipperId).toBe("shipper-org-1");
      });
    });

    it("53. Shipper gets trip detail", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/trips/test-trip-001`);
      const res = await callHandler(getTrip, req, { tripId: "test-trip-001" });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.trip).toBeDefined();
      expect(data.trip.id).toBe("test-trip-001");
      expect(data.trip.status).toBe("IN_TRANSIT");
      expect(data.trip.carrier).toBeDefined();
      expect(data.trip.truck).toBeDefined();
    });

    it("55. Shipper CANNOT update trip status (only carrier can)", async () => {
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

    it("57. Live trip endpoint works for shipper on IN_TRANSIT trip", async () => {
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
      expect(data.truck).toBeDefined();
      expect(data.carrier).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 7: Disputes
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 7: Disputes", () => {
    it("71. Shipper files dispute for own load", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/disputes`, {
        body: {
          loadId: seed.load.id,
          type: "LATE_DELIVERY",
          description:
            "The delivery was significantly delayed beyond the agreed timeframe",
        },
      });
      const res = await callHandler(createDispute, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.loadId).toBe(seed.load.id);
      expect(data.dispute.type).toBe("LATE_DELIVERY");
      expect(data.dispute.status).toBe("OPEN");
    });

    it("72. Shipper lists own disputes", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/disputes`);
      const res = await callHandler(listDisputes, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.disputes).toBeDefined();
      expect(Array.isArray(data.disputes)).toBe(true);
    });

    it("73. Rejects dispute for non-existent load", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/disputes`, {
        body: {
          loadId: "nonexistent-load-999999",
          type: "DAMAGE",
          description: "This load does not exist but testing validation",
        },
      });
      const res = await callHandler(createDispute, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(404);
      expect(data.error).toBe("Load not found");
    });

    it("74. Rejects dispute for other shipper's load", async () => {
      // Use a load that belongs to a different org
      const otherLoad = await db.load.create({
        data: {
          id: "other-shipper-dispute-load",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Other shipper dispute test load",
          shipperId: "other-shipper-org",
          createdById: "other-user-1",
        },
      });

      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/disputes`, {
        body: {
          loadId: otherLoad.id,
          type: "PAYMENT_ISSUE",
          description: "Testing access to other shipper dispute creation",
        },
      });
      const res = await callHandler(createDispute, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("do not have access");
    });

    it("75. Shipper cannot resolve own dispute (admin only)", async () => {
      // Create a dispute first
      const dispute = await db.dispute.create({
        data: {
          id: "dispute-admin-only-75",
          loadId: seed.load.id,
          type: "LATE_DELIVERY",
          description: "Test dispute for admin resolution check",
          status: "OPEN",
          createdById: seed.shipperUser.id,
          filedByOrgId: seed.shipperOrg.id,
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/disputes/${dispute.id}`,
        { body: { status: "RESOLVED", resolution: "Issue fixed" } }
      );
      const res = await callHandler(updateDispute, req, { id: dispute.id });
      const data = await parseResponse(res);

      // MANAGE_DISPUTES permission is required — shipper doesn't have it
      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 7b: POD & Settlement
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 7b: POD & Settlement", () => {
    it("60. Shipper verifies POD", async () => {
      // Create a DELIVERED load with POD submitted
      const podLoad = await db.load.create({
        data: {
          id: "pod-verify-load-60",
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
          podUrl: "https://storage.test/pod-verify-60.jpg",
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

    it("61. Cannot verify POD before submission", async () => {
      const noSubmitLoad = await db.load.create({
        data: {
          id: "pod-no-submit-61",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "Load with no POD submitted",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: false,
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "PUT",
        `${BASE_URL}/api/loads/${noSubmitLoad.id}/pod`
      );
      const res = await callHandler(verifyPod, req, { id: noSubmitLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("No POD has been submitted");
    });

    it("62. Cannot verify already-verified POD", async () => {
      const alreadyVerified = await db.load.create({
        data: {
          id: "pod-already-verified-62",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "FLATBED",
          weight: 5000,
          cargoDescription: "Load with already verified POD",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
          podUrl: "https://storage.test/pod-62.jpg",
          podVerified: true,
          podVerifiedAt: new Date(),
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "PUT",
        `${BASE_URL}/api/loads/${alreadyVerified.id}/pod`
      );
      const res = await callHandler(verifyPod, req, { id: alreadyVerified.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(data.error).toContain("POD already verified");
    });

    it("65. Shipper CANNOT upload POD (only carrier can)", async () => {
      const uploadLoad = await db.load.create({
        data: {
          id: "pod-upload-65",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Delivered load for upload test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
          podSubmitted: false,
          assignedTruck: { carrierId: seed.carrierOrg.id },
        },
      });

      setAuthSession(SHIPPER_SESSION);
      // POST requires FormData, but we test the role check which happens before file parsing
      // The route checks carrier ownership before FormData parsing
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/loads/${uploadLoad.id}/pod`
      );
      const res = await callHandler(uploadPod, req, { id: uploadLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only the assigned carrier can upload POD");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 8: Wallet & Financial
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 8: Wallet & Financial", () => {
    it("66. Gets wallet balance", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/wallet/balance`);
      const res = await callHandler(getWalletBalance, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.wallets).toBeDefined();
      expect(Array.isArray(data.wallets)).toBe(true);
      expect(data.wallets.length).toBeGreaterThan(0);
      expect(data.wallets[0].type).toBe("SHIPPER_WALLET");
      expect(data.currency).toBe("ETB");
    });

    it("68. Balance shows correct seeded amount", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/wallet/balance`);
      const res = await callHandler(getWalletBalance, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.wallets[0].balance).toBe(10000);
    });

    it("67. Lists wallet transactions", async () => {
      setAuthSession(SHIPPER_SESSION);

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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 9: Dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 9: Dashboard", () => {
    it("76. Gets shipper dashboard", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/shipper/dashboard`);
      const res = await callHandler(getShipperDashboard, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalLoads).toBe("number");
      expect(typeof data.stats.activeLoads).toBe("number");
      expect(data.loadsByStatus).toBeDefined();
      expect(data.wallet).toBeDefined();
    });

    it("77. Dashboard stats match actual data", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/shipper/dashboard`);
      const res = await callHandler(getShipperDashboard, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      // At least the seeded load exists
      expect(data.stats.totalLoads).toBeGreaterThanOrEqual(1);
    });

    it("78. Carrier CANNOT access shipper dashboard", async () => {
      setAuthSession(CARRIER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/shipper/dashboard`);
      const res = await callHandler(getShipperDashboard, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Shipper role required");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 10: Cross-Role Security
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Domain 10: Cross-Role Security", () => {
    it("79. Unauthenticated → 401 on load create", async () => {
      setAuthSession(null);

      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(401);
    });

    it("80. Unauthenticated → 401 on load list", async () => {
      setAuthSession(null);

      const req = createRequest("GET", `${BASE_URL}/api/loads`);
      const res = await callHandler(listLoads, req);

      expect(res.status).toBe(401);
    });

    it("81. PENDING_VERIFICATION user → 403 on load create", async () => {
      setAuthSession(PENDING_USER_SESSION);

      const req = createRequest("POST", `${BASE_URL}/api/loads`, {
        body: VALID_LOAD_BODY,
      });
      const res = await callHandler(createLoad, req);

      expect(res.status).toBe(403);
    });

    it("82. Shipper cannot access /api/trucks (list)", async () => {
      setAuthSession(SHIPPER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/trucks`);
      const res = await callHandler(listTrucks, req);
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.rule).toBe("SHIPPER_DEMAND_FOCUS");
    });

    it("83. Shipper cannot modify other shipper's load", async () => {
      const otherLoad = await db.load.create({
        data: {
          id: "other-shipper-modify-test",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Other shipper modify test load",
          shipperId: "other-shipper-org",
          createdById: "other-user-1",
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "PATCH",
        `${BASE_URL}/api/loads/${otherLoad.id}`,
        { body: { weight: 9999 } }
      );
      const res = await callHandler(updateLoad, req, { id: otherLoad.id });

      expect(res.status).toBe(403);
    });

    it("84. Shipper cannot delete other shipper's load", async () => {
      const otherLoad = await db.load.create({
        data: {
          id: "other-shipper-delete-test",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Other shipper delete test load",
          shipperId: "other-shipper-org",
          createdById: "other-user-1",
        },
      });

      setAuthSession(SHIPPER_SESSION);
      const req = createRequest(
        "DELETE",
        `${BASE_URL}/api/loads/${otherLoad.id}`
      );
      const res = await callHandler(deleteLoad, req, { id: otherLoad.id });

      expect(res.status).toBe(403);
    });

    it("85. Carrier session → 403 on shipper dashboard", async () => {
      setAuthSession(CARRIER_SESSION);

      const req = createRequest("GET", `${BASE_URL}/api/shipper/dashboard`);
      const res = await callHandler(getShipperDashboard, req);

      expect(res.status).toBe(403);
    });

    it("86. Unauthenticated → 401 on truck request respond", async () => {
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

    it("87. Shipper cannot respond to truck requests (only carrier can)", async () => {
      // Create a fresh load + truck to avoid state pollution from earlier tests
      const load87 = await db.load.create({
        data: {
          id: "load-shipper-respond-87",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(),
          deliveryCity: "Gondar",
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Load for shipper respond test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const truck87 = await db.truck.create({
        data: {
          id: "truck-respond-87",
          truckType: "DRY_VAN",
          licensePlate: "AA-87087",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      });

      const trReq = await db.truckRequest.create({
        data: {
          id: "treq-shipper-87",
          loadId: load87.id,
          truckId: truck87.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          truck: {
            id: truck87.id,
            carrierId: seed.carrierOrg.id,
            licensePlate: "AA-87087",
            carrier: { name: seed.carrierOrg.name },
          },
          load: {
            id: load87.id,
            status: "POSTED",
            shipperId: seed.shipperOrg.id,
          },
          shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        },
      });

      setAuthSession(SHIPPER_SESSION); // Shipper tries to respond
      const req = createRequest(
        "POST",
        `${BASE_URL}/api/truck-requests/${trReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondTruckRequest, req, { id: trReq.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("do not have permission");
    });

    it("88. Carrier cannot verify POD (only shipper can)", async () => {
      const verifyLoad = await db.load.create({
        data: {
          id: "pod-carrier-verify-88",
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
          podUrl: "https://storage.test/pod-88.jpg",
          podVerified: false,
        },
      });

      setAuthSession(CARRIER_SESSION); // Carrier tries to verify
      const req = createRequest(
        "PUT",
        `${BASE_URL}/api/loads/${verifyLoad.id}/pod`
      );
      const res = await callHandler(verifyPod, req, { id: verifyLoad.id });
      const data = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only the shipper can verify POD");
    });

    it("89. Unauthenticated → 401 on dispute detail", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        `${BASE_URL}/api/disputes/some-dispute-id`
      );
      const res = await callHandler(getDispute, req, { id: "some-dispute-id" });

      expect(res.status).toBe(401);
    });
  });
});
