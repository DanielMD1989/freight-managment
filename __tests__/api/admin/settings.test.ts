/**
 * Admin Settings & Audit Logs API Tests
 *
 * Tests for /api/admin/settings, /api/admin/audit-logs,
 * /api/admin/audit-logs/stats
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
}));

// Mock audit log module with real implementations for query/stats
const mockQueryAuditLogs = jest.fn();
const mockGetAuditLogStats = jest.fn();

jest.mock("@/lib/auditLog", () => ({
  queryAuditLogs: (...args: any[]) => mockQueryAuditLogs(...args),
  getAuditLogStats: (...args: any[]) => mockGetAuditLogStats(...args),
  AuditEventType: {
    AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS",
    AUTH_LOGIN_FAILURE: "AUTH_LOGIN_FAILURE",
    AUTH_LOGOUT: "AUTH_LOGOUT",
    AUTHZ_ACCESS_DENIED: "AUTHZ_ACCESS_DENIED",
    FILE_UPLOAD: "FILE_UPLOAD",
    DOCUMENT_VERIFIED: "DOCUMENT_VERIFIED",
    DOCUMENT_REJECTED: "DOCUMENT_REJECTED",
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    CSRF_VIOLATION: "CSRF_VIOLATION",
    SETTINGS_UPDATED: "SETTINGS_UPDATED",
    ADMIN_ACTION: "ADMIN_ACTION",
    SYSTEM_ERROR: "SYSTEM_ERROR",
  },
  AuditSeverity: {
    INFO: "INFO",
    WARNING: "WARNING",
    ERROR: "ERROR",
    CRITICAL: "CRITICAL",
  },
  writeAuditLog: jest.fn(async () => {}),
}));

// Import route handlers AFTER mocks
const {
  GET: getSettings,
  PATCH: updateSettings,
} = require("@/app/api/admin/settings/route");
const { GET: getAuditLogs } = require("@/app/api/admin/audit-logs/route");
const {
  GET: getAuditLogStats,
} = require("@/app/api/admin/audit-logs/stats/route");

describe("Admin Settings API", () => {
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
    it("GET settings returns 500 for unauthenticated", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      expect(res.status).toBe(500);
    });

    it("GET settings returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      expect(res.status).toBe(403);
    });

    it("GET settings returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      expect(res.status).toBe(403);
    });

    it("PATCH settings returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { rateLimitDocumentUpload: 20 },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(403);
    });

    it("PATCH settings returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { rateLimitDocumentUpload: 20 },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(403);
    });

    it("GET settings returns 200 for ADMIN", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/admin/settings ────────────────────────────────────────────────

  describe("GET /api/admin/settings", () => {
    it("returns existing system settings", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings).toBeDefined();
      expect(body.settings.id).toBe("system");
      expect(body.message).toContain("retrieved");
    });

    it("returns rate limit settings", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(body.settings.rateLimitDocumentUpload).toBe(10);
      expect(body.settings.rateLimitTruckPosting).toBe(100);
      expect(body.settings.rateLimitFileDownload).toBe(100);
      expect(body.settings.rateLimitAuthAttempts).toBe(5);
    });

    it("returns match score thresholds", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(body.settings.matchScoreMinimum).toBe(40);
      expect(body.settings.matchScoreGood).toBe(70);
      expect(body.settings.matchScoreExcellent).toBe(85);
    });

    it("returns email notification settings", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(body.settings.emailNotificationsEnabled).toBe(true);
      expect(body.settings.emailNotifyDocumentApproval).toBe(true);
      expect(body.settings.emailNotifyDocumentRejection).toBe(true);
      expect(body.settings.emailNotifyLoadAssignment).toBe(true);
      expect(body.settings.emailNotifyPodVerification).toBe(true);
    });

    it("returns file upload settings", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(body.settings.maxFileUploadSizeMb).toBe(10);
      expect(body.settings.maxDocumentsPerEntity).toBe(20);
    });

    it("returns general settings", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(body.settings.platformMaintenanceMode).toBe(false);
      expect(body.settings.requireEmailVerification).toBe(false);
      expect(body.settings.requirePhoneVerification).toBe(false);
    });

    it("creates defaults if no settings exist", async () => {
      useSuperAdminSession();
      // Clear the system settings
      const stores = (db as any).__stores;
      if (stores?.systemSettings) {
        stores.systemSettings.clear();
      }

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/settings"
      );
      const res = await getSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings).toBeDefined();
      expect(body.settings.id).toBe("system");
      // Defaults are created
      expect(body.settings.rateLimitDocumentUpload).toBe(10);
      expect(body.settings.matchScoreMinimum).toBe(40);
    });
  });

  // ─── PATCH /api/admin/settings ──────────────────────────────────────────────

  describe("PATCH /api/admin/settings", () => {
    it("updates rate limit settings", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { rateLimitDocumentUpload: 20, rateLimitTruckPosting: 200 },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.rateLimitDocumentUpload).toBe(20);
      expect(body.settings.rateLimitTruckPosting).toBe(200);
      expect(body.message).toContain("updated");
    });

    it("updates match score thresholds", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: {
            matchScoreMinimum: 30,
            matchScoreGood: 60,
            matchScoreExcellent: 90,
          },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.matchScoreMinimum).toBe(30);
      expect(body.settings.matchScoreGood).toBe(60);
      expect(body.settings.matchScoreExcellent).toBe(90);
    });

    it("updates email notification toggles", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: {
            emailNotificationsEnabled: false,
            emailNotifyDocumentApproval: false,
          },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.emailNotificationsEnabled).toBe(false);
      expect(body.settings.emailNotifyDocumentApproval).toBe(false);
    });

    it("updates file upload limits", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { maxFileUploadSizeMb: 25, maxDocumentsPerEntity: 30 },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.maxFileUploadSizeMb).toBe(25);
      expect(body.settings.maxDocumentsPerEntity).toBe(30);
    });

    it("toggles maintenance mode with message", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: {
            platformMaintenanceMode: true,
            platformMaintenanceMessage: "System upgrade in progress",
          },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.platformMaintenanceMode).toBe(true);
      expect(body.settings.platformMaintenanceMessage).toBe(
        "System upgrade in progress"
      );
    });

    it("rejects match score thresholds not in ascending order", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: {
            matchScoreMinimum: 80,
            matchScoreGood: 70,
            matchScoreExcellent: 60,
          },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("ascending order");
    });

    it("rejects rate limit out of range", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { rateLimitDocumentUpload: 0 },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(400);
    });

    it("rejects rate limit above max", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { rateLimitDocumentUpload: 9999 },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(400);
    });

    it("rejects maxFileUploadSizeMb out of range", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { maxFileUploadSizeMb: 200 },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(400);
    });

    it("creates audit log entry on update", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { rateLimitAuthAttempts: 10 },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(200);

      // Verify audit log was created
      const logs = Array.from(
        ((db as any).__stores?.auditLogs as Map<string, any>)?.values() || []
      );
      const settingsLog = logs.find(
        (l: any) =>
          l.eventType === "SETTINGS_UPDATED" && l.resource === "SYSTEM_SETTINGS"
      );
      expect(settingsLog).toBeDefined();
    });

    it("allows partial updates (only changed fields)", async () => {
      useAdminSession();
      // Update only one field
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { requireEmailVerification: true },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.requireEmailVerification).toBe(true);
      // Other fields preserved
      expect(body.settings.rateLimitAuthAttempts).toBeDefined();
    });

    it("SuperAdmin can update settings", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: { requirePhoneVerification: true },
        }
      );
      const res = await updateSettings(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.settings.requirePhoneVerification).toBe(true);
    });

    it("rejects matchScoreMinimum >= matchScoreGood", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/settings",
        {
          body: {
            matchScoreMinimum: 70,
            matchScoreGood: 70,
            matchScoreExcellent: 90,
          },
        }
      );
      const res = await updateSettings(req);
      expect(res.status).toBe(400);
    });
  });
});

// ─── Audit Logs API ──────────────────────────────────────────────────────────

describe("Admin Audit Logs API", () => {
  beforeAll(async () => {
    await seedAdminTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
    mockQueryAuditLogs.mockReset();
    mockGetAuditLogStats.mockReset();
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET audit-logs returns 500 for unauthenticated", async () => {
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
      });
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(500);
    });

    it("GET audit-logs returns 500 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(500);
    });

    it("GET audit-logs returns 500 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(500);
    });

    it("GET audit-logs returns 200 for ADMIN", async () => {
      useAdminSession();
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
      });
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(200);
    });

    it("GET audit-log stats returns 500 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs/stats"
      );
      const res = await getAuditLogStats(req);
      expect(res.status).toBe(500);
    });
  });

  // ─── GET /api/admin/audit-logs ──────────────────────────────────────────────

  describe("GET /api/admin/audit-logs", () => {
    it("returns paginated audit logs with default limit=100", async () => {
      useAdminSession();
      const mockLogs = [
        {
          id: "log-1",
          eventType: "AUTH_LOGIN_SUCCESS",
          severity: "INFO",
          userId: "user-1",
          timestamp: new Date().toISOString(),
        },
      ];
      mockQueryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 100,
        offset: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs"
      );
      const res = await getAuditLogs(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.logs).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.limit).toBe(100);
      expect(body.offset).toBe(0);
    });

    it("passes severity filter to queryAuditLogs", async () => {
      useAdminSession();
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs?severity=ERROR"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(200);
      expect(mockQueryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "ERROR" })
      );
    });

    it("passes eventType filter to queryAuditLogs", async () => {
      useAdminSession();
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs?eventType=AUTH_LOGIN_FAILURE"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(200);
      expect(mockQueryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "AUTH_LOGIN_FAILURE" })
      );
    });

    it("passes userId filter to queryAuditLogs", async () => {
      useAdminSession();
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs?userId=shipper-user-1"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(200);
      expect(mockQueryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "shipper-user-1" })
      );
    });

    it("passes date range filters to queryAuditLogs", async () => {
      useAdminSession();
      mockQueryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
      });

      const startDate = "2026-01-01T00:00:00Z";
      const endDate = "2026-02-01T00:00:00Z";
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/audit-logs?startDate=${startDate}&endDate=${endDate}`
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(200);
      expect(mockQueryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it("returns CSV export when format=csv", async () => {
      useAdminSession();
      mockQueryAuditLogs.mockResolvedValue({
        logs: [
          {
            createdAt: "2026-01-15T10:00:00Z",
            eventType: "AUTH_LOGIN_SUCCESS",
            severity: "INFO",
            userId: "user-1",
            organizationId: null,
            ipAddress: "127.0.0.1",
            userAgent: "TestAgent/1.0",
            resourceType: null,
            resourceId: null,
            action: "LOGIN",
            details: {},
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs?format=csv"
      );
      const res = await getAuditLogs(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("audit-logs-");
    });

    it("rejects invalid event type", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs?eventType=INVALID_TYPE"
      );
      const res = await getAuditLogs(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("Invalid event type");
    });

    it("rejects invalid severity level", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs?severity=INVALID"
      );
      const res = await getAuditLogs(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("Invalid severity");
    });
  });

  // ─── GET /api/admin/audit-logs/stats ────────────────────────────────────────

  describe("GET /api/admin/audit-logs/stats", () => {
    it("returns aggregated stats", async () => {
      useAdminSession();
      const mockStats = {
        totalLogs: 150,
        authFailures: 5,
        authzFailures: 2,
        rateLimitViolations: 3,
        csrfViolations: 1,
        fileUploads: 20,
        documentVerifications: 10,
      };
      mockGetAuditLogStats.mockResolvedValue(mockStats);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs/stats"
      );
      const res = await getAuditLogStats(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.totalLogs).toBe(150);
      expect(body.authFailures).toBe(5);
      expect(body.rateLimitViolations).toBe(3);
      expect(body.csrfViolations).toBe(1);
    });

    it("passes organizationId filter", async () => {
      useAdminSession();
      mockGetAuditLogStats.mockResolvedValue({
        totalLogs: 10,
        authFailures: 0,
        authzFailures: 0,
        rateLimitViolations: 0,
        csrfViolations: 0,
        fileUploads: 5,
        documentVerifications: 2,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs/stats?organizationId=shipper-org-1"
      );
      const res = await getAuditLogStats(req);
      expect(res.status).toBe(200);
      expect(mockGetAuditLogStats).toHaveBeenCalledWith(
        "shipper-org-1",
        undefined,
        undefined
      );
    });

    it("SuperAdmin can access stats", async () => {
      useSuperAdminSession();
      mockGetAuditLogStats.mockResolvedValue({
        totalLogs: 0,
        authFailures: 0,
        authzFailures: 0,
        rateLimitViolations: 0,
        csrfViolations: 0,
        fileUploads: 0,
        documentVerifications: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/audit-logs/stats"
      );
      const res = await getAuditLogStats(req);
      expect(res.status).toBe(200);
    });
  });
});
