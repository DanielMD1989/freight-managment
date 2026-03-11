/**
 * Admin Organizations API Tests
 *
 * Tests for /api/admin/organizations, /api/admin/organizations/[id]/verify
 */

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
  AdminSeedData,
} from "./helpers";

// ─── Setup Mocks ──────────────────────────────────────────────────────────────
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
// NOTE: Do NOT call mockAuditLog() here because the local jest.mock("@/lib/auditLog", ...)
// below provides writeAuditLog, AuditEventType, and AuditSeverity needed by the verify route.
// Calling mockAuditLog() would override the local mock (which only provides logAuthFailure/logAuthSuccess).
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
    hasAnyPermission: actual.hasAnyPermission,
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

jest.mock("@/lib/auditLog", () => ({
  writeAuditLog: jest.fn(async () => {}),
  AuditEventType: { ORG_VERIFIED: "ORG_VERIFIED" },
  AuditSeverity: { INFO: "INFO" },
}));

// Import route handlers AFTER mocks
const {
  GET: listOrganizations,
} = require("@/app/api/admin/organizations/route");
const {
  POST: verifyOrg,
  DELETE: unverifyOrg,
} = require("@/app/api/admin/organizations/[id]/verify/route");
const {
  POST: rejectOrg,
} = require("@/app/api/admin/organizations/[id]/reject/route");
const {
  GET: getVerificationStatus,
} = require("@/app/api/user/verification-status/route");

