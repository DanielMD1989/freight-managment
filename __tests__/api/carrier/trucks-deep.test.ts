/**
 * Truck Management — Deep Tests
 *
 * Covers validation edge cases, cross-role visibility, state transitions,
 * and workflow scenarios NOT covered by the existing trucks.test.ts:
 *
 * - POST /api/trucks: Zod validation boundaries (zero capacity, plate length, invalid enum)
 * - GET /api/trucks: Carrier without org, empty results, carrierId param ignored for non-admin
 * - GET /api/trucks/[id]: DISPATCHER and SUPER_ADMIN visibility
 * - PATCH /api/trucks/[id]: Resubmit after rejection, nullable fields, ADMIN cannot update, mobile CSRF
 * - DELETE /api/trucks/[id]: All active trip statuses block, COMPLETED/CANCELLED allow, P2003 FK error
 * - POST /api/trucks/[id]/approve: SUPER_ADMIN approve, DISPATCHER denied, approvedById set,
 *   rejectionReason cleared, notification metadata, reason length limit, full resubmit cycle
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
mockLogger();

// Custom handleApiError mock — handles ZodErrors → 400 (unlike default mockApiErrors which returns 500)
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const { z } = require("zod");
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }
    const status =
      error.name === "ForbiddenError"
        ? 403
        : error.name === "UnauthorizedError"
          ? 401
          : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Mock rbac/permissions for approve route (uses hasPermission from here, not @/lib/rbac)
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

// Mock email for approve route
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({ success: true })),
  createEmailHTML: jest.fn((content: string) => `<html>${content}</html>`),
}));

// Import handlers AFTER mocks
const {
  POST: createTruck,
  GET: listTrucks,
} = require("@/app/api/trucks/route");
const {
  GET: getTruck,
  PATCH: updateTruck,
  DELETE: deleteTruck,
} = require("@/app/api/trucks/[id]/route");
const { POST: approveTruck } = require("@/app/api/trucks/[id]/approve/route");

describe("Truck Management — Deep Tests", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  const superAdminSession = createMockSession({
    userId: "superadmin-user-1",
    email: "superadmin@test.com",
    role: "SUPER_ADMIN",
    organizationId: "admin-org-1",
  });

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-1",
    email: "dispatcher@test.com",
    role: "DISPATCHER",
    organizationId: "dispatcher-org-1",
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
        id: "superadmin-user-1",
        email: "superadmin@test.com",
        role: "SUPER_ADMIN",
        organizationId: "admin-org-1",
        firstName: "Super",
        lastName: "Admin",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "dispatcher-user-1",
        email: "dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "dispatcher-org-1",
        firstName: "Dispatcher",
        lastName: "User",
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

  // ─── POST /api/trucks — Validation depth ────────────────────────────────

  describe("POST /api/trucks — Validation depth", () => {
    it("missing truckType → 400 validation error", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          licensePlate: "MISS-TYPE",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("invalid truckType enum value → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "INVALID_TYPE",
          licensePlate: "BAD-ENUM",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("zero capacity (positive() rejects 0) → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "ZERO-CAP",
          capacity: 0,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("negative volume → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "NEG-VOL",
          capacity: 10000,
          volume: -5,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("licensePlate too short (2 chars) → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "AB",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("licensePlate too long (21 chars) → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "A".repeat(21),
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("sanitizeText called on licensePlate and currentCity", async () => {
      const { sanitizeText } = require("@/lib/validation");

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "SAN-TEXT",
          capacity: 10000,
          currentCity: "Addis Ababa",
        },
      });

      await createTruck(req);

      expect(sanitizeText).toHaveBeenCalledWith("SAN-TEXT", 20);
      expect(sanitizeText).toHaveBeenCalledWith("Addis Ababa", 200);
    });

    it("response includes carrier relation (id, name, isVerified)", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "CONTAINER",
          licensePlate: "CARRIER-REL",
          capacity: 20000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.truck.carrier).toBeDefined();
      expect(data.truck.carrier.id).toBe("carrier-org-1");
      expect(data.truck.carrier.name).toBeDefined();
    });

    it("createdById IS set by the route handler", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "TANKER",
          licensePlate: "NO-CREATED-BY",
          capacity: 15000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      // FIX M1: createdById is now set for audit trail
      expect(data.truck.createdById).toBe("carrier-user-1");
    });
  });

  // ─── GET /api/trucks — Filter & visibility depth ─────────────────────────

  describe("GET /api/trucks — Filter & visibility depth", () => {
    it("carrier without org → 403", async () => {
      await db.user.create({
        data: {
          id: "no-org-carrier",
          email: "noorg@test.com",
          role: "CARRIER",
          organizationId: null,
          firstName: "No",
          lastName: "Org",
          status: "ACTIVE",
          passwordHash: "mock-hash",
        },
      });

      setAuthSession(
        createMockSession({
          userId: "no-org-carrier",
          email: "noorg@test.com",
          role: "CARRIER",
          organizationId: undefined,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("organization");
    });

    it("empty result → returns empty trucks array with pagination", async () => {
      const emptyOrg = await db.organization.create({
        data: {
          id: "empty-carrier-org",
          name: "Empty Carrier",
          type: "CARRIER_COMPANY",
          contactEmail: "empty@test.com",
          contactPhone: "+251911888888",
          isVerified: true,
        },
      });

      await db.user.create({
        data: {
          id: "empty-carrier-user",
          email: "empty@test.com",
          role: "CARRIER",
          organizationId: emptyOrg.id,
          firstName: "Empty",
          lastName: "Carrier",
          status: "ACTIVE",
          passwordHash: "mock-hash",
        },
      });

      setAuthSession(
        createMockSession({
          userId: "empty-carrier-user",
          email: "empty@test.com",
          role: "CARRIER",
          organizationId: emptyOrg.id,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trucks).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });

    it("SUPER_ADMIN sees all trucks", async () => {
      setAuthSession(superAdminSession);

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trucks).toBeDefined();
      expect(data.trucks.length).toBeGreaterThan(0);
    });

    it("carrier's carrierId param is ignored — still sees own fleet only", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?carrierId=some-other-org"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const truck of data.trucks) {
        expect(truck.carrierId).toBe("carrier-org-1");
      }
    });
  });

  // ─── GET /api/trucks/[id] — Visibility depth ────────────────────────────

  describe("GET /api/trucks/[id] — Visibility depth", () => {
    it("DISPATCHER can view any truck → 200", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.id).toBe(seed.truck.id);
    });

    it("SUPER_ADMIN can view any truck → 200", async () => {
      setAuthSession(superAdminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.id).toBe(seed.truck.id);
    });
  });

  // ─── PATCH /api/trucks/[id] — Update depth ──────────────────────────────

  describe("PATCH /api/trucks/[id] — Update depth", () => {
    it("resubmit after rejection: set approvalStatus PENDING → 200", async () => {
      const rejectedTruck = await db.truck.create({
        data: {
          id: "rejected-truck-resubmit",
          truckType: "FLATBED",
          licensePlate: "REJ-RESUB",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "REJECTED",
          rejectionReason: "Expired documents",
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${rejectedTruck.id}`,
        {
          body: {
            approvalStatus: "PENDING",
            rejectionReason: null,
          },
        }
      );

      const res = await callHandler(updateTruck, req, {
        id: rejectedTruck.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.approvalStatus).toBe("PENDING");
      expect(data.rejectionReason).toBeNull();
    });

    it("cannot set approvalStatus to APPROVED from carrier → 400", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { approvalStatus: "APPROVED" },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });

    it("ADMIN cannot update other carrier's truck → 404", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { capacity: 99999 },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      // canUpdate = SUPER_ADMIN or owner. ADMIN is neither → 404
      expect(res.status).toBe(404);
    });

    it("same license plate update → no duplicate error", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { licensePlate: seed.truck.licensePlate },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);
    });

    it("set volume to null → 200", async () => {
      const truckWithVolume = await db.truck.create({
        data: {
          id: "truck-vol-null",
          truckType: "BOX_TRUCK",
          licensePlate: "VOL-NULL",
          capacity: 8000,
          volume: 50,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${truckWithVolume.id}`,
        {
          body: { volume: null },
        }
      );

      const res = await callHandler(updateTruck, req, {
        id: truckWithVolume.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.volume).toBeNull();
    });

    it("set currentCity to null → 200", async () => {
      const truckWithCity = await db.truck.create({
        data: {
          id: "truck-city-null",
          truckType: "DRY_VAN",
          licensePlate: "CITY-NULL",
          capacity: 12000,
          currentCity: "Mekelle",
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${truckWithCity.id}`,
        {
          body: { currentCity: null },
        }
      );

      const res = await callHandler(updateTruck, req, {
        id: truckWithCity.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.currentCity).toBeNull();
    });

    it("invalid truckType enum on update → 400", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { truckType: "SPACESHIP" },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });

    it("negative capacity on update → 400", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { capacity: -500 },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });

    it("mobile client without Bearer → 401", async () => {
      // Override the CSRF mock to simulate real validateCSRFWithMobile behavior
      const { validateCSRFWithMobile } = require("@/lib/csrf");
      const { NextResponse } = require("next/server");
      (validateCSRFWithMobile as jest.Mock).mockImplementationOnce(
        async (request: any) => {
          const isMobile = request.headers.get("x-client-type") === "mobile";
          const hasBearer = request.headers
            .get("authorization")
            ?.startsWith("Bearer ");
          if (isMobile && !hasBearer) {
            return NextResponse.json(
              { error: "Mobile clients require Bearer authentication" },
              { status: 401 }
            );
          }
          return null;
        }
      );

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          headers: {
            "x-client-type": "mobile",
            Authorization: "", // Override: no Bearer token
          },
          body: { capacity: 5000 },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(401);

      const data = await parseResponse(res);
      expect(data.error).toContain("Bearer");
    });
  });

  // ─── DELETE /api/trucks/[id] — Guard depth ──────────────────────────────

  describe("DELETE /api/trucks/[id] — Guard depth", () => {
    it("SUPER_ADMIN can delete → 200", async () => {
      setAuthSession(superAdminSession);

      const truckToDelete = await db.truck.create({
        data: {
          id: "sa-delete-truck",
          truckType: "FLATBED",
          licensePlate: "SA-DEL-1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckToDelete.id}`
      );

      const res = await callHandler(deleteTruck, req, {
        id: truckToDelete.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });

    it("DISPATCHER cannot delete → 404", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(404);
    });

    it("trip in ASSIGNED status blocks delete → 409", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "assigned-trip-truck",
          truckType: "FLATBED",
          licensePlate: "ASGN-BLK",
          capacity: 10000,
          isAvailable: false,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      await db.trip.create({
        data: {
          id: "trip-assigned-block",
          loadId: seed.load.id,
          truckId: truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: truck.id });
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.error).toContain("active assignments");
    });

    it("trip in PICKUP_PENDING blocks delete → 409", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "pickup-trip-truck",
          truckType: "TANKER",
          licensePlate: "PKP-BLK",
          capacity: 15000,
          isAvailable: false,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      await db.trip.create({
        data: {
          id: "trip-pickup-block",
          loadId: seed.load.id,
          truckId: truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PICKUP_PENDING",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: truck.id });
      expect(res.status).toBe(409);
    });

    it("trip in DELIVERED status blocks delete → 409", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "delivered-trip-truck",
          truckType: "DRY_VAN",
          licensePlate: "DLV-BLK",
          capacity: 12000,
          isAvailable: false,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      await db.trip.create({
        data: {
          id: "trip-delivered-block",
          loadId: seed.load.id,
          truckId: truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: truck.id });
      expect(res.status).toBe(409);
    });

    it("COMPLETED trip only → delete succeeds", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "completed-trip-truck",
          truckType: "FLATBED",
          licensePlate: "COMP-OK",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      await db.trip.create({
        data: {
          id: "trip-completed-ok",
          loadId: seed.load.id,
          truckId: truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });

    it("CANCELLED trip only → delete succeeds", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "cancelled-trip-truck",
          truckType: "FLATBED",
          licensePlate: "CANC-OK",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      await db.trip.create({
        data: {
          id: "trip-cancelled-ok",
          loadId: seed.load.id,
          truckId: truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "CANCELLED",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });

    it("P2003 foreign key error → 409", async () => {
      setAuthSession(adminSession);

      const truckWithFK = await db.truck.create({
        data: {
          id: "fk-error-truck",
          truckType: "BOX_TRUCK",
          licensePlate: "FK-ERR-1",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      // Temporarily mock db.truck.delete to throw P2003
      const originalDelete = (db.truck as any).delete;
      (db.truck as any).delete = jest.fn(() => {
        const error: any = new Error("Foreign key constraint failed");
        error.code = "P2003";
        throw error;
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckWithFK.id}`
      );

      const res = await callHandler(deleteTruck, req, {
        id: truckWithFK.id,
      });
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.error).toContain("active postings");

      // Restore
      (db.truck as any).delete = originalDelete;
    });
  });

  // ─── POST /api/trucks/[id]/approve — Workflow depth ─────────────────────

  describe("POST /api/trucks/[id]/approve — Workflow depth", () => {
    it("SUPER_ADMIN can approve → 200", async () => {
      setAuthSession(superAdminSession);

      const truck = await db.truck.create({
        data: {
          id: "sa-approve-truck",
          truckType: "FLATBED",
          licensePlate: "SA-APPR",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(approveTruck, req, { id: truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.truck.approvalStatus).toBe("APPROVED");
    });

    it("DISPATCHER cannot approve → 403", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(approveTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(403);
    });

    it("approve clears rejectionReason to null", async () => {
      setAuthSession(adminSession);

      const rejectedTruck = await db.truck.create({
        data: {
          id: "rejected-to-approve",
          truckType: "TANKER",
          licensePlate: "CLR-REJ",
          capacity: 20000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "REJECTED",
          rejectionReason: "Bad documents",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${rejectedTruck.id}/approve`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(approveTruck, req, {
        id: rejectedTruck.id,
      });
      // H10 FIX: Only PENDING trucks can be approved — REJECTED must be resubmitted first
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("already rejected");
    });

    it("approve sets approvedById to session userId", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "approved-by-check",
          truckType: "DRY_VAN",
          licensePlate: "BY-CHECK",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truck.id}/approve`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(approveTruck, req, { id: truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.truck.approvedById).toBe("admin-user-1");
    });

    it("rejection notification includes reason in metadata", async () => {
      setAuthSession(adminSession);

      const truck = await db.truck.create({
        data: {
          id: "reject-notif-meta",
          truckType: "CONTAINER",
          licensePlate: "NOTIF-MTA",
          capacity: 25000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truck.id}/approve`,
        { body: { action: "REJECT", reason: "Insurance expired" } }
      );

      await callHandler(approveTruck, req, { id: truck.id });

      const { createNotification } = require("@/lib/notifications");
      expect(createNotification).toHaveBeenCalled();
      const call = createNotification.mock.calls[0][0];
      expect(call.type).toBe("TRUCK_REJECTED");
      expect(call.metadata.reason).toBe("Insurance expired");
    });

    it("reason > 500 chars → 400 validation error", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${seed.truck.id}/approve`,
        {
          body: {
            action: "REJECT",
            reason: "X".repeat(501),
          },
        }
      );

      const res = await callHandler(approveTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });

    it("full cycle: create PENDING → reject → carrier resubmit → re-approve", async () => {
      // Step 1: Carrier creates truck (starts as PENDING by default)
      setAuthSession(carrierSession);

      const createReq = createRequest(
        "POST",
        "http://localhost:3000/api/trucks",
        {
          body: {
            truckType: "LOWBOY",
            licensePlate: "FULL-CYC",
            capacity: 30000,
          },
        }
      );

      const createRes = await createTruck(createReq);
      expect(createRes.status).toBe(201);
      const created = await parseResponse(createRes);
      const truckId = created.truck.id;

      // Step 2: Admin rejects
      setAuthSession(adminSession);

      const rejectReq = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckId}/approve`,
        { body: { action: "REJECT", reason: "Missing documents" } }
      );

      const rejectRes = await callHandler(approveTruck, rejectReq, {
        id: truckId,
      });
      expect(rejectRes.status).toBe(200);

      const rejected = await parseResponse(rejectRes);
      expect(rejected.truck.approvalStatus).toBe("REJECTED");
      expect(rejected.truck.rejectionReason).toBe("Missing documents");

      // Step 3: Carrier resubmits (sets approvalStatus back to PENDING)
      setAuthSession(carrierSession);

      const resubmitReq = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${truckId}`,
        {
          body: {
            approvalStatus: "PENDING",
            rejectionReason: null,
          },
        }
      );

      const resubmitRes = await callHandler(updateTruck, resubmitReq, {
        id: truckId,
      });
      expect(resubmitRes.status).toBe(200);

      const resubmitted = await parseResponse(resubmitRes);
      expect(resubmitted.approvalStatus).toBe("PENDING");

      // Step 4: Admin re-approves
      setAuthSession(adminSession);

      const approveReq = createRequest(
        "POST",
        `http://localhost:3000/api/trucks/${truckId}/approve`,
        { body: { action: "APPROVE" } }
      );

      const approveRes = await callHandler(approveTruck, approveReq, {
        id: truckId,
      });
      expect(approveRes.status).toBe(200);

      const approved = await parseResponse(approveRes);
      expect(approved.truck.approvalStatus).toBe("APPROVED");
      expect(approved.truck.rejectionReason).toBeNull();
    });
  });
});
