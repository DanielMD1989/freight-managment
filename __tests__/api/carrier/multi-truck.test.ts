/**
 * Multi-Truck Management Tests — Round M12
 *
 * Verifies that carriers with multiple trucks get correct independent behavior:
 * - T1: Post approved truck while sibling is PENDING → 201 / 403
 * - T2: Post two APPROVED trucks simultaneously → both 201
 * - T3: Reject truck with ACTIVE posting → posting becomes CANCELLED
 * - T4: Rejected truck's posting absent from GET /api/truck-postings
 * - T5: Reject truck with pending truck-request → request becomes CANCELLED
 * - T6: TOCTOU — respond APPROVE after truck rejected → 400
 * - T7: Approve truck A, reject truck B → A unaffected
 * - T8: Wallet check is per-org — one balance covers both trucks
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
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  SeedData,
  createGpsDeviceForTruck,
} from "../../utils/routeTestUtils";

// Setup mocks
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
mockAuditLog();
mockGps();
mockSms();

// Foundation rules mock
jest.mock("@/lib/foundation-rules", () => ({
  getVisibilityRules: jest.fn((role: string) => ({
    canViewAllTrucks: role !== "SHIPPER",
    canViewAllLoads: role !== "CARRIER",
    canViewOwnTrucksOnly: role === "CARRIER",
    canViewOwnLoadsOnly: role === "SHIPPER",
  })),
  RULE_SHIPPER_DEMAND_FOCUS: {
    id: "SHIPPER_DEMAND_FOCUS",
    description: "Shippers cannot browse truck fleet",
  },
  RULE_ONE_ACTIVE_POST_PER_TRUCK: {
    id: "ONE_ACTIVE_POST_PER_TRUCK",
    description: "One active posting per truck",
  },
  RULE_CARRIER_FINAL_AUTHORITY: {
    id: "CARRIER_FINAL_AUTHORITY",
    description: "Carrier must approve",
  },
  validateOneActivePostPerTruck: jest.fn(() => ({ valid: true })),
  canModifyTruckOwnership: jest.fn((role: string) => role === "CARRIER"),
  canDirectlyAssignLoads: jest.fn((role: string) =>
    ["CARRIER", "ADMIN", "SUPER_ADMIN"].includes(role)
  ),
  canProposeMatches: jest.fn((role: string) =>
    ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(role)
  ),
  canStartTrips: jest.fn((role: string) => role === "CARRIER"),
  canAcceptLoadRequests: jest.fn((role: string) => role === "CARRIER"),
  assertDispatcherCannotAssign: jest.fn(),
  assertCarrierOwnership: jest.fn(),
  assertOneActivePost: jest.fn(),
  FoundationRuleViolation: class FoundationRuleViolation extends Error {
    ruleId: string;
    constructor(ruleId: string, desc: string) {
      super(desc);
      this.ruleId = ruleId;
    }
  },
}));
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  validateIdFormat: jest.fn(() => ({ valid: true })),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: error.errors },
      { status: 400 }
    );
  }),
}));

// Mock rbac/permissions for approve route
jest.mock("@/lib/rbac/permissions", () => ({
  hasPermission: jest.fn((_role: string, _perm: string) => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    return session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";
  }),
  Permission: {
    VERIFY_DOCUMENTS: "verify_documents",
  },
}));

// Mock email
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({ success: true })),
  createEmailHTML: jest.fn((content: string) => `<html>${content}</html>`),
}));

// Import handlers AFTER mocks
const {
  POST: createPosting,
  GET: listPostings,
} = require("@/app/api/truck-postings/route");
const { POST: approveTruck } = require("@/app/api/trucks/[id]/approve/route");
const {
  POST: respondTruckRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");

describe("Multi-Truck Management — M12", () => {
  let seed: SeedData;
  let originLocation: any;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "admin-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    status: "ACTIVE",
    organizationId: "shipper-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin user
    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create an Ethiopian location for origin city
    originLocation = await db.ethiopianLocation.create({
      data: {
        id: "city-multi-truck",
        name: "Bahir Dar",
        nameEthiopic: "ባህር ዳር",
        region: "Amhara",
        isActive: true,
        latitude: 11.6,
        longitude: 37.39,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── T1: Post approved truck while sibling is PENDING ────────────────────

  it("T1: post approved truck A succeeds; post pending truck B → 403", async () => {
    const truckA = await db.truck.create({
      data: {
        id: "mt-truck-a-approved",
        truckType: "FLATBED",
        licensePlate: "MT-A-001",
        capacity: 15000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    const truckB = await db.truck.create({
      data: {
        id: "mt-truck-b-pending",
        truckType: "FLATBED",
        licensePlate: "MT-B-001",
        capacity: 15000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    // §11 GPS Tracking Policy: truck needs GPS device before posting
    await createGpsDeviceForTruck(truckA.id);

    setAuthSession(carrierSession);

    // Post truck A — should succeed
    const reqA = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckA.id,
          originCityId: originLocation.id,
          availableFrom: new Date(Date.now() + 86400000).toISOString(),
          contactName: "Driver A",
          contactPhone: "+251911111111",
        },
      }
    );
    const resA = await createPosting(reqA);
    expect(resA.status).toBe(201);

    // Post truck B — should fail with 403
    const reqB = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckB.id,
          originCityId: originLocation.id,
          availableFrom: new Date(Date.now() + 86400000).toISOString(),
          contactName: "Driver B",
          contactPhone: "+251911111112",
        },
      }
    );
    const resB = await createPosting(reqB);
    expect(resB.status).toBe(403);

    const dataB = await parseResponse(resB);
    expect(dataB.error).toContain("approved");
  });

  // ─── T2: Post two APPROVED trucks simultaneously ─────────────────────────

  it("T2: post two APPROVED trucks simultaneously → both 201", async () => {
    const truckC = await db.truck.create({
      data: {
        id: "mt-truck-c-approved",
        truckType: "DRY_VAN",
        licensePlate: "MT-C-001",
        capacity: 10000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    const truckD = await db.truck.create({
      data: {
        id: "mt-truck-d-approved",
        truckType: "DRY_VAN",
        licensePlate: "MT-D-001",
        capacity: 10000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // §11 GPS Tracking Policy: trucks need GPS devices before posting
    await createGpsDeviceForTruck(truckC.id);
    await createGpsDeviceForTruck(truckD.id);

    setAuthSession(carrierSession);

    const reqC = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckC.id,
          originCityId: originLocation.id,
          availableFrom: new Date(Date.now() + 86400000).toISOString(),
          contactName: "Driver C",
          contactPhone: "+251911222333",
        },
      }
    );
    const resC = await createPosting(reqC);
    expect(resC.status).toBe(201);

    const reqD = createRequest(
      "POST",
      "http://localhost:3000/api/truck-postings",
      {
        body: {
          truckId: truckD.id,
          originCityId: originLocation.id,
          availableFrom: new Date(Date.now() + 86400000).toISOString(),
          contactName: "Driver D",
          contactPhone: "+251911222334",
        },
      }
    );
    const resD = await createPosting(reqD);
    expect(resD.status).toBe(201);
  });

  // ─── T3: Reject PENDING truck with ACTIVE posting → posting CANCELLED ────
  // Defense-in-depth: PENDING trucks normally can't have postings (creation requires APPROVED),
  // but stale data or direct DB manipulation could leave one. The cleanup runs regardless.

  it("T3: rejecting PENDING truck cancels any stale ACTIVE posting", async () => {
    const truckE = await db.truck.create({
      data: {
        id: "mt-truck-e-reject",
        truckType: "FLATBED",
        licensePlate: "MT-E-001",
        capacity: 20000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    // Simulate stale ACTIVE posting (e.g., from direct DB insert or pre-fix state)
    await db.truckPosting.create({
      data: {
        id: "mt-posting-e",
        truckId: truckE.id,
        carrierId: seed.carrierOrg.id,
        originCityId: originLocation.id,
        originCityName: "Bahir Dar",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "Driver E",
        contactPhone: "+251911333444",
      },
    });

    // Admin rejects truck E
    setAuthSession(adminSession);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${truckE.id}/approve`,
      {
        body: {
          action: "REJECT",
          reason: "Documents are expired and need renewal",
        },
      }
    );
    const res = await callHandler(approveTruck, req, { id: truckE.id });
    expect(res.status).toBe(200);

    // Verify posting is now CANCELLED
    const posting = await db.truckPosting.findUnique({
      where: { id: "mt-posting-e" },
    });
    expect(posting.status).toBe("CANCELLED");
  });

  // ─── T4: GET /api/truck-postings includes approvalStatus filter ───────────

  it("T4: GET /api/truck-postings query includes approvalStatus: APPROVED filter", async () => {
    // GET /api/truck-postings as public (no auth)
    setAuthSession(null);
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await listPostings(req);
    expect(res.status).toBe(200);

    // G-M12-1b: Verify the findMany call includes truck.approvalStatus filter
    const findManyCalls = (db.truckPosting.findMany as jest.Mock).mock.calls;
    const lastCall = findManyCalls[findManyCalls.length - 1];
    const whereArg = lastCall?.[0]?.where;

    expect(whereArg).toBeDefined();
    expect(whereArg.truck).toBeDefined();
    expect(whereArg.truck.approvalStatus).toBe("APPROVED");
  });

  // ─── T5: Reject truck with pending truck-request → request CANCELLED ─────

  it("T5: rejecting PENDING truck cancels any stale pending truck-requests", async () => {
    const truckG = await db.truck.create({
      data: {
        id: "mt-truck-g-reqcancel",
        truckType: "DRY_VAN",
        licensePlate: "MT-G-001",
        capacity: 10000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    // Simulate stale pending truck-request (defense-in-depth)
    await db.truckRequest.create({
      data: {
        id: "mt-request-g",
        truckId: truckG.id,
        loadId: seed.load.id,
        shipperId: seed.shipperOrg.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.shipperUser.id,
        status: "PENDING",
      },
    });

    // Admin rejects truck G
    setAuthSession(adminSession);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${truckG.id}/approve`,
      {
        body: {
          action: "REJECT",
          reason: "Failed safety inspection requirements",
        },
      }
    );
    const res = await callHandler(approveTruck, req, { id: truckG.id });
    expect(res.status).toBe(200);

    // Verify truck-request is now CANCELLED
    const request = await db.truckRequest.findUnique({
      where: { id: "mt-request-g" },
    });
    expect(request.status).toBe("CANCELLED");
  });

  // ─── T6: TOCTOU — respond APPROVE after truck rejected → 400 ────────────

  it("T6: responding APPROVE to truck-request after truck rejected → 400", async () => {
    const truckH = await db.truck.create({
      data: {
        id: "mt-truck-h-toctou",
        truckType: "FLATBED",
        licensePlate: "MT-H-001",
        capacity: 15000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "REJECTED",
        rejectionReason: "License plate mismatch",
      },
    });

    // Create a pending truck-request (simulating it was created before rejection)
    await db.truckRequest.create({
      data: {
        id: "mt-request-h",
        truckId: truckH.id,
        loadId: seed.load.id,
        shipperId: seed.shipperOrg.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.shipperUser.id,
        status: "PENDING",
      },
    });

    // Carrier tries to APPROVE the request — should fail because truck is REJECTED
    setAuthSession(carrierSession);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/truck-requests/${"mt-request-h"}/respond`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(respondTruckRequest, req, {
      id: "mt-request-h",
    });
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("no longer approved");
  });

  // ─── T7: Approve truck A, reject truck B → A unaffected ─────────────────

  it("T7: approving truck A and rejecting truck B — A remains APPROVED", async () => {
    const truckI = await db.truck.create({
      data: {
        id: "mt-truck-i-independent",
        truckType: "DRY_VAN",
        licensePlate: "MT-I-001",
        capacity: 12000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    const truckJ = await db.truck.create({
      data: {
        id: "mt-truck-j-independent",
        truckType: "FLATBED",
        licensePlate: "MT-J-001",
        capacity: 18000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    setAuthSession(adminSession);

    // Approve truck I
    const reqI = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${truckI.id}/approve`,
      { body: { action: "APPROVE" } }
    );
    const resI = await callHandler(approveTruck, reqI, { id: truckI.id });
    expect(resI.status).toBe(200);
    const dataI = await parseResponse(resI);
    expect(dataI.truck.approvalStatus).toBe("APPROVED");

    // Reject truck J
    const reqJ = createRequest(
      "POST",
      `http://localhost:3000/api/trucks/${truckJ.id}/approve`,
      {
        body: {
          action: "REJECT",
          reason: "Missing required documentation for vehicle",
        },
      }
    );
    const resJ = await callHandler(approveTruck, reqJ, { id: truckJ.id });
    expect(resJ.status).toBe(200);
    const dataJ = await parseResponse(resJ);
    expect(dataJ.truck.approvalStatus).toBe("REJECTED");

    // Verify truck I is still APPROVED (not affected by truck J's rejection)
    const truckIAfter = await db.truck.findUnique({
      where: { id: truckI.id },
    });
    expect(truckIAfter.approvalStatus).toBe("APPROVED");
  });

  // ─── T8: Wallet check is per-org ────────────────────────────────────────

  it("T8: wallet check is per-org — one minimumBalance affects all trucks", async () => {
    // Set carrier wallet minimumBalance very high
    const wallet = await db.financialAccount.findFirst({
      where: { organizationId: seed.carrierOrg.id },
    });
    if (wallet) {
      await db.financialAccount.update({
        where: { id: wallet.id },
        data: { minimumBalance: 9999999, balance: 100 },
      });
    }

    // Carrier tries to browse truck-postings — should be blocked with 402
    setAuthSession(carrierSession);
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await listPostings(req);
    expect(res.status).toBe(402);

    const data = await parseResponse(res);
    expect(data.error).toContain("wallet");

    // Reset wallet
    if (wallet) {
      await db.financialAccount.update({
        where: { id: wallet.id },
        data: { minimumBalance: 0, balance: 5000 },
      });
    }
  });
});
