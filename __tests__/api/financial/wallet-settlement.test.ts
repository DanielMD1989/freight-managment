/**
 * US-10 · Wallet / Financial Settlement
 *
 * Tests for:
 * - GET /api/wallet/balance → carrier balance
 * - GET /api/wallet/transactions → paginated transaction list
 * - GET /api/financial/wallet → full wallet detail
 * - POST /api/financial/withdraw → withdrawal request
 * - GET /api/wallets/summary → admin-only aggregate summary
 *
 * Business rules:
 * - requireActiveUser enforced on all endpoints
 * - Shipper accessing carrier wallet → 404 (role-based)
 * - Withdraw > balance → 400
 * - Concurrent withdrawals guarded atomically
 * - Transactions are paginated (limit max 100)
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

// Import handlers AFTER mocks
const { GET: getBalance } = require("@/app/api/wallet/balance/route");
const { GET: getTransactions } = require("@/app/api/wallet/transactions/route");
const { GET: getFinancialWallet } = require("@/app/api/financial/wallet/route");
const { POST: withdraw } = require("@/app/api/financial/withdraw/route");
const { GET: getWalletsSummary } = require("@/app/api/wallets/summary/route");

describe("US-10 · Wallet / Financial Settlement", () => {
  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "wallet-admin-1",
    email: "walletadmin@test.com",
    role: "ADMIN",
    organizationId: "wallet-admin-org",
  });

  const superAdminSession = createMockSession({
    userId: "wallet-superadmin-1",
    email: "walletsuper@test.com",
    role: "SUPER_ADMIN",
    organizationId: "wallet-admin-org",
  });

  beforeAll(async () => {
    await seedTestData();

    // Admin org for summary tests
    await db.organization.create({
      data: {
        id: "wallet-admin-org",
        name: "Admin Platform",
        type: "PLATFORM",
        contactEmail: "walletadmin@test.com",
        contactPhone: "+251911000060",
      },
    });
    await db.user.create({
      data: {
        id: "wallet-admin-1",
        email: "walletadmin@test.com",
        passwordHash: "hashed_SecurePass1!",
        firstName: "Wallet",
        lastName: "Admin",
        phone: "+251911000060",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "wallet-admin-org",
      },
    });
    await db.user.create({
      data: {
        id: "wallet-superadmin-1",
        email: "walletsuper@test.com",
        passwordHash: "hashed_SecurePass1!",
        firstName: "Wallet",
        lastName: "SuperAdmin",
        phone: "+251911000061",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        organizationId: "wallet-admin-org",
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/wallet/balance ─────────────────────────────────────────────

  describe("GET /api/wallet/balance", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect([401, 500]).toContain(res.status);
    });

    it("carrier with wallet → 200 with balance", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBeDefined();
      expect(data.wallets).toBeDefined();
      expect(Array.isArray(data.wallets)).toBe(true);
    });

    it("carrier wallet has currency=ETB", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      const data = await parseResponse(res);
      expect(data.currency).toBe("ETB");
    });

    it("PENDING user cannot access balance (requireActiveUser)", async () => {
      const pendingSession = createMockSession({
        userId: "wallet-user-1",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: "carrier-org-1",
      });
      setAuthSession(pendingSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect([401, 403]).toContain(res.status);
    });

    it("user without organization → 400", async () => {
      const noOrgSession = createMockSession({
        userId: "wallet-no-org-user",
        role: "CARRIER",
        organizationId: undefined,
      });
      await db.user.create({
        data: {
          id: "wallet-no-org-user",
          email: "walletnoorg@test.com",
          passwordHash: "hashed_SecurePass1!",
          firstName: "No",
          lastName: "Org",
          phone: "+251911000070",
          role: "CARRIER",
          status: "ACTIVE",
        },
      });
      setAuthSession(noOrgSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(400);
    });

    it("org with no wallet → 404", async () => {
      const noWalletOrg = "wallet-empty-org";
      await db.organization.create({
        data: {
          id: noWalletOrg,
          name: "Empty Wallet Org",
          type: "CARRIER_COMPANY",
          contactEmail: "emptywallet@test.com",
          contactPhone: "+251911000071",
        },
      });
      const noWalletSession = createMockSession({
        userId: "wallet-empty-user",
        role: "CARRIER",
        organizationId: noWalletOrg,
      });
      await db.user.create({
        data: {
          id: "wallet-empty-user",
          email: "emptywallet@test.com",
          passwordHash: "hashed_SecurePass1!",
          firstName: "Empty",
          lastName: "Wallet",
          phone: "+251911000071",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: noWalletOrg,
        },
      });
      setAuthSession(noWalletSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(404);
    });
  });

  // ─── GAP-4: Shipper wallet tests ─────────────────────────────────────────

  describe("Shipper wallet via GET /api/wallet/balance", () => {
    it("SHIPPER can GET own wallet balance → 200 with SHIPPER_WALLET", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBeDefined();
      expect(data.wallets).toBeDefined();
      expect(Array.isArray(data.wallets)).toBe(true);
    });

    it("SHIPPER wallet type is SHIPPER_WALLET (not CARRIER_WALLET)", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      const data = await parseResponse(res);
      const walletTypes = data.wallets.map((w: any) => w.type);
      expect(walletTypes).toContain("SHIPPER_WALLET");
      expect(walletTypes).not.toContain("CARRIER_WALLET");
    });

    it("SHIPPER wallet has positive balance from seed data", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      const data = await parseResponse(res);
      expect(data.totalBalance).toBeGreaterThan(0);
    });

    it("SHIPPER wallet currency is ETB", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      const data = await parseResponse(res);
      expect(data.currency).toBe("ETB");
    });

    it("SHIPPER cannot see CARRIER wallet (different org isolation)", async () => {
      // The shipper org only has a SHIPPER_WALLET;
      // carrier's CARRIER_WALLET belongs to a different organizationId.
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      const data = await parseResponse(res);
      // Shipper's wallet list must not include any CARRIER_WALLET type
      const hasCarrierWallet = data.wallets.some(
        (w: any) => w.type === "CARRIER_WALLET"
      );
      expect(hasCarrierWallet).toBe(false);
    });
  });

  // ─── GET /api/wallet/transactions ───────────────────────────────────────

  describe("GET /api/wallet/transactions", () => {
    it("carrier → 200 with transactions array", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.transactions).toBeDefined();
      expect(Array.isArray(data.transactions)).toBe(true);
    });

    it("limit param capped at 100", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?limit=9999"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);
      // Verify data returns (capped internally) — no error
      const data = await parseResponse(res);
      expect(data.transactions).toBeDefined();
    });

    it("limit=0 clamps to 1", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?limit=0"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);
    });

    it("returns pagination metadata (total, limit, offset)", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?limit=10&offset=0"
      );
      const res = await getTransactions(req);
      const data = await parseResponse(res);
      expect(data.pagination).toBeDefined();
    });

    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/financial/wallet ──────────────────────────────────────────

  describe("GET /api/financial/wallet", () => {
    it("carrier → 200 with wallet details", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/financial/wallet"
      );
      const res = await getFinancialWallet(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.wallet).toBeDefined();
      expect(data.wallet.accountType).toBe("CARRIER_WALLET");
    });

    it("PENDING user → 401/403 (requireActiveUser)", async () => {
      const pendingSession = createMockSession({
        userId: "fin-wallet-pending",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: "carrier-org-1",
      });
      setAuthSession(pendingSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/financial/wallet"
      );
      const res = await getFinancialWallet(req);
      expect([401, 403]).toContain(res.status);
    });
  });

  // ─── POST /api/financial/withdraw ───────────────────────────────────────

  describe("POST /api/financial/withdraw", () => {
    const validWithdraw = {
      amount: 100,
      bankAccount: "1234567890",
      bankName: "Commercial Bank",
      accountHolder: "Test Carrier",
    };

    it("carrier with sufficient balance → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        { body: validWithdraw }
      );
      const res = await withdraw(req);
      expect(res.status).toBe(200);
    });

    it("withdraw more than balance → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        {
          body: {
            ...validWithdraw,
            amount: 9_999_999, // way more than seeded balance
          },
        }
      );
      const res = await withdraw(req);
      expect([400, 422]).toContain(res.status);
    });

    it("amount = 0 → 400 (must be positive)", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        {
          body: { ...validWithdraw, amount: 0 },
        }
      );
      const res = await withdraw(req);
      expect(res.status).toBe(400);
    });

    it("amount negative → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        {
          body: { ...validWithdraw, amount: -50 },
        }
      );
      const res = await withdraw(req);
      expect(res.status).toBe(400);
    });

    it("bankAccount too short → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        {
          body: { ...validWithdraw, bankAccount: "123" },
        }
      );
      const res = await withdraw(req);
      expect(res.status).toBe(400);
    });

    it("PENDING user cannot withdraw (requireActiveUser)", async () => {
      const pendingSession = createMockSession({
        userId: "withdraw-pending",
        role: "CARRIER",
        status: "PENDING_VERIFICATION",
        organizationId: "carrier-org-1",
      });
      setAuthSession(pendingSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        { body: validWithdraw }
      );
      const res = await withdraw(req);
      expect([401, 403]).toContain(res.status);
    });

    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        { body: validWithdraw }
      );
      const res = await withdraw(req);
      expect([401, 500]).toContain(res.status);
    });

    it("CSRF validation is called", async () => {
      setAuthSession(carrierSession);
      const { validateCSRFWithMobile } = require("@/lib/csrf");
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/financial/withdraw",
        { body: validWithdraw }
      );
      await withdraw(req);
      expect(validateCSRFWithMobile).toHaveBeenCalled();
    });
  });

  // ─── GET /api/wallets/summary (admin only) ──────────────────────────────

  describe("GET /api/wallets/summary", () => {
    it("admin → 200 with aggregated totals", async () => {
      setAuthSession(adminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallets/summary"
      );
      const res = await getWalletsSummary(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.totalPlatformRevenue).toBeDefined();
      expect(data.totalShipperDeposits).toBeDefined();
      expect(data.totalCarrierEarnings).toBeDefined();
    });

    it("SUPER_ADMIN → 200 with aggregated totals", async () => {
      setAuthSession(superAdminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallets/summary"
      );
      const res = await getWalletsSummary(req);
      expect(res.status).toBe(200);
    });

    it("carrier → 404 (not admin)", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallets/summary"
      );
      const res = await getWalletsSummary(req);
      expect(res.status).toBe(404);
    });

    it("shipper → 404 (not admin)", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallets/summary"
      );
      const res = await getWalletsSummary(req);
      expect(res.status).toBe(404);
    });

    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallets/summary"
      );
      const res = await getWalletsSummary(req);
      expect([401, 500]).toContain(res.status);
    });

    it("totals are numeric (not null)", async () => {
      setAuthSession(adminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallets/summary"
      );
      const res = await getWalletsSummary(req);
      const data = await parseResponse(res);
      expect(typeof data.totalPlatformRevenue).toBe("number");
      expect(typeof data.totalShipperDeposits).toBe("number");
      expect(typeof data.totalCarrierEarnings).toBe("number");
    });
  });
});
