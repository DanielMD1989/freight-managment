/**
 * Team Member Removal API Tests — Item 13 / G13-1..G13-3
 *
 * Tests for DELETE /api/organizations/members/[id]
 *
 * Verifies the security-critical fix that previously allowed a removed
 * team member to keep an active session (G13-1):
 *   - revokeAllSessions(memberId) MUST be called
 *   - audit log entry MUST be written (G13-2)
 *   - notification to removed user MUST be fired (G13-3)
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createMockSession,
  createRequest,
  callHandler,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockStorage,
  mockLogger,
  mockNotifications,
} from "../../utils/routeTestUtils";

mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockStorage();
mockLogger();
mockNotifications();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const status =
      error.name === "ForbiddenError"
        ? 403
        : error.name === "UnauthorizedError"
          ? 401
          : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

const {
  DELETE: removeMember,
} = require("@/app/api/organizations/members/[id]/route");

function useOwnerSession() {
  setAuthSession(
    createMockSession({
      userId: "owner-user-1",
      email: "owner@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "team-org-1",
      firstName: "Owner",
      lastName: "User",
    })
  );
}

async function callRemove(memberId: string) {
  const req = createRequest(
    "DELETE",
    `http://localhost:3000/api/organizations/members/${memberId}`
  );
  return callHandler(removeMember, req, { id: memberId });
}

describe("DELETE /api/organizations/members/[id] — Team Member Removal (Item 13)", () => {
  beforeAll(async () => {
    await db.organization.create({
      data: {
        id: "team-org-1",
        name: "Team Org",
        type: "SHIPPER",
        contactEmail: "team@test.com",
      },
    });
    await db.user.create({
      data: {
        id: "owner-user-1",
        email: "owner@test.com",
        passwordHash: "hashed",
        firstName: "Owner",
        lastName: "User",
        phone: "+251911000001",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "team-org-1",
      },
    });
    await db.user.create({
      data: {
        id: "member-user-1",
        email: "member@test.com",
        passwordHash: "hashed",
        firstName: "Member",
        lastName: "User",
        phone: "+251911000002",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "team-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  it("MR-1: removes member by clearing organizationId", async () => {
    useOwnerSession();
    const res = await callRemove("member-user-1");
    expect(res.status).toBe(200);
    const updated = await db.user.findUnique({
      where: { id: "member-user-1" },
    });
    expect(updated?.organizationId).toBeNull();
  });

  it("MR-2 (G13-1): revokeAllSessions is called for the removed member", async () => {
    // Re-attach the member for this test
    await db.user.update({
      where: { id: "member-user-1" },
      data: { organizationId: "team-org-1" },
    });

    const authModule = require("@/lib/auth");
    const revokeSpy = authModule.revokeAllSessions as jest.Mock;
    revokeSpy.mockClear();

    useOwnerSession();
    const res = await callRemove("member-user-1");
    expect(res.status).toBe(200);
    expect(revokeSpy).toHaveBeenCalledWith("member-user-1");
  });

  it("MR-3 (G13-2): writeAuditLog is called with MEMBER_REMOVED action", async () => {
    await db.user.update({
      where: { id: "member-user-1" },
      data: { organizationId: "team-org-1" },
    });

    const auditModule = require("@/lib/auditLog");
    const writeSpy = auditModule.writeAuditLog as jest.Mock;
    writeSpy.mockClear();

    useOwnerSession();
    await callRemove("member-user-1");

    expect(writeSpy).toHaveBeenCalled();
    const call = writeSpy.mock.calls[0][0];
    expect(call.action).toBe("MEMBER_REMOVED");
    expect(call.resourceId).toBe("member-user-1");
    expect(call.userId).toBe("owner-user-1");
  });

  it("MR-4 (G13-3): createNotification is fired to removed user", async () => {
    await db.user.update({
      where: { id: "member-user-1" },
      data: { organizationId: "team-org-1" },
    });

    const notifModule = require("@/lib/notifications");
    const createSpy = notifModule.createNotification as jest.Mock;
    createSpy.mockClear();

    useOwnerSession();
    await callRemove("member-user-1");

    expect(createSpy).toHaveBeenCalled();
    const call = createSpy.mock.calls[0][0];
    expect(call.userId).toBe("member-user-1");
    expect(call.type).toBe("USER_STATUS_CHANGED");
  });

  it("MR-5: cannot self-remove", async () => {
    useOwnerSession();
    const res = await callRemove("owner-user-1");
    expect(res.status).toBe(400);
  });

  it("MR-6: cannot remove member of another organization", async () => {
    await db.organization.create({
      data: {
        id: "other-org-1",
        name: "Other Org",
        type: "SHIPPER",
        contactEmail: "other@test.com",
      },
    });
    await db.user.create({
      data: {
        id: "other-member-1",
        email: "other-member@test.com",
        passwordHash: "hashed",
        firstName: "Other",
        lastName: "Member",
        phone: "+251911000099",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "other-org-1",
      },
    });
    useOwnerSession();
    const res = await callRemove("other-member-1");
    expect(res.status).toBe(403);
  });
});
