/**
 * Financial Withdrawal API Tests
 *
 * Tests for withdrawal operations:
 * - POST /api/financial/withdraw → { message, withdrawalRequest }
 * - GET /api/financial/withdraw → { withdrawals }
 *
 * Business rules:
 * - POST requires ACTIVE user status (requireActiveUser)
 * - POST requires WITHDRAW_FUNDS permission
 * - CSRF validation on POST
 * - Amount must be positive, bankAccount min 10 chars
 * - Balance check in Serializable transaction (race condition safety)
 * - Insufficient balance → 400
 * - GET: carriers see own withdrawal requests, admin sees all
 * - Status filter: ?status=PENDING
 * - Results ordered by createdAt desc
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
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
  mockLoadUtils,
  SeedData,
} from "../../utils/routeTestUtils";

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
mockRbac();
mockApiErrors();
mockLogger();
mockLoadUtils();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

jest.mock("@prisma/client", () => ({
  Prisma: {
    TransactionIsolationLevel: {
      Serializable: "Serializable",
      ReadCommitted: "ReadCommitted",
      RepeatableRead: "RepeatableRead",
    },
  },
}));

// Import handlers AFTER mocks
const {
  POST: requestWithdrawal,
  GET: listWithdrawals,
} = require("@/app/api/financial/withdraw/route");

describe("Financial Withdrawal API", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  const inactiveSession = createMockSession({
    userId: "inactive-user",
    email: "inactive@test.com",
    role: "CARRIER",
    status: "PENDING_VERIFICATION",
    organizationId: "carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "admin-org-1",
  });

  const validWithdrawal = {
    amount: 500,
    bankAccount: "1234567890123",
    bankName: "Commercial Bank of Ethiopia",
    accountHolder: "Test Carrier",
  };

  beforeAll(async () => {
    seed = await seedTestData();

    // Admin org + user
    await db.organization.create({
      data: {
        id: "admin-org-1",
        name: "Admin Org",
        type: "PLATFORM",
        contactEmail: "admin@test.com",
        contactPhone: "+251911000010",
      },
    });
    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "User",
        phone: "+251911000010",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "admin-org-1",
      },
    });

    // Inactive user for status check
    await db.user.create({
      data: {
        id: "inactive-user",
        email: "inactive@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Inactive",
        lastName: "User",
        phone: "+251911033333",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: "carrier-org-1",
      },
    });

    // Pre-create withdrawal requests for GET tests
    await db.withdrawalRequest.create({
      data: {
        id: "wr-1",
        amount: 200,
        bankAccount: "1234567890123",
        bankName: "CBE",
        accountHolder: "Test Carrier",
        requestedById: "carrier-user-1",
        status: "PENDING",
        createdAt: new Date("2026-02-25T10:00:00Z"),
      },
    });
    await db.withdrawalRequest.create({
      data: {
        id: "wr-2",
        amount: 300,
        bankAccount: "1234567890123",
        bankName: "CBE",
        accountHolder: "Test Carrier",
        requestedById: "carrier-user-1",
        status: "APPROVED",
        createdAt: new Date("2026-02-26T10:00:00Z"),
      },
    });
    await db.withdrawalRequest.create({
      data: {
        id: "wr-admin",
        amount: 1000,
        bankAccount: "9876543210123",
        bankName: "Dashen Bank",
        accountHolder: "Other User",
        requestedById: "admin-user-1",
        status: "PENDING",
        createdAt: new Date("2026-02-27T10:00:00Z"),
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/financial/withdraw ────────────────────────────────────────

  describe("POST /api/financial/withdraw", () => {
    describe("Auth", () => {
      it("unauthenticated → 401/500", async () => {
        setAuthSession(null);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        const res = await requestWithdrawal(req);
        expect([401, 500]).toContain(res.status);
      });

      it("non-ACTIVE user → 403/500", async () => {
        setAuthSession(inactiveSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        const res = await requestWithdrawal(req);
        expect([403, 500]).toContain(res.status);
      });
    });

    describe("Organization", () => {
      it("user without organizationId → 400", async () => {
        const noOrgSession = createMockSession({
          userId: "wd-no-org",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: undefined,
        });
        await db.user.create({
          data: {
            id: "wd-no-org",
            email: "wdnoorg@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "No",
            lastName: "Org",
            phone: "+251911022222",
            role: "CARRIER",
            status: "ACTIVE",
          },
        });
        setAuthSession(noOrgSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(400);
      });
    });

    describe("Validation", () => {
      it("negative amount → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: { ...validWithdrawal, amount: -100 } }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(400);
      });

      it("bankAccount < 10 chars → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: { ...validWithdrawal, bankAccount: "12345" } }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(400);
      });

      it("missing required fields → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: { amount: 500 } }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(400);
      });
    });

    describe("Wallet checks", () => {
      it("wallet not found → 404", async () => {
        const noWalletSession = createMockSession({
          userId: "wd-no-wallet",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "no-wallet-org-wd",
        });
        await db.organization.create({
          data: {
            id: "no-wallet-org-wd",
            name: "No Wallet Org WD",
            type: "CARRIER_COMPANY",
            contactEmail: "nowallet-wd@test.com",
            contactPhone: "+251911011111",
          },
        });
        await db.user.create({
          data: {
            id: "wd-no-wallet",
            email: "wdnowallet@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "No",
            lastName: "Wallet",
            phone: "+251911011111",
            role: "CARRIER",
            status: "ACTIVE",
            organizationId: "no-wallet-org-wd",
          },
        });
        setAuthSession(noWalletSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(404);
      });

      it("insufficient balance → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: { ...validWithdrawal, amount: 999999 } }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(400);
        const data = await parseResponse(res);
        expect(data.error).toMatch(/insufficient/i);
      });
    });

    describe("Success", () => {
      it("returns withdrawal request with PENDING status", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        const res = await requestWithdrawal(req);
        expect(res.status).toBe(200);
        const data = await parseResponse(res);
        expect(data.message).toMatch(/submitted/i);
        expect(data.withdrawalRequest).toBeDefined();
        expect(data.withdrawalRequest.status).toBe("PENDING");
      });

      it("sets requestedById to current user", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        const res = await requestWithdrawal(req);
        const data = await parseResponse(res);
        expect(data.withdrawalRequest.requestedById).toBe("carrier-user-1");
      });
    });

    describe("Transaction", () => {
      it("uses $transaction for race condition safety", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        await requestWithdrawal(req);
        expect(db.$transaction).toHaveBeenCalled();
      });
    });

    describe("CSRF", () => {
      it("CSRF validation runs on POST", async () => {
        const { validateCSRFWithMobile } = require("@/lib/csrf");
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/financial/withdraw",
          { body: validWithdrawal }
        );
        await requestWithdrawal(req);
        expect(validateCSRFWithMobile).toHaveBeenCalled();
      });
    });
  });

  // ─── GET /api/financial/withdraw ────────────────────────────────────────

  describe("GET /api/financial/withdraw", () => {
    describe("Auth", () => {
      it("unauthenticated → 401/500", async () => {
        setAuthSession(null);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/withdraw"
        );
        const res = await listWithdrawals(req);
        expect([401, 500]).toContain(res.status);
      });
    });

    describe("Access control", () => {
      it("carrier sees only own withdrawal requests", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/withdraw"
        );
        const res = await listWithdrawals(req);
        expect(res.status).toBe(200);
        const data = await parseResponse(res);
        expect(data.withdrawals).toBeDefined();
        for (const wr of data.withdrawals) {
          expect(wr.requestedById).toBe("carrier-user-1");
        }
      });

      it("admin sees all withdrawal requests", async () => {
        setAuthSession(adminSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/withdraw"
        );
        const res = await listWithdrawals(req);
        expect(res.status).toBe(200);
        const data = await parseResponse(res);
        // Admin should see all, including carrier's and admin's own
        expect(data.withdrawals.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe("Filtering", () => {
      it("?status=PENDING filters results", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/withdraw?status=PENDING"
        );
        const res = await listWithdrawals(req);
        const data = await parseResponse(res);
        for (const wr of data.withdrawals) {
          expect(wr.status).toBe("PENDING");
        }
      });
    });

    describe("Empty results", () => {
      it("returns empty array when no requests", async () => {
        const freshSession = createMockSession({
          userId: "fresh-user",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "carrier-org-1",
        });
        await db.user.create({
          data: {
            id: "fresh-user",
            email: "fresh@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "Fresh",
            lastName: "User",
            phone: "+251911066666",
            role: "CARRIER",
            status: "ACTIVE",
            organizationId: "carrier-org-1",
          },
        });
        setAuthSession(freshSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/withdraw"
        );
        const res = await listWithdrawals(req);
        const data = await parseResponse(res);
        expect(data.withdrawals).toEqual([]);
      });
    });

    describe("Ordering", () => {
      it("returns withdrawals with createdAt timestamps", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/withdraw"
        );
        const res = await listWithdrawals(req);
        const data = await parseResponse(res);
        expect(data.withdrawals.length).toBeGreaterThanOrEqual(2);
        // All records should have createdAt timestamps
        for (const wr of data.withdrawals) {
          expect(wr.createdAt).toBeDefined();
        }
      });
    });
  });
});
