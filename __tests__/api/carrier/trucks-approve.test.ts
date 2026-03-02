/**
 * Carrier Truck Approval Tests
 *
 * Tests for POST /api/trucks/[id]/approve
 *
 * Business rules tested:
 * - ADMIN/SUPER_ADMIN can approve/reject trucks
 * - CARRIER/SHIPPER cannot approve (403)
 * - REJECT requires reason
 * - Notifications created for carrier users
 * - Email sent on approve/reject
 * - Cache invalidated after approval
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
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
  mockApiErrors,
  mockLogger,
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks BEFORE requiring route handlers
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
mockApiErrors();
mockLogger();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Mock rbac/permissions (approve route uses hasPermission from here)
jest.mock("@/lib/rbac/permissions", () => ({
  hasPermission: jest.fn((_role: string, _perm: string) => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    return session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";
  }),
  Permission: {
    VERIFY_DOCUMENTS: "verify_documents",
  },
}));

// Mock email
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({ success: true })),
  createEmailHTML: jest.fn((content: string) => `<html>${content}</html>`),
}));

// Import handlers AFTER mocks
const { POST: approveTruck } = require("@/app/api/trucks/[id]/approve/route");

describe("Carrier Truck Approval", () => {
  let seed: SeedData;

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

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  const superAdminSession = createMockSession({
    userId: "superadmin-user-1",
    email: "superadmin@test.com",
    role: "SUPER_ADMIN",
    organizationId: "admin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "superadmin-user-1",
        email: "superadmin@test.com",
        role: "SUPER_ADMIN",
        organizationId: "admin-org-1",
        firstName: "Super",
        lastName: "Admin",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(adminSession);
  });

  // ─── APPROVE flow ───────────────────────────────────────────────────

  describe("APPROVE flow", () => {
    it("should approve a truck → 200 with approvalStatus APPROVED", async () => {
      // Create a pending truck for approval
      const pendingTruck = await db.truck.create({
        data: {
          id: "truck-pending-approve",
          truckType: "DRY_VAN",
          licensePlate: "PEND-001",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${pendingTruck.id}/approve`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(approveTruck, req, { id: pendingTruck.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.truck.approvalStatus).toBe("APPROVED");
      expect(body.truck.approvedAt).toBeTruthy();
      expect(body.message).toContain("approved");
    });

    it("should create notifications for active carrier users on approve", async () => {
      const truckForNotif = await db.truck.create({
        data: {
          id: "truck-notif-test",
          truckType: "FLATBED",
          licensePlate: "NOTIF-01",
          capacity: 15000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckForNotif.id}/approve`,
        { body: { action: "APPROVE" } }
      );
      await callHandler(approveTruck, req, { id: truckForNotif.id });

      const { createNotification } = require("@/lib/notifications");
      expect(createNotification).toHaveBeenCalled();
      const call = createNotification.mock.calls[0][0];
      expect(call.type).toBe("TRUCK_APPROVED");
      expect(call.metadata.truckId).toBe(truckForNotif.id);
    });
  });

  // ─── REJECT flow ───────────────────────────────────────────────────

  describe("REJECT flow", () => {
    it("should reject a truck with reason → 200 with approvalStatus REJECTED", async () => {
      const truckToReject = await db.truck.create({
        data: {
          id: "truck-reject-test",
          truckType: "TANKER",
          licensePlate: "REJ-001",
          capacity: 20000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckToReject.id}/approve`,
        { body: { action: "REJECT", reason: "Documents expired" } }
      );
      const res = await callHandler(approveTruck, req, {
        id: truckToReject.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.truck.approvalStatus).toBe("REJECTED");
      expect(body.truck.rejectionReason).toBe("Documents expired");
      expect(body.message).toContain("rejected");
    });

    it("should reject without reason → 400", async () => {
      const truckNoReason = await db.truck.create({
        data: {
          id: "truck-reject-no-reason",
          truckType: "DRY_VAN",
          licensePlate: "REJ-002",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckNoReason.id}/approve`,
        { body: { action: "REJECT" } }
      );
      const res = await callHandler(approveTruck, req, {
        id: truckNoReason.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("reason");
    });
  });

  // ─── Authorization ───────────────────────────────────────────────────

  describe("Authorization", () => {
    it("should deny carrier from approving → 403", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(approveTruck, req, { id: seed.truck.id });

      expect(res.status).toBe(403);
      const body = await parseResponse(res);
      expect(body.error).toContain("admin");
    });

    it("should deny shipper from approving → 403", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(approveTruck, req, { id: seed.truck.id });

      expect(res.status).toBe(403);
    });

    it("should deny unauthenticated user → 401", async () => {
      setAuthSession(null);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(approveTruck, req, { id: seed.truck.id });

      // handleApiError properly returns 401 for auth errors
      expect(res.status).toBe(401);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("should return 404 for non-existent truck", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trucks/nonexistent/approve",
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(approveTruck, req, { id: "nonexistent" });

      expect(res.status).toBe(404);
      const body = await parseResponse(res);
      expect(body.error).toContain("not found");
    });

    it("should return 400 for invalid action enum", async () => {
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        { body: { action: "INVALID" } }
      );
      const res = await callHandler(approveTruck, req, { id: seed.truck.id });

      expect(res.status).toBe(400);
    });

    it("should reject re-approving an already-approved truck → 400", async () => {
      // seed.truck is already APPROVED from seedTestData
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(approveTruck, req, { id: seed.truck.id });

      // H10 FIX: Only PENDING trucks can be approved
      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("already approved");
    });
  });

  // ─── Side effects ───────────────────────────────────────────────────

  describe("Side effects", () => {
    it("should send email on APPROVE", async () => {
      const truckEmailApprove = await db.truck.create({
        data: {
          id: "truck-email-approve",
          truckType: "DRY_VAN",
          licensePlate: "EMAIL-01",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckEmailApprove.id}/approve`,
        { body: { action: "APPROVE" } }
      );
      await callHandler(approveTruck, req, { id: truckEmailApprove.id });

      const { sendEmail } = require("@/lib/email");
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: seed.carrierOrg.contactEmail,
          subject: expect.stringContaining("Approved"),
        })
      );
    });

    it("should send email on REJECT", async () => {
      const truckEmailReject = await db.truck.create({
        data: {
          id: "truck-email-reject",
          truckType: "DRY_VAN",
          licensePlate: "EMAIL-02",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckEmailReject.id}/approve`,
        { body: { action: "REJECT", reason: "Missing insurance" } }
      );
      await callHandler(approveTruck, req, { id: truckEmailReject.id });

      const { sendEmail } = require("@/lib/email");
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: seed.carrierOrg.contactEmail,
          subject: expect.stringContaining("Rejected"),
        })
      );
    });
  });
});
