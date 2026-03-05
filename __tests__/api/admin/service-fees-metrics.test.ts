/**
 * Admin Service Fee Metrics API Tests
 *
 * Tests for GET /api/admin/service-fees/metrics
 * Uses inline role check → ADMIN + SUPER_ADMIN only
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

// Import route handler AFTER mocks
const {
  GET: getServiceFeeMetrics,
} = require("@/app/api/admin/service-fees/metrics/route");

describe("Admin Service Fee Metrics API", () => {
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

  // SFM-1: ADMIN GET → 200
  it("SFM-1: ADMIN GET → 200 with metrics", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body).toBeDefined();
  });

  // SFM-2: SUPER_ADMIN GET → 200
  it("SFM-2: SUPER_ADMIN GET → 200", async () => {
    useSuperAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(200);
  });

  // SFM-3: SHIPPER GET → 403
  it("SFM-3: SHIPPER GET → 403", async () => {
    useShipperSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(403);
  });

  // SFM-4: CARRIER GET → 403
  it("SFM-4: CARRIER GET → 403", async () => {
    useCarrierSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(403);
  });

  // SFM-5: DISPATCHER GET → 403
  it("SFM-5: DISPATCHER GET → 403", async () => {
    useDispatcherSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(403);
  });
});
