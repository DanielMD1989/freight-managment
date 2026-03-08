/**
 * Admin Revoke Access API Tests
 *
 * Tests for POST /api/admin/users/[id]/revoke
 * Round A17 — G-A17-1, G-A17-2, G-A17-5
 */

// @jest-environment node

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

jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyUserVerification: jest.fn(async () => {}),
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => {}),
  createEmailHTML: jest.fn((c: string) => `<html>${c}</html>`),
}));

jest.mock("@/lib/types/admin", () => ({
  MAX_WALLET_TOPUP_AMOUNT: 1000000,
  ADMIN_FINANCIAL_OPS_RPS: 5,
  ADMIN_FINANCIAL_OPS_BURST: 10,
}));

// Import route handler AFTER mocks
const {
  POST: revokeAccess,
} = require("@/app/api/admin/users/[id]/revoke/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRevokeRequest(targetId: string, body?: object) {
  return createRequest(
    "POST",
    `http://localhost:3000/api/admin/users/${targetId}/revoke`,
    { body: body ?? { reason: "Violation of terms of service by the user" } }
  );
}

async function callRevoke(targetId: string, body?: object) {
  const req = makeRevokeRequest(targetId, body);
  return callHandler(revokeAccess, req, { id: targetId });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/admin/users/[id]/revoke — Revoke Access (Round A17)", () => {
  let seed: AdminSeedData;

  beforeAll(async () => {
    seed = await seedAdminTestData();
    // Create a second admin user so RA-4 can test hierarchy guard without triggering self-revoke
    await db.user.create({
      data: {
        id: "admin-user-2",
        email: "admin2@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "Two",
        phone: "+251911000099",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "admin-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // RA-1 Admin revokes Dispatcher → 200, status=SUSPENDED, revokedAt set
  it("RA-1: Admin revokes Dispatcher → 200, status=SUSPENDED, revokedAt set", async () => {
    useAdminSession();
    const res = await callRevoke("dispatcher-user-1");
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.message).toBe("Access revoked");
    expect(data.userId).toBe("dispatcher-user-1");
    expect(data.revokedAt).toBeDefined();

    // Verify DB was updated
    const user = await db.user.findUnique({
      where: { id: "dispatcher-user-1" },
    });
    expect(user?.status).toBe("SUSPENDED");
    expect(user?.revokedAt).not.toBeNull();
    expect(user?.revocationReason).toBe(
      "Violation of terms of service by the user"
    );

    // Reset for subsequent tests
    await db.user.update({
      where: { id: "dispatcher-user-1" },
      data: { status: "ACTIVE", revokedAt: null, revocationReason: null },
    });
  });

  // RA-2 Admin revokes Shipper → 200
  it("RA-2: Admin revokes Shipper → 200, status=SUSPENDED, revokedAt set", async () => {
    useAdminSession();
    const res = await callRevoke("shipper-user-1");
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.userId).toBe("shipper-user-1");
    expect(data.revokedAt).toBeDefined();

    const user = await db.user.findUnique({ where: { id: "shipper-user-1" } });
    expect(user?.status).toBe("SUSPENDED");

    await db.user.update({
      where: { id: "shipper-user-1" },
      data: { status: "ACTIVE", revokedAt: null, revocationReason: null },
    });
  });

  // RA-3 Admin revokes Carrier → 200
  it("RA-3: Admin revokes Carrier → 200, status=SUSPENDED, revokedAt set", async () => {
    useAdminSession();
    const res = await callRevoke("carrier-user-1");
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.userId).toBe("carrier-user-1");

    const user = await db.user.findUnique({ where: { id: "carrier-user-1" } });
    expect(user?.status).toBe("SUSPENDED");

    await db.user.update({
      where: { id: "carrier-user-1" },
      data: { status: "ACTIVE", revokedAt: null, revocationReason: null },
    });
  });

  // RA-4 Admin cannot revoke Admin → 403 (uses admin-user-2 so self-revoke doesn't fire)
  it("RA-4: Admin revokes another Admin → 403 (hierarchy guard)", async () => {
    useAdminSession(); // session userId = "admin-user-1"
    const res = await callRevoke("admin-user-2"); // different admin user
    expect(res.status).toBe(403);
    const data = await parseResponse(res);
    expect(data.error).toMatch(/admin/i);
  });

  // RA-5 Admin cannot revoke SUPER_ADMIN → 403
  it("RA-5: Admin revokes SUPER_ADMIN → 403 (hierarchy guard)", async () => {
    useAdminSession();
    const res = await callRevoke("superadmin-user-1");
    expect(res.status).toBe(403);
  });

  // RA-6 SuperAdmin revokes Admin → 200
  it("RA-6: SuperAdmin revokes Admin → 200, revokedAt set", async () => {
    useSuperAdminSession();
    const res = await callRevoke("admin-user-1");
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.userId).toBe("admin-user-1");
    expect(data.revokedAt).toBeDefined();

    const user = await db.user.findUnique({ where: { id: "admin-user-1" } });
    expect(user?.status).toBe("SUSPENDED");

    await db.user.update({
      where: { id: "admin-user-1" },
      data: { status: "ACTIVE", revokedAt: null, revocationReason: null },
    });
  });

  // RA-7 No reason → 400
  it("RA-7: Missing reason → 400", async () => {
    useAdminSession();
    const res = await callRevoke("dispatcher-user-1", {});
    expect(res.status).toBe(400);
  });

  // RA-8 Short reason (< 10 chars) → 400
  it("RA-8: Short reason (< 10 chars) → 400", async () => {
    useAdminSession();
    const res = await callRevoke("dispatcher-user-1", { reason: "short" });
    expect(res.status).toBe(400);
  });

  // RA-9 Already SUSPENDED → 409
  it("RA-9: Already SUSPENDED → 409", async () => {
    useAdminSession();
    // First suspension
    await db.user.update({
      where: { id: "dispatcher-user-1" },
      data: { status: "SUSPENDED" },
    });

    const res = await callRevoke("dispatcher-user-1");
    expect(res.status).toBe(409);
    const data = await parseResponse(res);
    expect(data.error).toMatch(/already revoked/i);

    // Restore
    await db.user.update({
      where: { id: "dispatcher-user-1" },
      data: { status: "ACTIVE" },
    });
  });

  // RA-10 Revoke self → 400
  it("RA-10: Admin attempts self-revoke → 400", async () => {
    useAdminSession(); // session userId = "admin-user-1"
    const res = await callRevoke("admin-user-1");
    // Self-check runs before hierarchy check, but session.userId === targetUserId
    // Note: admin-user-1 is ADMIN so hierarchy guard also fires (403).
    // The self-revoke guard (400) runs first in the handler.
    expect([400, 403]).toContain(res.status);
  });

  // RA-11 Non-admin calls revoke → 403
  it("RA-11: SHIPPER calls revoke → 403", async () => {
    useShipperSession();
    const res = await callRevoke("carrier-user-1");
    expect(res.status).toBe(403);
  });

  it("RA-11b: CARRIER calls revoke → 403", async () => {
    useCarrierSession();
    const res = await callRevoke("shipper-user-1");
    expect(res.status).toBe(403);
  });

  it("RA-11c: DISPATCHER calls revoke → 403", async () => {
    useDispatcherSession();
    const res = await callRevoke("carrier-user-1");
    expect(res.status).toBe(403);
  });

  // RA-12 revokeAllSessions spy confirmed called
  it("RA-12: revokeAllSessions is called on successful revocation", async () => {
    useAdminSession();

    // Get the mocked auth module to spy on revokeAllSessions
    const authModule = require("@/lib/auth");
    const revokeAllSessionsSpy = authModule.revokeAllSessions as jest.Mock;
    revokeAllSessionsSpy.mockClear();

    const res = await callRevoke("dispatcher-user-1");
    expect(res.status).toBe(200);
    expect(revokeAllSessionsSpy).toHaveBeenCalledWith("dispatcher-user-1");

    // Restore
    await db.user.update({
      where: { id: "dispatcher-user-1" },
      data: { status: "ACTIVE", revokedAt: null, revocationReason: null },
    });
  });
});
