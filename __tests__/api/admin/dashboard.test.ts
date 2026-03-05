/**
 * Admin Dashboard API Tests
 *
 * Tests for GET /api/admin/dashboard
 * Note: deprecated in favour of /analytics but route is still live.
 * VIEW_DASHBOARD permission is granted to ALL roles.
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
} from "../../utils/routeTestUtils";
import {
  useAdminSession,
  useSuperAdminSession,
  useShipperSession,
  useCarrierSession,
  seedAdminTestData,
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

// Mock the metrics module used by the dashboard route
jest.mock("@/lib/admin/metrics", () => ({
  getAdminDashboardMetrics: jest.fn(async () => ({
    counts: {
      totalUsers: 10,
      totalOrganizations: 4,
      totalLoads: 20,
      totalTrucks: 5,
    },
    loads: {
      active: 3,
      inProgress: 2,
      delivered: 8,
      completed: 5,
      cancelled: 2,
      byStatus: {},
    },
    trips: { total: 8, active: 3, completed: 5, cancelled: 0, byStatus: {} },
    trucks: { total: 5, available: 3, unavailable: 2, byApprovalStatus: {} },
    revenue: {
      platformBalance: 50000,
      serviceFeeCollected: 10000,
      pendingWithdrawals: 2000,
    },
    disputes: { open: 1, underReview: 0, resolved: 3, rejected: 0 },
    recentActivity: { usersLast7Days: 2, loadsLast7Days: 5 },
  })),
}));

// Import route handler AFTER mocks
const { GET: getDashboard } = require("@/app/api/admin/dashboard/route");

describe("Admin Dashboard API", () => {
  beforeAll(async () => {
    await seedAdminTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // DAD-1: ADMIN GET → 200 with metrics
  it("DAD-1: ADMIN GET → 200 with dashboard metrics", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/dashboard"
    );
    const res = await getDashboard(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body.totalUsers).toBeDefined();
    expect(body.totalLoads).toBeDefined();
    expect(body.activeLoads).toBeDefined();
  });

  // DAD-2: SUPER_ADMIN GET → 200
  it("DAD-2: SUPER_ADMIN GET → 200", async () => {
    useSuperAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/dashboard"
    );
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
  });

  // DAD-3: SHIPPER GET → 200 (VIEW_DASHBOARD granted to all)
  it("DAD-3: SHIPPER GET → 200 (VIEW_DASHBOARD granted to all roles)", async () => {
    useShipperSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/dashboard"
    );
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
  });

  // DAD-4: CARRIER GET → 200
  it("DAD-4: CARRIER GET → 200", async () => {
    useCarrierSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/dashboard"
    );
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
  });

  // DAD-5: Unauthenticated GET → 403 (ForbiddenError from requirePermission)
  it("DAD-5: Unauthenticated GET → 403", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/dashboard"
    );
    const res = await getDashboard(req);
    expect(res.status).toBe(403);
  });
});
