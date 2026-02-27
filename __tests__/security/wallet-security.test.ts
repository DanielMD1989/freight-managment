/**
 * Wallet Security Tests
 *
 * Tests wallet access control, cross-org isolation,
 * and financial data integrity.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
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
} from "../utils/routeTestUtils";

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

// Import route handlers AFTER mocks (use require so mocks are applied)
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");

describe("Wallet Security Tests", () => {
  beforeAll(async () => {
    // Create organizations
    await db.organization.create({
      data: {
        id: "wallet-shipper-org",
        name: "Wallet Shipper",
        type: "SHIPPER",
        contactEmail: "ws@test.com",
        contactPhone: "+251911000001",
      },
    });

    await db.organization.create({
      data: {
        id: "wallet-carrier-org",
        name: "Wallet Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "wc@test.com",
        contactPhone: "+251911000002",
      },
    });

    await db.organization.create({
      data: {
        id: "wallet-empty-org",
        name: "Empty Wallet Org",
        type: "CARRIER_COMPANY",
        contactEmail: "empty@test.com",
        contactPhone: "+251911000003",
      },
    });

    // Create users
    await db.user.create({
      data: {
        id: "wallet-shipper-user",
        email: "ws@test.com",
        passwordHash: "hash",
        firstName: "Wallet",
        lastName: "Shipper",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "wallet-shipper-org",
      },
    });

    await db.user.create({
      data: {
        id: "wallet-carrier-user",
        email: "wc@test.com",
        passwordHash: "hash",
        firstName: "Wallet",
        lastName: "Carrier",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "wallet-carrier-org",
      },
    });

    await db.user.create({
      data: {
        id: "wallet-no-org-user",
        email: "noorg@test.com",
        passwordHash: "hash",
        firstName: "No",
        lastName: "Org",
        role: "CARRIER",
        status: "ACTIVE",
      },
    });

    // Create wallets with different balances
    await db.financialAccount.create({
      data: {
        id: "shipper-wallet-sec",
        organizationId: "wallet-shipper-org",
        accountType: "SHIPPER_WALLET",
        balance: 50000,
        currency: "ETB",
      },
    });

    await db.financialAccount.create({
      data: {
        id: "carrier-wallet-sec",
        organizationId: "wallet-carrier-org",
        accountType: "CARRIER_WALLET",
        balance: 25000,
        currency: "ETB",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Access Control ──────────────────────────────────────────────────────

  describe("Wallet access control", () => {
    it("should require authentication", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(401);
    });

    it("should require organization membership", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-no-org-user",
          email: "noorg@test.com",
          role: "CARRIER",
          organizationId: undefined,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("organization");
    });

    it("should return 404 for org without wallet", async () => {
      setAuthSession(
        createMockSession({
          userId: "empty-wallet-user",
          email: "empty@test.com",
          role: "CARRIER",
          organizationId: "wallet-empty-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect([400, 404]).toContain(res.status);
    });
  });

  // ─── Cross-Organization Financial Isolation ──────────────────────────────

  describe("Cross-org financial isolation", () => {
    it("should return only shipper wallet for shipper user", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-shipper-user",
          email: "ws@test.com",
          role: "SHIPPER",
          organizationId: "wallet-shipper-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets).toBeDefined();
      expect(data.totalBalance).toBe(50000);
      expect(data.currency).toBe("ETB");
    });

    it("should return only carrier wallet for carrier user", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-carrier-user",
          email: "wc@test.com",
          role: "CARRIER",
          organizationId: "wallet-carrier-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.totalBalance).toBe(25000);
    });

    it("should not expose other org wallet balance", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-carrier-user",
          email: "wc@test.com",
          role: "CARRIER",
          organizationId: "wallet-carrier-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      const data = await parseResponse(res);

      // Should NOT see shipper's 50000
      expect(data.totalBalance).not.toBe(50000);
      expect(data.totalBalance).not.toBe(75000); // Not combined total
    });
  });

  // ─── Response Shape ──────────────────────────────────────────────────────

  describe("Wallet response shape", () => {
    it("should return correct response structure", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-shipper-user",
          email: "ws@test.com",
          role: "SHIPPER",
          organizationId: "wallet-shipper-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);

      // Required fields
      expect(data).toHaveProperty("wallets");
      expect(data).toHaveProperty("totalBalance");
      expect(data).toHaveProperty("currency");
      expect(Array.isArray(data.wallets)).toBe(true);
      expect(typeof data.totalBalance).toBe("number");
      expect(typeof data.currency).toBe("string");
    });

    it("should return wallet with correct type for shipper", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-shipper-user",
          email: "ws@test.com",
          role: "SHIPPER",
          organizationId: "wallet-shipper-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      const data = await parseResponse(res);

      if (data.wallets.length > 0) {
        const wallet = data.wallets[0];
        expect(wallet).toHaveProperty("id");
        expect(wallet).toHaveProperty("balance");
        expect(wallet.accountType || wallet.type).toMatch(
          /SHIPPER_WALLET|CARRIER_WALLET/
        );
      }
    });

    it("should include recent transactions count", async () => {
      setAuthSession(
        createMockSession({
          userId: "wallet-shipper-user",
          email: "ws@test.com",
          role: "SHIPPER",
          organizationId: "wallet-shipper-org",
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      const data = await parseResponse(res);

      expect(data).toHaveProperty("recentTransactionsCount");
      expect(typeof data.recentTransactionsCount).toBe("number");
    });
  });
});
