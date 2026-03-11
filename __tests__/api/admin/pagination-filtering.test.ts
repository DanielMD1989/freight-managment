/**
 * Admin Pagination & Date Filtering Tests
 *
 * RBO-1: GET /admin/revenue/by-organization — default limit=50 applied
 * RBO-2: GET /admin/revenue/by-organization — explicit page+limit params honoured
 * RBO-3: GET /admin/revenue/by-organization — limit capped at 100
 * WD-1:  GET /admin/withdrawals — no date filter → all results returned
 * WD-2:  GET /admin/withdrawals — startDate+endDate filters createdAt correctly
 */

import {
  setAuthSession,
  createRequest,
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
  seedTestData,
} from "../../utils/routeTestUtils";
import { useAdminSession, seedAdminTestData } from "./helpers";

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

// ─── RBAC mock — allows ADMIN through ────────────────────────────────────────
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

// Mock admin/metrics (used by revenue route)
jest.mock("@/lib/admin/metrics", () => ({
  getDateRangeForPeriod: jest.fn(() => ({
    start: new Date("2024-01-01"),
    end: new Date("2024-12-31"),
  })),
}));

// ─── Import route handlers AFTER mocks ───────────────────────────────────────
const {
  GET: getRevenueByOrg,
} = require("@/app/api/admin/revenue/by-organization/route");
const { GET: getWithdrawals } = require("@/app/api/admin/withdrawals/route");

describe("Admin Pagination & Date Filtering", () => {
  beforeAll(async () => {
    await seedAdminTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
    useAdminSession();
  });

  // ── Revenue by-organization pagination ────────────────────────────────────

  // RBO-1: Default limit=50 is applied and pagination meta is returned
  it("RBO-1: GET /admin/revenue/by-organization returns pagination meta with default limit=50", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization"
    );
    const res = await getRevenueByOrg(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(50);
    expect(typeof body.pagination.total).toBe("number");
  });

  // RBO-2: Explicit page + limit params are honoured
  it("RBO-2: GET /admin/revenue/by-organization honours explicit page+limit", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?page=2&limit=10"
    );
    const res = await getRevenueByOrg(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
  });

  // RBO-3: limit is capped at 100 even if larger value is provided
  it("RBO-3: GET /admin/revenue/by-organization caps limit at 100", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?limit=500"
    );
    const res = await getRevenueByOrg(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.pagination.limit).toBe(100);
  });

  // ── Withdrawals date filtering ─────────────────────────────────────────────

  // WD-1: No date filter → returns all withdrawals (pagination intact)
  it("WD-1: GET /admin/withdrawals with no date filter returns all records", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/withdrawals"
    );
    const res = await getWithdrawals(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.withdrawals).toBeDefined();
    expect(Array.isArray(body.withdrawals)).toBe(true);
    expect(body.pagination).toBeDefined();
    // All 3 seeded withdrawals are returned
    expect(body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  // WD-2: startDate+endDate filters createdAt — future range returns 0
  it("WD-2: GET /admin/withdrawals with future date range returns empty list", async () => {
    const futureStart = "2099-01-01T00:00:00.000Z";
    const futureEnd = "2099-12-31T23:59:59.999Z";
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/admin/withdrawals?startDate=${futureStart}&endDate=${futureEnd}`
    );
    const res = await getWithdrawals(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.withdrawals).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });
});
