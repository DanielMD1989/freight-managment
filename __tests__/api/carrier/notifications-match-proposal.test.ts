/**
 * Match Proposal Carrier Notification Filter Tests — Round N2
 *
 * NB-1: G-N2-1 — carrier user query in POST /api/match-proposals uses
 *       `status: "ACTIVE"` not the deprecated `isActive: true` field.
 *       Suspended/pending carrier users must NOT receive the MATCH_PROPOSAL notification.
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

const { POST: createProposal } = require("@/app/api/match-proposals/route");

function callCreateProposal(body: object) {
  const req = createRequest(
    "POST",
    "http://localhost:3000/api/match-proposals",
    { body }
  );
  return createProposal(req);
}

describe("Match Proposal Carrier Notification Filter (G-N2-1)", () => {
  let createNotification: jest.Mock;

  beforeAll(() => {
    createNotification = require("@/lib/notifications").createNotification;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // NB-1: Only ACTIVE carrier users receive the MATCH_PROPOSAL notification
  it("NB-1: match proposal → only ACTIVE carrier users notified, SUSPENDED user excluded", async () => {
    const shipperOrg = await db.organization.create({
      data: {
        id: "nmp-shipper-1",
        name: "NMP Shipper",
        type: "SHIPPER",
        contactEmail: "nmpshipper@test.com",
        contactPhone: "+251911600001",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const carrierOrg = await db.organization.create({
      data: {
        id: "nmp-carrier-1",
        name: "NMP Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "nmpcarrier@test.com",
        contactPhone: "+251911600002",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const dispatcherOrg = await db.organization.create({
      data: {
        id: "nmp-dispatcher-org-1",
        name: "NMP Dispatcher Org",
        type: "DISPATCHER",
        contactEmail: "nmpdispatcher@test.com",
        contactPhone: "+251911600005",
        isVerified: true,
      },
    });

    // Active carrier user — should get notified
    await db.user.create({
      data: {
        id: "nmp-carrier-user-active",
        email: "active@nmpcarrier.com",
        passwordHash: "hash",
        firstName: "Active",
        lastName: "User",
        phone: "+251911600003",
        role: "CARRIER",
        status: "ACTIVE",
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });

    // Suspended carrier user — must NOT get notified (isActive=true historically,
    // but status="SUSPENDED"; G-N2-1 fix ensures status field is used)
    await db.user.create({
      data: {
        id: "nmp-carrier-user-suspended",
        email: "suspended@nmpcarrier.com",
        passwordHash: "hash",
        firstName: "Suspended",
        lastName: "User",
        phone: "+251911600004",
        role: "CARRIER",
        status: "SUSPENDED",
        isActive: true, // deprecated field still true — verifies bug was real
        organizationId: carrierOrg.id,
      },
    });

    const load = await db.load.create({
      data: {
        id: "nmp-load-1",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Test cargo",
        shipperId: shipperOrg.id,
        createdById: "nmp-shipper-user-1",
        postedAt: new Date(),
      },
    });

    const truck = await db.truck.create({
      data: {
        id: "nmp-truck-1",
        truckType: "DRY_VAN",
        licensePlate: "NMP-0001",
        capacity: 10000,
        isAvailable: true,
        carrierId: carrierOrg.id,
        createdById: "nmp-carrier-user-active",
        approvalStatus: "APPROVED",
      },
    });

    // Dispatcher session
    setAuthSession(
      createMockSession({
        userId: "nmp-dispatcher-user-1",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: dispatcherOrg.id,
      })
    );

    const res = await callCreateProposal({
      loadId: load.id,
      truckId: truck.id,
      expiresInHours: 24,
    });

    const body = await parseResponse(res);
    expect(res.status).toBe(201);
    expect(body.proposal).toBeDefined();

    // Only the ACTIVE carrier user's notification call should appear
    const carrierCalls = createNotification.mock.calls.filter(
      (call) =>
        call[0].type === "MATCH_PROPOSAL" &&
        call[0].userId &&
        call[0].userId.includes("nmp-carrier-user")
    );
    const notifiedUserIds = carrierCalls.map((call) => call[0].userId);

    expect(notifiedUserIds).toContain("nmp-carrier-user-active");
    expect(notifiedUserIds).not.toContain("nmp-carrier-user-suspended");
  });

  // NB-1b: When all carrier users are ACTIVE, all get notified
  it("NB-1b: all ACTIVE carrier users in org receive MATCH_PROPOSAL notification", async () => {
    const carrierOrg = await db.organization.create({
      data: {
        id: "nmp-carrier-2",
        name: "NMP Carrier 2",
        type: "CARRIER_COMPANY",
        contactEmail: "nmpcarrier2@test.com",
        contactPhone: "+251911600010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const dispatcherOrg = await db.organization.create({
      data: {
        id: "nmp-dispatcher-org-2",
        name: "NMP Dispatcher 2",
        type: "DISPATCHER",
        contactEmail: "nmpdispatcher2@test.com",
        contactPhone: "+251911600011",
        isVerified: true,
      },
    });

    const shipperOrg = await db.organization.create({
      data: {
        id: "nmp-shipper-2",
        name: "NMP Shipper 2",
        type: "SHIPPER",
        contactEmail: "nmpshipper2@test.com",
        contactPhone: "+251911600012",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    await db.user.create({
      data: {
        id: "nmp-carrier-user-2a",
        email: "user2a@nmpcarrier2.com",
        passwordHash: "hash",
        firstName: "Two",
        lastName: "A",
        phone: "+251911600013",
        role: "CARRIER",
        status: "ACTIVE",
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });

    await db.user.create({
      data: {
        id: "nmp-carrier-user-2b",
        email: "user2b@nmpcarrier2.com",
        passwordHash: "hash",
        firstName: "Two",
        lastName: "B",
        phone: "+251911600014",
        role: "CARRIER",
        status: "ACTIVE",
        isActive: true,
        organizationId: carrierOrg.id,
      },
    });

    const load = await db.load.create({
      data: {
        id: "nmp-load-2",
        status: "POSTED",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 8000,
        cargoDescription: "Cargo 2",
        shipperId: shipperOrg.id,
        createdById: "nmp-shipper-user-2",
        postedAt: new Date(),
      },
    });

    const truck = await db.truck.create({
      data: {
        id: "nmp-truck-2",
        truckType: "FLATBED",
        licensePlate: "NMP-0002",
        capacity: 12000,
        isAvailable: true,
        carrierId: carrierOrg.id,
        createdById: "nmp-carrier-user-2a",
        approvalStatus: "APPROVED",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "nmp-dispatcher-user-2",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: dispatcherOrg.id,
      })
    );

    const res = await callCreateProposal({
      loadId: load.id,
      truckId: truck.id,
      expiresInHours: 24,
    });

    expect(res.status).toBe(201);

    const carrierCalls = createNotification.mock.calls.filter(
      (call) =>
        call[0].type === "MATCH_PROPOSAL" &&
        call[0].userId?.includes("nmp-carrier-user-2")
    );
    const notifiedUserIds = carrierCalls.map((call) => call[0].userId);
    expect(notifiedUserIds).toContain("nmp-carrier-user-2a");
    expect(notifiedUserIds).toContain("nmp-carrier-user-2b");
  });
});
