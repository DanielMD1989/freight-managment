/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Admin Users API Tests
 *
 * Tests for /api/admin/users, /api/admin/users/[id],
 * /api/admin/users/[id]/verify, /api/admin/users/[id]/wallet,
 * /api/admin/users/[id]/wallet/topup
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
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockStorage();
mockLogger();

// Mock RBAC with real permission checking
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
    requireRole: jest.fn(async (allowedRoles: string[]) => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) {
        const error = new Error("Unauthorized");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      if (!allowedRoles.includes(session.role)) {
        const error = new Error("Forbidden: Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    Permission: actual.Permission,
    hasPermission: actual.hasPermission,
    hasAnyPermission: actual.hasAnyPermission,
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
    UnauthorizedError: class UnauthorizedError extends Error {
      constructor(msg = "Unauthorized") {
        super(msg);
        this.name = "UnauthorizedError";
      }
    },
  };
});

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    // Handle ZodError
    if (error.name === "ZodError" || error.issues) {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { error: "Validation error", details: error.flatten?.() },
        { status: 400 }
      );
    }
    const status =
      error.name === "ForbiddenError"
        ? 403
        : error.name === "UnauthorizedError"
          ? 401
          : 500;
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyUserVerification: jest.fn(async () => {}),
  notifyTruckRequest: jest.fn(async () => {}),
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => {}),
  createEmailHTML: jest.fn((content: string) => `<html>${content}</html>`),
}));

jest.mock("@/lib/types/admin", () => ({
  MAX_WALLET_TOPUP_AMOUNT: 1000000,
  ADMIN_FINANCIAL_OPS_RPS: 5,
  ADMIN_FINANCIAL_OPS_BURST: 10,
}));

// Import route handlers AFTER mocks
const {
  GET: listUsers,
  PATCH: updateUserRole,
} = require("@/app/api/admin/users/route");
const {
  GET: getUser,
  PATCH: updateUser,
  DELETE: deleteUser,
} = require("@/app/api/admin/users/[id]/route");
const { POST: verifyUser } = require("@/app/api/admin/users/[id]/verify/route");
const {
  GET: getUserWallet,
} = require("@/app/api/admin/users/[id]/wallet/route");
const {
  POST: topUpWallet,
} = require("@/app/api/admin/users/[id]/wallet/topup/route");

