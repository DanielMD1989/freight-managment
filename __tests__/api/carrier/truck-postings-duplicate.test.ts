/**
 * Truck Posting Duplicate Tests
 *
 * Tests for POST /api/truck-postings/[id]/duplicate
 *
 * Business rules tested:
 * - Only carriers/admins can duplicate
 * - Ownership verification
 * - ONE_ACTIVE_POST_PER_TRUCK enforcement (409)
 * - Custom CSRF: mobile requires Bearer auth
 * - Duplicated posting gets status ACTIVE
 * - Can duplicate CANCELLED/EXPIRED postings
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

// Import handler AFTER mocks
const {
  POST: duplicatePosting,
} = require("@/app/api/truck-postings/[id]/duplicate/route");

describe("Truck Posting Duplicate", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other-carrier@test.com",
    role: "CARRIER",
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

    await db.user.create({
      data: {
        id: "other-carrier-user",
        email: "other-carrier@test.com",
        role: "CARRIER",
        organizationId: "other-carrier-org",
        firstName: "Other",
        lastName: "Carrier",
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
    setAuthSession(carrierSession);
  });

  // ─── Success cases ───────────────────────────────────────────────

  describe("Success cases", () => {
    it("should duplicate a CANCELLED posting → 201 with ACTIVE status", async () => {
      // Create a cancelled posting (no active posting for this truck)
      const cancelledPosting = await db.truckPosting.create({
        data: {
          id: "posting-cancelled-dup",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "city-addis",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "CANCELLED",
          fullPartial: "FULL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
        },
      });

      // Deactivate the existing active posting
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "CANCELLED" },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-postings/${cancelledPosting.id}/duplicate`
      );
      const res = await callHandler(duplicatePosting, req, {
        id: cancelledPosting.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(body.status).toBe("ACTIVE");
      expect(body.id).not.toBe(cancelledPosting.id);
      expect(body.truckId).toBe(seed.truck.id);

      // Clean up: remove the duplicated posting so it doesn't interfere
      await db.truckPosting.delete({ where: { id: body.id } });
      // Restore seed posting
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "ACTIVE" },
      });
    });

    it("should allow admin to duplicate any posting → 201", async () => {
      setAuthSession(adminSession);

      // Deactivate the existing active posting first
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "EXPIRED" },
      });

      const expiredPosting = await db.truckPosting.create({
        data: {
          id: "posting-admin-dup",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "city-addis",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "EXPIRED",
          fullPartial: "FULL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-postings/${expiredPosting.id}/duplicate`
      );
      const res = await callHandler(duplicatePosting, req, {
        id: expiredPosting.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(body.status).toBe("ACTIVE");

      // Clean up
      await db.truckPosting.delete({ where: { id: body.id } });
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "ACTIVE" },
      });
    });
  });

  // ─── Authorization ───────────────────────────────────────────────

  describe("Authorization", () => {
    it("should deny shipper → 403", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/duplicate`
      );
      const res = await callHandler(duplicatePosting, req, {
        id: seed.truckPosting.id,
      });

      expect(res.status).toBe(403);
    });

    it("should deny other carrier's posting → 403", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/duplicate`
      );
      const res = await callHandler(duplicatePosting, req, {
        id: seed.truckPosting.id,
      });

      expect(res.status).toBe(403);
    });

    // Note: The duplicate endpoint now uses validateCSRFWithMobile (standard CSRF)
    // instead of a hand-rolled mobile Bearer check, so the mobile-without-Bearer
    // scenario is handled by the standard CSRF middleware (tested elsewhere).
  });

  // ─── Business rules ───────────────────────────────────────────────

  describe("Business rules", () => {
    it("should return 409 when truck already has active posting", async () => {
      // seed.truckPosting is already ACTIVE for seed.truck
      const anotherPosting = await db.truckPosting.create({
        data: {
          id: "posting-another-expired",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "city-dire",
          originCityName: "Dire Dawa",
          availableFrom: new Date(),
          status: "EXPIRED",
          fullPartial: "FULL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-postings/${anotherPosting.id}/duplicate`
      );
      const res = await callHandler(duplicatePosting, req, {
        id: anotherPosting.id,
      });

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toContain("active posting");
    });

    it("should return 404 for non-existent posting", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings/nonexistent/duplicate"
      );
      const res = await callHandler(duplicatePosting, req, {
        id: "nonexistent",
      });

      expect(res.status).toBe(404);
    });

    it("should duplicate EXPIRED posting with new ACTIVE status", async () => {
      // Deactivate seed posting first
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "MATCHED" },
      });

      const expiredPost = await db.truckPosting.create({
        data: {
          id: "posting-expired-dup2",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "city-addis",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "EXPIRED",
          fullPartial: "PARTIAL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-postings/${expiredPost.id}/duplicate`
      );
      const res = await callHandler(duplicatePosting, req, {
        id: expiredPost.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(body.status).toBe("ACTIVE");

      // Clean up
      await db.truckPosting.delete({ where: { id: body.id } });
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "ACTIVE" },
      });
    });
  });
});
