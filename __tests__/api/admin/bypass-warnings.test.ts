/**
 * Admin Bypass Warnings API Tests
 *
 * Tests for /api/admin/bypass-warnings, /api/admin/bypass-warnings/organizations
 */

import { db } from "@/lib/db";
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
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: error.flatten?.() || error },
      { status: 400 }
    );
  }),
}));

// Mock bypass warnings library
const mockCheckAndSendWarnings = jest.fn();
const mockSendBypassWarning = jest.fn();

jest.mock("@/lib/bypassWarnings", () => ({
  checkAndSendWarnings: (...args: any[]) => mockCheckAndSendWarnings(...args),
  sendBypassWarning: (...args: any[]) => mockSendBypassWarning(...args),
  BypassWarningType: {
    FIRST_SUSPICIOUS_CANCELLATION: "FIRST_SUSPICIOUS_CANCELLATION",
    MULTIPLE_SUSPICIOUS_CANCELLATIONS: "MULTIPLE_SUSPICIOUS_CANCELLATIONS",
    ACCOUNT_FLAGGED: "ACCOUNT_FLAGGED",
    BYPASS_REPORTED: "BYPASS_REPORTED",
  },
}));

jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
}));

// Import route handlers AFTER mocks
const {
  POST: postWarnings,
  GET: getWarningStats,
} = require("@/app/api/admin/bypass-warnings/route");
const {
  GET: getOrganizations,
  PATCH: patchOrganization,
} = require("@/app/api/admin/bypass-warnings/organizations/route");

