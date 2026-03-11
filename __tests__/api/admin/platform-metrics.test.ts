/**
 * Admin Platform Metrics API Tests
 *
 * Tests for GET /api/admin/platform-metrics
 * Uses requirePermission(MANAGE_USERS) → ADMIN + SUPER_ADMIN only
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

// Import route handler AFTER mocks
const {
  GET: getPlatformMetrics,
} = require("@/app/api/admin/platform-metrics/route");

describe("Admin Platform Metrics API", () => {
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

  // PLM-1: SUPER_ADMIN GET → 200 with metrics structure
  it("PLM-1: SUPER_ADMIN GET → 200 with metrics structure", async () => {
    useSuperAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body.metrics).toBeDefined();
    expect(body.metrics.users).toBeDefined();
    expect(body.metrics.organizations).toBeDefined();
    expect(body.metrics.loads).toBeDefined();
    expect(body.metrics.trucks).toBeDefined();
    expect(body.metrics.financial).toBeDefined();
  });

  // PLM-2: ADMIN GET → 403 (VIEW_PLATFORM_METRICS is SUPER_ADMIN only)
  it("PLM-2: ADMIN GET → 403 (VIEW_PLATFORM_METRICS is SUPER_ADMIN only)", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(403);
  });

  // PLM-3: SHIPPER GET → 403
  it("PLM-3: SHIPPER GET → 403", async () => {
    useShipperSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(403);
  });

  // PLM-4: CARRIER GET → 403
  it("PLM-4: CARRIER GET → 403", async () => {
    useCarrierSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(403);
  });

  // PLM-5: DISPATCHER GET → 403
  it("PLM-5: DISPATCHER GET → 403", async () => {
    useDispatcherSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(403);
  });

  // PM-1: No session → 403
  it("PM-1: No session → 403", async () => {
    // setAuthSession(null) is called in beforeEach
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(403);
  });

  // PM-2: ADMIN → 403 (VIEW_PLATFORM_METRICS is SUPER_ADMIN only)
  it("PM-2: ADMIN → 403 (VIEW_PLATFORM_METRICS is SUPER_ADMIN only)", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(403);
  });

  // PM-3: SUPER_ADMIN → 200 (has VIEW_PLATFORM_METRICS)
  it("PM-3: SUPER_ADMIN → 200 (has VIEW_PLATFORM_METRICS)", async () => {
    useSuperAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/platform-metrics"
    );
    const res = await getPlatformMetrics(req);
    expect(res.status).toBe(200);
  });
});