describe("Admin Users API", () => {
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

  // ─── Authorization ──────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET /api/admin/users returns 403 for unauthenticated", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/users returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/users returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/users returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(403);
    });

    it("PATCH /api/admin/users (role update) returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { userId: "carrier-user-1", role: "DISPATCHER" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(403);
    });

    it("PATCH /api/admin/users (role update) returns 403 for ADMIN (ASSIGN_ROLES is SuperAdmin-only)", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { userId: "carrier-user-1", role: "DISPATCHER" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/users returns 200 for ADMIN", async () => {
      useAdminSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(200);
    });

    it("GET /api/admin/users returns 200 for SUPER_ADMIN", async () => {
      useSuperAdminSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/admin/users — List ────────────────────────────────────────────

  describe("GET /api/admin/users — List", () => {
    it("returns paginated users with default page=1, limit=20", async () => {
      useAdminSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
    });

    it("pagination metadata is correct", async () => {
      useAdminSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      const data = await parseResponse(res);
      expect(data.pagination.total).toBeGreaterThan(0);
      expect(data.pagination.pages).toBe(
        Math.ceil(data.pagination.total / data.pagination.limit)
      );
    });

    it("filters by role=SHIPPER", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?role=SHIPPER"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      for (const user of data.users) {
        expect(user.role).toBe("SHIPPER");
      }
    });

    it("filters by role=CARRIER", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?role=CARRIER"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      for (const user of data.users) {
        expect(user.role).toBe("CARRIER");
      }
    });

    it("invalid role filter is ignored (no crash)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?role=INVALID"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
    });

    it("searches by email (case-insensitive)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?search=shipper"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.users.length).toBeGreaterThan(0);
    });

    it("searches by firstName", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?search=Test"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.users.length).toBeGreaterThan(0);
    });

    it("empty result set returns empty array with pagination", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?search=nonexistent12345xyz"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.users).toEqual([]);
      expect(data.pagination).toBeDefined();
    });

    it("page beyond total returns empty users array", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users?page=999"
      );
      const res = await listUsers(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.users).toEqual([]);
    });

    it("users include organization relationship", async () => {
      useAdminSession();
      const req = createRequest("GET", "http://localhost:3000/api/admin/users");
      const res = await listUsers(req);
      const data = await parseResponse(res);
      const userWithOrg = data.users.find((u: any) => u.organizationId);
      if (userWithOrg) {
        expect(userWithOrg.organization).toBeDefined();
      }
    });
  });

  // ─── PATCH /api/admin/users — Update Role ───────────────────────────────────

  describe("PATCH /api/admin/users — Update Role", () => {
    it("successfully updates user role from CARRIER to DISPATCHER", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { userId: seed.carrierUser.id, role: "DISPATCHER" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.role).toBe("DISPATCHER");

      // Restore
      await db.user.update({
        where: { id: seed.carrierUser.id },
        data: { role: "CARRIER" },
      });
    });

    it("returns updated user with new role", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { userId: seed.shipperUser.id, role: "SHIPPER" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(seed.shipperUser.id);
    });

    it("Zod validation: missing userId returns 400", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { role: "DISPATCHER" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(400);
    });

    it("Zod validation: invalid role enum returns 400", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { userId: seed.carrierUser.id, role: "INVALID_ROLE" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(400);
    });

    it("only SUPER_ADMIN can assign roles (ADMIN gets 403)", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users",
        {
          body: { userId: seed.carrierUser.id, role: "DISPATCHER" },
        }
      );
      const res = await updateUserRole(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/users/[id] — User Detail ───────────────────────────────

  describe("GET /api/admin/users/[id] — User Detail", () => {
    it("returns user with full profile fields", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}`
      );
      const res = await callHandler(getUser, req, { id: seed.shipperUser.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(seed.shipperUser.id);
      expect(data.user.email).toBeDefined();
      expect(data.user.role).toBe("SHIPPER");
    });

    it("includes organization details", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}`
      );
      const res = await callHandler(getUser, req, { id: seed.shipperUser.id });
      const data = await parseResponse(res);
      expect(data.user.organization).toBeDefined();
    });

    it("returns 404 for non-existent user", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users/non-existent-user"
      );
      const res = await callHandler(getUser, req, { id: "non-existent-user" });
      expect(res.status).toBe(404);
    });

    it("admin cannot view ADMIN users (403)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.adminUser.id}`
      );
      const res = await callHandler(getUser, req, { id: seed.adminUser.id });
      expect(res.status).toBe(403);
    });

    it("admin cannot view SUPER_ADMIN users (403)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.superAdminUser.id}`
      );
      const res = await callHandler(getUser, req, {
        id: seed.superAdminUser.id,
      });
      expect(res.status).toBe(403);
    });

    it("SuperAdmin can view any user", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.adminUser.id}`
      );
      const res = await callHandler(getUser, req, { id: seed.adminUser.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── PATCH /api/admin/users/[id] — Update User ─────────────────────────────

  describe("PATCH /api/admin/users/[id] — Update User", () => {
    it("updates phone number successfully", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}`,
        { body: { phone: "+251922000001" } }
      );
      const res = await callHandler(updateUser, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.phone).toBe("+251922000001");
    });

    it("updates user status (ACTIVE → SUSPENDED)", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.carrierUser.id}`,
        { body: { status: "SUSPENDED" } }
      );
      const res = await callHandler(updateUser, req, {
        id: seed.carrierUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.status).toBe("SUSPENDED");

      // Restore
      await db.user.update({
        where: { id: seed.carrierUser.id },
        data: { status: "ACTIVE" },
      });
    });

    it("Zod: phone too short returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}`,
        { body: { phone: "123" } }
      );
      const res = await callHandler(updateUser, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("Zod: invalid status enum returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}`,
        { body: { status: "INVALID_STATUS" } }
      );
      const res = await callHandler(updateUser, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("cannot change own phone (self-modification prevention)", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.adminUser.id}`,
        { body: { phone: "+251933000001" } }
      );
      const res = await callHandler(updateUser, req, { id: seed.adminUser.id });
      expect(res.status).toBe(403);
    });

    it("admin can only modify CARRIER/SHIPPER/DISPATCHER (not ADMIN)", async () => {
      useAdminSession();
      // Create a second admin to try to modify
      await db.user.create({
        data: {
          id: "admin-user-2",
          email: "admin2@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Admin",
          lastName: "Two",
          phone: "+251911099099",
          role: "ADMIN",
          status: "ACTIVE",
          organizationId: seed.adminOrg.id,
        },
      });
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users/admin-user-2",
        { body: { status: "SUSPENDED" } }
      );
      const res = await callHandler(updateUser, req, { id: "admin-user-2" });
      expect(res.status).toBe(403);
    });

    it("SuperAdmin can modify anyone", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.carrierUser.id}`,
        { body: { status: "ACTIVE" } }
      );
      const res = await callHandler(updateUser, req, {
        id: seed.carrierUser.id,
      });
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent user", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/users/non-existent",
        { body: { phone: "+251922999999" } }
      );
      const res = await callHandler(updateUser, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("returns change descriptions in response", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}`,
        { body: { status: "ACTIVE" } }
      );
      const res = await callHandler(updateUser, req, {
        id: seed.shipperUser.id,
      });
      const data = await parseResponse(res);
      expect(data.changes).toBeDefined();
      expect(Array.isArray(data.changes)).toBe(true);
    });
  });

  // ─── DELETE /api/admin/users/[id] ───────────────────────────────────────────

  describe("DELETE /api/admin/users/[id] — Soft Delete", () => {
    let deletableUserId: string;

    beforeAll(async () => {
      await db.user.create({
        data: {
          id: "deletable-carrier-1",
          email: "deletable@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Deletable",
          lastName: "Carrier",
          phone: "+251911088088",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: seed.carrierOrg.id,
        },
      });
      deletableUserId = "deletable-carrier-1";
    });

    it("soft deletes user (isActive=false, status=SUSPENDED)", async () => {
      useAdminSession();
      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/users/${deletableUserId}`
      );
      const res = await callHandler(deleteUser, req, { id: deletableUserId });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.status).toBe("SUSPENDED");
    });

    it("cannot delete yourself", async () => {
      useAdminSession();
      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/users/${seed.adminUser.id}`
      );
      const res = await callHandler(deleteUser, req, { id: seed.adminUser.id });
      expect(res.status).toBe(403);
    });

    it("admin cannot delete ADMIN user", async () => {
      useAdminSession();
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/admin/users/admin-user-2"
      );
      const res = await callHandler(deleteUser, req, { id: "admin-user-2" });
      expect(res.status).toBe(403);
    });

    it("SuperAdmin can delete ADMIN users", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/admin/users/admin-user-2"
      );
      const res = await callHandler(deleteUser, req, { id: "admin-user-2" });
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent user", async () => {
      useAdminSession();
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/admin/users/non-existent"
      );
      const res = await callHandler(deleteUser, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/admin/users/[id]/verify ──────────────────────────────────────

  describe("POST /api/admin/users/[id]/verify — Status Update", () => {
    it("sets user to ACTIVE status", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/verify`,
        { body: { status: "ACTIVE" } }
      );
      const res = await callHandler(verifyUser, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.status).toBe("ACTIVE");
    });

    it("sets user to SUSPENDED with reason", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.carrierUser.id}/verify`,
        { body: { status: "SUSPENDED", reason: "Violation of terms" } }
      );
      const res = await callHandler(verifyUser, req, {
        id: seed.carrierUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.status).toBe("SUSPENDED");

      // Restore
      await db.user.update({
        where: { id: seed.carrierUser.id },
        data: { status: "ACTIVE" },
      });
    });

    it("sets user to REJECTED with reason", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.dispatcherUser.id}/verify`,
        { body: { status: "REJECTED", reason: "Invalid documents" } }
      );
      const res = await callHandler(verifyUser, req, {
        id: seed.dispatcherUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.status).toBe("REJECTED");

      // Restore
      await db.user.update({
        where: { id: seed.dispatcherUser.id },
        data: { status: "ACTIVE" },
      });
    });

    it("missing status returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/verify`,
        { body: {} }
      );
      const res = await callHandler(verifyUser, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("invalid status returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/verify`,
        { body: { status: "INVALID" } }
      );
      const res = await callHandler(verifyUser, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent user", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/users/non-existent/verify",
        { body: { status: "ACTIVE" } }
      );
      const res = await callHandler(verifyUser, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("returns updated user", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/verify`,
        { body: { status: "ACTIVE" } }
      );
      const res = await callHandler(verifyUser, req, {
        id: seed.shipperUser.id,
      });
      const data = await parseResponse(res);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(seed.shipperUser.id);
    });
  });

  // ─── GET /api/admin/users/[id]/wallet ───────────────────────────────────────

  describe("GET /api/admin/users/[id]/wallet", () => {
    it("returns wallet balance and recent transactions", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet`
      );
      const res = await callHandler(getUserWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet).toBeDefined();
      expect(data.wallet.balance).toBeDefined();
      expect(data.transactions).toBeDefined();
    });

    it("user without organization returns 400", async () => {
      useAdminSession();
      // Create a user without org
      await db.user.create({
        data: {
          id: "no-org-user-1",
          email: "noorg@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "No",
          lastName: "Org",
          phone: "+251911077077",
          role: "SHIPPER",
          status: "ACTIVE",
        },
      });
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users/no-org-user-1/wallet"
      );
      const res = await callHandler(getUserWallet, req, {
        id: "no-org-user-1",
      });
      expect(res.status).toBe(400);
    });

    it("non-existent user returns 404", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/users/non-existent/wallet"
      );
      const res = await callHandler(getUserWallet, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("non-admin returns 403", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet`
      );
      const res = await callHandler(getUserWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/admin/users/[id]/wallet/topup ───────────────────────────────

  describe("POST /api/admin/users/[id]/wallet/topup", () => {
    it("successfully tops up wallet", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: 1000 } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.success).toBe(true);
      expect(data.newBalance).toBeDefined();
      expect(data.transactionId).toBeDefined();
    });

    it("returns new balance and transaction ID", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: 500, reference: "REF-001", notes: "Test topup" } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      const data = await parseResponse(res);
      expect(data.success).toBe(true);
      expect(typeof data.newBalance).toBe("number");
      expect(data.transactionId).toBeDefined();
    });

    it("Zod: negative amount returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: -100 } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("Zod: zero amount returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: 0 } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("Zod: amount > 1,000,000 ETB returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: 1000001 } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(400);
    });

    it("rate limiting enforced (returns 429)", async () => {
      useAdminSession();
      // Mock rate limit to reject
      const { checkRpsLimit } = require("@/lib/rateLimit");
      (checkRpsLimit as jest.Mock).mockResolvedValueOnce({ allowed: false });
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: 100 } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(429);
    });

    it("user without organization returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/users/no-org-user-1/wallet/topup",
        { body: { amount: 100 } }
      );
      const res = await callHandler(topUpWallet, req, { id: "no-org-user-1" });
      expect(res.status).toBe(400);
    });

    it("non-existent user returns 404", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/users/non-existent/wallet/topup",
        { body: { amount: 100 } }
      );
      const res = await callHandler(topUpWallet, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("non-admin returns 403", async () => {
      useShipperSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/users/${seed.shipperUser.id}/wallet/topup`,
        { body: { amount: 100 } }
      );
      const res = await callHandler(topUpWallet, req, {
        id: seed.shipperUser.id,
      });
      expect(res.status).toBe(403);
    });
  });
});
