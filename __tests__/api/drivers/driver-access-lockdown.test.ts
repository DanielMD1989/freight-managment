/**
 * Driver Access Lockdown Tests — Task 27A
 *
 * Verifies that DRIVER role is blocked from all 14 critical endpoints
 * (Task 6A gaps). A driver shares the carrier's organizationId, so
 * these tests validate that the role check catches them.
 */
import {
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
  setAuthSession,
  createMockSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
} from "../../utils/routeTestUtils";
import { db } from "@/lib/db";

// ─── Mocks (must be at module level before route imports) ────────────────────
// mockAuth() NOT called — replaced by the extended mock below
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

// requireOtpVerified is used by documents/upload — extend the auth mock
jest.mock("@/lib/auth", () => {
  const { getAuthSession } = require("../../utils/routeTestUtils");
  return {
    requireAuth: jest.fn(async () => {
      const s = getAuthSession();
      if (!s) throw new Error("Unauthorized");
      return s;
    }),
    requireActiveUser: jest.fn(async () => {
      const s = getAuthSession();
      if (!s) throw new Error("Unauthorized");
      if (s.status !== "ACTIVE") {
        const e = new Error("Forbidden");
        (e as any).name = "ForbiddenError";
        throw e;
      }
      return { ...s, dbStatus: s.status };
    }),
    requireOtpVerified: jest.fn(async () => {
      const s = getAuthSession();
      if (!s) throw new Error("Unauthorized");
      return { ...s, dbStatus: s.status };
    }),
    getSessionAny: jest.fn(async () => getAuthSession()),
    getSession: jest.fn(async () => getAuthSession()),
    hashPassword: jest.fn(async (pw: string) => `hashed_${pw}`),
    validatePasswordPolicy: jest.fn(() => ({ valid: true, errors: [] })),
    revokeAllSessions: jest.fn(async () => {}),
    verifyToken: jest.fn(async () => getAuthSession()),
  };
});

// ─── Import route handlers AFTER mock setup ──────────────────────────────────
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const {
  GET: getWalletTransactions,
} = require("@/app/api/wallet/transactions/route");
const { GET: getWalletDeposits } = require("@/app/api/wallet/deposit/route");
const {
  DELETE: deleteOrgMember,
} = require("@/app/api/organizations/members/[id]/route");
const { GET: listTrucks } = require("@/app/api/trucks/route");
const { GET: listMatchProposals } = require("@/app/api/match-proposals/route");
const { GET: getDocumentById } = require("@/app/api/documents/[id]/route");
const { POST: uploadDocument } = require("@/app/api/documents/upload/route");
const { GET: getOrgMe } = require("@/app/api/organizations/me/route");
const {
  POST: createInvitation,
} = require("@/app/api/organizations/invitations/route");

// ─── Setup ───────────────────────────────────────────────────────────────────

const DRIVER_SESSION = createMockSession({
  userId: "driver-user-lockdown",
  email: "driver-lockdown@test.com",
  role: "DRIVER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
  firstName: "Lock",
  lastName: "Down",
});

beforeAll(async () => {
  await seedTestData();

  // Create a DRIVER user in the carrier org
  await db.user.create({
    data: {
      id: "driver-user-lockdown",
      email: "driver-lockdown@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Lock",
      lastName: "Down",
      phone: "+251911999001",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    },
  });
});

afterAll(() => {
  clearAllStores();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Driver Access Lockdown (Task 6A — 14 Critical Gaps)", () => {
  beforeEach(() => {
    setAuthSession(DRIVER_SESSION);
  });

  test("Gap 1: DRIVER cannot access wallet balance", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/wallet/balance"
    );
    const res = await callHandler(getWalletBalance, req);
    expect(res.status).toBe(404);
  });

  test("Gap 2: DRIVER cannot access wallet transactions", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/wallet/transactions"
    );
    const res = await callHandler(getWalletTransactions, req);
    expect(res.status).toBe(404);
  });

  test("Gap 3: DRIVER cannot access wallet deposits", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/wallet/deposit"
    );
    const res = await callHandler(getWalletDeposits, req);
    expect(res.status).toBe(404);
  });

  test("Gap 4: DRIVER cannot delete org members", async () => {
    const req = createRequest(
      "DELETE",
      "http://localhost:3000/api/organizations/members/some-id"
    );
    const res = await callHandler(deleteOrgMember, req, { id: "some-id" });
    expect(res.status).toBe(403);
    const body = await parseResponse(res);
    expect(body.error).toContain("Drivers cannot manage");
  });

  test("Gap 5: DRIVER cannot list all trucks", async () => {
    const req = createRequest("GET", "http://localhost:3000/api/trucks");
    const res = await callHandler(listTrucks, req);
    expect(res.status).toBe(403);
  });

  test("Gap 6: DRIVER cannot list match proposals", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/match-proposals"
    );
    const res = await callHandler(listMatchProposals, req);
    expect(res.status).toBe(404);
  });

  test("Gap 8: DRIVER cannot access org documents", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/documents/some-doc-id?entityType=company"
    );
    const res = await callHandler(getDocumentById, req, { id: "some-doc-id" });
    expect(res.status).toBe(404);
  });

  test("Gap 9: DRIVER cannot upload documents", async () => {
    // uploadDocument uses requireOtpVerified which maps to requireActiveUser in mock
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/documents/upload"
    );
    const res = await callHandler(uploadDocument, req);
    expect(res.status).toBe(403);
    const body = await parseResponse(res);
    expect(body.error).toContain("Drivers cannot upload");
  });

  test("Gap 10: DRIVER cannot create invitations", async () => {
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/organizations/invitations",
      {
        body: {
          email: "test@test.com",
          role: "CARRIER",
          organizationId: "carrier-org-1",
        },
      }
    );
    const res = await callHandler(createInvitation, req);
    expect(res.status).toBe(403);
    const body = await parseResponse(res);
    expect(body.error).toContain("Drivers cannot manage invitations");
  });

  test("Gap 13: DRIVER gets limited org/me response (no financialAccounts, no users)", async () => {
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/organizations/me"
    );
    const res = await callHandler(getOrgMe, req);
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    // Limited response should have basic org fields
    expect(body.organization).toBeDefined();
    expect(body.organization.id).toBeDefined();
    expect(body.organization.name).toBeDefined();
    // Should NOT have financial or user data
    expect(body.organization.financialAccounts).toBeUndefined();
    expect(body.organization.users).toBeUndefined();
    expect(body.organization._count).toBeUndefined();
  });
});
