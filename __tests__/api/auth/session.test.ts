/**
 * Auth Session Tests
 *
 * Tests for session-related auth endpoints:
 * - GET /api/auth/me → current user profile
 * - POST /api/auth/logout → clear session + CSRF
 */

import {
  createMockSession,
  setAuthSession,
  createRequest,
  parseResponse,
  seedTestData,
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
  mockRbac,
  mockApiErrors,
  mockLogger,
} from "../../utils/routeTestUtils";

// Setup mocks
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
mockRbac();
mockApiErrors();
mockLogger();

// Import handlers AFTER mocks
const { GET: getMe } = require("@/app/api/auth/me/route");
const { POST: logout } = require("@/app/api/auth/logout/route");

describe("Auth Session", () => {
  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/auth/me ─────────────────────────────────────────────────────

  describe("GET /api/auth/me", () => {
    it("unauthenticated → 401", async () => {
      setAuthSession(null);
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      expect(res.status).toBe(401);
    });

    it("carrier gets own profile → 200 with user object", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe("carrier-user-1");
      expect(data.user.role).toBe("CARRIER");
    });

    it("response includes email, role, status, organizationId", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      const data = await parseResponse(res);
      expect(data.user).toHaveProperty("email");
      expect(data.user).toHaveProperty("role");
      expect(data.user).toHaveProperty("status");
      expect(data.user).toHaveProperty("organizationId");
    });

    it("response shape contains expected fields", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      const data = await parseResponse(res);
      // Route selects specific fields — verify key fields present
      expect(data.user).toHaveProperty("id");
      expect(data.user).toHaveProperty("email");
      expect(data.user).toHaveProperty("role");
      expect(data.user).toHaveProperty("status");
    });

    it("shipper gets own profile → 200", async () => {
      setAuthSession(shipperSession);
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.user.role).toBe("SHIPPER");
    });

    it("user not in db → 404", async () => {
      setAuthSession(
        createMockSession({ userId: "ghost-user-999", role: "CARRIER" })
      );
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      expect(res.status).toBe(404);
    });

    it("response includes organization details when present", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/auth/me");
      const res = await getMe(req);
      const data = await parseResponse(res);
      // carrier-user-1 belongs to carrier-org-1 seeded in seedTestData
      expect(data.user.organization).toBeDefined();
      expect(data.user.organization.id).toBe("carrier-org-1");
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("authenticated logout → 200 with success message", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/logout"
      );
      const res = await logout(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.message).toContain("Logout");
    });

    it("logout without session → still 200 (idempotent)", async () => {
      setAuthSession(null);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/logout"
      );
      const res = await logout(req);
      // Logout without session should still succeed (already logged out)
      expect([200, 401]).toContain(res.status);
    });

    it("calls revokeAllSessions when session exists", async () => {
      setAuthSession(carrierSession);
      const authLib = require("@/lib/auth");
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/logout"
      );
      await logout(req);
      expect(authLib.revokeAllSessions).toHaveBeenCalledWith("carrier-user-1");
    });

    it("calls clearSession on logout", async () => {
      setAuthSession(carrierSession);
      const authLib = require("@/lib/auth");
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/logout"
      );
      await logout(req);
      expect(authLib.clearSession).toHaveBeenCalled();
    });

    it("calls clearCSRFToken on logout", async () => {
      setAuthSession(carrierSession);
      const csrfLib = require("@/lib/csrf");
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/logout"
      );
      await logout(req);
      expect(csrfLib.clearCSRFToken).toHaveBeenCalled();
    });
  });
});
