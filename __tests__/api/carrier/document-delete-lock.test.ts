/**
 * Document Delete Lock Enforcement Tests (Round M5)
 *
 * G-M5-6: DELETE /api/documents/[id] — must check documentsLockedAt
 *          on both company and truck branches. Locked → 423.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
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
  mockApiErrors,
  mockLogger,
  SeedData,
} from "../../utils/routeTestUtils";
import { NextRequest } from "next/server";

// ─── Auth mock ──────────────────────────────────────────────────────────────
jest.mock("@/lib/auth", () => ({
  requireActiveUser: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireAuth: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  getSession: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    return getAuthSession();
  }),
}));

jest.mock("@/lib/rbac", () => {
  const actual = jest.requireActual("@/lib/rbac/permissions");
  return {
    requirePermission: jest.fn(async (permission: string) => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      if (!actual.hasPermission(session.role, permission)) {
        const error = new Error("Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    Permission: actual.Permission,
    hasPermission: actual.hasPermission,
  };
});

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  createDocumentApprovalEmail: jest.fn().mockReturnValue({}),
  createDocumentRejectionEmail: jest.fn().mockReturnValue({}),
}));

// ─── Standard mocks ─────────────────────────────────────────────────────────
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
mockApiErrors();
mockLogger();

// Import handler AFTER all mocks
const { DELETE: deleteDocument } = require("@/app/api/documents/[id]/route");

// ─── Helpers ────────────────────────────────────────────────────────────────

function createDeleteRequest(id: string, entityType: string): NextRequest {
  return {
    url: `http://localhost:3000/api/documents/${id}?entityType=${entityType}`,
    headers: new Headers({ Authorization: "Bearer mock-token" }),
    json: jest.fn(),
  } as unknown as NextRequest;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("Document Delete Lock Enforcement (G-M5-6)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Company documents ─────────────────────────────────────────────────────

  describe("company document delete + lock check", () => {
    it("DL-1: DELETE locked company doc → 423", async () => {
      const lockedOrg = await db.organization.create({
        data: {
          id: "del-lock-org-1",
          name: "Delete Lock Org",
          type: "SHIPPER",
          contactEmail: "del-lock@test.com",
          isVerified: true,
          verificationStatus: "APPROVED",
          documentsLockedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });

      const doc = await db.companyDocument.create({
        data: {
          id: "del-lock-doc-1",
          type: "COMPANY_LICENSE",
          fileName: "license.pdf",
          fileUrl: "https://test.com/license.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          verificationStatus: "PENDING",
          organizationId: lockedOrg.id,
          uploadedById: "del-lock-user-1",
        },
      });

      const session = createMockSession({
        userId: "del-lock-user-1",
        role: "SHIPPER",
        organizationId: lockedOrg.id,
      });
      setAuthSession(session);

      const req = createDeleteRequest(doc.id, "company");
      const res = await callHandler(deleteDocument, req, { id: doc.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(423);
      expect(body.error).toMatch(/locked/i);
    });

    it("DL-2: DELETE unlocked company doc (PENDING) → 200", async () => {
      const unlockedOrg = await db.organization.create({
        data: {
          id: "del-unlock-org-1",
          name: "Delete Unlock Org",
          type: "SHIPPER",
          contactEmail: "del-unlock@test.com",
          isVerified: false,
          verificationStatus: "PENDING",
          documentsLockedAt: null,
        },
      });

      const doc = await db.companyDocument.create({
        data: {
          id: "del-unlock-doc-1",
          type: "COMPANY_LICENSE",
          fileName: "license.pdf",
          fileUrl: "https://test.com/license.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          verificationStatus: "PENDING",
          organizationId: unlockedOrg.id,
          uploadedById: "del-unlock-user-1",
        },
      });

      const session = createMockSession({
        userId: "del-unlock-user-1",
        role: "SHIPPER",
        organizationId: unlockedOrg.id,
      });
      setAuthSession(session);

      const req = createDeleteRequest(doc.id, "company");
      const res = await callHandler(deleteDocument, req, { id: doc.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.message).toMatch(/deleted/i);
    });
  });

  // ── Truck documents ───────────────────────────────────────────────────────

  describe("truck document delete + lock check", () => {
    it("DL-3: DELETE locked truck doc → 423", async () => {
      const lockedTruck = await db.truck.create({
        data: {
          id: "del-lock-truck-1",
          truckType: "DRY_VAN",
          licensePlate: "DL-TRK-01",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
          documentsLockedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });

      const doc = await db.truckDocument.create({
        data: {
          id: "del-lock-tdoc-1",
          type: "REGISTRATION",
          fileName: "registration.pdf",
          fileUrl: "https://test.com/registration.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          verificationStatus: "PENDING",
          truckId: lockedTruck.id,
          uploadedById: seed.carrierUser.id,
        },
      });

      const session = createMockSession({
        userId: seed.carrierUser.id,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
      });
      setAuthSession(session);

      const req = createDeleteRequest(doc.id, "truck");
      const res = await callHandler(deleteDocument, req, { id: doc.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(423);
      expect(body.error).toMatch(/locked/i);
    });

    it("DL-4: DELETE unlocked truck doc (PENDING) → 200", async () => {
      const unlockedTruck = await db.truck.create({
        data: {
          id: "del-unlock-truck-1",
          truckType: "FLATBED",
          licensePlate: "DL-TRK-02",
          capacity: 15000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
          documentsLockedAt: null,
        },
      });

      const doc = await db.truckDocument.create({
        data: {
          id: "del-unlock-tdoc-1",
          type: "REGISTRATION",
          fileName: "registration.pdf",
          fileUrl: "https://test.com/registration.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          verificationStatus: "PENDING",
          truckId: unlockedTruck.id,
          uploadedById: seed.carrierUser.id,
        },
      });

      const session = createMockSession({
        userId: seed.carrierUser.id,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
      });
      setAuthSession(session);

      const req = createDeleteRequest(doc.id, "truck");
      const res = await callHandler(deleteDocument, req, { id: doc.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.message).toMatch(/deleted/i);
    });
  });
});
