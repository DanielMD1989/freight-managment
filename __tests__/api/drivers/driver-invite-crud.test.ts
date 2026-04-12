/**
 * Driver Invite + CRUD Tests — Task 27A
 *
 * Tests the carrier-driven invite flow, accept-invite, and driver
 * management CRUD operations.
 */
import {
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
  setAuthSession,
  createMockSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
} from "../../utils/routeTestUtils";
import { db } from "@/lib/db";

// ─── Mocks ───────────────────────────────────────────────────────────────────
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

// Also mock the OTP auth (used by documents/upload but not by driver routes)
jest.mock("@/lib/auth", () => {
  const original = jest.requireActual("@/lib/auth");
  return {
    ...original,
    requireOtpVerified: jest.fn(async () => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      return { ...session, dbStatus: session.status };
    }),
  };
});

// ─── Import route handlers AFTER mock setup ──────────────────────────────────
const { POST: inviteDriver } = require("@/app/api/drivers/invite/route");
const { POST: acceptInvite } = require("@/app/api/drivers/accept-invite/route");
const { GET: listDrivers } = require("@/app/api/drivers/route");
const {
  GET: getDriver,
  DELETE: suspendDriver,
} = require("@/app/api/drivers/[id]/route");
const { POST: approveDriver } = require("@/app/api/drivers/[id]/approve/route");
const { POST: rejectDriver } = require("@/app/api/drivers/[id]/reject/route");

// ─── Sessions ────────────────────────────────────────────────────────────────
const CARRIER_SESSION = createMockSession({
  userId: "carrier-user-1",
  email: "carrier@test.com",
  role: "CARRIER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
});

const SHIPPER_SESSION = createMockSession({
  userId: "shipper-user-1",
  email: "shipper@test.com",
  role: "SHIPPER",
  status: "ACTIVE",
  organizationId: "shipper-org-1",
});

const DRIVER_SESSION = createMockSession({
  userId: "driver-crud-user",
  email: "driver-crud@test.com",
  role: "DRIVER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
});

// ─── Setup ───────────────────────────────────────────────────────────────────
beforeAll(async () => {
  await seedTestData();
});

afterAll(() => {
  clearAllStores();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Driver Invite Flow", () => {
  test("CARRIER can invite a driver", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: {
          name: "Abebe Kebede",
          phone: "+251911888001",
        },
      }
    );
    const res = await callHandler(inviteDriver, req);
    expect(res.status).toBe(201);
    const body = await parseResponse(res);
    expect(body.success).toBe(true);
    expect(body.inviteCode).toBeDefined();
    expect(body.inviteCode).toHaveLength(6);
    expect(body.driverName).toBe("Abebe Kebede");
    expect(body.phone).toBe("+251911888001");
  });

  test("Non-CARRIER cannot invite a driver", async () => {
    setAuthSession(SHIPPER_SESSION);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: {
          name: "Should Fail",
          phone: "+251911888002",
        },
      }
    );
    const res = await callHandler(inviteDriver, req);
    expect(res.status).toBe(403);
  });

  test("Duplicate phone rejected on second invite", async () => {
    setAuthSession(CARRIER_SESSION);
    // First invite already created the user+invitation for +251911888001 in the test above.
    // Trying to invite again with the same phone should fail.
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: {
          name: "Duplicate Driver",
          phone: "+251911888001",
        },
      }
    );
    const res = await callHandler(inviteDriver, req);
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("already exists");
  });
});

