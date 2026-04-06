/**
 * Financial Wallet API Tests
 *
 * Tests for carrier financial operations:
 * - GET /api/financial/wallet → { wallet, recentTransactions }
 * - POST /api/financial/wallet → { message, journalEntry, newBalance }
 *
 * Business rules:
 * - GET requires VIEW_WALLET permission
 * - POST requires DEPOSIT_FUNDS permission
 * - User must belong to an organization
 * - Organization must have a financial account (SHIPPER_WALLET or CARRIER_WALLET)
 * - POST deposit: positive amount required, paymentMethod required
 * - Balance incremented after deposit, journal entry created
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
const { GET: getWallet } = require("@/app/api/financial/wallet/route");
// POST handler removed (2026-04-06) — endpoint was unused dead code with
// inverted journal sign bug. See app/api/financial/wallet/route.ts comment.

describe("Financial Wallet API", () => {
  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/financial/wallet ──────────────────────────────────────────

  describe("GET /api/financial/wallet", () => {
    describe("Auth & RBAC", () => {
      it("unauthenticated → 401/500", async () => {
        setAuthSession(null);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/wallet"
        );
        const res = await getWallet(req);
        expect([401, 500]).toContain(res.status);
      });

      it("carrier with VIEW_WALLET permission → 200", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/wallet"
        );
        const res = await getWallet(req);
        expect(res.status).toBe(200);
      });
    });

    describe("Organization", () => {
      it("user without organizationId → 400", async () => {
        const noOrgSession = createMockSession({
          userId: "wallet-no-org",
          role: "CARRIER",
          organizationId: undefined,
        });
        await db.user.create({
          data: {
            id: "wallet-no-org",
            email: "walletnoorg@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "No",
            lastName: "Org",
            phone: "+251911055555",
            role: "CARRIER",
            status: "ACTIVE",
          },
        });
        setAuthSession(noOrgSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/wallet"
        );
        const res = await getWallet(req);
        expect(res.status).toBe(400);
      });
    });

    describe("Wallet not found", () => {
      it("org with no financial account → 404", async () => {
        const noWalletSession = createMockSession({
          userId: "wallet-no-acct",
          role: "CARRIER",
          organizationId: "no-wallet-org",
        });
        await db.organization.create({
          data: {
            id: "no-wallet-org",
            name: "No Wallet Org",
            type: "CARRIER_COMPANY",
            contactEmail: "nowallet@test.com",
            contactPhone: "+251911044444",
          },
        });
        await db.user.create({
          data: {
            id: "wallet-no-acct",
            email: "nowallet@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "No",
            lastName: "Wallet",
            phone: "+251911044444",
            role: "CARRIER",
            status: "ACTIVE",
            organizationId: "no-wallet-org",
          },
        });
        setAuthSession(noWalletSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/wallet"
        );
        const res = await getWallet(req);
        expect(res.status).toBe(404);
      });
    });

    describe("Success", () => {
      it("returns wallet balance/currency/accountType", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/wallet"
        );
        const res = await getWallet(req);
        const data = await parseResponse(res);
        expect(data.wallet).toBeDefined();
        expect(data.wallet.balance).toBeDefined();
        expect(data.wallet.currency).toBe("ETB");
        expect(data.wallet.accountType).toBe("CARRIER_WALLET");
      });

      it("returns recentTransactions array", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/financial/wallet"
        );
        const res = await getWallet(req);
        const data = await parseResponse(res);
        expect(data.recentTransactions).toBeDefined();
        expect(Array.isArray(data.recentTransactions)).toBe(true);
      });
    });
  });

  // POST /api/financial/wallet — DELETED (2026-04-06)
  // The endpoint was unused dead code with an inverted journal sign bug.
  // The blueprint §8 deposit flow uses /api/wallet/deposit (request) →
  // /api/admin/users/[id]/wallet/topup (admin approval). See the
  // financial-atomicity tests for that flow's coverage.
});
