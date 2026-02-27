/**
 * Carrier Disputes API Tests
 *
 * Tests the carrier's access to the disputes API endpoints (/api/disputes).
 * The disputes API is role-agnostic - both shippers and carriers can
 * create and view disputes for loads they are associated with.
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
  SeedData,
} from "../utils/routeTestUtils";

// Setup all mocks before importing route handlers
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

// Mock validation (sanitizeText used by disputes route)
jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Mock rbac for the [id] route's PATCH handler (requirePermission)
jest.mock("@/lib/rbac", () => ({
  requirePermission: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  Permission: {
    MANAGE_DISPUTES: "manage_disputes",
  },
  getAccessRoles: jest.fn(() => ({ canView: true, canModify: true })),
}));

// Import route handlers AFTER mocks (use require so mocks are applied)
const {
  POST: createDispute,
  GET: listDisputes,
} = require("@/app/api/disputes/route");
const { GET: getDispute } = require("@/app/api/disputes/[id]/route");

describe("Carrier Disputes API", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Assign the truck to the load so the carrier has access
    await db.load.update({
      where: { id: seed.load.id },
      data: {
        status: "ASSIGNED",
        assignedTruckId: seed.truck.id,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // Helper to set up the carrier session
  function useCarrierSession() {
    setAuthSession(
      createMockSession({
        userId: "carrier-user-1",
        role: "CARRIER",
        organizationId: "carrier-org-1",
      })
    );
  }

  // Helper to set up the shipper session
  function useShipperSession() {
    setAuthSession(
      createMockSession({
        userId: "shipper-user-1",
        role: "SHIPPER",
        organizationId: "shipper-org-1",
      })
    );
  }

  /**
   * Helper: mock db.load.findUnique to return the proper relationship shape
   * that the disputes route expects (shipper, assignedTruck.carrier).
   */
  function mockLoadFindUniqueWithRelations() {
    (db.load.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { id: string } }) => {
        // Look up the load from the in-memory store first
        const loadRecord = (db.load.findMany as jest.Mock)();
        return loadRecord.then
          ? loadRecord.then((records: Array<Record<string, unknown>>) => {
              const record = records.find(
                (r: Record<string, unknown>) => r.id === where.id
              );
              if (!record) return Promise.resolve(null);
              return Promise.resolve({
                ...record,
                shipper: { id: record.shipperId },
                assignedTruck: record.assignedTruckId
                  ? {
                      carrier: {
                        id: seed.carrierOrg.id,
                      },
                    }
                  : null,
              });
            })
          : Promise.resolve(null);
      }
    );
  }

  /**
   * Helper: mock db.dispute.findUnique to return the proper relationship shape
   * that the GET /api/disputes/[id] route expects.
   */
  function mockDisputeFindUniqueWithRelations(
    disputeRecord: Record<string, unknown>
  ) {
    (db.dispute.findUnique as jest.Mock).mockResolvedValueOnce({
      ...disputeRecord,
      load: {
        id: seed.load.id,
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        status: "ASSIGNED",
        shipper: { id: seed.shipperOrg.id, name: seed.shipperOrg.name },
        assignedTruck: {
          id: seed.truck.id,
          licensePlate: "AA-12345",
          carrier: { id: seed.carrierOrg.id, name: seed.carrierOrg.name },
        },
      },
      createdBy: {
        id: "carrier-user-1",
        email: "carrier@test.com",
        firstName: "Test",
        lastName: "Carrier",
      },
      disputedOrg: {
        id: "carrier-org-1",
        name: "Test Carrier LLC",
      },
    });
  }

  // ─── Authorization ──────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("should return 401 for unauthenticated POST /api/disputes", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "PAYMENT_ISSUE",
          description: "Payment was not received for the completed delivery",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(401);

      const data = await parseResponse(res);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 for unauthenticated GET /api/disputes", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(401);

      const data = await parseResponse(res);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 for unauthenticated GET /api/disputes/[id]", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes/some-dispute-id"
      );

      const res = await callHandler(getDispute, req, { id: "some-dispute-id" });
      expect(res.status).toBe(401);

      const data = await parseResponse(res);
      expect(data.error).toBe("Unauthorized");
    });
  });

  // ─── Create Dispute as Carrier ──────────────────────────────────────────

  describe("Create Dispute (POST /api/disputes)", () => {
    it("should create a dispute for a load the carrier is assigned to", async () => {
      useCarrierSession();
      mockLoadFindUniqueWithRelations();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "PAYMENT_ISSUE",
          description: "Payment was not received for the completed delivery",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.message).toBe("Dispute created successfully");
      expect(data.dispute).toBeDefined();
      expect(data.dispute.type).toBe("PAYMENT_ISSUE");
      expect(data.dispute.status).toBe("OPEN");
      expect(data.dispute.loadId).toBe(seed.load.id);
      expect(data.dispute.createdById).toBe("carrier-user-1");
      expect(data.dispute.disputedOrgId).toBe("carrier-org-1");
    });

    it("should create a DAMAGE dispute with evidence", async () => {
      useCarrierSession();
      mockLoadFindUniqueWithRelations();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "DAMAGE",
          description:
            "Cargo was damaged during transit due to improper loading instructions",
          evidence: "https://storage.test/evidence/damage-photo-001.jpg",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute.type).toBe("DAMAGE");
      expect(data.dispute.evidenceUrls).toContain(
        "https://storage.test/evidence/damage-photo-001.jpg"
      );
    });

    it("should create a LATE_DELIVERY dispute", async () => {
      useCarrierSession();
      mockLoadFindUniqueWithRelations();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "LATE_DELIVERY",
          description:
            "Delivery was delayed due to shipper-caused scheduling issues at pickup",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute.type).toBe("LATE_DELIVERY");
    });

    it("should return 404 for a non-existent load", async () => {
      useCarrierSession();
      // Override findUnique to return null for this load
      (db.load.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "non-existent-load-999",
          type: "OTHER",
          description: "This dispute is for a load that does not exist at all",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toBe("Load not found");
    });

    it("should return 403 when carrier is not assigned to the load", async () => {
      useCarrierSession();

      // Mock a load that belongs to a different carrier
      (db.load.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "other-load-001",
        shipperId: "other-shipper-org",
        shipper: { id: "other-shipper-org" },
        assignedTruck: {
          carrier: { id: "other-carrier-org" },
        },
      });

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "other-load-001",
          type: "PAYMENT_ISSUE",
          description:
            "Attempting to dispute a load not assigned to this carrier",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("Forbidden");
    });

    it("should return 400 for invalid dispute type", async () => {
      useCarrierSession();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "INVALID_TYPE",
          description: "This should fail validation due to invalid type",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for description shorter than 10 characters", async () => {
      useCarrierSession();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "PAYMENT_ISSUE",
          description: "Too short",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 when loadId is missing", async () => {
      useCarrierSession();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          type: "DAMAGE",
          description:
            "Missing the loadId field from the request body entirely",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── List Disputes ──────────────────────────────────────────────────────

  describe("List Disputes (GET /api/disputes)", () => {
    let carrierDisputeId: string;

    beforeAll(async () => {
      // Seed a dispute created by the carrier for later retrieval
      const dispute = await db.dispute.create({
        data: {
          id: "carrier-dispute-001",
          loadId: seed.load.id,
          createdById: "carrier-user-1",
          disputedOrgId: "carrier-org-1",
          type: "PAYMENT_ISSUE",
          description: "Seeded carrier dispute for listing tests",
          evidenceUrls: [],
          status: "OPEN",
        },
      });
      carrierDisputeId = dispute.id;

      // Seed a second dispute with RESOLVED status
      await db.dispute.create({
        data: {
          id: "carrier-dispute-002",
          loadId: seed.load.id,
          createdById: "carrier-user-1",
          disputedOrgId: "carrier-org-1",
          type: "DAMAGE",
          description: "Seeded resolved carrier dispute for filter tests",
          evidenceUrls: [],
          status: "RESOLVED",
        },
      });
    });

    it("should list disputes for the carrier organization", async () => {
      useCarrierSession();

      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      expect(Array.isArray(data.disputes)).toBe(true);
    });

    it("should filter disputes by status=OPEN", async () => {
      useCarrierSession();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?status=OPEN"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      // All returned disputes should have OPEN status
      for (const dispute of data.disputes) {
        expect(dispute.status).toBe("OPEN");
      }
    });

    it("should filter disputes by status=RESOLVED", async () => {
      useCarrierSession();

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?status=RESOLVED"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      for (const dispute of data.disputes) {
        expect(dispute.status).toBe("RESOLVED");
      }
    });

    it("should filter disputes by loadId", async () => {
      useCarrierSession();

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/disputes?loadId=${seed.load.id}`
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      for (const dispute of data.disputes) {
        expect(dispute.loadId).toBe(seed.load.id);
      }
    });

    // ─── Cross-org Access Control ───────────────────────────────────────

    it("should not return carrier-org disputes to a different shipper org", async () => {
      // Create a second shipper org with no relation to the disputes
      await db.organization.create({
        data: {
          id: "other-shipper-org-2",
          name: "Other Shipper Corp",
          type: "SHIPPER",
          contactEmail: "other-shipper@test.com",
          contactPhone: "+251911000099",
        },
      });

      setAuthSession(
        createMockSession({
          userId: "other-shipper-user-2",
          role: "SHIPPER",
          organizationId: "other-shipper-org-2",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      // The other shipper org should not see carrier-org-1 disputes
      // because the in-memory mock filters by disputedOrgId via the OR clause
      for (const dispute of data.disputes) {
        expect(dispute.disputedOrgId).not.toBe("carrier-org-1");
      }
    });

    // ─── Get Single Dispute ─────────────────────────────────────────────

    it("should get a single dispute by ID as carrier", async () => {
      useCarrierSession();

      // Mock the findUnique with proper relationship shape
      mockDisputeFindUniqueWithRelations({
        id: carrierDisputeId,
        loadId: seed.load.id,
        createdById: "carrier-user-1",
        disputedOrgId: "carrier-org-1",
        type: "PAYMENT_ISSUE",
        description: "Seeded carrier dispute for listing tests",
        status: "OPEN",
        evidenceUrls: [],
      });

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/disputes/${carrierDisputeId}`
      );

      const res = await callHandler(getDispute, req, { id: carrierDisputeId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.id).toBe(carrierDisputeId);
      expect(data.dispute.type).toBe("PAYMENT_ISSUE");
      expect(data.dispute.load).toBeDefined();
      expect(data.dispute.load.id).toBe(seed.load.id);
      expect(data.dispute.createdBy).toBeDefined();
      expect(data.dispute.disputedOrg).toBeDefined();
    });

    it("should return 404 for a non-existent dispute ID", async () => {
      useCarrierSession();
      (db.dispute.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes/non-existent-dispute"
      );

      const res = await callHandler(getDispute, req, {
        id: "non-existent-dispute",
      });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toBe("Dispute not found");
    });

    it("should return 403 when accessing a dispute from an unrelated org", async () => {
      // Set session to an org that is neither the shipper nor the carrier
      setAuthSession(
        createMockSession({
          userId: "unrelated-user-1",
          role: "CARRIER",
          organizationId: "unrelated-org-1",
        })
      );

      // Mock a dispute where the org has no relation
      (db.dispute.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "dispute-other-org",
        loadId: seed.load.id,
        createdById: "carrier-user-1",
        disputedOrgId: "carrier-org-1",
        type: "DAMAGE",
        description: "Dispute belonging to a different organization",
        status: "OPEN",
        load: {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          status: "ASSIGNED",
          shipper: { id: "shipper-org-1" },
          assignedTruck: {
            id: seed.truck.id,
            licensePlate: "AA-12345",
            carrier: { id: "carrier-org-1" },
          },
        },
        createdBy: {
          id: "carrier-user-1",
          email: "carrier@test.com",
          firstName: "Test",
          lastName: "Carrier",
        },
        disputedOrg: {
          id: "carrier-org-1",
          name: "Test Carrier LLC",
        },
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes/dispute-other-org"
      );

      const res = await callHandler(getDispute, req, {
        id: "dispute-other-org",
      });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("Forbidden");
    });
  });

  // ─── Shipper Creating Disputes ────────────────────────────────────────

  describe("Shipper Creating Disputes for Same Load", () => {
    it("should allow the shipper to create a dispute for the same load", async () => {
      useShipperSession();
      mockLoadFindUniqueWithRelations();

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: seed.load.id,
          type: "LATE_DELIVERY",
          description:
            "The carrier delivered the cargo significantly late causing losses",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.createdById).toBe("shipper-user-1");
      expect(data.dispute.disputedOrgId).toBe("shipper-org-1");
    });
  });
});
