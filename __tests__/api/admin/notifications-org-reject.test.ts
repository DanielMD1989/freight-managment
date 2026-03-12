/**
 * Org Rejection → User Notification Tests — Round N1
 *
 * NA-6: Admin rejects org → createNotification called with type ACCOUNT_FLAGGED
 *       and reason in message, for all org users
 *
 * Gap: G-N1-9
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createMockSession,
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
  mockLogger,
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
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeRejectionReason: jest.fn((r: string) => r),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

const {
  POST: rejectOrg,
} = require("@/app/api/admin/organizations/[id]/reject/route");

function callReject(orgId: string, reason: string) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/admin/organizations/${orgId}/reject`,
    { body: { reason } }
  );
  return rejectOrg(req, { params: Promise.resolve({ id: orgId }) });
}

describe("Admin Org Rejection → ACCOUNT_FLAGGED Notification (G-N1-9)", () => {
  let createNotification: jest.Mock;

  beforeAll(() => {
    const notifications = require("@/lib/notifications");
    createNotification = notifications.createNotification;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // NA-6: Rejection sends ACCOUNT_FLAGGED with reason to all org users
  it("NA-6: org rejection → createNotification called with type=ACCOUNT_FLAGGED and reason in message", async () => {
    const org = await db.organization.create({
      data: {
        id: "nor-org-1",
        name: "NOR Org",
        type: "SHIPPER",
        contactEmail: "nor1@test.com",
        contactPhone: "+251911500001",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    await db.user.create({
      data: {
        id: "nor-user-1",
        email: "nor1@test.com",
        passwordHash: "hash",
        firstName: "NOR",
        lastName: "User",
        phone: "+251911500001",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      },
    });

    setAuthSession(
      createMockSession({
        userId: "admin-nor-1",
        role: "ADMIN",
        status: "ACTIVE",
      })
    );

    const reason = "Documents are incomplete and not legible";
    const res = await callReject(org.id, reason);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.verificationStatus).toBe("REJECTED");
    expect(body.organization.rejectionReason).toBe(reason);

    // createNotification must be called with ACCOUNT_FLAGGED
    const flaggedCalls = createNotification.mock.calls.filter(
      ([args]: [any]) => args.type === "ACCOUNT_FLAGGED"
    );
    expect(flaggedCalls.length).toBeGreaterThanOrEqual(1);
    expect(flaggedCalls[0][0]).toMatchObject({
      type: "ACCOUNT_FLAGGED",
      title: "Registration Rejected",
      message: expect.stringContaining(reason),
    });
  });

  // NA-6b: Non-admin cannot reject
  it("NA-6b: carrier cannot reject an org → 403, no notification", async () => {
    const org = await db.organization.create({
      data: {
        id: "nor-org-2",
        name: "NOR Org 2",
        type: "SHIPPER",
        contactEmail: "nor2@test.com",
        contactPhone: "+251911500002",
        verificationStatus: "PENDING",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "carrier-nor-1",
        role: "CARRIER",
        status: "ACTIVE",
      })
    );

    const res = await callReject(org.id, "Invalid documents submitted here");
    expect(res.status).toBe(403);
    expect(createNotification).not.toHaveBeenCalled();
  });

  // G-M13-5: Org rejection unposts active loads
  it("G-M13-5: rejecting org → POSTED loads become UNPOSTED", async () => {
    const org = await db.organization.create({
      data: {
        id: "nor-org-m13",
        name: "NOR Org M13",
        type: "SHIPPER",
        contactEmail: "norm13@test.com",
        contactPhone: "+251911500013",
        verificationStatus: "PENDING",
      },
    });

    // Create a user for the org
    await db.user.create({
      data: {
        id: "nor-user-m13",
        email: "norm13user@test.com",
        firstName: "M13",
        lastName: "User",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });

    // Create a POSTED load for this org
    await db.load.create({
      data: {
        id: "load-m13-reject-test",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Load for org reject cleanup test",
        shipperId: org.id,
        createdById: "nor-user-m13",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "admin-nor-m13",
        role: "ADMIN",
        status: "ACTIVE",
      })
    );

    const res = await callReject(org.id, "Failed compliance check");
    expect(res.status).toBe(200);

    // Verify load was unposted
    const load = await db.load.findUnique({
      where: { id: "load-m13-reject-test" },
    });
    expect(load?.status).toBe("UNPOSTED");
  });
});
