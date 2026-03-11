/**
 * Active-User Enforcement Tests (Q1-B)
 *
 * Verifies that marketplace/state-changing routes reject REGISTERED/PENDING users
 * and only allow ACTIVE users.
 *
 * Routes under test:
 *   POST /api/organizations   — pending user cannot create org
 *   GET  /api/saved-searches  — pending user cannot read saved searches
 *   POST /api/saved-searches  — pending user cannot save searches
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
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockApiErrors,
  mockLogger,
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
mockApiErrors();
mockLogger();

const { POST: postOrganization } = require("@/app/api/organizations/route");
const {
  GET: getSavedSearches,
  POST: postSavedSearch,
} = require("@/app/api/saved-searches/route");

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Active-User Enforcement (Q1-B)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/organizations ─────────────────────────────────────────────────

  describe("POST /api/organizations", () => {
    it("AUE-1: REGISTERED (non-active) user → 403", async () => {
      setAuthSession(
        createMockSession({
          role: "SHIPPER",
          status: "REGISTERED",
          organizationId: undefined,
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/organizations",
        {
          body: {
            name: "New Org",
            type: "SHIPPER",
            contactEmail: "org@test.com",
            contactPhone: "0911000001",
          },
        }
      );
      const res = await callHandler(postOrganization, req);

      expect(res.status).toBe(403);
    });

    it("AUE-2: PENDING_VERIFICATION user → 403", async () => {
      setAuthSession(
        createMockSession({
          role: "SHIPPER",
          status: "PENDING_VERIFICATION",
          organizationId: undefined,
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/organizations",
        {
          body: {
            name: "New Org",
            type: "SHIPPER",
            contactEmail: "org2@test.com",
            contactPhone: "0911000002",
          },
        }
      );
      const res = await callHandler(postOrganization, req);

      expect(res.status).toBe(403);
    });

    it("AUE-3: ACTIVE user → proceeds past auth (400 or 201 based on state)", async () => {
      setAuthSession(
        createMockSession({
          role: "SHIPPER",
          status: "ACTIVE",
          organizationId: seed.shipperOrg.id, // already has org → 400
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/organizations",
        {
          body: {
            name: "Another Org",
            type: "SHIPPER",
            contactEmail: "org3@test.com",
            contactPhone: "0911000003",
          },
        }
      );
      const res = await callHandler(postOrganization, req);

      // Active user passes auth — gets 400 because user already has org, not 403
      expect(res.status).not.toBe(403);
    });
  });

  // ── GET /api/saved-searches ─────────────────────────────────────────────────

  describe("GET /api/saved-searches", () => {
    it("AUE-4: REGISTERED user → 403", async () => {
      setAuthSession(
        createMockSession({
          role: "SHIPPER",
          status: "REGISTERED",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/saved-searches"
      );
      const res = await callHandler(getSavedSearches, req);

      expect(res.status).toBe(403);
    });

    it("AUE-5: ACTIVE user → 200 with searches array", async () => {
      setAuthSession(
        createMockSession({
          role: "SHIPPER",
          status: "ACTIVE",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/saved-searches"
      );
      const res = await callHandler(getSavedSearches, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("searches");
    });
  });

  // ── POST /api/saved-searches ────────────────────────────────────────────────

  describe("POST /api/saved-searches", () => {
    it("AUE-6: REGISTERED user → 403", async () => {
      setAuthSession(
        createMockSession({
          role: "CARRIER",
          status: "REGISTERED",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/saved-searches",
        { body: { name: "My Search", type: "LOADS" } }
      );
      const res = await callHandler(postSavedSearch, req);

      expect(res.status).toBe(403);
    });

    it("AUE-7: ACTIVE user → 201", async () => {
      setAuthSession(
        createMockSession({
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/saved-searches",
        {
          body: {
            name: "My Search",
            type: "LOADS",
            criteria: { origin: "Addis" },
          },
        }
      );
      const res = await callHandler(postSavedSearch, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(body).toHaveProperty("search");
    });
  });
});
