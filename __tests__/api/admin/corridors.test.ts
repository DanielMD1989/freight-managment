/**
 * Admin Corridors API Tests
 *
 * Tests for /api/admin/corridors, /api/admin/corridors/[id]
 */

import { db } from "@/lib/db";
import {
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
  mockStorage,
  mockLogger,
} from "../../utils/routeTestUtils";
import {
  useAdminSession,
  useSuperAdminSession,
  useShipperSession,
  useCarrierSession,
  useDispatcherSession,
  seedAdminTestData,
  AdminSeedData,
} from "./helpers";

// ─── Setup Mocks ──────────────────────────────────────────────────────────────
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
mockStorage();
mockLogger();

jest.mock("@/lib/rbac", () => {
  const actual = jest.requireActual("@/lib/rbac/permissions");
  return {
    requirePermission: jest.fn(async (permission: string) => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) {
        const error = new Error("Unauthorized");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      if (!actual.hasPermission(session.role, permission)) {
        const error = new Error("Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    Permission: actual.Permission,
    hasPermission: actual.hasPermission,
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
  };
});

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    if (error instanceof require("zod").ZodError) {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ error: "Validation error" }, { status: 400 });
    }
    const status = error.name === "ForbiddenError" ? 403 : 500;
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

jest.mock("@/lib/serviceFeeCalculation", () => ({
  calculateFeePreview: jest.fn((distance: number, pricePerKm: number) => ({
    distanceKm: distance,
    pricePerKm,
    baseFee: distance * pricePerKm,
    finalFee: distance * pricePerKm,
    promoDiscount: 0,
  })),
  calculateDualPartyFeePreview: jest.fn(
    (
      distance: number,
      shipperPpk: number,
      _sp: boolean,
      _spp: number | null,
      carrierPpk: number
    ) => ({
      shipper: {
        distanceKm: distance,
        pricePerKm: shipperPpk,
        baseFee: distance * shipperPpk,
        finalFee: distance * shipperPpk,
      },
      carrier: {
        distanceKm: distance,
        pricePerKm: carrierPpk,
        baseFee: distance * carrierPpk,
        finalFee: distance * carrierPpk,
      },
      totalPlatformFee: distance * shipperPpk + distance * carrierPpk,
    })
  ),
}));

// Import route handlers AFTER mocks
const {
  GET: listCorridors,
  POST: createCorridor,
} = require("@/app/api/admin/corridors/route");
const {
  GET: getCorridor,
  PATCH: updateCorridor,
  DELETE: deleteCorridor,
} = require("@/app/api/admin/corridors/[id]/route");

describe("Admin Corridors API", () => {
  let seed: AdminSeedData;

  beforeAll(async () => {
    seed = await seedAdminTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      expect(res.status).toBe(403);
    });

    it("GET returns 200 for ADMIN", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      expect(res.status).toBe(200);
    });

    it("POST returns 403 for non-admin", async () => {
      useShipperSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "Test",
            originRegion: "Addis Ababa",
            destinationRegion: "Afar",
            distanceKm: 100,
            pricePerKm: 5,
          },
        }
      );
      const res = await createCorridor(req);
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 for ADMIN (SUPER_ADMIN only)", async () => {
      useAdminSession();
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/admin/corridors/corridor-2"
      );
      const res = await callHandler(deleteCorridor, req, { id: "corridor-2" });
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/corridors ───────────────────────────────────────────────

  describe("GET /api/admin/corridors", () => {
    it("returns corridors with pagination", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.corridors).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.regions).toBeDefined();
    });

    it("filter by isActive=true", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors?isActive=true"
      );
      const res = await listCorridors(req);
      const body = await parseResponse(res);
      for (const c of body.corridors) {
        expect(c.isActive).toBe(true);
      }
    });

    it("filter by isActive=false", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors?isActive=false"
      );
      const res = await listCorridors(req);
      const body = await parseResponse(res);
      for (const c of body.corridors) {
        expect(c.isActive).toBe(false);
      }
    });

    it("filter by originRegion", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors?originRegion=Addis%20Ababa"
      );
      const res = await listCorridors(req);
      const body = await parseResponse(res);
      for (const c of body.corridors) {
        expect(c.originRegion).toBe("Addis Ababa");
      }
    });

    it("returns ETHIOPIAN_REGIONS list", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      const body = await parseResponse(res);
      expect(body.regions).toContain("Addis Ababa");
      expect(body.regions).toContain("Dire Dawa");
    });

    it("includes feePreview for each corridor", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors"
      );
      const res = await listCorridors(req);
      const body = await parseResponse(res);
      if (body.corridors.length > 0) {
        expect(body.corridors[0].feePreview).toBeDefined();
      }
    });
  });

  // ─── POST /api/admin/corridors ──────────────────────────────────────────────

  describe("POST /api/admin/corridors", () => {
    it("create corridor with full pricing", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "Addis-Gambela",
            originRegion: "Addis Ababa",
            destinationRegion: "Gambela",
            distanceKm: 500,
            shipperPricePerKm: 6,
            carrierPricePerKm: 4,
          },
        }
      );
      const res = await createCorridor(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(201);
      expect(body.corridor).toBeDefined();
      expect(body.corridor.name).toBe("Addis-Gambela");
      expect(body.corridor.feePreview).toBeDefined();
    });

    it("duplicate corridor returns 409", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "Duplicate Test",
            originRegion: "Addis Ababa",
            destinationRegion: "Dire Dawa",
            distanceKm: 400,
            pricePerKm: 5,
          },
        }
      );
      const res = await createCorridor(req);
      expect(res.status).toBe(409);
    });

    it("Zod: name too short (<3) returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "AB",
            originRegion: "Addis Ababa",
            destinationRegion: "Afar",
            distanceKm: 100,
            pricePerKm: 5,
          },
        }
      );
      const res = await createCorridor(req);
      expect(res.status).toBe(400);
    });

    it("Zod: invalid originRegion returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "Invalid Origin",
            originRegion: "Fake Region",
            destinationRegion: "Afar",
            distanceKm: 100,
            pricePerKm: 5,
          },
        }
      );
      const res = await createCorridor(req);
      expect(res.status).toBe(400);
    });

    it("Zod: distanceKm > 5000 returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "Too Far",
            originRegion: "Addis Ababa",
            destinationRegion: "Harari",
            distanceKm: 6000,
            pricePerKm: 5,
          },
        }
      );
      const res = await createCorridor(req);
      expect(res.status).toBe(400);
    });

    it("default direction is ONE_WAY", async () => {
      useAdminSession();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/admin/corridors",
        {
          body: {
            name: "Addis-Sidama",
            originRegion: "Addis Ababa",
            destinationRegion: "Sidama",
            distanceKm: 200,
            pricePerKm: 4,
          },
        }
      );
      const res = await createCorridor(req);
      const body = await parseResponse(res);
      if (res.status === 201) {
        expect(body.corridor.direction).toBe("ONE_WAY");
      }
    });
  });

  // ─── GET /api/admin/corridors/[id] ──────────────────────────────────────────

  describe("GET /api/admin/corridors/[id]", () => {
    it("returns corridor with stats and recent loads", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/corridors/${seed.corridor.id}`
      );
      const res = await callHandler(getCorridor, req, { id: seed.corridor.id });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.corridor).toBeDefined();
      expect(body.corridor.id).toBe(seed.corridor.id);
      expect(body.corridor.loadsCount).toBeDefined();
      expect(body.corridor.stats).toBeDefined();
    });

    it("404 for non-existent corridor", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/corridors/non-existent"
      );
      const res = await callHandler(getCorridor, req, { id: "non-existent" });
      expect(res.status).toBe(404);
    });

    it("includes service fee preview", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/admin/corridors/${seed.corridor.id}`
      );
      const res = await callHandler(getCorridor, req, { id: seed.corridor.id });
      const body = await parseResponse(res);
      expect(body.corridor.serviceFeePreview).toBeDefined();
    });
  });

  // ─── PATCH /api/admin/corridors/[id] ────────────────────────────────────────

  describe("PATCH /api/admin/corridors/[id]", () => {
    it("update name and pricing", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/corridors/${seed.corridor.id}`,
        {
          body: { name: "Addis-Dire Dawa Updated", shipperPricePerKm: 7 },
        }
      );
      const res = await callHandler(updateCorridor, req, {
        id: seed.corridor.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.corridor.name).toBe("Addis-Dire Dawa Updated");
    });

    it("404 for non-existent corridor", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/corridors/non-existent",
        {
          body: { name: "Test" },
        }
      );
      const res = await callHandler(updateCorridor, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });

    it("partial updates (only changed fields)", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/corridors/${seed.corridor.id}`,
        {
          body: { isActive: false },
        }
      );
      const res = await callHandler(updateCorridor, req, {
        id: seed.corridor.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.corridor.isActive).toBe(false);
      // Reset for other tests
      await db.corridor.update({
        where: { id: seed.corridor.id },
        data: { isActive: true },
      });
    });
  });

  // ─── DELETE /api/admin/corridors/[id] ───────────────────────────────────────

  describe("DELETE /api/admin/corridors/[id]", () => {
    it("SUPER_ADMIN can delete corridor with no loads", async () => {
      useSuperAdminSession();
      // corridor-2 has no loads
      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/corridors/${seed.corridor2.id}`
      );
      const res = await callHandler(deleteCorridor, req, {
        id: seed.corridor2.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.message).toContain("deleted");
    });

    it("cannot delete if loads reference corridor", async () => {
      useSuperAdminSession();
      // corridor-1 has the delivered load
      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/admin/corridors/${seed.corridor.id}`
      );
      const res = await callHandler(deleteCorridor, req, {
        id: seed.corridor.id,
      });
      expect(res.status).toBe(400);
    });

    it("404 for non-existent corridor", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/admin/corridors/non-existent"
      );
      const res = await callHandler(deleteCorridor, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });
  });
});
