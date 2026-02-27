/**
 * Admin Withdrawals API Tests
 *
 * Tests for /api/admin/withdrawals, /api/admin/withdrawals/[id]
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
  useSuperAdminSession,
  useShipperSession,
  useCarrierSession,
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

// Import route handlers AFTER mocks
const { GET: listWithdrawals } = require("@/app/api/admin/withdrawals/route");
const {
  PATCH: updateWithdrawal,
} = require("@/app/api/admin/withdrawals/[id]/route");

describe("Admin Withdrawals API", () => {
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
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      expect(res.status).toBe(500);
    });

    it("GET returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 200 for ADMIN", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      expect(res.status).toBe(200);
    });

    it("PATCH returns 403 for non-admin", async () => {
      useShipperSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-pending-1",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-pending-1",
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/withdrawals ─────────────────────────────────────────────

  describe("GET /api/admin/withdrawals", () => {
    it("returns paginated withdrawals", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.withdrawals).toBeDefined();
      expect(Array.isArray(body.withdrawals)).toBe(true);
      expect(body.pagination).toBeDefined();
    });

    it("filter by status=PENDING", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals?status=PENDING"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const w of body.withdrawals) {
        expect(w.status).toBe("PENDING");
      }
    });

    it("filter by status=APPROVED", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals?status=APPROVED"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const w of body.withdrawals) {
        expect(w.status).toBe("APPROVED");
      }
    });

    it("filter by status=REJECTED", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals?status=REJECTED"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const w of body.withdrawals) {
        expect(w.status).toBe("REJECTED");
      }
    });

    it("no filter returns all statuses", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(body.withdrawals.length).toBeGreaterThanOrEqual(3);
    });

    it("pagination metadata correct", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals?page=1&limit=2"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });

    it("default page=1, limit=20", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(20);
    });

    it("max limit=100 enforced", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals?limit=999"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      expect(body.pagination.limit).toBe(100);
    });

    it("includes bank account details", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      const w = body.withdrawals.find(
        (w: any) => w.id === "withdrawal-pending-1"
      );
      expect(w.bankName).toBe("CBE");
      expect(w.accountNumber).toBe("1234567890");
    });

    it("includes rejection reason for rejected", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/withdrawals?status=REJECTED"
      );
      const res = await listWithdrawals(req);
      const body = await parseResponse(res);
      if (body.withdrawals.length > 0) {
        expect(body.withdrawals[0].rejectionReason).toBeDefined();
      }
    });
  });

  // ─── PATCH /api/admin/withdrawals/[id] ──────────────────────────────────────

  describe("PATCH /api/admin/withdrawals/[id]", () => {
    it("approve PENDING withdrawal", async () => {
      useAdminSession();
      // Create a fresh pending withdrawal
      await db.withdrawalRequest.create({
        data: {
          id: "withdrawal-test-1",
          organizationId: seed.shipperOrg.id,
          userId: seed.shipperUser.id,
          amount: 1000,
          status: "PENDING",
          bankName: "CBE",
          accountNumber: "111222333",
          accountHolderName: "Test",
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-test-1",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-test-1",
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.withdrawalRequest.status).toBe("APPROVED");
      expect(body.withdrawalRequest.approvedAt).toBeDefined();
      expect(body.withdrawalRequest.approvedById).toBeDefined();
    });

    it("reject PENDING withdrawal with reason", async () => {
      useAdminSession();
      await db.withdrawalRequest.create({
        data: {
          id: "withdrawal-test-2",
          organizationId: seed.shipperOrg.id,
          userId: seed.shipperUser.id,
          amount: 2000,
          status: "PENDING",
          bankName: "CBE",
          accountNumber: "444555666",
          accountHolderName: "Test",
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-test-2",
        {
          body: {
            action: "REJECTED",
            rejectionReason: "Insufficient documentation",
          },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-test-2",
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.withdrawalRequest.status).toBe("REJECTED");
      expect(body.withdrawalRequest.rejectionReason).toBe(
        "Insufficient documentation"
      );
    });

    it("cannot approve already APPROVED withdrawal", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-approved-1",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-approved-1",
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("APPROVED");
    });

    it("cannot approve REJECTED withdrawal", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-rejected-1",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-rejected-1",
      });
      expect(res.status).toBe(400);
    });

    it("404 for non-existent withdrawal", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/non-existent",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });

    it("Zod: invalid action enum returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-pending-1",
        {
          body: { action: "INVALID" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-pending-1",
      });
      expect(res.status).toBe(400);
    });

    it("Zod: missing action returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-pending-1",
        { body: {} }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-pending-1",
      });
      expect(res.status).toBe(400);
    });

    it("sets completedAt on approval", async () => {
      useAdminSession();
      await db.withdrawalRequest.create({
        data: {
          id: "withdrawal-test-3",
          organizationId: seed.carrierOrg.id,
          userId: seed.carrierUser.id,
          amount: 3000,
          status: "PENDING",
          bankName: "Dashen",
          accountNumber: "777888999",
          accountHolderName: "Test Carrier",
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-test-3",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-test-3",
      });
      const body = await parseResponse(res);
      expect(body.withdrawalRequest.completedAt).toBeDefined();
    });

    it("SuperAdmin can approve withdrawals", async () => {
      useSuperAdminSession();
      await db.withdrawalRequest.create({
        data: {
          id: "withdrawal-test-4",
          organizationId: seed.shipperOrg.id,
          userId: seed.shipperUser.id,
          amount: 500,
          status: "PENDING",
          bankName: "CBE",
          accountNumber: "000111222",
          accountHolderName: "Test",
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/withdrawals/withdrawal-test-4",
        {
          body: { action: "APPROVED" },
        }
      );
      const res = await callHandler(updateWithdrawal, req, {
        id: "withdrawal-test-4",
      });
      expect(res.status).toBe(200);
    });
  });
});
