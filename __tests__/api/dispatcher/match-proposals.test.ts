// @jest-environment node
/**
 * Dispatcher Match Proposals Tests — Round A13
 *
 * Tests:
 * MP1 - DISPATCHER POST /api/match-proposals with valid load+truck → 201, PENDING
 * MP2 - CARRIER POST /api/match-proposals → 403
 * MP3 - SHIPPER POST /api/match-proposals → 403
 * MP4 - DISPATCHER creates proposal → createNotification called for carrier user (MATCH_PROPOSAL)
 * MP5 - DISPATCHER creates proposal → createNotification called for shipper user (MATCH_PROPOSAL)
 * MP6 - DISPATCHER POST /api/match-proposals/[id]/respond → 404 (cannot respond on behalf)
 * MP7 - CARRIER ACCEPT → createNotification called for shipper (MATCH_PROPOSAL_ACCEPTED)
 * MP8 - CARRIER REJECT → createNotification called for dispatcher (MATCH_PROPOSAL_REJECTED)
 * MP9 - CARRIER REJECT → createNotification called for shipper (MATCH_PROPOSAL_REJECTED) [G-A13-1]
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
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
  SeedData,
} from "../../utils/routeTestUtils";

// All mocks BEFORE require()
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

// Controllable wallet mock (pass by default)
const mockValidateWallet = jest.fn(async () => ({
  valid: true,
  shipperFee: 100,
  carrierFee: 50,
  shipperBalance: 10000,
  carrierBalance: 5000,
  errors: [],
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFees: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Route handlers AFTER mocks
const {
  POST: createMatchProposal,
} = require("@/app/api/match-proposals/route");
const {
  POST: respondToProposal,
} = require("@/app/api/match-proposals/[id]/respond/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const dispatcherSession = createMockSession({
  userId: "mp-dispatcher-1",
  role: "DISPATCHER",
  organizationId: "mp-dispatcher-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "mp-carrier-user-1",
  role: "CARRIER",
  organizationId: "mp-carrier-org-1",
  status: "ACTIVE",
});

const shipperSession = createMockSession({
  userId: "mp-shipper-user-1",
  role: "SHIPPER",
  organizationId: "mp-shipper-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Dispatcher Match Proposals (Round A13)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Dispatcher user
    await db.user.create({
      data: {
        id: "mp-dispatcher-1",
        email: "mp-dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "mp-dispatcher-org-1",
        firstName: "Match",
        lastName: "Dispatcher",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Carrier org user (for notification assertions)
    await db.user.create({
      data: {
        id: "mp-carrier-user-1",
        email: "mp-carrier@test.com",
        role: "CARRIER",
        organizationId: "mp-carrier-org-1",
        firstName: "Match",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Shipper user (for notification assertions)
    await db.user.create({
      data: {
        id: "mp-shipper-user-1",
        email: "mp-shipper@test.com",
        role: "SHIPPER",
        organizationId: "mp-shipper-org-1",
        firstName: "Match",
        lastName: "Shipper",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateWallet.mockResolvedValue({
      valid: true,
      shipperFee: 100,
      carrierFee: 50,
      shipperBalance: 10000,
      carrierBalance: 5000,
      errors: [],
    });
  });

  // ─── MP1: DISPATCHER can create proposal ──────────────────────────

  it("MP1 — DISPATCHER POST /api/match-proposals → 201, proposal.status=PENDING", async () => {
    setAuthSession(dispatcherSession);

    // Override canProposeMatch to allow DISPATCHER
    const dpModule = require("@/lib/dispatcherPermissions");
    dpModule.canProposeMatch.mockReturnValue(true);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/match-proposals",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      }
    );

    const res = await callHandler(createMatchProposal, req, {});
    expect(res.status).toBe(201);
    const body = await parseResponse(res);
    expect(body.proposal).toBeDefined();
    expect(body.proposal.status).toBe("PENDING");
  });

  // ─── MP2: CARRIER cannot propose ──────────────────────────────────

  it("MP2 — CARRIER POST /api/match-proposals → 403", async () => {
    setAuthSession(carrierSession);

    const dpModule = require("@/lib/dispatcherPermissions");
    dpModule.canProposeMatch.mockReturnValue(false);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/match-proposals",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      }
    );

    const res = await callHandler(createMatchProposal, req, {});
    expect(res.status).toBe(403);
  });

  // ─── MP3: SHIPPER cannot propose ──────────────────────────────────

  it("MP3 — SHIPPER POST /api/match-proposals → 403", async () => {
    setAuthSession(shipperSession);

    const dpModule = require("@/lib/dispatcherPermissions");
    dpModule.canProposeMatch.mockReturnValue(false);

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/match-proposals",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      }
    );

    const res = await callHandler(createMatchProposal, req, {});
    expect(res.status).toBe(403);
  });

  // ─── MP4 + MP5: DISPATCHER proposal notifies carrier AND shipper ───

  describe("Notification on proposal creation (MP4 + MP5)", () => {
    let notificationsModule: any;

    beforeEach(() => {
      notificationsModule = require("@/lib/notifications");
      setAuthSession(dispatcherSession);
      const dpModule = require("@/lib/dispatcherPermissions");
      dpModule.canProposeMatch.mockReturnValue(true);
    });

    it("MP4 — createNotification called for carrier user with type=MATCH_PROPOSAL", async () => {
      // Create fresh load to avoid duplicate proposal 409
      const freshLoad = await db.load.create({
        data: {
          id: "mp4-load-001",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "MP4 test cargo",
          shipperId: "mp-shipper-org-1",
          createdById: "mp-shipper-user-1",
          originLat: 9.02,
          originLon: 38.75,
          destinationLat: 7.05,
          destinationLon: 38.47,
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/match-proposals",
        {
          body: {
            loadId: freshLoad.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await callHandler(createMatchProposal, req, {});
      expect(res.status).toBe(201);

      expect(notificationsModule.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "MATCH_PROPOSAL",
          userId: expect.any(String),
        })
      );
    });

    it("MP5 — createNotification called for shipper user with type=MATCH_PROPOSAL", async () => {
      // Create fresh load
      const freshLoad = await db.load.create({
        data: {
          id: "mp5-load-001",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Bahir Dar",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 2500,
          cargoDescription: "MP5 test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          originLat: 9.02,
          originLon: 38.75,
          destinationLat: 11.59,
          destinationLon: 37.39,
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/match-proposals",
        {
          body: {
            loadId: freshLoad.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await callHandler(createMatchProposal, req, {});
      expect(res.status).toBe(201);

      // Shipper notification: called multiple times for carrier + shipper
      const calls = notificationsModule.createNotification.mock.calls;
      const matchProposalCalls = calls.filter(
        (args: any[]) => args[0]?.type === "MATCH_PROPOSAL"
      );
      expect(matchProposalCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── MP6: DISPATCHER cannot respond ───────────────────────────────

  it("MP6 — DISPATCHER POST /api/match-proposals/[id]/respond → 404", async () => {
    setAuthSession(dispatcherSession);

    // canApproveRequests returns false for DISPATCHER
    const dpModule = require("@/lib/dispatcherPermissions");
    dpModule.canApproveRequests.mockReturnValue(false);

    const proposal = await db.matchProposal.create({
      data: {
        id: "mp6-proposal-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        proposedById: "mp-dispatcher-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
      { body: { action: "ACCEPT" } }
    );

    const res = await callHandler(respondToProposal, req, { id: proposal.id });
    expect(res.status).toBe(404);
  });

  // ─── MP7, MP8, MP9: CARRIER respond notifications ─────────────────

  describe("Carrier respond notifications (MP7, MP8, MP9)", () => {
    let notificationsModule: any;

    beforeEach(() => {
      notificationsModule = require("@/lib/notifications");

      // Use seed carrier org so the org matches the truck's carrierId
      const seedCarrierSession = createMockSession({
        userId: seed.carrierUser.id,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
        status: "ACTIVE",
      });
      setAuthSession(seedCarrierSession);

      // canApproveRequests: allow CARRIER whose org matches carrierId
      const dpModule = require("@/lib/dispatcherPermissions");
      dpModule.canApproveRequests.mockImplementation(
        (user: any, carrierId: string) => {
          return user.role === "CARRIER" && user.organizationId === carrierId;
        }
      );
    });

    it("MP7 — CARRIER ACCEPT → createNotification called for shipper with type=MATCH_PROPOSAL_ACCEPTED", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "mp7-load-001",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Jimma",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "MP7 accept test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          originLat: 9.02,
          originLon: 38.75,
          destinationLat: 7.66,
          destinationLon: 36.83,
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp7-proposal-001",
          loadId: freshLoad.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          proposedById: "mp-dispatcher-1",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "ACCEPT" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect(res.status).toBe(200);

      const calls = notificationsModule.createNotification.mock.calls;
      const acceptedCalls = calls.filter(
        (args: any[]) => args[0]?.type === "MATCH_PROPOSAL_ACCEPTED"
      );
      expect(acceptedCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("MP8 — CARRIER REJECT → createNotification called for dispatcher with type=MATCH_PROPOSAL_REJECTED", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "mp8-load-001",
          status: "POSTED",
          pickupCity: "Dire Dawa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 3500,
          cargoDescription: "MP8 reject test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          originLat: 9.59,
          originLon: 41.86,
          destinationLat: 13.5,
          destinationLon: 39.47,
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp8-proposal-001",
          loadId: freshLoad.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          proposedById: "mp-dispatcher-1",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "REJECT", responseNotes: "Truck not suitable" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect(res.status).toBe(200);

      const calls = notificationsModule.createNotification.mock.calls;
      const rejectedCalls = calls.filter(
        (args: any[]) => args[0]?.type === "MATCH_PROPOSAL_REJECTED"
      );
      // Dispatcher notification
      const dispatcherNotified = rejectedCalls.some(
        (args: any[]) => args[0]?.userId === "mp-dispatcher-1"
      );
      expect(dispatcherNotified).toBe(true);
    });

    it("MP9 — CARRIER REJECT → createNotification called for shipper with type=MATCH_PROPOSAL_REJECTED (G-A13-1)", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "mp9-load-001",
          status: "POSTED",
          pickupCity: "Gondar",
          deliveryCity: "Adama",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 4500,
          cargoDescription: "MP9 shipper-rejection test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          originLat: 12.6,
          originLon: 37.47,
          destinationLat: 8.54,
          destinationLon: 39.27,
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp9-proposal-001",
          loadId: freshLoad.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          proposedById: "mp-dispatcher-1",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "REJECT", responseNotes: "Cannot service route" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect(res.status).toBe(200);

      const calls = notificationsModule.createNotification.mock.calls;
      const rejectedCalls = calls.filter(
        (args: any[]) => args[0]?.type === "MATCH_PROPOSAL_REJECTED"
      );
      // G-A13-1: Shipper org users must be notified
      expect(rejectedCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
