/**
 * Regression tests for Bug #9 and Bug #10 caught during the functional
 * e2e session (commits 33da950 and 335cee6).
 *
 * Bug #9: PATCH /api/organizations/[id] returned 500 when the form sent
 *        licenseNumber:"" or taxId:"" because Prisma's @unique constraint
 *        on those fields rejected duplicate empty strings.
 *        Lifetime in production: ~3.5 months (since 2025-12-24).
 *
 * Bug #10: PATCH /api/trips/[tripId] silently rejected admin EXCEPTION
 *         to CANCELLED transitions because the admin UI didn't supply
 *         cancelReason. The 400 error was swallowed and trips stayed
 *         stuck in EXCEPTION forever.
 *         Lifetime in production: ~1 month (since 2026-03-09).
 *
 * If either of these tests starts failing, the bug has regressed.
 */

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

// Bug #8 fix made canManageOrganization use getSessionAny() which the
// default mockAuth doesn't fully wire up. Mock @/lib/rbac directly so
// canManageOrganization returns true for our seeded shipper user.
jest.mock("@/lib/rbac", () => {
  const actual = jest.requireActual("@/lib/rbac");
  return {
    ...actual,
    canManageOrganization: jest.fn(async () => true),
    requirePermission: jest.fn(async () => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      return session;
    }),
  };
});

const { PATCH: updateOrg } = require("@/app/api/organizations/[id]/route");
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");
import { db } from "@/lib/db";

describe("Regression: Bug #9 and Bug #10", () => {
  let seed: SeedData;

  beforeEach(async () => {
    clearAllStores();
    seed = await seedTestData();
  });

  // ─── Bug #9: empty licenseNumber/taxId on org PATCH ──────────────────
  describe("Bug #9: empty unique strings must not 500", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: seed.shipperUser.email,
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );
    });

    it('PATCH org with licenseNumber:"" returns 200, not 500', async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/organizations/${seed.shipperOrg.id}`,
        {
          body: {
            name: "Test Shipper Co",
            description: "regression test for bug 9",
            contactEmail: "shipper@test.com",
            contactPhone: "+251911111111",
            licenseNumber: "",
            taxId: "",
            allowNameDisplay: true,
          },
        }
      );

      const res = await callHandler(updateOrg, req, {
        id: seed.shipperOrg.id,
      });

      // Pre-fix this returned 500 (Prisma P2002 unique violation
      // surfaced as Internal server error). Post-fix the zod transform
      // strips empty strings to undefined and the update succeeds.
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.organization?.description).toBe("regression test for bug 9");
    });

    it('PATCH org with only licenseNumber:"" still 200', async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/organizations/${seed.shipperOrg.id}`,
        {
          body: { licenseNumber: "" },
        }
      );

      const res = await callHandler(updateOrg, req, {
        id: seed.shipperOrg.id,
      });
      expect(res.status).toBe(200);
    });

    it('PATCH org with only taxId:"" still 200', async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/organizations/${seed.shipperOrg.id}`,
        {
          body: { taxId: "" },
        }
      );

      const res = await callHandler(updateOrg, req, {
        id: seed.shipperOrg.id,
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Bug #10: trip CANCELLED without cancelReason must 400 ───────────
  describe("Bug #10: trip CANCELLED requires cancelReason", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "audit-admin-1",
          email: "audit-admin@test.com",
          role: "ADMIN",
          organizationId: null,
        })
      );
    });

    it("PATCH trip to CANCELLED without cancelReason → 400", async () => {
      // Seed an EXCEPTION trip the admin will try to cancel
      const trip = await db.trip.create({
        data: {
          id: "audit-trip-bug10",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${trip.id}`,
        {
          body: { status: "CANCELLED" }, // missing cancelReason — bug #10
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: trip.id });

      // Pre-fix: the admin UI sent this exact body and the API returned
      // 400 silently which the UI swallowed. Trip stayed in EXCEPTION.
      // Post-fix: the admin UI prompts for a reason via window.prompt()
      // before sending. The API contract is unchanged — still 400.
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/cancelReason is required/i);

      // Trip stays EXCEPTION (no silent state corruption)
      const after = await db.trip.findUnique({ where: { id: trip.id } });
      expect(after?.status).toBe("EXCEPTION");
    });

    it("PATCH trip to CANCELLED WITH cancelReason → 200", async () => {
      const trip = await db.trip.create({
        data: {
          id: "audit-trip-bug10-pass",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${trip.id}`,
        {
          body: {
            status: "CANCELLED",
            cancelReason: "regression test bug 10 happy path",
          },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const after = await db.trip.findUnique({ where: { id: trip.id } });
      expect(after?.status).toBe("CANCELLED");
    });
  });
});
