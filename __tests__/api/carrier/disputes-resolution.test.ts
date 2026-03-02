/**
 * Dispute Resolution Tests
 *
 * Tests for PATCH /api/disputes/[id] — admin dispute resolution
 *
 * Business rules tested:
 * - Only admin/ops can update disputes (requirePermission MANAGE_DISPUTES)
 * - Status transitions: OPEN→UNDER_REVIEW→RESOLVED→CLOSED
 * - resolvedAt auto-set when RESOLVED or CLOSED
 * - resolution and resolutionNotes fields
 * - Carrier cannot update disputes
 * - Dispute not found → 404
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

// Mock rbac — requirePermission must check for admin role
jest.mock("@/lib/rbac", () => ({
  requirePermission: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      throw new Error("Permission denied: MANAGE_DISPUTES required");
    }
    return session;
  }),
  Permission: {
    MANAGE_DISPUTES: "manage_disputes",
  },
}));

// Import handler AFTER mocks
const { PATCH: updateDispute } = require("@/app/api/disputes/[id]/route");

describe("Dispute Resolution (PATCH)", () => {
  let seed: SeedData;
  let disputeId: string;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
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

    // Assign truck to load for dispute creation
    await db.load.update({
      where: { id: seed.load.id },
      data: {
        status: "DELIVERED",
        assignedTruckId: seed.truck.id,
      },
    });

    // Create a dispute for testing
    const dispute = await db.dispute.create({
      data: {
        id: "dispute-resolution-001",
        loadId: seed.load.id,
        createdById: seed.carrierUser.id,
        disputedOrgId: seed.shipperOrg.id,
        type: "DAMAGE",
        description: "Cargo was damaged during transport",
        status: "OPEN",
      },
    });

    disputeId = dispute.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(adminSession);
  });

  // ─── Status updates ───────────────────────────────────────────────

  describe("Status updates", () => {
    it("should update OPEN → UNDER_REVIEW → 200", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { status: "UNDER_REVIEW" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.dispute.status).toBe("UNDER_REVIEW");
      expect(body.message).toContain("updated");
    });

    it("should update UNDER_REVIEW → RESOLVED with resolvedAt → 200", async () => {
      // Set status to UNDER_REVIEW first
      await db.dispute.update({
        where: { id: disputeId },
        data: { status: "UNDER_REVIEW" },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        {
          body: {
            status: "RESOLVED",
            resolution: "Carrier compensated",
            resolutionNotes: "Full refund issued",
          },
        }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.dispute.status).toBe("RESOLVED");
      expect(body.dispute.resolvedAt).toBeTruthy();
      expect(body.dispute.resolution).toBe("Carrier compensated");
    });

    it("should update RESOLVED → CLOSED with resolvedAt → 200", async () => {
      // Set status to RESOLVED first
      await db.dispute.update({
        where: { id: disputeId },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { status: "CLOSED" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.dispute.status).toBe("CLOSED");
      expect(body.dispute.resolvedAt).toBeTruthy();
    });

    it("should update with resolution notes only → 200", async () => {
      // Reset to OPEN
      await db.dispute.update({
        where: { id: disputeId },
        data: { status: "OPEN", resolvedAt: null },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { resolution: "Investigation ongoing" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.dispute.resolution).toBe("Investigation ongoing");
    });
  });

  // ─── Authorization ───────────────────────────────────────────────

  describe("Authorization", () => {
    it("should deny carrier from updating dispute → 403", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { status: "UNDER_REVIEW" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });

      expect(res.status).toBe(403);
    });

    it("should deny unauthenticated user → 401", async () => {
      setAuthSession(null);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { status: "UNDER_REVIEW" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });

      expect(res.status).toBe(401);
    });
  });

  // ─── Validation ───────────────────────────────────────────────

  describe("Validation", () => {
    it("should return 400 for invalid status value", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { status: "INVALID_STATUS" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent dispute", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/disputes/nonexistent",
        { body: { status: "UNDER_REVIEW" } }
      );
      const res = await callHandler(updateDispute, req, {
        id: "nonexistent",
      });

      expect(res.status).toBe(404);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────

  describe("Edge cases", () => {
    it("should reject OPEN → OPEN (same-state transition) → 400", async () => {
      // Reset to OPEN
      await db.dispute.update({
        where: { id: disputeId },
        data: { status: "OPEN", resolvedAt: null },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/disputes/${disputeId}`,
        { body: { status: "OPEN" } }
      );
      const res = await callHandler(updateDispute, req, { id: disputeId });
      const body = await parseResponse(res);

      // H19 FIX: OPEN → OPEN is not a valid transition
      expect(res.status).toBe(400);
      expect(body.error).toContain("Cannot transition");
    });
  });
});