describe("Admin Bypass Warnings API", () => {
  beforeAll(async () => {
    await seedAdminTestData();

    // Set up some organizations with suspicious activity for testing
    const stores = (db as any).__stores;
    if (stores?.organizations) {
      // Update shipper org to have suspicious activity
      const shipperOrg = stores.organizations.get("shipper-org-1");
      if (shipperOrg) {
        stores.organizations.set("shipper-org-1", {
          ...shipperOrg,
          suspiciousCancellationCount: 2,
          bypassAttemptCount: 1,
          isFlagged: false,
          flaggedAt: null,
          flagReason: null,
        });
      }

      // Update carrier org to be flagged
      const carrierOrg = stores.organizations.get("carrier-org-1");
      if (carrierOrg) {
        stores.organizations.set("carrier-org-1", {
          ...carrierOrg,
          suspiciousCancellationCount: 5,
          bypassAttemptCount: 3,
          isFlagged: true,
          flaggedAt: new Date(),
          flagReason: "Repeated bypass behavior",
        });
      }
    }
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
    mockCheckAndSendWarnings.mockReset();
    mockSendBypassWarning.mockReset();
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("POST bypass-warnings returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await postWarnings(req);
      expect(res.status).toBe(403);
    });

    it("POST bypass-warnings returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await postWarnings(req);
      expect(res.status).toBe(403);
    });

    it("POST bypass-warnings returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await postWarnings(req);
      expect(res.status).toBe(403);
    });

    it("POST bypass-warnings returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await postWarnings(req);
      expect(res.status).toBe(403);
    });

    it("GET warning stats returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await getWarningStats(req);
      expect(res.status).toBe(403);
    });

    it("GET organizations returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations"
      );
      const res = await getOrganizations(req);
      expect(res.status).toBe(403);
    });

    it("PATCH organizations returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: { organizationId: "shipper-org-1", isFlagged: true },
        }
      );
      const res = await patchOrganization(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/admin/bypass-warnings ────────────────────────────────────────

  describe("POST /api/admin/bypass-warnings", () => {
    it("sends manual warning with body", async () => {
      useSuperAdminSession();
      mockSendBypassWarning.mockResolvedValue(undefined);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings",
        {
          body: {
            organizationId: "shipper-org-1",
            warningType: "FIRST_SUSPICIOUS_CANCELLATION",
          },
        }
      );
      const res = await postWarnings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.message).toContain("Warning sent");
      expect(body.organizationId).toBe("shipper-org-1");
      expect(body.warningType).toBe("FIRST_SUSPICIOUS_CANCELLATION");
      expect(mockSendBypassWarning).toHaveBeenCalledWith(
        "shipper-org-1",
        "FIRST_SUSPICIOUS_CANCELLATION"
      );
    });

    it("runs automated check without body", async () => {
      useSuperAdminSession();
      mockCheckAndSendWarnings.mockResolvedValue({
        warningsSent: 3,
        organizationsWarned: ["Org A", "Org B", "Org C"],
      });

      // Create request with no body (JSON parse returns null)
      const req = new Request(
        "http://localhost:3000/api/admin/bypass-warnings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": "test-token",
          },
        }
      );
      const res = await postWarnings(req as any);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.message).toContain("Automated warning check");
      expect(body.warningsSent).toBe(3);
      expect(body.timestamp).toBeDefined();
    });

    it("rejects invalid warning type", async () => {
      useSuperAdminSession();

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings",
        {
          body: {
            organizationId: "shipper-org-1",
            warningType: "INVALID_TYPE",
          },
        }
      );
      const res = await postWarnings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it("SuperAdmin can send warnings", async () => {
      useSuperAdminSession();
      mockSendBypassWarning.mockResolvedValue(undefined);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings",
        {
          body: {
            organizationId: "carrier-org-1",
            warningType: "ACCOUNT_FLAGGED",
          },
        }
      );
      const res = await postWarnings(req);
      expect(res.status).toBe(200);
    });

    it("validates manual warning body with Zod", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/bypass-warnings",
        {
          body: { organizationId: 123, warningType: 456 },
        }
      );
      const res = await postWarnings(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/admin/bypass-warnings (Stats) ────────────────────────────────

  describe("GET /api/admin/bypass-warnings (Stats)", () => {
    it("returns stats for ADMIN", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await getWarningStats(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.stats).toBeDefined();
      expect(body.stats.firstTimeOffenders).toBeDefined();
      expect(body.stats.multipleOffenders).toBeDefined();
      expect(body.stats.flaggedOrganizations).toBeDefined();
      expect(body.stats.totalSuspicious).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it("returns flaggedOrganizations count", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await getWarningStats(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      // carrier-org-1 is flagged
      expect(body.stats.flaggedOrganizations).toBeGreaterThanOrEqual(1);
    });

    it("SuperAdmin can access stats", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings"
      );
      const res = await getWarningStats(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/admin/bypass-warnings/organizations ──────────────────────────

  describe("GET /api/admin/bypass-warnings/organizations", () => {
    it("returns all organizations with bypass data (default status=all)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations"
      );
      const res = await getOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organizations).toBeDefined();
      expect(body.totalCount).toBeDefined();
      expect(body.limit).toBeDefined();
      expect(body.offset).toBeDefined();
      expect(body.hasMore).toBeDefined();
    });

    it("filters by status=flagged", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations?status=flagged"
      );
      const res = await getOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      // All returned orgs should be flagged
      for (const org of body.organizations) {
        expect(org.isFlagged).toBe(true);
      }
    });

    it("filters by status=suspicious", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations?status=suspicious"
      );
      const res = await getOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      // All returned orgs should have suspicious activity but not flagged
      for (const org of body.organizations) {
        expect(org.isFlagged).toBe(false);
        expect(org.suspiciousCancellationCount).toBeGreaterThanOrEqual(1);
      }
    });

    it("supports pagination with limit and offset", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations?limit=1&offset=0"
      );
      const res = await getOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organizations.length).toBeLessThanOrEqual(1);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
    });

    it("returns hasMore for pagination", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations?limit=1&offset=0"
      );
      const res = await getOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(typeof body.hasMore).toBe("boolean");
    });

    it("includes _count relations", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations"
      );
      const res = await getOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      if (body.organizations.length > 0) {
        expect(body.organizations[0]._count).toBeDefined();
      }
    });

    it("SuperAdmin can access organizations list", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/bypass-warnings/organizations"
      );
      const res = await getOrganizations(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── PATCH /api/admin/bypass-warnings/organizations ────────────────────────

  describe("PATCH /api/admin/bypass-warnings/organizations", () => {
    it("flags an organization", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: {
            organizationId: "shipper-org-1",
            isFlagged: true,
            flagReason: "Suspicious bypass pattern detected",
          },
        }
      );
      const res = await patchOrganization(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.message).toContain("flagged");
      expect(body.organization).toBeDefined();
      expect(body.organization.isFlagged).toBe(true);
      expect(body.organization.flagReason).toBe(
        "Suspicious bypass pattern detected"
      );
    });

    it("unflags an organization", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: { organizationId: "carrier-org-1", isFlagged: false },
        }
      );
      const res = await patchOrganization(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.message).toContain("removed");
      expect(body.organization.isFlagged).toBe(false);
      expect(body.organization.flagReason).toBeNull();
    });

    it("rejects missing organizationId", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: { isFlagged: true },
        }
      );
      const res = await patchOrganization(req);
      expect(res.status).toBe(400);
    });

    it("rejects missing isFlagged", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: { organizationId: "shipper-org-1" },
        }
      );
      const res = await patchOrganization(req);
      expect(res.status).toBe(400);
    });

    it("returns 500 for non-existent organization", async () => {
      useSuperAdminSession();
      // Simulate Prisma throwing on update with non-existent id
      (db.organization.update as jest.Mock).mockRejectedValueOnce(
        new Error("Record to update not found.")
      );
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: { organizationId: "non-existent-org", isFlagged: true },
        }
      );
      const res = await patchOrganization(req);
      // Prisma throws on update with non-existent id
      expect(res.status).toBe(500);
    });

    it("SuperAdmin can flag organizations", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: {
            organizationId: "shipper-org-1",
            isFlagged: true,
            flagReason: "Admin review required",
          },
        }
      );
      const res = await patchOrganization(req);
      expect(res.status).toBe(200);
    });

    it("sets flaggedAt timestamp when flagging", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: {
            organizationId: "shipper-org-1",
            isFlagged: true,
            flagReason: "Test flagging",
          },
        }
      );
      const res = await patchOrganization(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organization.flaggedAt).toBeDefined();
    });

    it("clears flaggedAt when unflagging", async () => {
      useSuperAdminSession();
      // First flag it
      const flagReq = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: {
            organizationId: "shipper-org-1",
            isFlagged: true,
            flagReason: "Temp flag",
          },
        }
      );
      await patchOrganization(flagReq);

      // Now unflag
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/bypass-warnings/organizations",
        {
          body: { organizationId: "shipper-org-1", isFlagged: false },
        }
      );
      const res = await patchOrganization(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organization.flaggedAt).toBeNull();
      expect(body.organization.flagReason).toBeNull();
    });
  });
});
