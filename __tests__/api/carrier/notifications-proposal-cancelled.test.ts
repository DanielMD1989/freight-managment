/**
 * Competing Request Cancellation Notifications (Path C) — Round N2
 *
 * When a carrier ACCEPTS a match proposal, any competing pending requests
 * for the same load are silently cancelled. These tests verify that the
 * affected parties receive cancellation notifications (G-N2-3).
 *
 * NB-8:  Carrier + Dispatcher with competing MatchProposal → MATCH_PROPOSAL_REJECTED
 * NB-9:  Carrier with pending LoadRequest for same load → LOAD_REQUEST_REJECTED
 * NB-10: Shipper with pending TruckRequest for same load → TRUCK_REQUEST_REJECTED
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
  POST: respondToProposal,
} = require("@/app/api/match-proposals/[id]/respond/route");

function callRespond(proposalId: string, body: object) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/match-proposals/${proposalId}/respond`,
    { body }
  );
  return callHandler(respondToProposal, req, { id: proposalId });
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

async function setupBaseScenario(prefix: string) {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper-org`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}shipper@test.com`,
      contactPhone: "+251911900001",
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
      contactPhone: "+251911900002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const dispatcherOrg = await db.organization.create({
    data: {
      id: `${prefix}-dispatcher-org`,
      name: `${prefix} Dispatcher`,
      type: "DISPATCHER",
      contactEmail: `${prefix}dispatcher@test.com`,
      contactPhone: "+251911900003",
      isVerified: true,
    },
  });

  const shipperUser = await db.user.create({
    data: {
      id: `${prefix}-shipper-user`,
      email: `${prefix}shipper@test.com`,
      passwordHash: "hash",
      firstName: "Test",
      lastName: "Shipper",
      phone: "+251911900004",
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
      phone: "+251911900005",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: carrierOrg.id,
    },
  });

  const dispatcherUser = await db.user.create({
    data: {
      id: `${prefix}-dispatcher-user`,
      email: `${prefix}dispatcher@test.com`,
      passwordHash: "hash",
      firstName: "Test",
      lastName: "Dispatcher",
      phone: "+251911900006",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: dispatcherOrg.id,
    },
  });

  const load = await db.load.create({
    data: {
      id: `${prefix}-load`,
      status: "SEARCHING",
      pickupCity: "Addis Ababa",
      deliveryCity: "Gondar",
      pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      truckType: "FLATBED",
      weight: 7500,
      cargoDescription: "Test cargo",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
      postedAt: new Date(),
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `${prefix}-truck`,
      truckType: "FLATBED",
      licensePlate: `${prefix.toUpperCase().slice(0, 5)}-T01`,
      capacity: 12000,
      isAvailable: true,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      approvalStatus: "APPROVED",
    },
  });

  // The primary proposal (PENDING — carrier will ACCEPT it)
  const primaryProposal = await db.matchProposal.create({
    data: {
      id: `${prefix}-primary-proposal`,
      loadId: load.id,
      truckId: truck.id,
      carrierId: carrierOrg.id,
      proposedById: dispatcherUser.id,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return {
    shipperOrg,
    carrierOrg,
    dispatcherOrg,
    shipperUser,
    carrierUser,
    dispatcherUser,
    load,
    truck,
    primaryProposal,
  };
}

describe("Competing Request Cancellation Notifications — Path C (G-N2-3)", () => {
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

  // NB-8: Carrier accepts proposal → competing MatchProposal carrier+dispatcher notified
  it("NB-8: carrier ACCEPT → notifyOrganization + createNotification for carrier/dispatcher with competing proposal", async () => {
    const {
      carrierOrg,
      carrierUser,
      dispatcherUser,
      load,
      truck,
      primaryProposal,
    } = await setupBaseScenario("nb8");

    const otherCarrierOrg = await db.organization.create({
      data: {
        id: "nb8-other-carrier-org",
        name: "NB8 Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nb8othercarrier@test.com",
        contactPhone: "+251911900010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const otherDispatcherUser = await db.user.create({
      data: {
        id: "nb8-other-dispatcher-user",
        email: "nb8otherdispatcher@test.com",
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Dispatcher",
        phone: "+251911900011",
        role: "DISPATCHER",
        status: "ACTIVE",
      },
    });

    // Competing proposal for same load
    await db.matchProposal.create({
      data: {
        id: "nb8-competing-proposal",
        loadId: load.id,
        truckId: truck.id,
        carrierId: otherCarrierOrg.id,
        proposedById: otherDispatcherUser.id,
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

    const res = await callRespond(primaryProposal.id, { action: "ACCEPT" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.proposal.status).toBe("ACCEPTED");

    // Competing carrier org should receive MATCH_PROPOSAL_REJECTED via notifyOrganization
    const proposalRejectedOrgCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "MATCH_PROPOSAL_REJECTED"
    );
    const notifiedOrgIds = proposalRejectedOrgCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherCarrierOrg.id);
    expect(proposalRejectedOrgCalls[0][0].title).toBe(
      "Match Proposal Cancelled"
    );

    // Competing dispatcher should receive createNotification
    const proposalRejectedUserCalls = createNotification.mock.calls.filter(
      (call) =>
        call[0].type === "MATCH_PROPOSAL_REJECTED" &&
        call[0].userId === otherDispatcherUser.id
    );
    expect(proposalRejectedUserCalls).toHaveLength(1);
    expect(proposalRejectedUserCalls[0][0].title).toBe(
      "Match Proposal Cancelled"
    );
  });

  // NB-9: Carrier accepts proposal → competing LoadRequest carriers notified
  it("NB-9: carrier ACCEPT → notifyOrganization called with LOAD_REQUEST_REJECTED for competing carrier", async () => {
    const {
      shipperOrg,
      carrierOrg,
      carrierUser,
      load,
      truck,
      primaryProposal,
    } = await setupBaseScenario("nb9");

    const otherCarrierOrg = await db.organization.create({
      data: {
        id: "nb9-other-carrier-org",
        name: "NB9 Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nb9othercarrier@test.com",
        contactPhone: "+251911900020",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const otherCarrierUser = await db.user.create({
      data: {
        id: "nb9-other-carrier-user",
        email: "nb9othercarrier@test.com",
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911900021",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: otherCarrierOrg.id,
      },
    });

    const otherTruck = await db.truck.create({
      data: {
        id: "nb9-other-truck",
        truckType: "FLATBED",
        licensePlate: "NB9-OTHER",
        capacity: 12000,
        isAvailable: true,
        carrierId: otherCarrierOrg.id,
        createdById: otherCarrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // Competing LoadRequest for same load
    await db.loadRequest.create({
      data: {
        id: "nb9-competing-load-request",
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

    const res = await callRespond(primaryProposal.id, { action: "ACCEPT" });
    expect(res.status).toBe(200);

    const loadRejectedCalls = notifyOrganization.mock.calls.filter(
      (call) => call[0].type === "LOAD_REQUEST_REJECTED"
    );
    const notifiedOrgIds = loadRejectedCalls.map(
      (call) => call[0].organizationId
    );
    expect(notifiedOrgIds).toContain(otherCarrierOrg.id);
    expect(loadRejectedCalls[0][0].title).toBe("Request No Longer Available");
  });

  // NB-10: Carrier accepts proposal → competing TruckRequest shippers notified
  it("NB-10: carrier ACCEPT → notifyOrganization called with TRUCK_REQUEST_REJECTED for competing shipper", async () => {
    const {
      shipperOrg,
      carrierOrg,
      carrierUser,
      load,
      truck,
      primaryProposal,
    } = await setupBaseScenario("nb10");

    const otherShipperOrg = await db.organization.create({
      data: {
        id: "nb10-other-shipper-org",
        name: "NB10 Other Shipper",
        type: "SHIPPER",
        contactEmail: "nb10othershipper@test.com",
        contactPhone: "+251911900030",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const otherShipperUser = await db.user.create({
      data: {
        id: "nb10-other-shipper-user",
        email: "nb10othershipper@test.com",
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251911900031",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: otherShipperOrg.id,
      },
    });

    // Competing TruckRequest for same load
    await db.truckRequest.create({
      data: {
        id: "nb10-competing-truck-request",
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

    const res = await callRespond(primaryProposal.id, { action: "ACCEPT" });
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

  // NB-8b: REJECT path → no cancellation notifications (competing requests not cancelled)
  it("NB-8b: carrier REJECT → no MATCH_PROPOSAL_REJECTED / LOAD_REQUEST_REJECTED cancellation notifications", async () => {
    const { carrierOrg, carrierUser, primaryProposal } =
      await setupBaseScenario("nb8b");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      })
    );

    const res = await callRespond(primaryProposal.id, { action: "REJECT" });
    expect(res.status).toBe(200);

    // REJECT path does not cancel competing requests → no cancellation notifications
    const cancellationOrgCalls = notifyOrganization.mock.calls.filter(
      (call) =>
        call[0].type === "TRUCK_REQUEST_REJECTED" ||
        call[0].type === "LOAD_REQUEST_REJECTED"
    );
    const cancellationMatchProposalOrgCalls =
      notifyOrganization.mock.calls.filter(
        (call) =>
          call[0].type === "MATCH_PROPOSAL_REJECTED" &&
          call[0].title === "Match Proposal Cancelled"
      );
    expect(cancellationOrgCalls).toHaveLength(0);
    expect(cancellationMatchProposalOrgCalls).toHaveLength(0);
  });
});
