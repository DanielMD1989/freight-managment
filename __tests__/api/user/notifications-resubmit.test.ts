/**
 * Org Resubmit → Admin Notification Tests — Round N1
 *
 * NA-3: Org resubmit → createNotificationForRole called with role=ADMIN
 *
 * Gap: G-N1-2
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
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const status = error?.name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status }
    );
  }),
}));

const { POST: resubmit } = require("@/app/api/user/resubmit/route");

describe("Org Resubmit → Admin Notification (G-N1-2)", () => {
  let createNotificationForRole: jest.Mock;

  beforeAll(() => {
    const notifications = require("@/lib/notifications");
    createNotificationForRole = notifications.createNotificationForRole;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // NA-3: Org resubmit fires admin notification
  it("NA-3: resubmit after rejection → createNotificationForRole called with ADMIN + REGISTRATION_RESUBMITTED", async () => {
    const org = await db.organization.create({
      data: {
        id: "nr-org-1",
        name: "NR Org",
        type: "SHIPPER",
        contactEmail: "nr1@test.com",
        contactPhone: "+251911200001",
        verificationStatus: "REJECTED",
        rejectionReason: "Missing docs",
        rejectedAt: new Date(),
      },
    });

    await db.user.create({
      data: {
        id: "nr-user-1",
        email: "nr1@test.com",
        passwordHash: "hash",
        firstName: "NR",
        lastName: "One",
        phone: "+251911200001",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      },
    });

    setAuthSession(
      createMockSession({
        userId: "nr-user-1",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.verificationStatus).toBe("PENDING");

    expect(createNotificationForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "ADMIN",
        type: "REGISTRATION_RESUBMITTED",
      })
    );
  });

  // Verify notification is NOT called on failed resubmit (non-REJECTED org)
  it("NA-3b: resubmit on PENDING org → 400, no admin notification", async () => {
    const org = await db.organization.create({
      data: {
        id: "nr-org-2",
        name: "NR Pending Org",
        type: "SHIPPER",
        contactEmail: "nr2@test.com",
        contactPhone: "+251911200002",
        verificationStatus: "PENDING",
      },
    });

    await db.user.create({
      data: {
        id: "nr-user-2",
        email: "nr2@test.com",
        passwordHash: "hash",
        firstName: "NR",
        lastName: "Two",
        phone: "+251911200002",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      },
    });

    setAuthSession(
      createMockSession({
        userId: "nr-user-2",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);

    expect(res.status).toBe(400);
    expect(createNotificationForRole).not.toHaveBeenCalled();
  });
});
