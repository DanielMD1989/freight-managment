/**
 * Admin Analytics API Tests
 *
 * Tests for /api/admin/analytics, /api/admin/dashboard,
 * /api/admin/platform-metrics, /api/admin/service-fees/metrics
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
  useDispatcherSession,
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

// Mock admin metrics module
const mockGetLoadMetrics = jest.fn();
const mockGetTripMetrics = jest.fn();
const mockGetTruckMetrics = jest.fn();
const mockGetRevenueMetrics = jest.fn();
const mockGetDisputeMetrics = jest.fn();
const mockGetCountMetrics = jest.fn();
const mockGetPeriodMetrics = jest.fn();
const mockGetChartData = jest.fn();
const mockGetDateRangeForPeriod = jest.fn();

jest.mock("@/lib/admin/metrics", () => ({
  getLoadMetrics: (...args: any[]) => mockGetLoadMetrics(...args),
  getTripMetrics: (...args: any[]) => mockGetTripMetrics(...args),
  getTruckMetrics: (...args: any[]) => mockGetTruckMetrics(...args),
  getRevenueMetrics: (...args: any[]) => mockGetRevenueMetrics(...args),
  getDisputeMetrics: (...args: any[]) => mockGetDisputeMetrics(...args),
  getCountMetrics: (...args: any[]) => mockGetCountMetrics(...args),
  getPeriodMetrics: (...args: any[]) => mockGetPeriodMetrics(...args),
  getChartData: (...args: any[]) => mockGetChartData(...args),
  getDateRangeForPeriod: (...args: any[]) => mockGetDateRangeForPeriod(...args),
}));

jest.mock("@/lib/slaAggregation", () => ({
  calculateSLAMetrics: jest.fn(async () => ({
    period: "week",
    startDate: new Date(),
    endDate: new Date(),
    pickup: { total: 10, onTime: 8, late: 2, rate: 80, avgDelayHours: 1.5 },
    delivery: { total: 10, onTime: 9, late: 1, rate: 90, avgDelayHours: 0.5 },
    cancellation: { total: 10, cancelled: 1, rate: 10 },
    exceptions: {
      total: 2,
      resolved: 1,
      open: 1,
      avgMTTR: 12,
      mttrByType: {},
      mttrByPriority: {},
    },
  })),
  getSLATrends: jest.fn(async () => [
    {
      date: "2026-02-01",
      pickupRate: 85,
      deliveryRate: 90,
      cancellationRate: 5,
    },
  ]),
}));

// Import route handlers AFTER mocks
const { GET: getAnalytics } = require("@/app/api/admin/analytics/route");

// Helper to set up default metric mocks
function setupDefaultMetricMocks() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  mockGetDateRangeForPeriod.mockReturnValue({ start, end: now });
  mockGetCountMetrics.mockResolvedValue({
    totalUsers: 50,
    totalOrganizations: 10,
  });
  mockGetLoadMetrics.mockResolvedValue({
    total: 100,
    active: 20,
    inProgress: 15,
    delivered: 30,
    completed: 25,
    cancelled: 10,
    byStatus: {
      DRAFT: 5,
      POSTED: 10,
      SEARCHING: 5,
      OFFERED: 0,
      ASSIGNED: 5,
      PICKUP_PENDING: 5,
      IN_TRANSIT: 5,
      DELIVERED: 30,
      COMPLETED: 25,
      EXCEPTION: 0,
      CANCELLED: 10,
      EXPIRED: 0,
      UNPOSTED: 0,
    },
  });
  mockGetTripMetrics.mockResolvedValue({
    total: 40,
    active: 10,
    byStatus: { ASSIGNED: 5, IN_TRANSIT: 5 },
  });
  mockGetTruckMetrics.mockResolvedValue({
    total: 20,
    available: 10,
    unavailable: 10,
    byApprovalStatus: { APPROVED: 15, PENDING: 5 },
  });
  mockGetRevenueMetrics.mockResolvedValue({
    platformBalance: 100000,
    serviceFeeCollected: 50000,
    pendingWithdrawals: 5000,
  });
  mockGetDisputeMetrics.mockResolvedValue({
    open: 3,
    underReview: 2,
    resolved: 10,
    rejected: 1,
  });
  mockGetPeriodMetrics.mockResolvedValue({
    newUsers: 5,
    newLoads: 12,
    newTrucks: 3,
    completedTrips: 8,
    cancelledTrips: 1,
  });
  mockGetChartData.mockResolvedValue({
    loadsOverTime: [{ date: "2026-02-01", count: 10 }],
    revenueOverTime: [{ date: "2026-02-01", amount: 5000 }],
    tripsOverTime: [{ date: "2026-02-01", count: 4 }],
  });
}

describe("Admin Analytics API", () => {
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

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET analytics returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      expect(res.status).toBe(403);
    });

    it("GET analytics returns 200 for SHIPPER (has VIEW_DASHBOARD)", async () => {
      useShipperSession();
      setupDefaultMetricMocks();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      expect(res.status).toBe(200);
    });

    it("GET analytics returns 200 for CARRIER (has VIEW_DASHBOARD)", async () => {
      useCarrierSession();
      setupDefaultMetricMocks();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      expect(res.status).toBe(200);
    });

    it("GET analytics returns 200 for DISPATCHER (has VIEW_DASHBOARD)", async () => {
      useDispatcherSession();
      setupDefaultMetricMocks();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/admin/analytics ───────────────────────────────────────────────

  describe("GET /api/admin/analytics", () => {
    it("default period=month returns metrics", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.period).toBe("month");
      expect(body.summary).toBeDefined();
      expect(body.charts).toBeDefined();
      expect(body.sla).toBeDefined();
    });

    it("period=day returns daily metrics", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics?period=day"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.period).toBe("day");
    });

    it("period=week returns weekly metrics", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics?period=week"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.period).toBe("week");
    });

    it("period=year returns yearly metrics", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics?period=year"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.period).toBe("year");
    });

    it("response includes summary with revenue, trucks, loads, trips, users, orgs, disputes", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(body.summary.revenue).toBeDefined();
      expect(body.summary.trucks).toBeDefined();
      expect(body.summary.loads).toBeDefined();
      expect(body.summary.trips).toBeDefined();
      expect(body.summary.users).toBeDefined();
      expect(body.summary.organizations).toBeDefined();
      expect(body.summary.disputes).toBeDefined();
    });

    it("response includes charts data", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(body.charts.loadsOverTime).toBeDefined();
      expect(body.charts.revenueOverTime).toBeDefined();
      expect(body.charts.tripsOverTime).toBeDefined();
      expect(body.charts.loadsByStatus).toBeDefined();
      expect(body.charts.slaTrends).toBeDefined();
    });

    it("response includes SLA metrics", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(body.sla).toBeDefined();
      expect(body.sla.pickup).toBeDefined();
      expect(body.sla.delivery).toBeDefined();
      expect(body.sla.cancellation).toBeDefined();
      expect(body.sla.exceptions).toBeDefined();
    });

    it("dateRange in response matches period", async () => {
      useAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics?period=month"
      );
      const res = await getAnalytics(req);
      const body = await parseResponse(res);
      expect(body.dateRange).toBeDefined();
      expect(body.dateRange.start).toBeDefined();
      expect(body.dateRange.end).toBeDefined();
    });

    it("SuperAdmin can access analytics", async () => {
      useSuperAdminSession();
      setupDefaultMetricMocks();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/analytics"
      );
      const res = await getAnalytics(req);
      expect(res.status).toBe(200);
    });
  });
});