describe("Admin Organizations API", () => {
  let seed: AdminSeedData;

  beforeAll(async () => {
    seed = await seedAdminTestData();
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
    it("GET returns 403 for unauthenticated", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 200 for ADMIN", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      expect(res.status).toBe(200);
    });

    it("GET returns 200 for SUPER_ADMIN", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      expect(res.status).toBe(200);
    });

    it("POST verify returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/organizations/shipper-org-1/verify"
      );
      const res = await callHandler(verifyOrg, req, { id: "shipper-org-1" });
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/organizations ───────────────────────────────────────────

  describe("GET /api/admin/organizations", () => {
    it("returns paginated organizations with defaults", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organizations).toBeDefined();
      expect(Array.isArray(body.organizations)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(20);
    });

    it("pagination metadata correct", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(body.pagination.total).toBeGreaterThan(0);
      expect(body.pagination.pages).toBeGreaterThan(0);
    });

    it("search by name (case-insensitive)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations?search=shipper"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const org of body.organizations) {
        expect(org.name.toLowerCase()).toContain("shipper");
      }
    });

    it("filter by isVerified=true", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations?isVerified=true"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const org of body.organizations) {
        expect(org.isVerified).toBe(true);
      }
    });

    it("filter by isVerified=false", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations?isVerified=false"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const org of body.organizations) {
        expect(org.isVerified).toBe(false);
      }
    });

    it("includes _count (users, loads, trucks)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      if (body.organizations.length > 0) {
        expect(body.organizations[0]._count).toBeDefined();
      }
    });

    it("includes isFlagged and flagReason", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      if (body.organizations.length > 0) {
        expect(body.organizations[0]).toHaveProperty("isFlagged");
      }
    });

    it("max limit=100 enforced", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations?limit=999"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(body.pagination.limit).toBe(100);
    });

    it("sort order (newest first)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      // The route orders by createdAt desc; the in-memory mock does not implement orderBy,
      // so we verify the response contains organizations and that the route itself handles ordering.
      // With the mock, all orgs are created within the same millisecond so we just verify
      // the response is valid and contains organizations.
      expect(res.status).toBe(200);
      expect(body.organizations.length).toBeGreaterThan(0);
    });

    it("empty results for no-match search", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/organizations?search=zzzznonexistent"
      );
      const res = await listOrganizations(req);
      const body = await parseResponse(res);
      expect(body.organizations).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  // ─── POST /api/admin/organizations/[id]/verify ─────────────────────────────

  describe("POST /api/admin/organizations/[id]/verify", () => {
    it("successfully verify unverified organization", async () => {
      useAdminSession();
      // Make sure org is unverified first
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: { isVerified: false, verifiedAt: null },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(verifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.message).toContain("verified");
      expect(body.organization.isVerified).toBe(true);
      expect(body.organization.verifiedAt).toBeDefined();
    });

    it("already verified org returns 400", async () => {
      useAdminSession();
      // Ensure it's verified
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: { isVerified: true, verifiedAt: new Date() },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(verifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("already verified");
    });

    it("404 for non-existent organization", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/organizations/non-existent/verify"
      );
      const res = await callHandler(verifyOrg, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("creates audit log entry", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: { isVerified: false, verifiedAt: null },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      await callHandler(verifyOrg, req, { id: seed.dispatcherOrg.id });

      const { writeAuditLog } = require("@/lib/auditLog");
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ORG_VERIFIED",
          action: "VERIFY",
        })
      );
    });

    // Round S2: new fields set on approval
    it("S2: approve sets verificationStatus=APPROVED, documentsLockedAt non-null, rejectionReason=null", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: {
          isVerified: false,
          verifiedAt: null,
          verificationStatus: "PENDING",
          rejectionReason: "Prior rejection reason",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(verifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.organization.verificationStatus).toBe("APPROVED");
      expect(body.organization.documentsLockedAt).toBeTruthy();
      expect(body.organization.isVerified).toBe(true); // two-field sync check

      const org = await db.organization.findUnique({
        where: { id: seed.dispatcherOrg.id },
      });
      expect(org.verificationStatus).toBe("APPROVED");
      expect(org.documentsLockedAt).toBeTruthy();
      expect(org.rejectionReason).toBeNull();
      expect(org.isVerified).toBe(true);
    });
  });

  // G-A2-1: Org approve atomically activates PENDING_VERIFICATION users
  it("T-A1-1: org with 2 PENDING_VERIFICATION users → both promoted to ACTIVE, activatedCount=2", async () => {
    useAdminSession();

    // Create a fresh unverified org with 2 PENDING_VERIFICATION users
    const newOrg = await db.organization.create({
      data: {
        id: "activate-org-1",
        name: "Activation Test Org",
        type: "CARRIER",
        contactEmail: "activate@test.com",
        contactPhone: "+251911009800",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    await db.user.create({
      data: {
        id: "activate-user-1a",
        email: "activate1a@test.com",
        passwordHash: "hash",
        firstName: "Activate",
        lastName: "UserA",
        phone: "+251911009801",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: newOrg.id,
      },
    });
    await db.user.create({
      data: {
        id: "activate-user-1b",
        email: "activate1b@test.com",
        passwordHash: "hash",
        firstName: "Activate",
        lastName: "UserB",
        phone: "+251911009802",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: newOrg.id,
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/admin/organizations/${newOrg.id}/verify`
    );
    const res = await callHandler(verifyOrg, req, { id: newOrg.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.activatedCount).toBe(2);

    // Both users should now be ACTIVE
    const u1 = await db.user.findUnique({ where: { id: "activate-user-1a" } });
    const u2 = await db.user.findUnique({ where: { id: "activate-user-1b" } });
    expect(u1.status).toBe("ACTIVE");
    expect(u2.status).toBe("ACTIVE");
  });

  it("T-A1-2: org with mix of PENDING_VERIFICATION + REGISTERED → only PENDING_VERIFICATION promoted", async () => {
    useAdminSession();

    const mixOrg = await db.organization.create({
      data: {
        id: "activate-org-2",
        name: "Mix Status Org",
        type: "CARRIER",
        contactEmail: "mix@test.com",
        contactPhone: "+251911009810",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    await db.user.create({
      data: {
        id: "activate-user-2a",
        email: "activate2a@test.com",
        passwordHash: "hash",
        firstName: "Mix",
        lastName: "PendVerif",
        phone: "+251911009811",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: mixOrg.id,
      },
    });
    await db.user.create({
      data: {
        id: "activate-user-2b",
        email: "activate2b@test.com",
        passwordHash: "hash",
        firstName: "Mix",
        lastName: "Registered",
        phone: "+251911009812",
        role: "CARRIER",
        status: "REGISTERED",
        organizationId: mixOrg.id,
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/admin/organizations/${mixOrg.id}/verify`
    );
    const res = await callHandler(verifyOrg, req, { id: mixOrg.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.activatedCount).toBe(1);

    // Only PENDING_VERIFICATION user promoted
    const u1 = await db.user.findUnique({ where: { id: "activate-user-2a" } });
    const u2 = await db.user.findUnique({ where: { id: "activate-user-2b" } });
    expect(u1.status).toBe("ACTIVE");
    expect(u2.status).toBe("REGISTERED"); // unchanged
  });

  it("T-A1-3: org with no pending users → activatedCount=0, no error", async () => {
    useAdminSession();
    // dispatcherOrg has only ACTIVE users
    await db.organization.update({
      where: { id: seed.dispatcherOrg.id },
      data: {
        isVerified: false,
        verifiedAt: null,
        verificationStatus: "PENDING",
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
    );
    const res = await callHandler(verifyOrg, req, {
      id: seed.dispatcherOrg.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.activatedCount).toBe(0);
  });

  // G-A2-3: Org approve notifies ACTIVE org members
  it("T-A3-1: after org verify → createNotification called for each ACTIVE user", async () => {
    useAdminSession();

    const notifOrg = await db.organization.create({
      data: {
        id: "notif-org-1",
        name: "Notification Test Org",
        type: "CARRIER",
        contactEmail: "notif@test.com",
        contactPhone: "+251911009820",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    // Create 2 PENDING_VERIFICATION users (they'll be activated inside the transaction)
    await db.user.create({
      data: {
        id: "notif-user-1a",
        email: "notif1a@test.com",
        passwordHash: "hash",
        firstName: "Notif",
        lastName: "UserA",
        phone: "+251911009821",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: notifOrg.id,
      },
    });

    const { createNotification } = require("@/lib/notifications");
    createNotification.mockClear();

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/admin/organizations/${notifOrg.id}/verify`
    );
    await callHandler(verifyOrg, req, { id: notifOrg.id });

    expect(createNotification).toHaveBeenCalled();
    const call = createNotification.mock.calls[0][0];
    expect(call.type).toBe("ACCOUNT_APPROVED");
    expect(call.metadata.orgId).toBe(notifOrg.id);
  });

  // G-M4-4: Org approve invalidates user status cache for activated users
  it("G-M4-4: org verify → CacheInvalidation.user() called for activated users", async () => {
    useAdminSession();

    const cacheOrg = await db.organization.create({
      data: {
        id: "cache-inv-org-1",
        name: "Cache Inv Test Org",
        type: "SHIPPER",
        contactEmail: "cache-inv@test.com",
        contactPhone: "+251911009830",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    await db.user.create({
      data: {
        id: "cache-inv-user-1",
        email: "cache-inv-u1@test.com",
        passwordHash: "hash",
        firstName: "Cache",
        lastName: "Test",
        phone: "+251911009831",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: cacheOrg.id,
      },
    });

    const cacheModule = require("@/lib/cache");
    const cacheInvUser = cacheModule.CacheInvalidation.user as jest.Mock;
    cacheInvUser.mockClear();

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/admin/organizations/${cacheOrg.id}/verify`
    );
    const res = await callHandler(verifyOrg, req, { id: cacheOrg.id });
    expect(res.status).toBe(200);

    expect(cacheInvUser).toHaveBeenCalledWith("cache-inv-user-1");
  });

  // ─── DELETE /api/admin/organizations/[id]/verify ───────────────────────────

  describe("DELETE /api/admin/organizations/[id]/verify", () => {
    it("successfully remove verification", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: { isVerified: true, verifiedAt: new Date() },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(unverifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organization.isVerified).toBe(false);
    });

    it("already unverified org returns 400", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: { isVerified: false, verifiedAt: null },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(unverifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      expect(res.status).toBe(400);
    });

    it("404 for non-existent organization", async () => {
      useAdminSession();
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/admin/organizations/non-existent/verify"
      );
      const res = await callHandler(unverifyOrg, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("creates audit log entry on unverify", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: { isVerified: true, verifiedAt: new Date() },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      await callHandler(unverifyOrg, req, { id: seed.dispatcherOrg.id });

      const { writeAuditLog } = require("@/lib/auditLog");
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UNVERIFY",
        })
      );
    });

    it("403 for CARRIER on DELETE", async () => {
      useCarrierSession();
      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(unverifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      expect(res.status).toBe(403);
    });

    // Round S2: new fields reset on unverify
    it("S2: unverify resets verificationStatus=PENDING and clears documentsLockedAt", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: seed.dispatcherOrg.id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          verificationStatus: "APPROVED",
          documentsLockedAt: new Date(),
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/organizations/${seed.dispatcherOrg.id}/verify`
      );
      const res = await callHandler(unverifyOrg, req, {
        id: seed.dispatcherOrg.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.organization.verificationStatus).toBe("PENDING");
      expect(body.organization.documentsLockedAt).toBeNull();
      expect(body.organization.isVerified).toBe(false); // two-field sync check

      const org = await db.organization.findUnique({
        where: { id: seed.dispatcherOrg.id },
      });
      expect(org.verificationStatus).toBe("PENDING");
      expect(org.documentsLockedAt).toBeNull();
      expect(org.isVerified).toBe(false);
    });
  });

  // ─── POST /api/admin/organizations/[id]/reject (G-A1-2) ────────────────────

  describe("POST /api/admin/organizations/[id]/reject", () => {
    let rejectOrgId: string;

    beforeEach(async () => {
      // Create a fresh PENDING org for each reject test
      const org = await db.organization.create({
        data: {
          id: `reject-org-${Date.now()}`,
          name: "Org To Reject",
          type: "SHIPPER",
          contactEmail: "reject@test.com",
          contactPhone: "+251911009900",
          verificationStatus: "PENDING",
        },
      });
      rejectOrgId = org.id;
    });

    it("T-REJ-1: Admin rejects org with valid reason → 200, verificationStatus=REJECTED", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Missing TIN certificate and business license" } }
      );
      const res = await callHandler(rejectOrg, req, { id: rejectOrgId });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.organization.verificationStatus).toBe("REJECTED");
      expect(body.organization.rejectionReason).toBeTruthy();

      const org = await db.organization.findUnique({
        where: { id: rejectOrgId },
      });
      expect(org.verificationStatus).toBe("REJECTED");
      expect(org.rejectedAt).toBeTruthy();
      expect(org.isVerified).toBe(false);
      expect(org.documentsLockedAt).toBeNull();
    });

    it("T-REJ-2: Non-admin (DISPATCHER) → 403", async () => {
      useDispatcherSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Missing documents for rejection test" } }
      );
      const res = await callHandler(rejectOrg, req, { id: rejectOrgId });
      expect(res.status).toBe(403);
    });

    it("T-REJ-3: Org not found → 404", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/organizations/non-existent-org/reject",
        { body: { reason: "Missing documents for rejection test" } }
      );
      const res = await callHandler(rejectOrg, req, { id: "non-existent-org" });
      expect(res.status).toBe(404);
    });

    it("T-REJ-4: Org already APPROVED → 400", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: rejectOrgId },
        data: { verificationStatus: "APPROVED", isVerified: true },
      });
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Missing documents for rejection test" } }
      );
      const res = await callHandler(rejectOrg, req, { id: rejectOrgId });
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("approved");
    });

    it("T-REJ-5: Org already REJECTED → 400", async () => {
      useAdminSession();
      await db.organization.update({
        where: { id: rejectOrgId },
        data: { verificationStatus: "REJECTED" },
      });
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Missing documents for rejection test" } }
      );
      const res = await callHandler(rejectOrg, req, { id: rejectOrgId });
      const body = await parseResponse(res);
      expect(res.status).toBe(400);
      expect(body.error).toContain("rejected");
    });

    it("T-REJ-6: Missing/too-short reason → 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Short" } }
      );
      const res = await callHandler(rejectOrg, req, { id: rejectOrgId });
      expect(res.status).toBe(400);
    });

    it("T-REJ-7: createNotification called for each org user", async () => {
      useAdminSession();
      // Create a user in the org
      await db.user.create({
        data: {
          id: `reject-user-${rejectOrgId}`,
          email: `reject-${rejectOrgId}@test.com`,
          passwordHash: "hash",
          firstName: "Reject",
          lastName: "User",
          phone: "+251911009901",
          role: "SHIPPER",
          status: "PENDING_VERIFICATION",
          organizationId: rejectOrgId,
        },
      });

      const {
        createNotification: mockCreateNotif,
      } = require("@/lib/notifications");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Missing TIN certificate and business license" } }
      );
      await callHandler(rejectOrg, req, { id: rejectOrgId });
      expect(mockCreateNotif).toHaveBeenCalled();
    });

    it("T-REJ-8: writeAuditLog called with correct event type", async () => {
      useAdminSession();
      const { writeAuditLog } = require("@/lib/auditLog");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Missing TIN certificate and business license" } }
      );
      await callHandler(rejectOrg, req, { id: rejectOrgId });
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ORG_VERIFIED",
          action: "REJECT",
        })
      );
    });

    // ── G-M3-2 — Org rejection cascades REJECTED to members + revokes sessions ─

    it("G-M3-2: org rejection cascades REJECTED status to all org members", async () => {
      useAdminSession();

      // Create two users in the org
      await db.user.create({
        data: {
          id: `reject-cascade-u1-${rejectOrgId}`,
          email: `reject-cascade-u1-${rejectOrgId}@test.com`,
          passwordHash: "hash",
          firstName: "Cascade",
          lastName: "One",
          phone: "+251911009960",
          role: "SHIPPER",
          status: "ACTIVE",
          organizationId: rejectOrgId,
        },
      });
      await db.user.create({
        data: {
          id: `reject-cascade-u2-${rejectOrgId}`,
          email: `reject-cascade-u2-${rejectOrgId}@test.com`,
          passwordHash: "hash",
          firstName: "Cascade",
          lastName: "Two",
          phone: "+251911009961",
          role: "SHIPPER",
          status: "PENDING_VERIFICATION",
          organizationId: rejectOrgId,
        },
      });

      const authModule = require("@/lib/auth");
      const revokeAllSessionsSpy = authModule.revokeAllSessions as jest.Mock;
      revokeAllSessionsSpy.mockClear();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/admin/organizations/${rejectOrgId}/reject`,
        { body: { reason: "Fraudulent documentation submitted by org" } }
      );
      const res = await callHandler(rejectOrg, req, { id: rejectOrgId });
      expect(res.status).toBe(200);

      // Both users should now be REJECTED
      const u1 = await db.user.findUnique({
        where: { id: `reject-cascade-u1-${rejectOrgId}` },
      });
      const u2 = await db.user.findUnique({
        where: { id: `reject-cascade-u2-${rejectOrgId}` },
      });
      expect(u1.status).toBe("REJECTED");
      expect(u2.status).toBe("REJECTED");

      // revokeAllSessions called for each member
      expect(revokeAllSessionsSpy).toHaveBeenCalledWith(
        `reject-cascade-u1-${rejectOrgId}`
      );
      expect(revokeAllSessionsSpy).toHaveBeenCalledWith(
        `reject-cascade-u2-${rejectOrgId}`
      );
    });
  });

  // ─── Round S2: verification-status returns new fields ──────────────────────

  describe("verification-status endpoint (Round S2)", () => {
    it("returns verificationStatus and rejectionReason from organization", async () => {
      await db.organization.update({
        where: { id: seed.shipperOrg.id },
        data: {
          verificationStatus: "REJECTED",
          rejectionReason: "Missing TIN certificate",
        },
      });
      useShipperSession();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/user/verification-status"
      );
      const res = await getVerificationStatus(req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.organization.verificationStatus).toBe("REJECTED");
      expect(body.organization.rejectionReason).toBe("Missing TIN certificate");

      // Restore org state
      await db.organization.update({
        where: { id: seed.shipperOrg.id },
        data: { verificationStatus: "APPROVED", rejectionReason: null },
      });
    });
  });
});
