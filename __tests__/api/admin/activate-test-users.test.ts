/**
 * Admin Activate Test Users API Tests
 *
 * Tests for POST/GET /api/admin/activate-test-users
 * Verifies BUG-ACTIVATE-EMAIL fix: endsWith "@testfreightet.com" (not contains)
 */

import { db } from "@/lib/db";
import {
  setAuthSession,
  createRequest,
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
  useShipperSession,
  useCarrierSession,
  useDispatcherSession,
  seedAdminTestData,
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

// Import route handlers AFTER mocks
const {
  POST: activateTestUsers,
  GET: getTestUsers,
} = require("@/app/api/admin/activate-test-users/route");

describe("Admin Activate Test Users API", () => {
  beforeAll(async () => {
    await seedAdminTestData();

    // Seed a legitimate test user
    await db.user.create({
      data: {
        id: "atu-legit-user",
        email: "testuser@testfreightet.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Legit",
        lastName: "TestUser",
        phone: "+251922000001",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: "shipper-org-1",
      },
    });

    // Seed an "evil" user whose email contains but does NOT end with @testfreightet.com
    await db.organization.create({
      data: {
        id: "org-evil-atu",
        name: "Evil ATU Org",
        type: "SHIPPER",
        contactEmail: "evil-atu@evil.com",
        contactPhone: "+251922000002",
      },
    });
    await db.user.create({
      data: {
        id: "atu-evil-user",
        email: "not@domain.com+testfreightet.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Evil",
        lastName: "User",
        phone: "+251922000002",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: "org-evil-atu",
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

  // ATU-1: Admin activates @testfreightet.com users
  it("ATU-1: Admin POST → activates @testfreightet.com users → 200 + count ≥ 1", async () => {
    useAdminSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    const res = await activateTestUsers(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body.message).toContain("ACTIVE");
  });

  // ATU-2: Evil user with testfreightet.com in middle is NOT activated
  it("ATU-2: User with testfreightet.com in middle of email NOT activated by endsWith fix", async () => {
    useAdminSession();

    // Reset evil user to PENDING_VERIFICATION before test
    await db.user.update({
      where: { id: "atu-evil-user" },
      data: { status: "PENDING_VERIFICATION" },
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    await activateTestUsers(req);

    // The evil user should still be PENDING_VERIFICATION
    const evilUser = await db.user.findUnique({
      where: { id: "atu-evil-user" },
    });
    expect(evilUser!.status).toBe("PENDING_VERIFICATION");

    // The legit user should be ACTIVE
    const legitUser = await db.user.findUnique({
      where: { id: "atu-legit-user" },
    });
    expect(legitUser!.status).toBe("ACTIVE");
  });

  // ATU-3: Admin GET returns list of test users
  it("ATU-3: Admin GET → returns test users list → 200", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    const res = await getTestUsers(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body.users).toBeDefined();
    expect(Array.isArray(body.users)).toBe(true);
  });

  // ATU-4: SHIPPER POST → 403
  it("ATU-4: SHIPPER POST → 403", async () => {
    useShipperSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    const res = await activateTestUsers(req);
    expect(res.status).toBe(403);
  });

  // ATU-5: CARRIER POST → 403
  it("ATU-5: CARRIER POST → 403", async () => {
    useCarrierSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    const res = await activateTestUsers(req);
    expect(res.status).toBe(403);
  });

  // ATU-6: DISPATCHER POST → 403
  it("ATU-6: DISPATCHER POST → 403", async () => {
    useDispatcherSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    const res = await activateTestUsers(req);
    expect(res.status).toBe(403);
  });

  // ATU-7: Unauthenticated POST → 500
  it("ATU-7: Unauthenticated POST → 500", async () => {
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/admin/activate-test-users"
    );
    const res = await activateTestUsers(req);
    expect(res.status).toBe(500);
  });
});