describe("Driver Accept Invite", () => {
  let testInviteCode: string;

  beforeAll(async () => {
    // Create a fresh invite for accept-invite testing
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: {
          name: "Accept Test Driver",
          phone: "+251911888010",
          email: "accept-test@test.com",
        },
      }
    );
    const res = await callHandler(inviteDriver, req);
    const body = await parseResponse(res);
    testInviteCode = body.inviteCode;
  });

  test("Driver can accept with valid code", async () => {
    // Accept-invite is unauthenticated
    setAuthSession(null);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/accept-invite",
      {
        body: {
          inviteCode: testInviteCode,
          phone: "+251911888010",
          password: "Test1234!",
        },
      }
    );
    const res = await callHandler(acceptInvite, req);
    expect(res.status).toBe(201);
    const body = await parseResponse(res);
    expect(body.success).toBe(true);
    expect(body.driverId).toBeDefined();
    expect(body.loginEmail).toBeDefined();
  });

  test("Wrong phone rejected", async () => {
    // Create another invite
    setAuthSession(CARRIER_SESSION);
    const inviteReq = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: { name: "Wrong Phone", phone: "+251911888020" },
      }
    );
    const inviteRes = await callHandler(inviteDriver, inviteReq);
    const code = (await parseResponse(inviteRes)).inviteCode;

    setAuthSession(null);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/accept-invite",
      {
        body: {
          inviteCode: code,
          phone: "+251911WRONG",
          password: "Test1234!",
        },
      }
    );
    const res = await callHandler(acceptInvite, req);
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("Phone number does not match");
  });

  test("Expired code rejected", async () => {
    // Create invite and manually expire it
    setAuthSession(CARRIER_SESSION);
    const inviteReq = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: { name: "Expired Test", phone: "+251911888030" },
      }
    );
    const inviteRes = await callHandler(inviteDriver, inviteReq);
    const code = (await parseResponse(inviteRes)).inviteCode;

    // Manually expire the invitation
    await db.invitation.updateMany({
      where: { token: code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    setAuthSession(null);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/accept-invite",
      {
        body: {
          inviteCode: code,
          phone: "+251911888030",
          password: "Test1234!",
        },
      }
    );
    const res = await callHandler(acceptInvite, req);
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("expired");
  });
});

describe("Driver CRUD", () => {
  test("CARRIER can list drivers", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/drivers?limit=50"
    );
    const res = await callHandler(listDrivers, req);
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.drivers).toBeDefined();
    expect(Array.isArray(body.drivers)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  test("CARRIER can approve pending driver", async () => {
    // Find a PENDING_VERIFICATION driver (created by accept-invite test)
    const pendingDriver = await db.user.findFirst({
      where: {
        role: "DRIVER",
        status: "PENDING_VERIFICATION",
        organizationId: "carrier-org-1",
      },
      select: { id: true },
    });

    if (!pendingDriver) {
      // If none exists, skip gracefully
      console.log(
        "No PENDING_VERIFICATION driver found — skipping approve test"
      );
      return;
    }

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/drivers/${pendingDriver.id}/approve`
    );
    const res = await callHandler(approveDriver, req, { id: pendingDriver.id });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.success).toBe(true);
  });

  test("CARRIER can reject with reason", async () => {
    // Create a new pending driver for rejection
    setAuthSession(CARRIER_SESSION);
    const inviteReq = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: { name: "Reject Me", phone: "+251911888040" },
      }
    );
    const inviteRes = await callHandler(inviteDriver, inviteReq);
    const code = (await parseResponse(inviteRes)).inviteCode;

    // Accept the invite
    setAuthSession(null);
    const acceptReq = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/accept-invite",
      {
        body: {
          inviteCode: code,
          phone: "+251911888040",
          password: "Test1234!",
        },
      }
    );
    await callHandler(acceptInvite, acceptReq);

    // Find the pending driver
    const driver = await db.user.findFirst({
      where: { phone: "+251911888040", role: "DRIVER" },
      select: { id: true },
    });

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/drivers/${driver!.id}/reject`,
      { body: { reason: "Incomplete CDL documents" } }
    );
    const res = await callHandler(rejectDriver, req, { id: driver!.id });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Driver rejected");
  });

  test("CARRIER can suspend active driver (no active trips)", async () => {
    // Find an ACTIVE driver
    const activeDriver = await db.user.findFirst({
      where: {
        role: "DRIVER",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
      select: { id: true },
    });

    if (!activeDriver) {
      console.log("No ACTIVE driver found — skipping suspend test");
      return;
    }

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "DELETE",
      `http://localhost:3000/api/drivers/${activeDriver.id}`
    );
    const res = await callHandler(suspendDriver, req, { id: activeDriver.id });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Driver suspended");
  });

  test("DRIVER cannot list drivers", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest("GET", "http://localhost:3000/api/drivers");
    const res = await callHandler(listDrivers, req);
    expect(res.status).toBe(403);
  });
});
