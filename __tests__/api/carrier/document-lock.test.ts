/**
 * Document Lock Enforcement Tests (Round A3)
 *
 * G-A3-1: POST /api/documents/upload — company branch must block when
 *          organization.documentsLockedAt is set (org APPROVED).
 * G-A3-2: POST /api/documents/upload — truck branch must block when
 *          truck.documentsLockedAt is set (truck APPROVED).
 *
 * Both must return 423 Locked with a descriptive error.
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

// ─── Auth mock (includes requireRegistrationAccess) ──────────────────────────
jest.mock("@/lib/auth", () => ({
  requireRegistrationAccess: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
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
  getSessionAny: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    return getAuthSession();
  }),
  hashPassword: jest.fn(async (pw: string) => `hashed_${pw}`),
  verifyPassword: jest.fn(
    async (pw: string, hash: string) => hash === `hashed_${pw}`
  ),
  setSession: jest.fn(async () => {}),
  createSessionRecord: jest.fn(async () => ({
    sessionId: "session-mock",
    id: "session-mock",
  })),
  createSessionToken: jest.fn(async () => "mock-session-token"),
  isLoginAllowed: jest.fn((status: string) => ({
    allowed: status === "ACTIVE",
    limited: false,
  })),
  generateOTP: jest.fn(() => "123456"),
  validatePasswordPolicy: jest.fn(() => ({ valid: true, errors: [] })),
  createToken: jest.fn(async () => "mock-token"),
  clearSession: jest.fn(async () => {}),
  revokeAllSessions: jest.fn(async () => {}),
}));

// ─── File storage mock (bypasses real file I/O) ───────────────────────────────
jest.mock("@/lib/fileStorage", () => ({
  saveFile: jest
    .fn()
    .mockResolvedValue({ fileUrl: "https://test.com/doc.pdf" }),
  validateUploadedFile: jest.fn().mockReturnValue({ valid: true }),
  MAX_FILE_SIZE: 10 * 1024 * 1024,
}));

// ─── Validation mock (bypasses filename / ID format checks) ──────────────────
jest.mock("@/lib/validation", () => ({
  validateFileName: jest.fn().mockReturnValue({ valid: true }),
  validateIdFormat: jest.fn().mockReturnValue({ valid: true }),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
  sanitizeText: jest.fn((text: string) => text),
}));

// ─── Remaining standard mocks ─────────────────────────────────────────────────
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

// Import handler AFTER all mocks are in place
const { POST: uploadDocument } = require("@/app/api/documents/upload/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockFile = {
  name: "test-doc.pdf",
  size: 1024,
  type: "application/pdf",
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
};

function createUploadRequest(fields: Record<string, any>): NextRequest {
  const formData = { get: (key: string) => fields[key] ?? null };
  return {
    formData: jest.fn().mockResolvedValue(formData),
    url: "http://localhost:3000/api/documents/upload",
    headers: new Headers({ Authorization: "Bearer mock-token" }),
  } as unknown as NextRequest;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Document Lock Enforcement (Round A3)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply fileStorage mock after clearAllMocks resets call counts
    const { validateUploadedFile } = require("@/lib/fileStorage");
    (validateUploadedFile as jest.Mock).mockReturnValue({ valid: true });
  });

  // ── G-A3-1: Company documents ──────────────────────────────────────────────

  describe("G-A3-1: company document upload blocked when org is locked", () => {
    it("T-LOCK-1: upload to LOCKED org → 423, error mentions locked", async () => {
      const lockedOrg = await db.organization.create({
        data: {
          id: "locked-company-org",
          name: "Locked Shipper Corp",
          type: "SHIPPER",
          contactEmail: "locked@test.com",
          isVerified: true,
          verificationStatus: "APPROVED",
          documentsLockedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });

      const session = createMockSession({
        userId: "shipper-lock-user",
        role: "SHIPPER",
        organizationId: lockedOrg.id,
      });
      setAuthSession(session);

      const req = createUploadRequest({
        file: mockFile,
        type: "COMPANY_LICENSE",
        entityType: "company",
        entityId: lockedOrg.id,
      });

      const res = await callHandler(uploadDocument, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(423);
      expect(body.error).toMatch(/locked/i);
    });

    it("T-LOCK-2: upload to UNLOCKED org → lock check passes (not 423)", async () => {
      const unlockedOrg = await db.organization.create({
        data: {
          id: "unlocked-company-org",
          name: "Unlocked Shipper Corp",
          type: "SHIPPER",
          contactEmail: "unlocked@test.com",
          isVerified: false,
          verificationStatus: "PENDING",
          documentsLockedAt: null,
        },
      });

      const session = createMockSession({
        userId: "shipper-unlock-user",
        role: "SHIPPER",
        organizationId: unlockedOrg.id,
      });
      setAuthSession(session);

      const req = createUploadRequest({
        file: mockFile,
        type: "COMPANY_LICENSE",
        entityType: "company",
        entityId: unlockedOrg.id,
      });

      const res = await callHandler(uploadDocument, req);
      // Lock check passed — will not be 423
      expect(res.status).not.toBe(423);
    });
  });

  // ── G-A3-2: Truck documents ────────────────────────────────────────────────

  describe("G-A3-2: truck document upload blocked when truck is locked", () => {
    it("T-LOCK-3: upload to LOCKED truck → 423, error mentions locked", async () => {
      const lockedTruck = await db.truck.create({
        data: {
          id: "locked-truck-doc-test",
          truckType: "DRY_VAN",
          licensePlate: "LOCK-T01",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
          documentsLockedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });

      const session = createMockSession({
        userId: seed.carrierUser.id,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
      });
      setAuthSession(session);

      const req = createUploadRequest({
        file: mockFile,
        type: "REGISTRATION",
        entityType: "truck",
        entityId: lockedTruck.id,
      });

      const res = await callHandler(uploadDocument, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(423);
      expect(body.error).toMatch(/locked/i);
    });

    it("T-LOCK-4: upload to UNLOCKED truck → lock check passes (not 423)", async () => {
      const unlockedTruck = await db.truck.create({
        data: {
          id: "unlocked-truck-doc-test",
          truckType: "FLATBED",
          licensePlate: "LOCK-T02",
          capacity: 15000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
          documentsLockedAt: null,
        },
      });

      const session = createMockSession({
        userId: seed.carrierUser.id,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
      });
      setAuthSession(session);

      const req = createUploadRequest({
        file: mockFile,
        type: "REGISTRATION",
        entityType: "truck",
        entityId: unlockedTruck.id,
      });

      const res = await callHandler(uploadDocument, req);
      // Lock check passed — will not be 423
      expect(res.status).not.toBe(423);
    });
  });
});
