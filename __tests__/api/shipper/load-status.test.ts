// @jest-environment node
/**
 * Shipper Load Status API Tests
 *
 * Tests for the load status endpoints:
 * - PATCH /api/loads/[id]/status  → update load status
 * - GET  /api/loads/[id]/status   → get current status + valid next states
 *
 * Business rules tested:
 * - DRAFT→POSTED transition succeeds for shipper (200, tripSynced: false)
 * - GET returns currentStatus and validNextStates array
 * - Shipper cannot set IN_TRANSIT or other carrier-only statuses (403)
 * - Shipper cannot set EXCEPTION (403)
 * - Invalid state machine transition returns 400
 * - COMPLETED status triggers deductServiceFee; response includes serviceFee
 * - COMPLETED when deductServiceFee fails → 400 (blocks completion)
 * - Carrier can set DELIVERED on an assigned load (200)
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

// Mock automation rules (dynamic import in route, best-effort)
jest.mock("@/lib/automationRules", () => ({
  evaluateRulesForTrigger: jest.fn(async () => []),
}));
jest.mock("@/lib/automationActions", () => ({
  executeAndRecordRuleActions: jest.fn(async () => {}),
}));

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
const {
  PATCH: updateStatus,
  GET: getStatus,
} = require("@/app/api/loads/[id]/status/route");

describe("Load Status API", () => {
  let seed: SeedData;

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    status: "ACTIVE",
    organizationId: "shipper-org-1",
  });

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

  beforeAll(async () => {
    seed = await seedTestData();
  });

  beforeEach(() => {
    setAuthSession(shipperSession);
    jest.clearAllMocks();
  });

  afterAll(() => {
    clearAllStores();
  });

  // ─── PATCH /api/loads/[id]/status ────────────────────────────────────────

  describe("PATCH /loads/[id]/status", () => {
    it("DRAFT→POSTED succeeds for shipper → 200, { load: { status: 'POSTED' }, tripSynced: false }", async () => {
      // The seeded load has status "POSTED"; create a DRAFT load for this transition
      await db.load.create({
        data: {
          id: "load-draft-001",
          status: "DRAFT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Draft cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/load-draft-001/status",
        { body: { status: "POSTED" } }
      );

      const res = await callHandler(updateStatus, req, {
        id: "load-draft-001",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.status).toBe("POSTED");
      expect(data.tripSynced).toBe(false);
    });

    it("GET /loads/[id]/status → 200, { currentStatus, validNextStates: [] }", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}/status`
      );

      const res = await callHandler(getStatus, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.currentStatus).toBeDefined();
      expect(Array.isArray(data.validNextStates)).toBe(true);
      // The mock returns [] for getValidNextStates
      expect(data.validNextStates).toEqual([]);
    });

    it("shipper tries to set IN_TRANSIT → 403 with correct message", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${seed.load.id}/status`,
        { body: { status: "IN_TRANSIT" } }
      );

      const res = await callHandler(updateStatus, req, { id: seed.load.id });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toMatch(
        /Shippers can only set status to DRAFT, POSTED, CANCELLED, or UNPOSTED/
      );
    });

    it("shipper tries to set EXCEPTION → 403", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${seed.load.id}/status`,
        { body: { status: "EXCEPTION" } }
      );

      const res = await callHandler(updateStatus, req, { id: seed.load.id });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toMatch(
        /Shippers can only set status to DRAFT, POSTED, CANCELLED, or UNPOSTED/
      );
    });

    it("invalid state machine transition → 400", async () => {
      // Override validateStateTransition to return invalid for this one call
      jest
        .requireMock("@/lib/loadStateMachine")
        .validateStateTransition.mockReturnValueOnce({
          valid: false,
          error: "Invalid transition",
        });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${seed.load.id}/status`,
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateStatus, req, { id: seed.load.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toBe("Invalid transition");
    });

    it("COMPLETED status calls deductServiceFee; response has serviceFee.success: true", async () => {
      setAuthSession(adminSession);

      // Create a load in DELIVERED state so admin can transition to COMPLETED
      await db.load.create({
        data: {
          id: "load-delivered-001",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Delivered cargo awaiting completion",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/load-delivered-001/status",
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateStatus, req, {
        id: "load-delivered-001",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.serviceFee).toBeDefined();
      expect(data.serviceFee.success).toBe(true);

      // Verify deductServiceFee was called
      const deductServiceFee = jest.requireMock(
        "@/lib/serviceFeeManagement"
      ).deductServiceFee;
      expect(deductServiceFee).toHaveBeenCalledWith("load-delivered-001");
    });

    it("COMPLETED when deductServiceFee fails → 400", async () => {
      setAuthSession(adminSession);

      // Create another DELIVERED load
      await db.load.create({
        data: {
          id: "load-delivered-002",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "Cargo with fee failure",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      // Make deductServiceFee fail for this one call
      jest
        .requireMock("@/lib/serviceFeeManagement")
        .deductServiceFee.mockResolvedValueOnce({
          success: false,
          error: "Insufficient funds",
        });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/load-delivered-002/status",
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateStatus, req, {
        id: "load-delivered-002",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/Cannot complete trip: fee deduction failed/);
    });

    // GAP-3: Fee-already-deducted retry path (validates BUG-1 fix)

    it("COMPLETED retry when shipperFeeStatus=DEDUCTED → 200 (not 400)", async () => {
      setAuthSession(adminSession);

      // Simulate post-crash state: fees were deducted but status transaction failed.
      // shipperFeeStatus="DEDUCTED" but no SERVICE_FEE_DEDUCTED LoadEvent.
      await db.load.create({
        data: {
          id: "load-fee-deducted-retry",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Retry after crash cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          shipperFeeStatus: "DEDUCTED",
          postedAt: new Date(),
        },
      });

      // deductServiceFee should NOT be called (fees already deducted at DB level),
      // but set up mock to simulate the "already deducted" error just in case
      jest
        .requireMock("@/lib/serviceFeeManagement")
        .deductServiceFee.mockResolvedValueOnce({
          success: false,
          error: "Service fees already deducted",
        });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/load-fee-deducted-retry/status",
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateStatus, req, {
        id: "load-fee-deducted-retry",
      });

      // BUG-1 fix: route detects fees already deducted and skips deduction → 200
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.status).toBe("COMPLETED");
    });

    it("COMPLETED retry when deductServiceFee returns 'already deducted' error → 200", async () => {
      setAuthSession(adminSession);

      // Load is in DELIVERED state with no fee status set (PENDING by default)
      // but deductServiceFee returns the idempotency error
      await db.load.create({
        data: {
          id: "load-fee-idempotency-retry",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 2500,
          cargoDescription: "Idempotency retry cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      jest
        .requireMock("@/lib/serviceFeeManagement")
        .deductServiceFee.mockResolvedValueOnce({
          success: false,
          error: "Service fees already deducted",
        });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/load-fee-idempotency-retry/status",
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateStatus, req, {
        id: "load-fee-idempotency-retry",
      });

      // BUG-1 fix: "already deducted" error is treated as success → 200
      expect(res.status).toBe(200);
    });

    it("carrier sets DELIVERED on assigned load → 200", async () => {
      setAuthSession(carrierSession);

      // Create a load in IN_TRANSIT assigned to carrier's truck
      await db.load.create({
        data: {
          id: "load-in-transit-001",
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "In-transit cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          assignedTruckId: seed.truck.id,
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/load-in-transit-001/status",
        { body: { status: "DELIVERED" } }
      );

      const res = await callHandler(updateStatus, req, {
        id: "load-in-transit-001",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.status).toBe("DELIVERED");
    });
  });

  // ─── GET /api/loads/[id]/status ──────────────────────────────────────────

  describe("GET /loads/[id]/status", () => {
    it("returns currentStatus and description for existing load", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}/status`
      );

      const res = await callHandler(getStatus, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.currentStatus).toBe(seed.load.status);
      expect(data.description).toBeDefined();
    });

    it("non-existent load → 404", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/nonexistent-load/status"
      );

      const res = await callHandler(getStatus, req, { id: "nonexistent-load" });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/not found/i);
    });

    it("unauthenticated → 401 or 500", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}/status`
      );

      const res = await callHandler(getStatus, req, { id: seed.load.id });
      expect([401, 500]).toContain(res.status);
    });
  });
});
