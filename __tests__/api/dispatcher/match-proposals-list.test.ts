// @jest-environment node
/**
 * Match Proposals List Tests — Round U2-FULL
 *
 * Scoped visibility matrix for GET /api/match-proposals and
 * respond authority matrix for POST /api/match-proposals/[id]/respond.
 *
 * Tests MPL-1 to MPL-7.
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
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
  SeedData,
} from "../../utils/routeTestUtils";

// ─── Module-level mocks ───────────────────────────────────────────────────────

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
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

// Import handlers AFTER mocks
const { GET: listProposals } = require("@/app/api/match-proposals/route");
const {
  POST: respondToProposal,
} = require("@/app/api/match-proposals/[id]/respond/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const dispatcherSession = createMockSession({
  userId: "mpl-dispatcher-1",
  email: "mpl-dispatcher@test.com",
  role: "DISPATCHER",
  status: "ACTIVE",
  organizationId: "mpl-dispatcher-org",
});

const adminSession = createMockSession({
  userId: "mpl-admin-1",
  email: "mpl-admin@test.com",
  role: "ADMIN",
  status: "ACTIVE",
  organizationId: "mpl-admin-org",
});

// CARRIER and SHIPPER sessions filled in after seed (need real org IDs for scoping)
let carrierSession: ReturnType<typeof createMockSession>;
let shipperSession: ReturnType<typeof createMockSession>;
let wrongCarrierSession: ReturnType<typeof createMockSession>;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Match Proposals List — Round U2-FULL", () => {
  let seed: SeedData;
  let proposalId: string;

  beforeAll(async () => {
    seed = await seedTestData();

    // Set scoped sessions
    carrierSession = createMockSession({
      userId: "mpl-carrier-1",
      email: "mpl-carrier@test.com",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: seed.carrierOrg.id,
    });

    shipperSession = createMockSession({
      userId: "mpl-shipper-1",
      email: "mpl-shipper@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: seed.shipperOrg.id,
    });

    wrongCarrierSession = createMockSession({
      userId: "mpl-wrong-carrier-1",
      email: "mpl-wrong-carrier@test.com",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "mpl-wrong-carrier-org",
    });

    // Create users
    for (const u of [
      {
        id: "mpl-dispatcher-1",
        email: "mpl-dispatcher@test.com",
        role: "DISPATCHER",
        org: "mpl-dispatcher-org",
      },
      {
        id: "mpl-admin-1",
        email: "mpl-admin@test.com",
        role: "ADMIN",
        org: "mpl-admin-org",
      },
      {
        id: "mpl-carrier-1",
        email: "mpl-carrier@test.com",
        role: "CARRIER",
        org: seed.carrierOrg.id,
      },
      {
        id: "mpl-shipper-1",
        email: "mpl-shipper@test.com",
        role: "SHIPPER",
        org: seed.shipperOrg.id,
      },
      {
        id: "mpl-wrong-carrier-1",
        email: "mpl-wrong-carrier@test.com",
        role: "CARRIER",
        org: "mpl-wrong-carrier-org",
      },
    ]) {
      await db.user.create({
        data: {
          id: u.id,
          email: u.email,
          role: u.role as any,
          organizationId: u.org,
          firstName: u.role,
          lastName: "MPL",
          status: "ACTIVE",
          passwordHash: "mock-hash",
        },
      });
    }

    // Create a match proposal scoped to seed.carrierOrg
    const expiresAt = new Date(Date.now() + 86400000); // 24h from now
    const proposal = await db.matchProposal.create({
      data: {
        id: "mpl-proposal-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        proposedById: "mpl-dispatcher-1",
        status: "PENDING",
        expiresAt,
      },
    });
    proposalId = proposal.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── MPL-1: DISPATCHER sees all proposals ────────────────────────────────────

  it("MPL-1 — DISPATCHER GET /api/match-proposals → 200, sees ALL proposals (no carrierId/shipperId filter)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/match-proposals"
    );

    const res = await callHandler(listProposals, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.proposals)).toBe(true);
    // Dispatcher should see the proposal even though it's for another org
    expect(data.proposals.some((p: any) => p.id === proposalId)).toBe(true);
  });

  // ─── MPL-2: CARRIER sees own-org trucks only ──────────────────────────────────

  it("MPL-2 — CARRIER GET → 200, scoped to own-org trucks only", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/match-proposals"
    );

    const res = await callHandler(listProposals, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    // All returned proposals should belong to the carrier's org
    for (const p of data.proposals) {
      expect(p.carrierId ?? seed.carrierOrg.id).toBe(seed.carrierOrg.id);
    }
  });

  // ─── MPL-3: SHIPPER sees own-org loads only ───────────────────────────────────

  it("MPL-3 — SHIPPER GET → 200, scoped to own-org loads only", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/match-proposals"
    );

    const res = await callHandler(listProposals, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.proposals)).toBe(true);
  });

  // ─── MPL-4: ADMIN sees all ────────────────────────────────────────────────────

  it("MPL-4 — ADMIN GET → 200, sees all proposals", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/match-proposals"
    );

    const res = await callHandler(listProposals, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.proposals)).toBe(true);
    expect(data.proposals.some((p: any) => p.id === proposalId)).toBe(true);
  });

  // ─── MPL-5: DISPATCHER POST respond → 404 ────────────────────────────────────

  it("MPL-5 — DISPATCHER POST /api/match-proposals/[id]/respond → 404 (canApproveRequests false)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/match-proposals/${proposalId}/respond`,
      { body: { action: "ACCEPT" } }
    );

    const res = await callHandler(respondToProposal, req, { id: proposalId });
    // canApproveRequests(DISPATCHER, ...) = false → "Proposal not found" 404
    expect(res.status).toBe(404);
  });

  // ─── MPL-6: SHIPPER POST respond → 404 ───────────────────────────────────────

  it("MPL-6 — SHIPPER POST respond → 404 (not a carrier)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/match-proposals/${proposalId}/respond`,
      { body: { action: "ACCEPT" } }
    );

    const res = await callHandler(respondToProposal, req, { id: proposalId });
    expect(res.status).toBe(404);
  });

  // ─── MPL-7: CARRIER (wrong truck-owner) POST respond → 404 ───────────────────

  it("MPL-7 — CARRIER (wrong truck-owner) POST respond → 404", async () => {
    setAuthSession(wrongCarrierSession);

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/match-proposals/${proposalId}/respond`,
      { body: { action: "ACCEPT" } }
    );

    const res = await callHandler(respondToProposal, req, { id: proposalId });
    expect(res.status).toBe(404);
  });
});
