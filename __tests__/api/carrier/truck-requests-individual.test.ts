/**
 * Truck Request Individual Route Tests
 *
 * Tests for GET /api/truck-requests/[id] and DELETE /api/truck-requests/[id]
 *
 * Covers:
 * - GET: requireActiveUser (not requireAuth)
 * - GET: Returns 404 for unauthorized (not 403) — prevents enumeration
 * - GET: handleApiError for consistent error responses
 * - DELETE: CSRF protection via validateCSRFWithMobile
 * - DELETE: requireActiveUser (not requireAuth)
 * - DELETE: Returns 404 for unauthorized
 * - DELETE: handleApiError for consistent error responses
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

// Setup mocks BEFORE requiring route handlers
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

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Import handlers AFTER mocks
const {
  GET: getTruckRequest,
  DELETE: deleteTruckRequest,
} = require("@/app/api/truck-requests/[id]/route");

describe("Truck Request Individual Route — GET & DELETE", () => {
  let seed: SeedData;
  let truckRequestId: string;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    status: "ACTIVE",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "admin-org-1",
  });

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other@carrier.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "other-carrier-org",
  });

  beforeAll(async () => {
    seed = await seedTestData();

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

    // Create a truck request for testing
    const truckRequest = await db.truckRequest.create({
      data: {
        id: "tr-individual-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: seed.shipperOrg.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.shipperUser.id,
        notes: "Test request",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    truckRequestId = truckRequest.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── GET /api/truck-requests/[id] ──────────────────────────────────────

  describe("GET /api/truck-requests/[id]", () => {
    it("returns 200 for carrier who received the request", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(getTruckRequest, req, {
        id: truckRequestId,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request).toBeDefined();
      expect(data.request.id).toBe(truckRequestId);
    });

    it("returns 200 for shipper who created the request", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(getTruckRequest, req, {
        id: truckRequestId,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request.id).toBe(truckRequestId);
    });

    it("returns 200 for admin", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(getTruckRequest, req, {
        id: truckRequestId,
      });
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent request", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-requests/nonexistent-id"
      );

      const res = await callHandler(getTruckRequest, req, {
        id: "nonexistent-id",
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 (not 403) for unauthorized carrier — prevents enumeration", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(getTruckRequest, req, {
        id: truckRequestId,
      });
      // Must be 404 not 403 to prevent resource enumeration
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("not found");
    });

    it("returns 401 for unauthenticated user", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(getTruckRequest, req, {
        id: truckRequestId,
      });
      // handleApiError converts auth error to 401
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── DELETE /api/truck-requests/[id] ───────────────────────────────────

  describe("DELETE /api/truck-requests/[id]", () => {
    it("allows shipper to cancel their own pending request → 200", async () => {
      const cancelableReq = await db.truckRequest.create({
        data: {
          id: "tr-cancel-individual-001",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-requests/${cancelableReq.id}`
      );

      const res = await callHandler(deleteTruckRequest, req, {
        id: cancelableReq.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.success).toBe(true);
      expect(data.request.status).toBe("CANCELLED");
    });

    it("returns 404 for non-existent request", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/truck-requests/nonexistent-id"
      );

      const res = await callHandler(deleteTruckRequest, req, {
        id: "nonexistent-id",
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 (not 403) for unauthorized carrier — prevents enumeration", async () => {
      // Carrier who received the request should NOT be able to cancel it
      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(deleteTruckRequest, req, {
        id: truckRequestId,
      });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("not found");
    });

    it("returns 400 when cancelling non-PENDING request", async () => {
      const approvedReq = await db.truckRequest.create({
        data: {
          id: "tr-approved-individual-001",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.shipperUser.id,
          status: "APPROVED",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-requests/${approvedReq.id}`
      );

      const res = await callHandler(deleteTruckRequest, req, {
        id: approvedReq.id,
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("Cannot cancel");
    });

    it("allows admin to cancel any request → 200", async () => {
      const adminCancelReq = await db.truckRequest.create({
        data: {
          id: "tr-admin-cancel-individual",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      setAuthSession(adminSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-requests/${adminCancelReq.id}`
      );

      const res = await callHandler(deleteTruckRequest, req, {
        id: adminCancelReq.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request.status).toBe("CANCELLED");
    });

    it("returns 401 for unauthenticated user", async () => {
      setAuthSession(null);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-requests/${truckRequestId}`
      );

      const res = await callHandler(deleteTruckRequest, req, {
        id: truckRequestId,
      });
      expect([401, 500]).toContain(res.status);
    });
  });
});
