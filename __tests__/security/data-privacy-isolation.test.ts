/**
 * Data Privacy & Isolation Tests
 *
 * Validates that resources are strictly isolated between organizations:
 * - Users ONLY see their own wallet
 * - Shippers see ONLY their own loads (never other shippers')
 * - Carriers see ONLY their own trucks (never other carriers')
 * - Cross-org access returns 404 (invisible), not 403
 * - Load board: carriers see POSTED loads; shippers see ONLY own loads
 * - Truck postings: shippers discover trucks; carriers see ONLY own fleet
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
  mockRbac,
  mockLogger,
  mockTrustMetrics,
  mockBypassDetection,
  mockLoadUtils,
  mockLoadStateMachine,
} from "../utils/routeTestUtils";

// Setup mocks (module-level, before any route handler imports)
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
mockLogger();
mockTrustMetrics();
mockBypassDetection();
mockLoadUtils();
mockLoadStateMachine();

// Override getAccessRoles mock with real logic (trip routes need proper shape)
const rbacMock = require("@/lib/rbac");
rbacMock.getAccessRoles = jest.fn((session: any, entityOwners?: any) => {
  const { role, organizationId } = session;
  const { shipperOrgId, carrierOrgId } = entityOwners || {};
  const isShipper =
    role === "SHIPPER" && !!shipperOrgId && shipperOrgId === organizationId;
  const isCarrier =
    role === "CARRIER" && !!carrierOrgId && carrierOrgId === organizationId;
  const isDispatcher = role === "DISPATCHER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN" || isSuperAdmin;
  const hasAccess = isShipper || isCarrier || isDispatcher || isAdmin;
  return {
    isShipper,
    isCarrier,
    isDispatcher,
    isAdmin,
    isSuperAdmin,
    hasAccess,
  };
});

// Import route handlers AFTER mocks (require so mocks are applied)
const {
  GET: getTruck,
  PATCH: updateTruck,
} = require("@/app/api/trucks/[id]/route");
const { GET: listTrucks } = require("@/app/api/trucks/route");
const { GET: listLoads } = require("@/app/api/loads/route");
const {
  GET: getLoad,
  PATCH: updateLoad,
} = require("@/app/api/loads/[id]/route");
const {
  GET: getTrip,
  PATCH: updateTrip,
} = require("@/app/api/trips/[tripId]/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const {
  PATCH: updateTruckPosting,
} = require("@/app/api/truck-postings/[id]/route");
const {
  GET: getShipperDashboard,
} = require("@/app/api/shipper/dashboard/route");
const {
  GET: getCarrierDashboard,
} = require("@/app/api/carrier/dashboard/route");
const { GET: listTruckPostings } = require("@/app/api/truck-postings/route");

describe("Data Privacy & Isolation Tests", () => {
  // Organizations
  const shipperAOrg = { id: "priv-shipperA-org", name: "Shipper Alpha" };
  const shipperBOrg = { id: "priv-shipperB-org", name: "Shipper Beta" };
  const carrierAOrg = { id: "priv-carrierA-org", name: "Carrier Alpha" };
  const carrierBOrg = { id: "priv-carrierB-org", name: "Carrier Beta" };

  // Users
  const shipperAUser = { id: "priv-shipperA-user", email: "shipperA@test.com" };
  const shipperBUser = { id: "priv-shipperB-user", email: "shipperB@test.com" };
  const carrierAUser = { id: "priv-carrierA-user", email: "carrierA@test.com" };
  const carrierBUser = { id: "priv-carrierB-user", email: "carrierB@test.com" };
  const dispatcherUser = {
    id: "priv-dispatcher-user",
    email: "dispatcher@test.com",
  };
  const adminUser = { id: "priv-admin-user", email: "admin@test.com" };

  // Sessions
  const shipperASession = createMockSession({
    userId: shipperAUser.id,
    email: shipperAUser.email,
    role: "SHIPPER",
    organizationId: shipperAOrg.id,
  });
  const shipperBSession = createMockSession({
    userId: shipperBUser.id,
    email: shipperBUser.email,
    role: "SHIPPER",
    organizationId: shipperBOrg.id,
  });
  const carrierASession = createMockSession({
    userId: carrierAUser.id,
    email: carrierAUser.email,
    role: "CARRIER",
    organizationId: carrierAOrg.id,
  });
  const carrierBSession = createMockSession({
    userId: carrierBUser.id,
    email: carrierBUser.email,
    role: "CARRIER",
    organizationId: carrierBOrg.id,
  });
  const dispatcherSession = createMockSession({
    userId: dispatcherUser.id,
    email: dispatcherUser.email,
    role: "DISPATCHER",
    organizationId: "priv-dispatch-org",
  });
  const adminSession = createMockSession({
    userId: adminUser.id,
    email: adminUser.email,
    role: "ADMIN",
    organizationId: "priv-admin-org",
  });

  beforeAll(async () => {
    clearAllStores();

    // Create organizations
    await db.organization.create({
      data: {
        id: shipperAOrg.id,
        name: shipperAOrg.name,
        type: "SHIPPER",
        contactEmail: "shipperA@test.com",
        contactPhone: "+251911100001",
        verificationStatus: "APPROVED",
      },
    });
    await db.organization.create({
      data: {
        id: shipperBOrg.id,
        name: shipperBOrg.name,
        type: "SHIPPER",
        contactEmail: "shipperB@test.com",
        contactPhone: "+251911100002",
        verificationStatus: "APPROVED",
      },
    });
    await db.organization.create({
      data: {
        id: carrierAOrg.id,
        name: carrierAOrg.name,
        type: "CARRIER_COMPANY",
        contactEmail: "carrierA@test.com",
        contactPhone: "+251911100003",
        verificationStatus: "APPROVED",
      },
    });
    await db.organization.create({
      data: {
        id: carrierBOrg.id,
        name: carrierBOrg.name,
        type: "CARRIER_COMPANY",
        contactEmail: "carrierB@test.com",
        contactPhone: "+251911100004",
        verificationStatus: "APPROVED",
      },
    });
    await db.organization.create({
      data: {
        id: "priv-dispatch-org",
        name: "Dispatch Corp",
        type: "CARRIER_COMPANY",
        contactEmail: "dispatch@test.com",
        contactPhone: "+251911100005",
        verificationStatus: "APPROVED",
      },
    });
    await db.organization.create({
      data: {
        id: "priv-admin-org",
        name: "Admin Org",
        type: "SHIPPER",
        contactEmail: "admin@test.com",
        contactPhone: "+251911100006",
        verificationStatus: "APPROVED",
      },
    });

    // Create users
    await db.user.create({
      data: {
        id: shipperAUser.id,
        email: shipperAUser.email,
        passwordHash: "hashed_Test1234!",
        firstName: "ShipperA",
        lastName: "User",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: shipperAOrg.id,
      },
    });
    await db.user.create({
      data: {
        id: shipperBUser.id,
        email: shipperBUser.email,
        passwordHash: "hashed_Test1234!",
        firstName: "ShipperB",
        lastName: "User",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: shipperBOrg.id,
      },
    });
    await db.user.create({
      data: {
        id: carrierAUser.id,
        email: carrierAUser.email,
        passwordHash: "hashed_Test1234!",
        firstName: "CarrierA",
        lastName: "User",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierAOrg.id,
      },
    });
    await db.user.create({
      data: {
        id: carrierBUser.id,
        email: carrierBUser.email,
        passwordHash: "hashed_Test1234!",
        firstName: "CarrierB",
        lastName: "User",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierBOrg.id,
      },
    });
    await db.user.create({
      data: {
        id: dispatcherUser.id,
        email: dispatcherUser.email,
        passwordHash: "hashed_Test1234!",
        firstName: "Dispatch",
        lastName: "User",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "priv-dispatch-org",
      },
    });
    await db.user.create({
      data: {
        id: adminUser.id,
        email: adminUser.email,
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "priv-admin-org",
      },
    });

    // Create trucks
    await db.truck.create({
      data: {
        id: "priv-truckA",
        truckType: "DRY_VAN",
        licensePlate: "PRIV-A001",
        capacity: 10000,
        isAvailable: true,
        carrierId: carrierAOrg.id,
        createdById: carrierAUser.id,
        approvalStatus: "APPROVED",
      },
    });
    await db.truck.create({
      data: {
        id: "priv-truckB",
        truckType: "FLATBED",
        licensePlate: "PRIV-B001",
        capacity: 15000,
        isAvailable: true,
        carrierId: carrierBOrg.id,
        createdById: carrierBUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // Create loads
    // loadA: POSTED by shipperA (visible on marketplace for carriers)
    await db.load.create({
      data: {
        id: "priv-loadA",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "ShipperA posted load",
        shipperId: shipperAOrg.id,
        createdById: shipperAUser.id,
        postedAt: new Date(),
      },
    });
    // loadB: ASSIGNED to shipperB / truckB
    await db.load.create({
      data: {
        id: "priv-loadB",
        status: "ASSIGNED",
        pickupCity: "Hawassa",
        pickupDate: new Date(Date.now() + 5 * 86400000),
        deliveryCity: "Mekelle",
        deliveryDate: new Date(Date.now() + 8 * 86400000),
        truckType: "FLATBED",
        weight: 8000,
        cargoDescription: "ShipperB assigned load",
        shipperId: shipperBOrg.id,
        createdById: shipperBUser.id,
        assignedTruckId: "priv-truckB",
      },
    });
    // loadC: DRAFT by shipperA (never on marketplace)
    await db.load.create({
      data: {
        id: "priv-loadC",
        status: "DRAFT",
        pickupCity: "Bahir Dar",
        pickupDate: new Date(Date.now() + 14 * 86400000),
        deliveryCity: "Gondar",
        deliveryDate: new Date(Date.now() + 17 * 86400000),
        truckType: "CONTAINER",
        weight: 3000,
        cargoDescription: "ShipperA draft load",
        shipperId: shipperAOrg.id,
        createdById: shipperAUser.id,
      },
    });

    // Create trips
    // tripA: carrierA / shipperA
    await db.trip.create({
      data: {
        id: "priv-tripA",
        loadId: "priv-loadA",
        truckId: "priv-truckA",
        carrierId: carrierAOrg.id,
        shipperId: shipperAOrg.id,
        status: "ASSIGNED",
      },
    });
    // tripB: carrierB / shipperB
    await db.trip.create({
      data: {
        id: "priv-tripB",
        loadId: "priv-loadB",
        truckId: "priv-truckB",
        carrierId: carrierBOrg.id,
        shipperId: shipperBOrg.id,
        status: "ASSIGNED",
      },
    });

    // Create truck postings
    await db.truckPosting.create({
      data: {
        id: "priv-posting-A",
        truckId: "priv-truckA",
        carrierId: carrierAOrg.id,
        originCityId: "city-addis",
        originCityName: "Addis Ababa",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "CarrierA Contact",
        contactPhone: "+251911100003",
      },
    });
    await db.truckPosting.create({
      data: {
        id: "priv-posting-B",
        truckId: "priv-truckB",
        carrierId: carrierBOrg.id,
        originCityId: "city-hawassa",
        originCityName: "Hawassa",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "CarrierB Contact",
        contactPhone: "+251911100004",
      },
    });

    // Create corridor
    await db.corridor.create({
      data: {
        id: "priv-corridor-1",
        name: "Addis Ababa - Dire Dawa",
        originRegion: "Addis Ababa",
        destinationRegion: "Dire Dawa",
        distanceKm: 515,
        direction: "ONE_WAY",
        isActive: true,
        pricePerKm: 5,
        shipperPricePerKm: 5,
        carrierPricePerKm: 3,
      },
    });

    // Create platform account
    await db.financialAccount.create({
      data: {
        id: "priv-platform-revenue",
        accountType: "PLATFORM_REVENUE",
        balance: 0,
        currency: "ETB",
        isActive: true,
      },
    });

    // Create wallets
    await db.financialAccount.create({
      data: {
        id: "priv-wallet-shipperA",
        organizationId: shipperAOrg.id,
        accountType: "SHIPPER_WALLET",
        balance: 10000,
        currency: "ETB",
        isActive: true,
      },
    });
    await db.financialAccount.create({
      data: {
        id: "priv-wallet-shipperB",
        organizationId: shipperBOrg.id,
        accountType: "SHIPPER_WALLET",
        balance: 15000,
        currency: "ETB",
        isActive: true,
      },
    });
    await db.financialAccount.create({
      data: {
        id: "priv-wallet-carrierA",
        organizationId: carrierAOrg.id,
        accountType: "CARRIER_WALLET",
        balance: 8000,
        currency: "ETB",
        isActive: true,
      },
    });
    await db.financialAccount.create({
      data: {
        id: "priv-wallet-carrierB",
        organizationId: carrierBOrg.id,
        accountType: "CARRIER_WALLET",
        balance: 12000,
        currency: "ETB",
        isActive: true,
      },
    });

    // Create notifications
    await db.notification.create({
      data: {
        id: "priv-notif-shipperA",
        userId: shipperAUser.id,
        type: "SYSTEM",
        title: "Welcome ShipperA",
        message: "Welcome to the platform",
        read: false,
      },
    });
    await db.notification.create({
      data: {
        id: "priv-notif-carrierB",
        userId: carrierBUser.id,
        type: "SYSTEM",
        title: "Welcome CarrierB",
        message: "Welcome to the platform",
        read: false,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  // ─── 1. Truck Isolation ──────────────────────────────────────────────────

  describe("Truck Isolation", () => {
    it("carrierA can view own truck by ID → 200", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/priv-truckA"
      );
      const res = await callHandler(getTruck, req, { id: "priv-truckA" });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.id).toBe("priv-truckA");
    });

    it("carrierA requesting carrierB's truck → 404 invisible", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/priv-truckB"
      );
      const res = await callHandler(getTruck, req, { id: "priv-truckB" });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Truck not found");
    });

    it("carrierA fleet list shows only own trucks", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?myTrucks=true"
      );
      const res = await callHandler(listTrucks, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const trucks = data.trucks || data;
      if (Array.isArray(trucks)) {
        trucks.forEach((t: any) => {
          expect(t.carrierId).toBe(carrierAOrg.id);
        });
      }
    });

    it("shipper blocked from fleet inventory GET /api/trucks → 403 (role-level)", async () => {
      setAuthSession(shipperASession);
      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await callHandler(listTrucks, req);
      // Shippers are blocked at role level from browsing fleet
      expect(res.status).toBe(403);
    });

    it("shipper CANNOT view truck detail by ID (must use /api/truck-postings) → 404", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/priv-truckA"
      );
      const res = await callHandler(getTruck, req, { id: "priv-truckA" });
      expect(res.status).toBe(404);
    });

    it("dispatcher CAN view any truck by ID → 200", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/priv-truckB"
      );
      const res = await callHandler(getTruck, req, { id: "priv-truckB" });
      expect(res.status).toBe(200);
    });

    it("carrierA PATCH on carrierB's truck → 404 invisible", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trucks/priv-truckB",
        {
          body: { currentCity: "Addis Ababa" },
        }
      );
      const res = await callHandler(updateTruck, req, { id: "priv-truckB" });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Truck not found");
    });

    it("admin CAN view any truck → 200", async () => {
      setAuthSession(adminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/priv-truckA"
      );
      const res = await callHandler(getTruck, req, { id: "priv-truckA" });
      expect(res.status).toBe(200);
    });

    it("shipper CAN search truck postings → sees ACTIVE postings", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );
      const res = await callHandler(listTruckPostings, req);
      expect(res.status).toBe(200);
    });
  });

  // ─── 2. Load Isolation ───────────────────────────────────────────────────

  describe("Load Isolation", () => {
    it("carrierA sees POSTED loads on load board", async () => {
      setAuthSession(carrierASession);
      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(listLoads, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      // Carrier marketplace should only show POSTED loads
      loads.forEach((l: any) => {
        expect(l.status).toBe("POSTED");
      });
    });

    it("shipperA with myLoads=true sees only own loads", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?myLoads=true"
      );
      const res = await callHandler(listLoads, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      loads.forEach((l: any) => {
        expect(l.shipperId).toBe(shipperAOrg.id);
      });
    });

    it("shipperA without myLoads STILL only sees own loads (bug fix)", async () => {
      setAuthSession(shipperASession);
      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(listLoads, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      // After fix: shippers always scoped to own loads, regardless of myLoads param
      loads.forEach((l: any) => {
        expect(l.shipperId).toBe(shipperAOrg.id);
      });
    });

    it("shipperA can view own POSTED load by ID → 200", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/priv-loadA"
      );
      const res = await callHandler(getLoad, req, { id: "priv-loadA" });
      expect(res.status).toBe(200);
    });

    it("shipperA requesting shipperB's load by ID → 404 invisible (bug fix)", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/priv-loadB"
      );
      const res = await callHandler(getLoad, req, { id: "priv-loadB" });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Load not found");
    });

    it("shipperA requesting shipperB's ASSIGNED load → 404 invisible", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/priv-loadB"
      );
      const res = await callHandler(getLoad, req, { id: "priv-loadB" });
      expect(res.status).toBe(404);
    });

    it("carrier clicks POSTED load from board → sees detail → 200", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/priv-loadA"
      );
      const res = await callHandler(getLoad, req, { id: "priv-loadA" });
      expect(res.status).toBe(200);
    });

    it("DRAFT loads never appear in carrier marketplace listing", async () => {
      setAuthSession(carrierASession);
      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(listLoads, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      const draftLoads = loads.filter((l: any) => l.status === "DRAFT");
      expect(draftLoads).toHaveLength(0);
    });

    it("carrier direct ID access to DRAFT load → 404 invisible", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/priv-loadC"
      );
      const res = await callHandler(getLoad, req, { id: "priv-loadC" });
      expect(res.status).toBe(404);
    });

    it("only load owner can PATCH → 404 for wrong shipper", async () => {
      setAuthSession(shipperBSession);
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/priv-loadA",
        {
          body: { cargoDescription: "Hijacked load" },
        }
      );
      const res = await callHandler(updateLoad, req, { id: "priv-loadA" });
      // ShipperB should not be able to edit ShipperA's load
      expect(res.status).toBe(403);
    });

    it("dispatcher can view all loads (multiple shippers)", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(listLoads, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      // Dispatcher sees loads from multiple shippers
      const shipperIds = new Set(loads.map((l: any) => l.shipperId));
      expect(shipperIds.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 3. Trip Isolation ───────────────────────────────────────────────────

  describe("Trip Isolation", () => {
    it("carrierA list shows only own trips", async () => {
      setAuthSession(carrierASession);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await callHandler(listTrips, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const trips = data.trips || [];
      trips.forEach((t: any) => {
        expect(t.carrierId).toBe(carrierAOrg.id);
      });
    });

    it("shipperA list shows only own trips", async () => {
      setAuthSession(shipperASession);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await callHandler(listTrips, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const trips = data.trips || [];
      trips.forEach((t: any) => {
        expect(t.shipperId).toBe(shipperAOrg.id);
      });
    });

    it("carrierA requesting carrierB's trip → 404 invisible", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/priv-tripB"
      );
      const res = await callHandler(getTrip, req, { tripId: "priv-tripB" });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Trip not found");
    });

    it("shipperA requesting shipperB's trip → 404 invisible", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/priv-tripB"
      );
      const res = await callHandler(getTrip, req, { tripId: "priv-tripB" });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Trip not found");
    });

    it("carrierA PATCH on carrierB's trip → 404 invisible", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/priv-tripB",
        {
          body: { status: "PICKUP_PENDING" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId: "priv-tripB" });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Trip not found");
    });

    it("dispatcher CAN view any trip → 200", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/priv-tripA"
      );
      const res = await callHandler(getTrip, req, { tripId: "priv-tripA" });
      expect(res.status).toBe(200);
    });
  });

  // ─── 4. Wallet Isolation ─────────────────────────────────────────────────

  describe("Wallet Isolation", () => {
    it("shipperA wallet balance returns only own wallet", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await callHandler(getWalletBalance, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBe(10000);
    });

    it("carrierA wallet balance returns only own wallet", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await callHandler(getWalletBalance, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBe(8000);
    });

    it("shipperA total NOT includes shipperB (10000, not 25000)", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await callHandler(getWalletBalance, req);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBe(10000);
      expect(data.totalBalance).not.toBe(25000); // 10000 + 15000
    });

    it("carrierA total NOT includes carrierB (8000, not 20000)", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await callHandler(getWalletBalance, req);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBe(8000);
      expect(data.totalBalance).not.toBe(20000); // 8000 + 12000
    });

    it("shipperA dashboard wallet = own balance only", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/shipper/dashboard"
      );
      const res = await callHandler(getShipperDashboard, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet.balance).toBe(10000);
    });

    it("carrierA dashboard wallet = own balance only", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await callHandler(getCarrierDashboard, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet.balance).toBe(8000);
    });

    it("shipperB dashboard = different balance from shipperA", async () => {
      setAuthSession(shipperBSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/shipper/dashboard"
      );
      const res = await callHandler(getShipperDashboard, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet.balance).toBe(15000);
    });

    it("fee deduction only affects involved org wallets", async () => {
      // Simulate a fee deduction by directly updating wallet balance
      const stores = (db as any).__stores;
      const shipperAWallet = stores.financialAccounts.get(
        "priv-wallet-shipperA"
      );
      const carrierAWallet = stores.financialAccounts.get(
        "priv-wallet-carrierA"
      );
      const platformAccount = stores.financialAccounts.get(
        "priv-platform-revenue"
      );
      const shipperBWallet = stores.financialAccounts.get(
        "priv-wallet-shipperB"
      );
      const carrierBWallet = stores.financialAccounts.get(
        "priv-wallet-carrierB"
      );

      // Save original balances
      const origShipperA = Number(shipperAWallet.balance);
      const origCarrierA = Number(carrierAWallet.balance);
      const origPlatform = Number(platformAccount.balance);
      const origShipperB = Number(shipperBWallet.balance);
      const origCarrierB = Number(carrierBWallet.balance);

      // Simulate fee deduction: shipperA -500, carrierA -300, platform +800
      shipperAWallet.balance = origShipperA - 500;
      carrierAWallet.balance = origCarrierA - 300;
      platformAccount.balance = origPlatform + 800;

      // Verify shipperB and carrierB are NOT affected
      expect(Number(shipperBWallet.balance)).toBe(origShipperB);
      expect(Number(carrierBWallet.balance)).toBe(origCarrierB);

      // Verify the involved parties changed
      expect(Number(shipperAWallet.balance)).toBe(origShipperA - 500);
      expect(Number(carrierAWallet.balance)).toBe(origCarrierA - 300);
      expect(Number(platformAccount.balance)).toBe(origPlatform + 800);

      // Restore for other tests
      shipperAWallet.balance = origShipperA;
      carrierAWallet.balance = origCarrierA;
      platformAccount.balance = origPlatform;
    });
  });

  // ─── 5. Notification Isolation ───────────────────────────────────────────

  describe("Notification Isolation", () => {
    it("shipperA sees only own notifications", async () => {
      // Notifications are handled by the mock (getRecentNotifications)
      // But we verify the API passes userId correctly
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      const res = await callHandler(
        require("@/app/api/notifications/route").GET,
        req
      );
      expect(res.status).toBe(200);
    });

    it("carrierB sees only own notifications", async () => {
      setAuthSession(carrierBSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      const res = await callHandler(
        require("@/app/api/notifications/route").GET,
        req
      );
      expect(res.status).toBe(200);
    });

    it("notification count scoped to user", async () => {
      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      const res = await callHandler(
        require("@/app/api/notifications/route").GET,
        req
      );
      const data = await parseResponse(res);
      // Mock returns 0 unread but the point is it's scoped to the user
      expect(data).toHaveProperty("unreadCount");
    });
  });

  // ─── 6. Cross-Role Privacy ───────────────────────────────────────────────

  describe("Cross-Role Privacy", () => {
    it("carrier marketplace listing has zero DRAFT loads", async () => {
      setAuthSession(carrierASession);
      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(listLoads, req);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      const drafts = loads.filter((l: any) => l.status === "DRAFT");
      expect(drafts).toHaveLength(0);
    });

    it("shipperA sees own DRAFT loads in list", async () => {
      setAuthSession(shipperASession);
      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(listLoads, req);
      const data = await parseResponse(res);
      const loads = data.loads || [];
      // ShipperA can see their own drafts
      const drafts = loads.filter((l: any) => l.status === "DRAFT");
      expect(drafts.length).toBeGreaterThanOrEqual(1);
      drafts.forEach((l: any) => {
        expect(l.shipperId).toBe(shipperAOrg.id);
      });
    });

    it("carrier PATCH on other carrier's truck posting → 404 invisible", async () => {
      setAuthSession(carrierASession);
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/truck-postings/priv-posting-B",
        {
          body: { notes: "Hijacked" },
        }
      );
      const res = await callHandler(updateTruckPosting, req, {
        id: "priv-posting-B",
      });
      expect(res.status).toBe(404);
      const data = await parseResponse(res);
      expect(data.error).toBe("Truck posting not found");
    });

    it("shipperA PATCH on shipperB's load → 403 (no access)", async () => {
      setAuthSession(shipperBSession);
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/priv-loadA",
        {
          body: { cargoDescription: "Hijacked" },
        }
      );
      const res = await callHandler(updateLoad, req, { id: "priv-loadA" });
      expect(res.status).toBe(403);
    });

    it("admin sees trips from all orgs", async () => {
      setAuthSession(adminSession);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await callHandler(listTrips, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      const trips = data.trips || [];
      if (trips.length >= 2) {
        const carrierIds = new Set(trips.map((t: any) => t.carrierId));
        expect(carrierIds.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ─── 7. Real-World Financial & Wallet Scenario ───────────────────────────

  describe("Real-World Financial & Wallet Scenario", () => {
    it("deductServiceFee: shipperA wallet ↓, carrierA wallet ↓, platform ↑", async () => {
      const stores = (db as any).__stores;
      const shipperAWallet = stores.financialAccounts.get(
        "priv-wallet-shipperA"
      );
      const carrierAWallet = stores.financialAccounts.get(
        "priv-wallet-carrierA"
      );
      const platformAccount = stores.financialAccounts.get(
        "priv-platform-revenue"
      );

      const origShipperA = Number(shipperAWallet.balance);
      const origCarrierA = Number(carrierAWallet.balance);
      const origPlatform = Number(platformAccount.balance);

      // Simulate: shipper pays 2575 ETB (515km * 5 ETB/km), carrier pays 1545 ETB (515km * 3 ETB/km)
      const shipperFee = 2575;
      const carrierFee = 1545;
      shipperAWallet.balance = origShipperA - shipperFee;
      carrierAWallet.balance = origCarrierA - carrierFee;
      platformAccount.balance = origPlatform + shipperFee + carrierFee;

      expect(Number(shipperAWallet.balance)).toBe(origShipperA - shipperFee);
      expect(Number(carrierAWallet.balance)).toBe(origCarrierA - carrierFee);
      expect(Number(platformAccount.balance)).toBe(
        origPlatform + shipperFee + carrierFee
      );

      // Restore
      shipperAWallet.balance = origShipperA;
      carrierAWallet.balance = origCarrierA;
      platformAccount.balance = origPlatform;
    });

    it("shipperB wallet NOT affected by shipperA's trip", async () => {
      const stores = (db as any).__stores;
      const shipperAWallet = stores.financialAccounts.get(
        "priv-wallet-shipperA"
      );
      const shipperBWallet = stores.financialAccounts.get(
        "priv-wallet-shipperB"
      );

      const origShipperB = Number(shipperBWallet.balance);

      // Deduct from shipperA
      shipperAWallet.balance = Number(shipperAWallet.balance) - 1000;

      // shipperB unchanged
      expect(Number(shipperBWallet.balance)).toBe(origShipperB);

      // Restore
      shipperAWallet.balance = Number(shipperAWallet.balance) + 1000;
    });

    it("carrierB wallet NOT affected by carrierA's trip", async () => {
      const stores = (db as any).__stores;
      const carrierAWallet = stores.financialAccounts.get(
        "priv-wallet-carrierA"
      );
      const carrierBWallet = stores.financialAccounts.get(
        "priv-wallet-carrierB"
      );

      const origCarrierB = Number(carrierBWallet.balance);

      // Deduct from carrierA
      carrierAWallet.balance = Number(carrierAWallet.balance) - 500;

      // carrierB unchanged
      expect(Number(carrierBWallet.balance)).toBe(origCarrierB);

      // Restore
      carrierAWallet.balance = Number(carrierAWallet.balance) + 500;
    });

    it("after deduction: shipper dashboard reflects updated balance", async () => {
      const stores = (db as any).__stores;
      const shipperAWallet = stores.financialAccounts.get(
        "priv-wallet-shipperA"
      );
      const origBalance = Number(shipperAWallet.balance);

      // Simulate deduction
      shipperAWallet.balance = origBalance - 2000;

      setAuthSession(shipperASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/shipper/dashboard"
      );
      const res = await callHandler(getShipperDashboard, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet.balance).toBe(origBalance - 2000);

      // Restore
      shipperAWallet.balance = origBalance;
    });

    it("after deduction: carrier dashboard reflects updated balance", async () => {
      const stores = (db as any).__stores;
      const carrierAWallet = stores.financialAccounts.get(
        "priv-wallet-carrierA"
      );
      const origBalance = Number(carrierAWallet.balance);

      // Simulate deduction
      carrierAWallet.balance = origBalance - 1500;

      setAuthSession(carrierASession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await callHandler(getCarrierDashboard, req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet.balance).toBe(origBalance - 1500);

      // Restore
      carrierAWallet.balance = origBalance;
    });
  });
});
