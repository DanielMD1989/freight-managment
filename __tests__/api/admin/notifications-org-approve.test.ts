/**
 * Org Approval → User Notification Tests — Round N1
 *
 * NA-5: Admin approves org → createNotification called with type ACCOUNT_APPROVED
 *       for all active org members
 *
 * Gap: G-N1-6, G-N1-7
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

const {
  POST: verifyOrg,
} = require("@/app/api/admin/organizations/[id]/verify/route");

function callVerify(orgId: string) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/admin/organizations/${orgId}/verify`
  );
  return verifyOrg(req, { params: Promise.resolve({ id: orgId }) });
}

describe("Admin Org Approval → ACCOUNT_APPROVED Notification (G-N1-6)", () => {
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

  // NA-5: Approval sends ACCOUNT_APPROVED to active org members
  it("NA-5: org approval → createNotification called with type=ACCOUNT_APPROVED for each active member", async () => {
    const org = await db.organization.create({
      data: {
        id: "noa-org-1",
        name: "NOA Org",
        type: "CARRIER",
        contactEmail: "noa1@test.com",
        contactPhone: "+251911400001",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    // Two active members + one pending (should also get notification after activation)
    await db.user.create({
      data: {
        id: "noa-user-1a",
        email: "noa1a@test.com",
        passwordHash: "hash",
        firstName: "NOA",
        lastName: "A",
        phone: "+251911400002",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });

    await db.user.create({
      data: {
        id: "noa-user-1b",
        email: "noa1b@test.com",
        passwordHash: "hash",
        firstName: "NOA",
        lastName: "B",
        phone: "+251911400003",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });

    setAuthSession(
      createMockSession({
        userId: "admin-noa-1",
        role: "ADMIN",
        status: "ACTIVE",
      })
    );

    const res = await callVerify(org.id);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.verificationStatus).toBe("APPROVED");

    // createNotification must have been called with ACCOUNT_APPROVED
    const calls = createNotification.mock.calls;
    const approvedCalls = calls.filter(
      ([args]: [any]) => args.type === "ACCOUNT_APPROVED"
    );
    expect(approvedCalls.length).toBeGreaterThanOrEqual(1);
    expect(approvedCalls[0][0]).toMatchObject({
      type: "ACCOUNT_APPROVED",
      title: "Registration Approved",
    });
  });

  // NA-5b: Already-verified org → 400, no notification
  it("NA-5b: already verified org → 400, no ACCOUNT_APPROVED notification", async () => {
    const org = await db.organization.create({
      data: {
        id: "noa-org-2",
        name: "NOA Already Verified",
        type: "CARRIER",
        contactEmail: "noa2@test.com",
        contactPhone: "+251911400004",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "admin-noa-2",
        role: "ADMIN",
        status: "ACTIVE",
      })
    );

    const res = await callVerify(org.id);
    expect(res.status).toBe(400);

    const calls = createNotification.mock.calls;
    const approvedCalls = calls.filter(
      ([args]: [any]) => args.type === "ACCOUNT_APPROVED"
    );
    expect(approvedCalls.length).toBe(0);
  });
});
