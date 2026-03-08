/**
 * Truck Resubmit → Admin Notification Tests — Round N1
 *
 * NA-4: Truck resubmit → createNotificationForRole called with role=ADMIN
 *
 * Gap: G-N1-3
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
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }),
}));

const { POST: truckResubmit } = require("@/app/api/trucks/[id]/resubmit/route");

function callResubmit(truckId: string) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/trucks/${truckId}/resubmit`
  );
  return truckResubmit(req, { params: Promise.resolve({ id: truckId }) });
}

describe("Truck Resubmit → Admin Notification (G-N1-3)", () => {
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

  // NA-4: Truck resubmit fires admin notification
  it("NA-4: truck resubmit after rejection → createNotificationForRole called with ADMIN + TRUCK_RESUBMITTED", async () => {
    const org = await db.organization.create({
      data: {
        id: "ntr-org-1",
        name: "NTR Carrier",
        type: "CARRIER",
        contactEmail: "ntr1@test.com",
        contactPhone: "+251911300001",
        isVerified: true,
      },
    });

    const truck = await db.truck.create({
      data: {
        id: "ntr-truck-1",
        licensePlate: "NTR-0001",
        make: "Scania",
        model: "R500",
        year: 2021,
        capacity: 20,
        carrierId: org.id,
        approvalStatus: "REJECTED",
        rejectionReason: "Bad docs",
        rejectedAt: new Date(),
      },
    });

    setAuthSession(
      createMockSession({
        userId: "ntr-user-1",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      })
    );

    const res = await callResubmit(truck.id);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.truck.approvalStatus).toBe("PENDING");

    expect(createNotificationForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "ADMIN",
        type: "TRUCK_RESUBMITTED",
        metadata: expect.objectContaining({ truckId: truck.id }),
      })
    );
  });

  // NA-4b: No notification on failed resubmit (truck not in REJECTED state)
  it("NA-4b: truck resubmit on PENDING truck → 400, no admin notification", async () => {
    const org = await db.organization.create({
      data: {
        id: "ntr-org-2",
        name: "NTR Carrier 2",
        type: "CARRIER",
        contactEmail: "ntr2@test.com",
        contactPhone: "+251911300002",
        isVerified: true,
      },
    });

    const truck = await db.truck.create({
      data: {
        id: "ntr-truck-2",
        licensePlate: "NTR-0002",
        make: "Scania",
        model: "R500",
        year: 2021,
        capacity: 20,
        carrierId: org.id,
        approvalStatus: "PENDING",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "ntr-user-2",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      })
    );

    const res = await callResubmit(truck.id);
    expect(res.status).toBe(400);
    expect(createNotificationForRole).not.toHaveBeenCalled();
  });

  // NA-4c: Wrong carrier cannot resubmit
  it("NA-4c: carrier that does not own the truck → 403, no admin notification", async () => {
    const ownerOrg = await db.organization.create({
      data: {
        id: "ntr-org-3",
        name: "NTR Owner",
        type: "CARRIER",
        contactEmail: "ntr3owner@test.com",
        contactPhone: "+251911300003",
        isVerified: true,
      },
    });

    const otherOrg = await db.organization.create({
      data: {
        id: "ntr-org-4",
        name: "NTR Other",
        type: "CARRIER",
        contactEmail: "ntr4other@test.com",
        contactPhone: "+251911300004",
        isVerified: true,
      },
    });

    const truck = await db.truck.create({
      data: {
        id: "ntr-truck-3",
        licensePlate: "NTR-0003",
        make: "Scania",
        model: "R500",
        year: 2021,
        capacity: 20,
        carrierId: ownerOrg.id,
        approvalStatus: "REJECTED",
        rejectionReason: "Bad docs",
        rejectedAt: new Date(),
      },
    });

    setAuthSession(
      createMockSession({
        userId: "ntr-user-3",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: otherOrg.id,
      })
    );

    const res = await callResubmit(truck.id);
    expect(res.status).toBe(403);
    expect(createNotificationForRole).not.toHaveBeenCalled();
  });
});
