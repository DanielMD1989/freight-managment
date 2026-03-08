/**
 * Admin Truck Approval → Carrier Notification Tests — Round N1
 *
 * NA-7: Admin approves truck → createNotification called with type TRUCK_APPROVED
 * NA-8: Admin rejects truck → createNotification called with type TRUCK_REJECTED + reason
 *
 * Gaps: G-N1-4, G-N1-5
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
  mockApiErrors,
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
mockApiErrors();
mockLogger();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

jest.mock("@/lib/rbac/permissions", () => ({
  hasPermission: jest.fn(() => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    return session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";
  }),
  Permission: { VERIFY_DOCUMENTS: "verify_documents" },
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => {}),
  createEmailHTML: jest.fn((content: string) => content),
}));

const { POST: approveTruck } = require("@/app/api/trucks/[id]/approve/route");

function callApprove(truckId: string, body: object) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/trucks/${truckId}/approve`,
    { body }
  );
  return approveTruck(req, { params: Promise.resolve({ id: truckId }) });
}

async function seedTruckWithCarrier(suffix: string) {
  const org = await db.organization.create({
    data: {
      id: `nta-org-${suffix}`,
      name: `NTA Carrier ${suffix}`,
      type: "CARRIER",
      contactEmail: `nta${suffix}@test.com`,
      contactPhone: `+25191160${suffix.padStart(4, "0")}`,
      isVerified: true,
    },
  });

  await db.user.create({
    data: {
      id: `nta-user-${suffix}`,
      email: `nta${suffix}@test.com`,
      passwordHash: "hash",
      firstName: "NTA",
      lastName: suffix,
      phone: `+25191160${suffix.padStart(4, "0")}`,
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: org.id,
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `nta-truck-${suffix}`,
      licensePlate: `NTA-${suffix}`,
      make: "Volvo",
      model: "FH16",
      year: 2022,
      capacity: 25,
      carrierId: org.id,
      approvalStatus: "PENDING",
    },
  });

  return { org, truck };
}

describe("Admin Truck Approval → TRUCK_APPROVED / TRUCK_REJECTED Notification (G-N1-4, G-N1-5)", () => {
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
    setAuthSession(
      createMockSession({
        userId: "admin-nta",
        role: "ADMIN",
        status: "ACTIVE",
      })
    );
  });

  // NA-7: Approval sends TRUCK_APPROVED
  it("NA-7: truck approval → createNotification called with type=TRUCK_APPROVED", async () => {
    const { truck } = await seedTruckWithCarrier("1");

    const res = await callApprove(truck.id, { action: "APPROVE" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.truck.approvalStatus ?? body.truck.status).toBeTruthy();

    const approvedCalls = createNotification.mock.calls.filter(
      ([args]: [any]) => args.type === "TRUCK_APPROVED"
    );
    expect(approvedCalls.length).toBeGreaterThanOrEqual(1);
    expect(approvedCalls[0][0]).toMatchObject({
      type: "TRUCK_APPROVED",
      title: "Truck Approved",
    });
  });

  // NA-8: Rejection sends TRUCK_REJECTED with reason
  it("NA-8: truck rejection → createNotification called with type=TRUCK_REJECTED and reason in message", async () => {
    const { truck } = await seedTruckWithCarrier("2");
    const reason = "License plate is not legible";

    const res = await callApprove(truck.id, { action: "REJECT", reason });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);

    const rejectedCalls = createNotification.mock.calls.filter(
      ([args]: [any]) => args.type === "TRUCK_REJECTED"
    );
    expect(rejectedCalls.length).toBeGreaterThanOrEqual(1);
    expect(rejectedCalls[0][0]).toMatchObject({
      type: "TRUCK_REJECTED",
      title: "Truck Rejected",
      message: expect.stringContaining(reason),
    });
  });

  // Non-admin cannot approve
  it("NA-7b: carrier cannot approve a truck → 403, no notification", async () => {
    const { truck } = await seedTruckWithCarrier("3");

    setAuthSession(
      createMockSession({
        userId: "carrier-nta-3",
        role: "CARRIER",
        status: "ACTIVE",
      })
    );

    const res = await callApprove(truck.id, { action: "APPROVE" });
    expect(res.status).toBe(403);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
