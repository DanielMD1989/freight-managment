/**
 * Competing Request Cancellation Notifications (Path B) — Round N2
 *
 * When a carrier CONFIRMS a load request (after shipper approval), any competing
 * pending requests for the same load/truck are silently cancelled. These tests verify
 * that the affected parties receive cancellation notifications (G-N2-3).
 *
 * NB-5: Carrier with pending LoadRequest for same load → LOAD_REQUEST_REJECTED
 * NB-6: Shipper with pending TruckRequest for same load → TRUCK_REQUEST_REJECTED
 * NB-7: Carrier + Dispatcher with pending MatchProposal for same load → MATCH_PROPOSAL_REJECTED
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createMockSession,
  createRequest,
  callHandler,
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
  mockRbac,
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
mockRbac();
mockApiErrors();
mockLogger();

const mockValidateWallet = jest.fn(async () => ({
  valid: true,
  shipperFee: 100,
  carrierFee: 50,
  errors: [],
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFees: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

const {
  POST: confirmRequest,
} = require("@/app/api/load-requests/[id]/confirm/route");

function callConfirm(requestId: string, body: object) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/load-requests/${requestId}/confirm`,
    { body }
  );
  return callHandler(confirmRequest, req, { id: requestId });
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

async function setupBaseScenario(prefix: string) {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper-org`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}shipper@test.com`,
      contactPhone: "+251911800001",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const carrierOrg = await db.organization.create({
    data: {
      id: `${prefix}-carrier-org`,
      name: `${prefix} Carrier`,
      type: "CARRIER_COMPANY",
      contactEmail: `${prefix}carrier@test.com`,
      contactPhone: "+251911800002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const shipperUser = await db.user.create({
    data: {
      id: `${prefix}-shipper-user`,
      email: `${prefix}shipper@test.com`,
      passwordHash: "hash",
      firstName: "Test",
      lastName: "Shipper",
      phone: "+251911800003",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: shipperOrg.id,
    },
  });

  const carrierUser = await db.user.create({
    data: {
      id: `${prefix}-carrier-user`,
      email: `${prefix}carrier@test.com`,
      passwordHash: "hash",
      firstName: "Test",
      lastName: "Carrier",
      phone: "+251911800004",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: carrierOrg.id,
    },
  });

  const load = await db.load.create({
    data: {
      id: `${prefix}-load`,
      status: "SEARCHING",
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 6000,
      cargoDescription: "Test cargo",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
      postedAt: new Date(),
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `${prefix}-truck`,
      truckType: "DRY_VAN",
      licensePlate: `${prefix.toUpperCase().slice(0, 5)}-T01`,
      capacity: 10000,
      isAvailable: true,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      approvalStatus: "APPROVED",
    },
  });

  // The primary load request (SHIPPER_APPROVED — ready to confirm)
  const primaryRequest = await db.loadRequest.create({
    data: {
      id: `${prefix}-primary-request`,
      loadId: load.id,
      truckId: truck.id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      requestedById: carrierUser.id,
      status: "SHIPPER_APPROVED",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return {
    shipperOrg,
    carrierOrg,
    shipperUser,
    carrierUser,
    load,
    truck,
    primaryRequest,
  };
}

describe("Competing Request Cancellation Notifications — Path B (G-N2-3)", () => {
  let createNotification: jest.Mock;
  let notifyOrganization: jest.Mock;

  beforeAll(() => {
    const notifications = require("@/lib/notifications");
    createNotification = notifications.createNotification;
    notifyOrganization = notifications.notifyOrganization;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // NB-5: Carrier confirms load request → competing LoadRequest carriers notified
  it("NB-5: carrier CONFIRM → notifyOrganization called with LOAD_REQUEST_REJECTED for competing carrier", async () => {
    const { shipperOrg, carrierOrg, carrierUser, load, truck, primaryRequest } =
      await setupBaseScenario("nb5");

    // Another carrier with a pending LoadRequest for same load
    const otherCarrierOrg = await db.organization.create({
      data: {
        id: "nb5-other-carrier-org",
        name: "NB5 Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nb5othercarrier@test.com",
        contactPhone: "+251911800010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const otherCarrierUser = await db.user.create({
      data: {
        id: "nb5-other-carrier-user",
        email: "nb5othercarrier@test.com",
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911800011",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: otherCarrierOrg.id,
      },
    });

    const otherTruck = await db.truck.create({
      data: {
        id: "nb5-other-truck",
        truckType: "DRY_VAN",
        licensePlate: "NB5-OTHER",
        capacity: 10000,
        isAvailable: true,
        carrierId: otherCarrierOrg.id,
        createdById: otherCarrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // Competing LoadRequest
    await db.loadRequest.create({
      data: {
        id: "nb5-competing-request",
        loadId: load.id,
        truckId: otherTruck.id,
        carrierId: otherCarrierOrg.id,
        shipperId: shipperOrg.id,
        requestedById: otherCarrierUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      })
    );

    const res = await callConfirm(primaryRequest.id, { action: "CONFIRM" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request.status).toBe("APPROVED");

    const loadRejectedCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "LOAD_REQUEST_REJECTED"
    );
    const notifiedOrgIds = loadRejectedCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherCarrierOrg.id);
    expect(loadRejectedCalls[0][0].title).toBe("Request No Longer Available");
  });

  // NB-6: Carrier confirms load request → competing TruckRequest shippers notified
  it("NB-6: carrier CONFIRM → notifyOrganization called with TRUCK_REQUEST_REJECTED for competing shipper", async () => {
    const { shipperOrg, carrierOrg, carrierUser, load, truck, primaryRequest } =
      await setupBaseScenario("nb6");

    const otherShipperOrg = await db.organization.create({
      data: {
        id: "nb6-other-shipper-org",
        name: "NB6 Other Shipper",
        type: "SHIPPER",
        contactEmail: "nb6othershipper@test.com",
        contactPhone: "+251911800020",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const otherShipperUser = await db.user.create({
      data: {
        id: "nb6-other-shipper-user",
        email: "nb6othershipper@test.com",
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251911800021",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: otherShipperOrg.id,
      },
    });

    // Competing TruckRequest for same load
    await db.truckRequest.create({
      data: {
        id: "nb6-competing-truck-request",
        truckId: truck.id,
        loadId: load.id,
        shipperId: otherShipperOrg.id,
        carrierId: carrierOrg.id,
        requestedById: otherShipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      })
    );

    const res = await callConfirm(primaryRequest.id, { action: "CONFIRM" });
    expect(res.status).toBe(200);

    const truckRejectedCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "TRUCK_REQUEST_REJECTED"
    );
    const notifiedOrgIds = truckRejectedCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherShipperOrg.id);
    expect(truckRejectedCalls[0][0].title).toBe("Request No Longer Available");
  });

  // NB-7: Carrier confirms load request → competing MatchProposal carrier+dispatcher notified
  it("NB-7: carrier CONFIRM → notifyOrganization + createNotification for carrier/dispatcher with competing match proposal", async () => {
    const { shipperOrg, carrierOrg, carrierUser, load, truck, primaryRequest } =
      await setupBaseScenario("nb7");

    const otherCarrierOrg = await db.organization.create({
      data: {
        id: "nb7-other-carrier-org",
        name: "NB7 Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nb7othercarrier@test.com",
        contactPhone: "+251911800030",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const dispatcherUser = await db.user.create({
      data: {
        id: "nb7-dispatcher-user",
        email: "nb7dispatcher@test.com",
        passwordHash: "hash",
        firstName: "Dispatcher",
        lastName: "NB7",
        phone: "+251911800031",
        role: "DISPATCHER",
        status: "ACTIVE",
      },
    });

    // Competing MatchProposal for same load
    await db.matchProposal.create({
      data: {
        id: "nb7-competing-proposal",
        loadId: load.id,
        truckId: truck.id,
        carrierId: otherCarrierOrg.id,
        proposedById: dispatcherUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      })
    );

    const res = await callConfirm(primaryRequest.id, { action: "CONFIRM" });
    expect(res.status).toBe(200);

    // Carrier org receives MATCH_PROPOSAL_REJECTED via notifyOrganization
    const proposalRejectedOrgCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "MATCH_PROPOSAL_REJECTED"
    );
    const notifiedOrgIds = proposalRejectedOrgCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherCarrierOrg.id);

    // Dispatcher receives individual createNotification
    const proposalRejectedUserCalls = createNotification.mock.calls.filter(
      (call) =>
        call[0].type === "MATCH_PROPOSAL_REJECTED" &&
        call[0].userId === dispatcherUser.id
    );
    expect(proposalRejectedUserCalls).toHaveLength(1);
    expect(proposalRejectedUserCalls[0][0].title).toBe(
      "Match Proposal Cancelled"
    );
  });

  // NB-5b: DECLINE path → no cancellation notifications (no competing requests cancelled)
  it("NB-5b: carrier DECLINE → no cancellation notifications fired", async () => {
    const { carrierUser, carrierOrg, primaryRequest } =
      await setupBaseScenario("nb5b");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      })
    );

    const res = await callConfirm(primaryRequest.id, { action: "DECLINE" });
    expect(res.status).toBe(200);

    // DECLINE does not cancel competing requests → no cancellation notifications
    const rejectedCalls = notifyOrganization.mock.calls.filter(
      (call) =>
        call[0].type === "TRUCK_REQUEST_REJECTED" ||
        call[0].type === "LOAD_REQUEST_REJECTED" ||
        call[0].type === "MATCH_PROPOSAL_REJECTED"
    );
    expect(rejectedCalls).toHaveLength(0);
  });
});
