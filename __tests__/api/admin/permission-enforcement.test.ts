/**
 * Admin Permission Enforcement Tests
 *
 * Verifies that all fixed admin routes use requirePermission() correctly.
 * Each route was previously using requireAuth() + manual role check which
 * skips the ACTIVE status check. Now all use requirePermission() which
 * calls requireActiveUser() internally.
 *
 * PE-1: GET /admin/organizations — VIEW_ORGANIZATIONS
 * PE-2: GET /admin/service-fees/metrics — VIEW_SERVICE_FEE_REPORTS
 * PE-3: GET /admin/withdrawals — APPROVE_WITHDRAWALS
 * PE-4: GET /admin/corridors — CONFIGURE_SERVICE_FEES
 * PE-5: POST /admin/corridors — CONFIGURE_SERVICE_FEES
 * PE-6: PATCH /admin/organizations/[id]/rates — CONFIGURE_SERVICE_FEES
 * PE-7: GET /admin/revenue/by-organization — VIEW_SERVICE_FEE_REPORTS
 * PE-8: GET /admin/users/[id]/wallet — MANAGE_WALLET
 * PE-9: Suspended ADMIN → 403 on any permission-gated route
 */

import {
  setAuthSession,
  createRequest,
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
  createMockSession,
} from "../../utils/routeTestUtils";
import { useAdminSession, useCarrierSession } from "./helpers";

// ─── Standard mocks ───────────────────────────────────────────────────────────
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

// ─── RBAC mock — uses real hasPermission + status check ───────────────────────
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
      // Mirrors requireActiveUser() — suspended users are blocked
      if (session.status !== "ACTIVE") {
        const error = new Error("Forbidden: Account not active");
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

// ─── handleApiError mock — maps ForbiddenError → 403 ─────────────────────────
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const status = error.name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

// ─── Import route handlers AFTER mocks ───────────────────────────────────────
const {
  GET: getOrganizations,
} = require("@/app/api/admin/organizations/route");
const {
  GET: getServiceFeeMetrics,
} = require("@/app/api/admin/service-fees/metrics/route");
const { GET: getWithdrawals } = require("@/app/api/admin/withdrawals/route");
const {
  GET: getCorridors,
  POST: postCorridors,
} = require("@/app/api/admin/corridors/route");
const {
  PATCH: patchOrgRates,
} = require("@/app/api/admin/organizations/[id]/rates/route");
const {
  GET: getRevenueByOrg,
} = require("@/app/api/admin/revenue/by-organization/route");
const {
  GET: getAdminWallet,
} = require("@/app/api/admin/users/[id]/wallet/route");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeSuspendedAdminSession() {
  setAuthSession(
    createMockSession({
      userId: "admin-suspended-1",
      email: "suspended-admin@test.com",
      role: "ADMIN",
      status: "SUSPENDED",
      organizationId: "admin-org-1",
    })
  );
}

describe("Admin Permission Enforcement", () => {
  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // PE-1: GET /admin/organizations — VIEW_ORGANIZATIONS
  it("PE-1: GET /admin/organizations — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/organizations"
    );

    // No session
    const res1 = await getOrganizations(req);
    expect(res1.status).toBe(403);

    // CARRIER session (lacks VIEW_ORGANIZATIONS)
    useCarrierSession();
    const res2 = await getOrganizations(req);
    expect(res2.status).toBe(403);
  });

  // PE-2: GET /admin/service-fees/metrics — VIEW_SERVICE_FEE_REPORTS
  it("PE-2: GET /admin/service-fees/metrics — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );

    const res1 = await getServiceFeeMetrics(req);
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await getServiceFeeMetrics(req);
    expect(res2.status).toBe(403);
  });

  // PE-3: GET /admin/withdrawals — APPROVE_WITHDRAWALS
  it("PE-3: GET /admin/withdrawals — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/withdrawals"
    );

    const res1 = await getWithdrawals(req);
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await getWithdrawals(req);
    expect(res2.status).toBe(403);
  });

  // PE-4: GET /admin/corridors — CONFIGURE_SERVICE_FEES
  it("PE-4: GET /admin/corridors — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/corridors"
    );

    const res1 = await getCorridors(req);
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await getCorridors(req);
    expect(res2.status).toBe(403);
  });

  // PE-5: POST /admin/corridors — CONFIGURE_SERVICE_FEES
  it("PE-5: POST /admin/corridors — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/corridors",
      {
        name: "Test",
        originRegion: "Addis Ababa",
        destinationRegion: "Amhara",
        distanceKm: 100,
      }
    );

    const res1 = await postCorridors(req);
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await postCorridors(req);
    expect(res2.status).toBe(403);
  });

  // PE-6: PATCH /admin/organizations/[id]/rates — CONFIGURE_SERVICE_FEES
  it("PE-6: PATCH /admin/organizations/[id]/rates — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/organizations/org-1/rates",
      { shipperRatePerKm: 5 }
    );
    const params = Promise.resolve({ id: "org-1" });

    const res1 = await patchOrgRates(req, { params });
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await patchOrgRates(req, { params });
    expect(res2.status).toBe(403);
  });

  // PE-7: GET /admin/revenue/by-organization — VIEW_SERVICE_FEE_REPORTS
  it("PE-7: GET /admin/revenue/by-organization — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization"
    );

    const res1 = await getRevenueByOrg(req);
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await getRevenueByOrg(req);
    expect(res2.status).toBe(403);
  });

  // PE-8: GET /admin/users/[id]/wallet — MANAGE_WALLET
  it("PE-8: GET /admin/users/[id]/wallet — no session→403, CARRIER→403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/users/user-1/wallet"
    );
    const params = Promise.resolve({ id: "user-1" });

    const res1 = await getAdminWallet(req, { params });
    expect(res1.status).toBe(403);

    useCarrierSession();
    const res2 = await getAdminWallet(req, { params });
    expect(res2.status).toBe(403);
  });

  // PE-9: Suspended ADMIN → 403 (requirePermission checks ACTIVE status)
  it("PE-9: SUSPENDED ADMIN → 403 on permission-gated route", async () => {
    makeSuspendedAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/organizations"
    );
    const res = await getOrganizations(req);
    expect(res.status).toBe(403);
  });

  // Verify ADMIN session passes the permission gate (not blocked as 403)
  it("ADMIN session passes VIEW_ORGANIZATIONS gate", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/organizations"
    );
    const res = await getOrganizations(req);
    // Admin has VIEW_ORGANIZATIONS → NOT a 403 (may be 200 or other)
    expect(res.status).not.toBe(403);
  });
});
