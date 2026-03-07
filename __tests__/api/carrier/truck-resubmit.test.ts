/**
 * Carrier Truck Resubmit Tests (G-A2-2)
 *
 * Tests for POST /api/trucks/[id]/resubmit
 *
 * Business rules:
 * - Only the carrier that owns the truck can resubmit
 * - Only REJECTED trucks can be resubmitted
 * - After resubmit, approvalStatus=PENDING (admin can approve again)
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

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const status =
      error?.name === "ForbiddenError"
        ? 403
        : error?.name === "UnauthorizedError"
          ? 401
          : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

// Import handler AFTER mocks
const { POST: resubmitTruck } = require("@/app/api/trucks/[id]/resubmit/route");

describe("Carrier Truck Resubmit (G-A2-2)", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org",
  });

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-99",
    email: "dispatcher99@test.com",
    role: "DISPATCHER",
    organizationId: "carrier-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // T-TR-1: Carrier owns REJECTED truck → 200, approvalStatus=PENDING
  it("T-TR-1: carrier owns REJECTED truck → 200, approvalStatus=PENDING, rejectionReason=null", async () => {
    const rejectedTruck = await db.truck.create({
      data: {
        id: "truck-rejected-for-resubmit",
        truckType: "DRY_VAN",
        licensePlate: "RESUB-001",
        capacity: 10000,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "REJECTED",
        rejectionReason: "Documents expired",
        rejectedAt: new Date(),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${rejectedTruck.id}/resubmit`
    );
    const res = await callHandler(resubmitTruck, req, { id: rejectedTruck.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.truck.approvalStatus).toBe("PENDING");
    expect(body.message).toContain("resubmitted");

    // Verify DB state
    const updated = await db.truck.findUnique({
      where: { id: rejectedTruck.id },
    });
    expect(updated.approvalStatus).toBe("PENDING");
    expect(updated.rejectionReason).toBeNull();
    expect(updated.rejectedAt).toBeNull();
  });

  // T-TR-2: Carrier owns PENDING truck → 400 (not in rejected state)
  it("T-TR-2: carrier owns PENDING truck → 400 (not in rejected state)", async () => {
    const pendingTruck = await db.truck.create({
      data: {
        id: "truck-pending-for-resubmit",
        truckType: "FLATBED",
        licensePlate: "RESUB-002",
        capacity: 15000,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${pendingTruck.id}/resubmit`
    );
    const res = await callHandler(resubmitTruck, req, { id: pendingTruck.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("rejected state");
  });

  // T-TR-3: Carrier owns APPROVED truck → 400
  it("T-TR-3: carrier owns APPROVED truck → 400", async () => {
    const approvedTruck = await db.truck.create({
      data: {
        id: "truck-approved-for-resubmit",
        truckType: "TANKER",
        licensePlate: "RESUB-003",
        capacity: 20000,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${approvedTruck.id}/resubmit`
    );
    const res = await callHandler(resubmitTruck, req, {
      id: approvedTruck.id,
    });

    expect(res.status).toBe(400);
  });

  // T-TR-4: Carrier does NOT own the truck → 403
  it("T-TR-4: carrier does not own truck → 403", async () => {
    setAuthSession(otherCarrierSession);

    const rejectedTruck2 = await db.truck.create({
      data: {
        id: "truck-other-carrier-rejected",
        truckType: "DRY_VAN",
        licensePlate: "RESUB-004",
        capacity: 10000,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "REJECTED",
        rejectionReason: "Some reason for rejection",
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${rejectedTruck2.id}/resubmit`
    );
    const res = await callHandler(resubmitTruck, req, {
      id: rejectedTruck2.id,
    });

    expect(res.status).toBe(403);
  });

  // T-TR-5: DISPATCHER (wrong role) → 403
  it("T-TR-5: DISPATCHER cannot resubmit → 403", async () => {
    setAuthSession(dispatcherSession);

    const rejectedTruck3 = await db.truck.create({
      data: {
        id: "truck-dispatcher-resubmit",
        truckType: "DRY_VAN",
        licensePlate: "RESUB-005",
        capacity: 10000,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "REJECTED",
        rejectionReason: "Some reason for rejection",
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${rejectedTruck3.id}/resubmit`
    );
    const res = await callHandler(resubmitTruck, req, {
      id: rejectedTruck3.id,
    });

    expect(res.status).toBe(403);
  });

  // T-TR-6: Truck not found → 404
  it("T-TR-6: truck not found → 404", async () => {
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/trucks/nonexistent-truck/resubmit"
    );
    const res = await callHandler(resubmitTruck, req, {
      id: "nonexistent-truck",
    });

    expect(res.status).toBe(404);
  });

  // T-TR-7: Unauthenticated → 401
  it("T-TR-7: unauthenticated → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${seed.truck.id}/resubmit`
    );
    const res = await callHandler(resubmitTruck, req, { id: seed.truck.id });

    expect(res.status).toBe(401);
  });

  // T-TR-8: After resubmit, approvalStatus=PENDING → admin approve unblocked (H10 guard passes)
  it("T-TR-8: after resubmit, truck is PENDING and admin can approve again", async () => {
    setAuthSession(carrierSession);

    const truckToResubmit = await db.truck.create({
      data: {
        id: "truck-resubmit-then-approve",
        truckType: "DRY_VAN",
        licensePlate: "RESUB-008",
        capacity: 10000,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "REJECTED",
        rejectionReason: "Documents need renewal",
      },
    });

    // Resubmit
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${truckToResubmit.id}/resubmit`
    );
    await callHandler(resubmitTruck, req, { id: truckToResubmit.id });

    // Verify DB shows PENDING (i.e., admin approve endpoint's H10 guard would pass)
    const after = await db.truck.findUnique({
      where: { id: truckToResubmit.id },
    });
    expect(after.approvalStatus).toBe("PENDING");
  });
});
