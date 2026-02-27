/**
 * Admin Settlements API Tests
 *
 * Tests for /api/admin/settlements, /api/admin/settlements/[id]/approve,
 * /api/admin/settlement-automation
 */

import { db } from "@/lib/db";
import {
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
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
  mockStorage,
  mockLogger,
} from "../../utils/routeTestUtils";
import {
  useAdminSession,
  useShipperSession,
  useCarrierSession,
  useDispatcherSession,
  seedAdminTestData,
  AdminSeedData,
} from "./helpers";

// ─── Setup Mocks ──────────────────────────────────────────────────────────────
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
mockStorage();
mockLogger();

jest.mock("@/lib/rbac", () => {
  const actual = jest.requireActual("@/lib/rbac/permissions");
  return {
    requirePermission: jest.fn(async (permission: string) => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) {
        const error = new Error("Unauthorized");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      if (!actual.hasPermission(session.role, permission)) {
        const error = new Error("Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    Permission: actual.Permission,
    hasPermission: actual.hasPermission,
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
  };
});

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const status = error.name === "ForbiddenError" ? 403 : 500;
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

// Mock settlement automation
const mockRunSettlementAutomation = jest.fn();
const mockGetSettlementStats = jest.fn();
const mockAutoVerifyExpiredPODs = jest.fn();
const mockProcessReadySettlements = jest.fn();

jest.mock("@/lib/settlementAutomation", () => ({
  runSettlementAutomation: (...args: any[]) =>
    mockRunSettlementAutomation(...args),
  getSettlementStats: (...args: any[]) => mockGetSettlementStats(...args),
  autoVerifyExpiredPODs: (...args: any[]) => mockAutoVerifyExpiredPODs(...args),
  processReadySettlements: (...args: any[]) =>
    mockProcessReadySettlements(...args),
}));

// Import route handlers AFTER mocks
const { GET: listSettlements } = require("@/app/api/admin/settlements/route");
const {
  POST: approveSettlement,
} = require("@/app/api/admin/settlements/[id]/approve/route");
const {
  GET: getAutomationStats,
  POST: triggerAutomation,
} = require("@/app/api/admin/settlement-automation/route");

describe("Admin Settlements API", () => {
  let seed: AdminSeedData;

  beforeAll(async () => {
    seed = await seedAdminTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
    mockRunSettlementAutomation.mockReset();
    mockGetSettlementStats.mockReset();
    mockAutoVerifyExpiredPODs.mockReset();
    mockProcessReadySettlements.mockReset();
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET settlements returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements"
      );
      const res = await listSettlements(req);
      expect(res.status).toBe(403);
    });

    it("GET settlements returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements"
      );
      const res = await listSettlements(req);
      expect(res.status).toBe(403);
    });

    it("POST approve returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlements/load-1/approve"
      );
      const res = await callHandler(approveSettlement, req, { id: "load-1" });
      expect(res.status).toBe(403);
    });

    it("GET automation returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlement-automation"
      );
      const res = await getAutomationStats(req);
      expect(res.status).toBe(403);
    });

    it("POST automation returns 403 for non-admin", async () => {
      useShipperSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlement-automation"
      );
      const res = await triggerAutomation(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/settlements ─────────────────────────────────────────────

  describe("GET /api/admin/settlements", () => {
    it("returns loads for settlement review", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements"
      );
      const res = await listSettlements(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.loads).toBeDefined();
      expect(body.totalCount).toBeDefined();
      expect(body.hasMore).toBeDefined();
    });

    it("default status=PENDING filters correctly", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements"
      );
      const res = await listSettlements(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      // PENDING settlements require DELIVERED + podVerified + settlementStatus=PENDING
      for (const load of body.loads) {
        expect(load.status).toBe("DELIVERED");
        expect(load.podVerified).toBe(true);
        expect(load.settlementStatus).toBe("PENDING");
      }
    });

    it("filter by status=all returns multiple statuses", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements?status=all"
      );
      const res = await listSettlements(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.loads).toBeDefined();
    });

    it("pagination works (limit and offset)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements?limit=1&offset=0"
      );
      const res = await listSettlements(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
    });

    it("includes shipper and carrier details", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlements"
      );
      const res = await listSettlements(req);
      const body = await parseResponse(res);
      if (body.loads.length > 0) {
        expect(body.loads[0].shipper).toBeDefined();
      }
    });
  });

  // ─── POST /api/admin/settlements/[id]/approve ──────────────────────────────

  describe("POST /api/admin/settlements/[id]/approve", () => {
    it("approve settlement for DELIVERED load with verified POD", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/settlements/${seed.deliveredLoad.id}/approve`
      );
      const res = await callHandler(approveSettlement, req, {
        id: seed.deliveredLoad.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.settlement.status).toBe("PAID");
      expect(body.settlement.settledAt).toBeDefined();
    });

    it("404 for non-existent load", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlements/non-existent/approve"
      );
      const res = await callHandler(approveSettlement, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });

    it("load not DELIVERED returns 400", async () => {
      useAdminSession();
      // The base load is POSTED, not DELIVERED
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/settlements/${seed.load.id}/approve`
      );
      const res = await callHandler(approveSettlement, req, {
        id: seed.load.id,
      });
      expect(res.status).toBe(400);
    });

    it("already PAID returns 400", async () => {
      useAdminSession();
      // The delivered load was just approved above, so it's now PAID
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/settlements/${seed.deliveredLoad.id}/approve`
      );
      const res = await callHandler(approveSettlement, req, {
        id: seed.deliveredLoad.id,
      });
      expect(res.status).toBe(400);
    });

    it("POD not verified returns 400", async () => {
      useAdminSession();
      // Create a delivered load without POD verification
      await db.load.create({
        data: {
          id: "unverified-pod-load",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podVerified: false,
          settlementStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlements/unverified-pod-load/approve"
      );
      const res = await callHandler(approveSettlement, req, {
        id: "unverified-pod-load",
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Settlement Automation ──────────────────────────────────────────────────

  describe("Settlement Automation", () => {
    it("GET returns current settlement stats", async () => {
      useAdminSession();
      mockGetSettlementStats.mockResolvedValue({
        pendingSettlements: 5,
        paidSettlements: 10,
        totalValue: 50000,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settlement-automation"
      );
      const res = await getAutomationStats(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.stats).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it("POST action=auto-verify triggers auto-verification", async () => {
      useAdminSession();
      mockAutoVerifyExpiredPODs.mockResolvedValue(3);
      mockGetSettlementStats.mockResolvedValue({ pendingSettlements: 2 });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlement-automation?action=auto-verify"
      );
      const res = await triggerAutomation(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.result.action).toBe("auto-verify");
      expect(body.result.autoVerifiedCount).toBe(3);
    });

    it("POST action=process-settlements processes settlements", async () => {
      useAdminSession();
      mockProcessReadySettlements.mockResolvedValue(5);
      mockGetSettlementStats.mockResolvedValue({ pendingSettlements: 0 });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlement-automation?action=process-settlements"
      );
      const res = await triggerAutomation(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.result.action).toBe("process-settlements");
      expect(body.result.settledCount).toBe(5);
    });

    it("POST action=full runs full workflow", async () => {
      useAdminSession();
      mockRunSettlementAutomation.mockResolvedValue({
        autoVerifiedCount: 2,
        settledCount: 4,
      });
      mockGetSettlementStats.mockResolvedValue({ pendingSettlements: 1 });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlement-automation?action=full"
      );
      const res = await triggerAutomation(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.result.action).toBe("full");
    });

    it("default action is full", async () => {
      useAdminSession();
      mockRunSettlementAutomation.mockResolvedValue({
        autoVerifiedCount: 0,
        settledCount: 0,
      });
      mockGetSettlementStats.mockResolvedValue({});

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/settlement-automation"
      );
      const res = await triggerAutomation(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.result.action).toBe("full");
    });
  });
});
