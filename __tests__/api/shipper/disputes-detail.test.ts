// @jest-environment node
/**
 * Dispute Detail Tests (GAP cover + BUG-R3-3)
 *
 * Route tested:
 * - GET /api/disputes/[id]  → get individual dispute details
 *
 * Business rules verified:
 * - DD-1: Shipper GET own dispute → 200
 * - DD-2: Carrier GET dispute for their assigned load → 200
 * - DD-3: DISPATCHER with shipper-org GET dispute → 404 (BUG-R3-3 fix)
 * - DD-4: DISPATCHER with carrier-org GET dispute → 404 (BUG-R3-3 fix)
 * - DD-5: Unrelated shipper (different org) GET dispute → 404 (resource cloaking)
 * - DD-6: Nonexistent dispute ID → 404
 * - DD-7: Admin GET any dispute → 200
 * - DD-8: Unauthenticated → 401
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  parseResponse,
  seedTestData,
  clearAllStores,
  callHandler,
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
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// Route handler AFTER mocks
const { GET: getDispute } = require("@/app/api/disputes/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "carrier-user-1",
  role: "CARRIER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Dispute Detail — GET /api/disputes/[id]", () => {
  let seededDisputeId: string;

  beforeAll(async () => {
    await seedTestData();

    // Admin org + user for DD-7
    await db.organization.create({
      data: {
        id: "dd-admin-org-1",
        name: "DD Admin Org",
        type: "PLATFORM",
        contactEmail: "dd-admin@test.com",
        contactPhone: "+251911000080",
      },
    });
    await db.user.create({
      data: {
        id: "dd-admin-user-1",
        email: "dd-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "DD",
        lastName: "Admin",
        phone: "+251911000080",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "dd-admin-org-1",
      },
    });

    // Second shipper org for DD-5 cross-org test
    await db.organization.create({
      data: {
        id: "dd-shipper-org-2",
        name: "DD Other Shipper",
        type: "SHIPPER",
        contactEmail: "dd-other-shipper@test.com",
        contactPhone: "+251911000081",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "dd-shipper-user-2",
        email: "dd-other-shipper@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251911000081",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "dd-shipper-org-2",
      },
    });

    // DISPATCHER in shipper-org-1 for DD-3
    await db.user.create({
      data: {
        id: "dd-dispatcher-shipper-1",
        email: "dd-dispatcher-shipper@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "DDDisp",
        lastName: "Shipper",
        phone: "+251911000082",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "shipper-org-1",
      },
    });

    // DISPATCHER in carrier-org-1 for DD-4
    await db.user.create({
      data: {
        id: "dd-dispatcher-carrier-1",
        email: "dd-dispatcher-carrier@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "DDDisp",
        lastName: "Carrier",
        phone: "+251911000083",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
    });

    // Set load to ASSIGNED with a truck so carrier access check works
    await db.load.update({
      where: { id: "test-load-001" },
      data: {
        status: "ASSIGNED",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
      },
    });

    // Seed a dispute to fetch in GET tests
    const dispute = await db.dispute.create({
      data: {
        type: "PAYMENT_ISSUE",
        description: "Test dispute for GET endpoint coverage",
        status: "OPEN",
        loadId: "test-load-001",
        createdById: "shipper-user-1",
        disputedOrgId: "carrier-org-1",
      },
    });
    seededDisputeId = dispute.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // DD-1: Shipper GET own dispute → 200
  it("DD-1: shipper GET own dispute → 200 with dispute object", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.dispute).toBeDefined();
    expect(body.dispute.id).toBe(seededDisputeId);
  });

  // DD-2: Carrier GET dispute for their assigned load → 200
  it("DD-2: carrier GET dispute for their assigned load → 200", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.dispute).toBeDefined();
    expect(body.dispute.id).toBe(seededDisputeId);
  });

  // DD-3: DISPATCHER with shipper-org GET dispute → 404 (BUG-R3-3 fix)
  it("DD-3: DISPATCHER with shipper-org GET dispute → 404 (BUG-R3-3 fix)", async () => {
    const dispatcherShipperOrg = createMockSession({
      userId: "dd-dispatcher-shipper-1",
      role: "DISPATCHER",
      organizationId: "shipper-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherShipperOrg);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });
    const body = await parseResponse(res);

    // BUG-R3-3 fix: DISPATCHER org matches shipper-org but role is not SHIPPER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // DD-4: DISPATCHER with carrier-org GET dispute → 404 (BUG-R3-3 fix)
  it("DD-4: DISPATCHER with carrier-org GET dispute → 404 (BUG-R3-3 fix)", async () => {
    const dispatcherCarrierOrg = createMockSession({
      userId: "dd-dispatcher-carrier-1",
      role: "DISPATCHER",
      organizationId: "carrier-org-1",
      status: "ACTIVE",
    });
    setAuthSession(dispatcherCarrierOrg);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });
    const body = await parseResponse(res);

    // BUG-R3-3 fix: DISPATCHER org matches carrier-org but role is not CARRIER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // DD-5: Unrelated shipper (different org) GET dispute → 404 (resource cloaking)
  it("DD-5: unrelated shipper (different org) GET dispute → 404 (resource cloaking)", async () => {
    const otherShipperSession = createMockSession({
      userId: "dd-shipper-user-2",
      role: "SHIPPER",
      organizationId: "dd-shipper-org-2",
      status: "ACTIVE",
    });
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // DD-6: Nonexistent dispute ID → 404
  it("DD-6: nonexistent dispute ID → 404", async () => {
    setAuthSession(shipperSession);

    const fakeId = "00000000-0000-0000-0000-000000000000";
    const req = createRequest("GET", `http://localhost/api/disputes/${fakeId}`);
    const res = await callHandler(getDispute, req, { id: fakeId });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // DD-7: Admin GET any dispute → 200
  it("DD-7: admin GET any dispute → 200", async () => {
    const adminSession = createMockSession({
      userId: "dd-admin-user-1",
      role: "ADMIN",
      organizationId: "dd-admin-org-1",
      status: "ACTIVE",
    });
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.dispute).toBeDefined();
    expect(body.dispute.id).toBe(seededDisputeId);
  });

  // DD-8: Unauthenticated → 401
  it("DD-8: unauthenticated GET /api/disputes/[id] → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${seededDisputeId}`
    );
    const res = await callHandler(getDispute, req, { id: seededDisputeId });

    expect(res.status).toBe(401);
  });
});
