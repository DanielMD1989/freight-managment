/**
 * Document Lock UI Exposure Tests (Round U6)
 *
 * T1: GET /api/user/verification-status includes documentsLockedAt when org is locked
 * T2: GET /api/user/verification-status returns documentsLockedAt: null when not locked
 * T3: GET /api/trucks/[id] includes documentsLockedAt in response
 * T4: GET /api/trucks/[id] returns documentsLockedAt: null for unapproved truck
 */

// @jest-environment node

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
  mockRbac,
  mockApiErrors,
  mockLogger,
  createMockSession,
} from "../../utils/routeTestUtils";

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

const {
  GET: getVerificationStatus,
} = require("@/app/api/user/verification-status/route");

const { GET: getTruck } = require("@/app/api/trucks/[id]/route");

describe("Document Lock UI Exposure (Round U6)", () => {
  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // ─── Verification Status ──────────────────────────────────────────────────

  describe("GET /api/user/verification-status", () => {
    it("T1: returns documentsLockedAt when org is locked (approved)", async () => {
      const lockedAt = new Date("2026-03-01T00:00:00.000Z");

      await db.organization.create({
        data: {
          id: "dlu-org-locked",
          name: "Locked Org",
          type: "CARRIER",
          contactEmail: "locked@test.com",
          contactPhone: "+251911000201",
          isVerified: true,
          verifiedAt: lockedAt,
          documentsLockedAt: lockedAt,
        },
      });

      await db.user.create({
        data: {
          id: "dlu-user-locked",
          email: "locked@test.com",
          passwordHash: "hash",
          firstName: "Locked",
          lastName: "User",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "dlu-org-locked",
        },
      });

      setAuthSession(
        createMockSession({
          userId: "dlu-user-locked",
          email: "locked@test.com",
          role: "CARRIER",
          organizationId: "dlu-org-locked",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/user/verification-status"
      );
      const res = await getVerificationStatus(req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.organization).toBeDefined();
      expect(body.organization.documentsLockedAt).toBe(lockedAt.toISOString());
    });

    it("T2: returns documentsLockedAt: null when org is not locked", async () => {
      await db.organization.create({
        data: {
          id: "dlu-org-unlocked",
          name: "Unlocked Org",
          type: "CARRIER",
          contactEmail: "unlocked@test.com",
          contactPhone: "+251911000202",
          isVerified: false,
          documentsLockedAt: null,
        },
      });

      await db.user.create({
        data: {
          id: "dlu-user-unlocked",
          email: "unlocked@test.com",
          passwordHash: "hash",
          firstName: "Unlocked",
          lastName: "User",
          role: "CARRIER",
          status: "PENDING_VERIFICATION",
          organizationId: "dlu-org-unlocked",
        },
      });

      setAuthSession(
        createMockSession({
          userId: "dlu-user-unlocked",
          email: "unlocked@test.com",
          role: "CARRIER",
          organizationId: "dlu-org-unlocked",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/user/verification-status"
      );
      const res = await getVerificationStatus(req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.organization).toBeDefined();
      expect(body.organization.documentsLockedAt).toBeNull();
    });
  });

  // ─── Truck GET ────────────────────────────────────────────────────────────

  describe("GET /api/trucks/[id]", () => {
    it("T3: returns documentsLockedAt when truck is approved (locked)", async () => {
      const lockedAt = new Date("2026-03-02T00:00:00.000Z");

      await db.organization.create({
        data: {
          id: "dlu-carrier-org-1",
          name: "Truck Carrier",
          type: "CARRIER",
          contactEmail: "truckcarrier@test.com",
          contactPhone: "+251911000203",
        },
      });

      await db.user.create({
        data: {
          id: "dlu-carrier-user-1",
          email: "truckcarrier@test.com",
          passwordHash: "hash",
          firstName: "Truck",
          lastName: "Carrier",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "dlu-carrier-org-1",
        },
      });

      await db.truck.create({
        data: {
          id: "dlu-truck-locked",
          licensePlate: "DLU-001",
          truckType: "FLATBED",
          capacity: 10000,
          carrierId: "dlu-carrier-org-1",
          approvalStatus: "APPROVED",
          documentsLockedAt: lockedAt,
        },
      });

      setAuthSession(
        createMockSession({
          userId: "dlu-carrier-user-1",
          email: "truckcarrier@test.com",
          role: "CARRIER",
          organizationId: "dlu-carrier-org-1",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/dlu-truck-locked"
      );
      const res = await getTruck(req, {
        params: Promise.resolve({ id: "dlu-truck-locked" }),
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.documentsLockedAt).toBe(lockedAt.toISOString());
    });

    it("T4: returns documentsLockedAt: null for unapproved truck", async () => {
      await db.truck.create({
        data: {
          id: "dlu-truck-unlocked",
          licensePlate: "DLU-002",
          truckType: "DRY_VAN",
          capacity: 8000,
          carrierId: "dlu-carrier-org-1",
          approvalStatus: "PENDING",
          documentsLockedAt: null,
        },
      });

      // carrier session already seeded above
      setAuthSession(
        createMockSession({
          userId: "dlu-carrier-user-1",
          email: "truckcarrier@test.com",
          role: "CARRIER",
          organizationId: "dlu-carrier-org-1",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/dlu-truck-unlocked"
      );
      const res = await getTruck(req, {
        params: Promise.resolve({ id: "dlu-truck-unlocked" }),
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.documentsLockedAt).toBeNull();
    });
  });
});
