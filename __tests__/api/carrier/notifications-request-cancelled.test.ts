/**
 * Competing Request Cancellation Notifications (Path A) — Round N2
 *
 * When a carrier APPROVES a truck request, any competing pending requests
 * for the same load/truck are silently cancelled. These tests verify that
 * the affected parties receive cancellation notifications (G-N2-3).
 *
 * NB-2: Shipper with another pending TruckRequest for same load → TRUCK_REQUEST_REJECTED
 * NB-3: Carrier with pending LoadRequest for same load → LOAD_REQUEST_REJECTED
 * NB-4: Carrier + Dispatcher with pending MatchProposal for same load → MATCH_PROPOSAL_REJECTED
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
  validateWalletBalancesForTrip: (...args: any[]) =>
    mockValidateWallet(...args),
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
  POST: respondToRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");

function callRespond(requestId: string, body: object) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/truck-requests/${requestId}/respond`,
    { body }
  );
  return callHandler(respondToRequest, req, { id: requestId });
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

async function setupBaseScenario(prefix: string) {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper-org`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}shipper@test.com`,
      contactPhone: "+251911700001",
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
      contactPhone: "+251911700002",
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
      phone: "+251911700001",
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
      phone: "+251911700002",
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
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 5000,
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
      licensePlate: `${prefix.toUpperCase()}-001`,
      capacity: 10000,
      isAvailable: true,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      approvalStatus: "APPROVED",
    },
  });

  return { shipperOrg, carrierOrg, shipperUser, carrierUser, load, truck };
}

describe("Competing Request Cancellation Notifications — Path A (G-N2-3)", () => {
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

  // NB-2: Carrier approves truck request → shippers with competing TruckRequests notified
  it("NB-2: carrier APPROVE → notifyOrganization called with TRUCK_REQUEST_REJECTED for shipper with competing request", async () => {
    const { shipperOrg, carrierOrg, shipperUser, carrierUser, load, truck } =
      await setupBaseScenario("nb2");

    // Another shipper org that also has a pending truck request for same load
    const otherShipperOrg = await db.organization.create({
      data: {
        id: "nb2-other-shipper-org",
        name: "NB2 Other Shipper",
        type: "SHIPPER",
        contactEmail: "nb2other@test.com",
        contactPhone: "+251911700010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    // The primary truck request (the one being approved)
    const primaryRequest = await db.truckRequest.create({
      data: {
        id: "nb2-primary-request",
        truckId: truck.id,
        loadId: load.id,
        shipperId: shipperOrg.id,
        carrierId: carrierOrg.id,
        requestedById: shipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Competing truck request from other shipper (same load)
    await db.truckRequest.create({
      data: {
        id: "nb2-competing-request",
        truckId: truck.id,
        loadId: load.id,
        shipperId: otherShipperOrg.id,
        carrierId: carrierOrg.id,
        requestedById: shipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Carrier approves the primary request
    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      })
    );

    const res = await callRespond(primaryRequest.id, { action: "APPROVE" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request.status).toBe("APPROVED");

    // Verify notifyOrganization called for the competing shipper's org
    const truckRejectedCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "TRUCK_REQUEST_REJECTED"
    );
    const notifiedOrgIds = truckRejectedCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherShipperOrg.id);
    // Title / message check
    expect(truckRejectedCalls[0][0].title).toBe("Request No Longer Available");
  });

  // NB-3: Carrier approves truck request → carriers with pending LoadRequests notified
  it("NB-3: carrier APPROVE → notifyOrganization called with LOAD_REQUEST_REJECTED for carrier with competing load request", async () => {
    const { shipperOrg, carrierOrg, shipperUser, carrierUser, load, truck } =
      await setupBaseScenario("nb3");

    // Another carrier that placed a LoadRequest for the same load
    const otherCarrierOrg = await db.organization.create({
      data: {
        id: "nb3-other-carrier-org",
        name: "NB3 Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nb3other@test.com",
        contactPhone: "+251911700020",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const otherCarrierUser = await db.user.create({
      data: {
        id: "nb3-other-carrier-user",
        email: "nb3other@test.com",
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911700021",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: otherCarrierOrg.id,
      },
    });

    const otherTruck = await db.truck.create({
      data: {
        id: "nb3-other-truck",
        truckType: "DRY_VAN",
        licensePlate: "NB3-OTHER",
        capacity: 10000,
        isAvailable: true,
        carrierId: otherCarrierOrg.id,
        createdById: otherCarrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // The primary truck request (being approved)
    const primaryRequest = await db.truckRequest.create({
      data: {
        id: "nb3-primary-request",
        truckId: truck.id,
        loadId: load.id,
        shipperId: shipperOrg.id,
        carrierId: carrierOrg.id,
        requestedById: shipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Competing LoadRequest from another carrier for the same load
    await db.loadRequest.create({
      data: {
        id: "nb3-competing-load-request",
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

    const res = await callRespond(primaryRequest.id, { action: "APPROVE" });
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

  // NB-4: Carrier approves truck request → carrier+dispatcher with pending MatchProposal notified
  it("NB-4: carrier APPROVE → notifyOrganization + createNotification for carrier/dispatcher with competing match proposal", async () => {
    const { shipperOrg, carrierOrg, shipperUser, carrierUser, load, truck } =
      await setupBaseScenario("nb4");

    const dispatcherOrg = await db.organization.create({
      data: {
        id: "nb4-dispatcher-org",
        name: "NB4 Dispatcher",
        type: "DISPATCHER",
        contactEmail: "nb4dispatcher@test.com",
        contactPhone: "+251911700030",
        isVerified: true,
      },
    });

    const dispatcherUser = await db.user.create({
      data: {
        id: "nb4-dispatcher-user",
        email: "nb4dispatcher@test.com",
        passwordHash: "hash",
        firstName: "Dispatcher",
        lastName: "NB4",
        phone: "+251911700031",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: dispatcherOrg.id,
      },
    });

    const otherCarrierOrg = await db.organization.create({
      data: {
        id: "nb4-other-carrier-org",
        name: "NB4 Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nb4carrier@test.com",
        contactPhone: "+251911700032",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    // The primary truck request (being approved)
    const primaryRequest = await db.truckRequest.create({
      data: {
        id: "nb4-primary-request",
        truckId: truck.id,
        loadId: load.id,
        shipperId: shipperOrg.id,
        carrierId: carrierOrg.id,
        requestedById: shipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Pending match proposal for the same load
    await db.matchProposal.create({
      data: {
        id: "nb4-competing-proposal",
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

    const res = await callRespond(primaryRequest.id, { action: "APPROVE" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request.status).toBe("APPROVED");

    // Carrier org should receive MATCH_PROPOSAL_REJECTED via notifyOrganization
    const proposalRejectedOrgCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "MATCH_PROPOSAL_REJECTED"
    );
    const notifiedOrgIds = proposalRejectedOrgCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherCarrierOrg.id);

    // Dispatcher should receive individual createNotification
    const proposalRejectedUserCalls = createNotification.mock.calls.filter(
      (call) => call[0].type === "MATCH_PROPOSAL_REJECTED"
    );
    const notifiedUserIds = proposalRejectedUserCalls.map(
      (call) => call[0].userId
    );
    expect(notifiedUserIds).toContain(dispatcherUser.id);

    // Check titles
    expect(proposalRejectedOrgCalls[0][0].title).toBe(
      "Match Proposal Cancelled"
    );
    expect(
      proposalRejectedUserCalls.find(
        (c) => c[0].userId === dispatcherUser.id
      )[0].title
    ).toBe("Match Proposal Cancelled");
  });

  // NB-2b: No cancellation notifications when no competing requests exist
  it("NB-2b: carrier APPROVE with no competing requests → no TRUCK_REQUEST_REJECTED or LOAD_REQUEST_REJECTED org notifications", async () => {
    const { shipperOrg, carrierOrg, shipperUser, carrierUser, load, truck } =
      await setupBaseScenario("nb2b");

    const primaryRequest = await db.truckRequest.create({
      data: {
        id: "nb2b-primary-request",
        truckId: truck.id,
        loadId: load.id,
        shipperId: shipperOrg.id,
        carrierId: carrierOrg.id,
        requestedById: shipperUser.id,
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

    const res = await callRespond(primaryRequest.id, { action: "APPROVE" });
    expect(res.status).toBe(200);

    // No TRUCK_REQUEST_REJECTED or LOAD_REQUEST_REJECTED org notifications
    const rejectedOrgCalls = notifyOrganization.mock.calls.filter(
      (call) =>
        call[0].type === "TRUCK_REQUEST_REJECTED" ||
        call[0].type === "LOAD_REQUEST_REJECTED"
    );
    expect(rejectedOrgCalls).toHaveLength(0);
  });
});
