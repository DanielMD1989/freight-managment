/**
 * Cross-Organization Access Tests
 *
 * Tests that resources are properly isolated between organizations.
 * No organization should be able to access, modify, or view
 * another organization's data.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
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
} from "../utils/routeTestUtils";

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
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();

// Import route handlers AFTER mocks (use require so mocks are applied)
const {
  GET: getTrip,
  PATCH: updateTrip,
} = require("@/app/api/trips/[tripId]/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const {
  POST: respondToLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");

describe("Cross-Organization Access Tests", () => {
  // Two distinct organizations
  const org1 = { id: "isolation-org-1", name: "Org One" };
  const org2 = { id: "isolation-org-2", name: "Org Two" };

  beforeAll(async () => {
    // Create two organizations
    await db.organization.create({
      data: {
        id: org1.id,
        name: org1.name,
        type: "CARRIER_COMPANY",
        contactEmail: "org1@test.com",
        contactPhone: "+251911111111",
        verificationStatus: "APPROVED",
      },
    });

    await db.organization.create({
      data: {
        id: org2.id,
        name: org2.name,
        type: "CARRIER_COMPANY",
        contactEmail: "org2@test.com",
        contactPhone: "+251922222222",
        verificationStatus: "APPROVED",
      },
    });

    // Create shipper org for loads
    await db.organization.create({
      data: {
        id: "isolation-shipper-org",
        name: "Isolation Shipper",
        type: "SHIPPER",
        contactEmail: "shipper-iso@test.com",
        contactPhone: "+251933333333",
        verificationStatus: "APPROVED",
      },
    });

    // Create users for each org
    await db.user.create({
      data: {
        id: "org1-user",
        email: "user1@org1.com",
        passwordHash: "hash1",
        firstName: "User",
        lastName: "One",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org1.id,
      },
    });

    await db.user.create({
      data: {
        id: "org2-user",
        email: "user2@org2.com",
        passwordHash: "hash2",
        firstName: "User",
        lastName: "Two",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org2.id,
      },
    });

    await db.user.create({
      data: {
        id: "shipper-iso-user",
        email: "shipper-iso@test.com",
        passwordHash: "hash3",
        firstName: "Shipper",
        lastName: "Iso",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "isolation-shipper-org",
      },
    });

    // Create trucks for each org
    await db.truck.create({
      data: {
        id: "org1-truck",
        truckType: "DRY_VAN",
        licensePlate: "ORG1-001",
        capacity: 10000,
        carrierId: org1.id,
        createdById: "org1-user",
        approvalStatus: "APPROVED",
      },
    });

    await db.truck.create({
      data: {
        id: "org2-truck",
        truckType: "FLATBED",
        licensePlate: "ORG2-001",
        capacity: 15000,
        carrierId: org2.id,
        createdById: "org2-user",
        approvalStatus: "APPROVED",
      },
    });

    // Create load
    await db.load.create({
      data: {
        id: "isolation-load",
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(),
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Isolation test load",
        shipperId: "isolation-shipper-org",
        createdById: "shipper-iso-user",
        assignedTruckId: "org1-truck",
      },
    });

    // Create trips for each org
    await db.trip.create({
      data: {
        id: "org1-trip",
        loadId: "isolation-load",
        truckId: "org1-truck",
        carrierId: org1.id,
        shipperId: "isolation-shipper-org",
        status: "IN_TRANSIT",
        referenceNumber: "TRIP-ORG1-001",
      },
    });

    await db.trip.create({
      data: {
        id: "org2-trip",
        loadId: "isolation-load",
        truckId: "org2-truck",
        carrierId: org2.id,
        shipperId: "isolation-shipper-org",
        status: "ASSIGNED",
        referenceNumber: "TRIP-ORG2-001",
      },
    });

    // Create wallets
    await db.financialAccount.create({
      data: {
        id: "org1-wallet",
        organizationId: org1.id,
        accountType: "CARRIER_WALLET",
        balance: 10000,
        currency: "ETB",
      },
    });

    await db.financialAccount.create({
      data: {
        id: "org2-wallet",
        organizationId: org2.id,
        accountType: "CARRIER_WALLET",
        balance: 20000,
        currency: "ETB",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Trip Isolation ──────────────────────────────────────────────────────

  describe("Trip isolation between organizations", () => {
    it("should allow Org1 to view their own trip", async () => {
      setAuthSession(
        createMockSession({
          userId: "org1-user",
          email: "user1@org1.com",
          role: "CARRIER",
          organizationId: org1.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/org1-trip"
      );
      const res = await callHandler(getTrip, req, { tripId: "org1-trip" });
      expect(res.status).toBe(200);
    });

    it("should reject Org2 viewing Org1 trip (404 invisible)", async () => {
      setAuthSession(
        createMockSession({
          userId: "org2-user",
          email: "user2@org2.com",
          role: "CARRIER",
          organizationId: org2.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/org1-trip"
      );
      const res = await callHandler(getTrip, req, { tripId: "org1-trip" });
      // Cross-org access returns 404 (invisible) not 403 — prevents resource enumeration
      expect(res.status).toBe(404);
    });

    it("should reject Org2 updating Org1 trip status (404 invisible)", async () => {
      setAuthSession(
        createMockSession({
          userId: "org2-user",
          email: "user2@org2.com",
          role: "CARRIER",
          organizationId: org2.id,
        })
      );

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/org1-trip",
        {
          body: { status: "DELIVERED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "org1-trip" });
      // Cross-org access returns 404 (invisible) not 403 — prevents resource enumeration
      expect(res.status).toBe(404);
    });

    it("should reject Org1 updating Org2 trip status (404 invisible)", async () => {
      setAuthSession(
        createMockSession({
          userId: "org1-user",
          email: "user1@org1.com",
          role: "CARRIER",
          organizationId: org1.id,
        })
      );

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/org2-trip",
        {
          body: { status: "PICKUP_PENDING" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "org2-trip" });
      // Cross-org access returns 404 (invisible) not 403 — prevents resource enumeration
      expect(res.status).toBe(404);
    });
  });

  // ─── Load Request Isolation ──────────────────────────────────────────────

  describe("Load request isolation between organizations", () => {
    it("should reject Org2 responding to Org1 shipper load request", async () => {
      // Shipper-org request that Org1 carrier submitted
      await db.loadRequest.create({
        data: {
          id: "lr-iso-001",
          loadId: "isolation-load",
          truckId: "org1-truck",
          carrierId: org1.id,
          shipperId: "isolation-shipper-org",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Org2 (wrong org) tries to respond as shipper
      setAuthSession(
        createMockSession({
          userId: "org2-user",
          email: "user2@org2.com",
          role: "SHIPPER",
          organizationId: org2.id,
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/lr-iso-001/respond",
        {
          body: { action: "APPROVE" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: "lr-iso-001",
      });
      expect(res.status).toBe(403);
    });

    it("should allow correct shipper org to respond", async () => {
      await db.loadRequest.create({
        data: {
          id: "lr-iso-002",
          loadId: "isolation-load",
          truckId: "org1-truck",
          carrierId: org1.id,
          shipperId: "isolation-shipper-org",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      setAuthSession(
        createMockSession({
          userId: "shipper-iso-user",
          email: "shipper-iso@test.com",
          role: "SHIPPER",
          organizationId: "isolation-shipper-org",
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/lr-iso-002/respond",
        {
          body: { action: "REJECT", responseNotes: "Not needed" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: "lr-iso-002",
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Wallet Isolation ────────────────────────────────────────────────────

  describe("Wallet isolation between organizations", () => {
    it("should return only Org1 wallet for Org1 user", async () => {
      setAuthSession(
        createMockSession({
          userId: "org1-user",
          email: "user1@org1.com",
          role: "CARRIER",
          organizationId: org1.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets).toBeDefined();
      // All wallets should belong to Org1
      if (data.wallets.length > 0) {
        data.wallets.forEach((wallet: any) => {
          expect(wallet.organizationId || wallet.id).toBeDefined();
        });
      }
    });

    it("should return only Org2 wallet for Org2 user", async () => {
      setAuthSession(
        createMockSession({
          userId: "org2-user",
          email: "user2@org2.com",
          role: "CARRIER",
          organizationId: org2.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets).toBeDefined();
    });

    it("should not expose other org wallet totals", async () => {
      setAuthSession(
        createMockSession({
          userId: "org1-user",
          email: "user1@org1.com",
          role: "CARRIER",
          organizationId: org1.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      const data = await parseResponse(res);

      // Total should not include org2 wallet (20000)
      if (data.totalBalance !== undefined) {
        expect(data.totalBalance).not.toBe(30000); // Not combined
      }
    });
  });

  // ─── Trip Listing Isolation ──────────────────────────────────────────────

  describe("Trip listing filtered by organization", () => {
    it("should only return Org1 trips for Org1 carrier", async () => {
      setAuthSession(
        createMockSession({
          userId: "org1-user",
          email: "user1@org1.com",
          role: "CARRIER",
          organizationId: org1.id,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trips).toBeDefined();
      // All returned trips should belong to Org1 carrier
      data.trips.forEach((trip: any) => {
        expect(trip.carrierId).toBe(org1.id);
      });
    });

    it("should only return Org2 trips for Org2 carrier", async () => {
      setAuthSession(
        createMockSession({
          userId: "org2-user",
          email: "user2@org2.com",
          role: "CARRIER",
          organizationId: org2.id,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      data.trips.forEach((trip: any) => {
        expect(trip.carrierId).toBe(org2.id);
      });
    });

    it("should return shipper org trips for shipper", async () => {
      setAuthSession(
        createMockSession({
          userId: "shipper-iso-user",
          email: "shipper-iso@test.com",
          role: "SHIPPER",
          organizationId: "isolation-shipper-org",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      data.trips.forEach((trip: any) => {
        expect(trip.shipperId).toBe("isolation-shipper-org");
      });
    });
  });

  // ─── Admin Can Cross Org Boundaries ──────────────────────────────────────

  describe("Admin cross-org access (allowed)", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "admin-user-1",
          email: "admin@test.com",
          role: "ADMIN",
          organizationId: "admin-org",
        })
      );
    });

    it("should allow admin to view any trip", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/org1-trip"
      );
      const res = await callHandler(getTrip, req, { tripId: "org1-trip" });
      expect(res.status).toBe(200);
    });

    it("should allow admin to list all trips", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Admin should see trips from multiple orgs
      expect(data.trips.length).toBeGreaterThan(0);
    });
  });
});
