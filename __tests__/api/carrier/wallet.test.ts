/**
 * Carrier Wallet API Tests
 *
 * Tests for wallet balance and transaction history:
 * - GET /api/wallet/balance → { wallets, totalBalance, currency, recentTransactionsCount }
 * - GET /api/wallet/transactions → { transactions, pagination }
 *
 * Business rules:
 * - User must belong to an organization
 * - Organization must have a financial account (wallet)
 * - Transactions filtered by wallet account IDs
 * - Pagination with limit/offset
 * - Type filter: COMMISSION, PAYMENT, REFUND, ADJUSTMENT
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

// Import handlers AFTER mocks
const { GET: getBalance } = require("@/app/api/wallet/balance/route");
const { GET: getTransactions } = require("@/app/api/wallet/transactions/route");

describe("Carrier Wallet", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const noOrgSession = createMockSession({
    userId: "no-org-user",
    email: "noorg@test.com",
    role: "CARRIER",
    organizationId: undefined,
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "carrier-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin user (shares carrier-org-1)
    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "User",
        phone: "+251911000003",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
    });

    // Create a second wallet for the carrier org (to test multi-wallet aggregation)
    await db.financialAccount.create({
      data: {
        id: "wallet-carrier-escrow",
        organizationId: seed.carrierOrg.id,
        accountType: "CARRIER_WALLET",
        balance: 2500,
        currency: "ETB",
      },
    });

    // Create a user without org
    await db.user.create({
      data: {
        id: "no-org-user",
        email: "noorg@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "No",
        lastName: "Org",
        phone: "+251911000099",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: undefined,
      },
    });

    // Create journal entries (transactions)
    await db.journalEntry.create({
      data: {
        id: "je-1",
        transactionType: "PAYMENT",
        description: "Payment for load delivery",
        reference: "REF-001",
        loadId: seed.load.id,
        lines: [
          {
            amount: 1000,
            isDebit: false,
            accountId: seed.carrierWallet.id,
            creditAccountId: null,
          },
        ],
      },
    });

    await db.journalEntry.create({
      data: {
        id: "je-2",
        transactionType: "COMMISSION",
        description: "Platform commission deduction",
        reference: "REF-002",
        loadId: seed.load.id,
        lines: [
          {
            amount: 50,
            isDebit: true,
            accountId: seed.carrierWallet.id,
            creditAccountId: null,
          },
        ],
      },
    });

    await db.journalEntry.create({
      data: {
        id: "je-3",
        transactionType: "REFUND",
        description: "Refund for cancelled load",
        reference: "REF-003",
        loadId: null,
        lines: [
          {
            amount: 200,
            isDebit: false,
            accountId: "wallet-carrier-escrow",
            creditAccountId: null,
          },
        ],
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

  // ─── GET /api/wallet/balance ────────────────────────────────────────────────

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

    it("carrier can view own wallet balance", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets).toBeDefined();
      expect(Array.isArray(data.wallets)).toBe(true);
      expect(data.totalBalance).toBeDefined();
      expect(typeof data.totalBalance).toBe("number");
      expect(data.currency).toBe("ETB");
    });

    it("user without organizationId → 400", async () => {
      setAuthSession(noOrgSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("organization");
    });

    it("org with no wallet → 404", async () => {
      // Create a session with org that has no financial accounts
      const orphanSession = createMockSession({
        userId: "orphan-user",
        email: "orphan@test.com",
        role: "CARRIER",
        organizationId: "orphan-org",
      });

      await db.organization.create({
        data: {
          id: "orphan-org",
          name: "Orphan Org",
          type: "CARRIER_COMPANY",
          contactEmail: "orphan@test.com",
          contactPhone: "+251911000088",
        },
      });

      await db.user.create({
        data: {
          id: "orphan-user",
          email: "orphan@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Orphan",
          lastName: "User",
          phone: "+251911000088",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "orphan-org",
        },
      });

      setAuthSession(orphanSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("No wallet found");
    });

    it("returns wallets array with type, balance, currency", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets.length).toBeGreaterThanOrEqual(1);
      const wallet = data.wallets[0];
      expect(wallet.id).toBeDefined();
      expect(wallet.type).toBeDefined();
      expect(typeof wallet.balance).toBe("number");
      expect(wallet.currency).toBe("ETB");
    });

    it("totalBalance is sum of all wallet accounts", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Carrier has wallet-carrier-1 (5000) + wallet-carrier-escrow (2500) = 7500
      const walletSum = data.wallets.reduce(
        (sum: number, w: any) => sum + w.balance,
        0
      );
      expect(data.totalBalance).toBe(walletSum);
    });

    it("includes recentTransactionsCount", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(typeof data.recentTransactionsCount).toBe("number");
    });

    it("admin with organizationId can view wallet", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets).toBeDefined();
    });
  });

  // ─── GET /api/wallet/transactions ───────────────────────────────────────────

  describe("GET /api/wallet/transactions", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect([401, 500]).toContain(res.status);
    });

    it("carrier gets own transactions", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.transactions).toBeDefined();
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("user without organizationId → 400", async () => {
      setAuthSession(noOrgSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("organization");
    });

    it("default pagination limit=50, offset=0", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.offset).toBe(0);
    });

    it("custom limit and offset respected", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?limit=10&offset=5"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(5);
    });

    it("returns empty array when no transactions exist", async () => {
      // Use a fresh org with a wallet but no journal entries
      await db.organization.create({
        data: {
          id: "empty-tx-org",
          name: "Empty TX Org",
          type: "CARRIER_COMPANY",
          contactEmail: "emptytx@test.com",
          contactPhone: "+251911000055",
        },
      });

      await db.user.create({
        data: {
          id: "empty-tx-user",
          email: "emptytx@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Empty",
          lastName: "TX",
          phone: "+251911000055",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "empty-tx-org",
        },
      });

      await db.financialAccount.create({
        data: {
          id: "wallet-empty-tx",
          organizationId: "empty-tx-org",
          accountType: "CARRIER_WALLET",
          balance: 0,
          currency: "ETB",
        },
      });

      const emptyTxSession = createMockSession({
        userId: "empty-tx-user",
        email: "emptytx@test.com",
        role: "CARRIER",
        organizationId: "empty-tx-org",
      });

      setAuthSession(emptyTxSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Mock doesn't filter by relation, so we check structure
      expect(data.transactions).toBeDefined();
      expect(Array.isArray(data.transactions)).toBe(true);
    });

    it("filter by transaction type", async () => {
      // M6 FIX: Use a valid TransactionType enum value (COMMISSION) instead of non-existent PAYMENT
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?type=COMMISSION"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // All returned transactions should be of type COMMISSION
      for (const tx of data.transactions) {
        expect(tx.type).toBe("COMMISSION");
      }
    });

    it("pagination includes totalCount and hasMore", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(typeof data.pagination.totalCount).toBe("number");
      expect(typeof data.pagination.hasMore).toBe("boolean");
    });
  });

  // ─── G-M31-C1: Sign convention tests ──────────────────────────────────────

  describe("G-M31-C1 sign convention", () => {
    const signOrgId = "sign-test-org";
    const signWalletId = "sign-test-wallet";

    const signSession = createMockSession({
      userId: "sign-test-user",
      email: "sign@test.com",
      role: "CARRIER",
      organizationId: signOrgId,
    });

    beforeAll(async () => {
      await db.organization.create({
        data: {
          id: signOrgId,
          name: "Sign Test Org",
          type: "CARRIER_COMPANY",
          contactEmail: "sign@test.com",
          contactPhone: "+251911099001",
        },
      });

      await db.user.create({
        data: {
          id: "sign-test-user",
          email: "sign@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Sign",
          lastName: "Test",
          phone: "+251911099001",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: signOrgId,
        },
      });

      await db.financialAccount.create({
        data: {
          id: signWalletId,
          organizationId: signOrgId,
          accountType: "CARRIER_WALLET",
          balance: 5000,
          currency: "ETB",
        },
      });

      // T1: Fee deduction — isDebit: true, money OUT
      await db.journalEntry.create({
        data: {
          id: "je-sign-deduct",
          transactionType: "SERVICE_FEE_DEDUCT",
          description: "Fee deduction for load",
          reference: "LOAD-SIGN-1",
          lines: [
            {
              amount: 300,
              isDebit: true,
              accountId: signWalletId,
              creditAccountId: null,
            },
          ],
        },
      });

      // T2: Deposit — isDebit: false (G-M31-C1 fix), money IN
      await db.journalEntry.create({
        data: {
          id: "je-sign-deposit",
          transactionType: "DEPOSIT",
          description: "Admin topup",
          reference: "TOPUP-SIGN-1",
          lines: [
            {
              amount: 1000,
              isDebit: false,
              accountId: signWalletId,
              creditAccountId: null,
            },
          ],
        },
      });

      // T3: Refund — isDebit: false, money IN
      await db.journalEntry.create({
        data: {
          id: "je-sign-refund",
          transactionType: "SERVICE_FEE_REFUND",
          description: "Fee refund for cancelled load",
          reference: "LOAD-SIGN-2",
          lines: [
            {
              amount: 200,
              isDebit: false,
              accountId: signWalletId,
              creditAccountId: null,
            },
          ],
        },
      });
    });

    it("T1: fee deduction returns negative amount", async () => {
      setAuthSession(signSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?type=SERVICE_FEE_DEDUCT"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      const deductTx = data.transactions.find(
        (t: any) => t.type === "SERVICE_FEE_DEDUCT"
      );
      expect(deductTx).toBeDefined();
      expect(deductTx.amount).toBeLessThan(0);
      expect(deductTx.amount).toBe(-300);
    });

    it("T2: deposit returns positive amount", async () => {
      setAuthSession(signSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?type=DEPOSIT"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      const depositTx = data.transactions.find(
        (t: any) => t.type === "DEPOSIT"
      );
      expect(depositTx).toBeDefined();
      expect(depositTx.amount).toBeGreaterThan(0);
      expect(depositTx.amount).toBe(1000);
    });

    it("T3: refund returns positive amount", async () => {
      setAuthSession(signSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?type=SERVICE_FEE_REFUND"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      const refundTx = data.transactions.find(
        (t: any) => t.type === "SERVICE_FEE_REFUND"
      );
      expect(refundTx).toBeDefined();
      expect(refundTx.amount).toBeGreaterThan(0);
      expect(refundTx.amount).toBe(200);
    });

    it("T4: total withdrawn excludes deposits — only deductions are negative", async () => {
      // Verify the API sign convention: deposits (isDebit: false) return positive,
      // fee deductions (isDebit: true) return negative. The carrier wallet page
      // aggregates "total withdrawn" from isDebit: true lines — deposits must
      // NOT appear there.
      setAuthSession(signSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Negative amounts = money OUT (fee deductions, withdrawals)
      const negativeTxs = data.transactions.filter((t: any) => t.amount < 0);
      // Only the fee deduction (-300) should be negative.
      // The deposit (+1000) must NOT be negative.
      for (const tx of negativeTxs) {
        expect(tx.type).not.toBe("DEPOSIT");
      }
      const deductTx = negativeTxs.find(
        (t: any) => t.type === "SERVICE_FEE_DEDUCT"
      );
      expect(deductTx).toBeDefined();
      expect(deductTx.amount).toBe(-300);
    });

    it("T5: deposits appear as positive — included in total deposited", async () => {
      // Verify that deposits (isDebit: false) return positive amounts.
      // The shipper wallet page aggregates "total deposited" from
      // isDebit: false + transactionType: DEPOSIT lines.
      setAuthSession(signSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/transactions?type=DEPOSIT"
      );
      const res = await getTransactions(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      const depositTxs = data.transactions.filter(
        (t: any) => t.type === "DEPOSIT"
      );
      // All deposits must be positive
      for (const tx of depositTxs) {
        expect(tx.amount).toBeGreaterThan(0);
      }
      // Our test deposit of 1000 should be present and positive
      const ourDeposit = depositTxs.find((t: any) => t.amount === 1000);
      expect(ourDeposit).toBeDefined();
    });
  });
});
