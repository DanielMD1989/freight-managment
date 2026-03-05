/**
 * Admin Withdrawals — Rejection Refund & Balance Guard Tests
 *
 * Tests for RC-1 (rejection returns funds) and RC-2 (insufficient balance guard)
 * in PATCH /api/admin/withdrawals/[id]
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
  useShipperSession,
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

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const status =
      error?.statusCode === 400
        ? 400
        : error?.statusCode === 404
          ? 404
          : error.name === "ForbiddenError"
            ? 403
            : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

// Import route handler AFTER mocks
const {
  PATCH: updateWithdrawal,
} = require("@/app/api/admin/withdrawals/[id]/route");

describe("Admin Withdrawals — Rejection Refund & Balance Guard", () => {
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

  // WRR-1: Rejection returns funds to shipper wallet
  it("WRR-1: Admin rejects PENDING withdrawal — shipper wallet balance restored", async () => {
    useAdminSession();

    // Seed fresh withdrawal with correct requestedById
    await db.withdrawalRequest.create({
      data: {
        id: "wrr-1",
        requestedById: seed.shipperUser.id,
        amount: 1000,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "1234567890",
        accountHolder: "Test Shipper",
      },
    });

    const walletBefore = await db.financialAccount.findUnique({
      where: { id: seed.shipperWallet.id },
    });
    const balanceBefore = Number(walletBefore!.balance);

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-1",
      {
        body: {
          action: "REJECTED",
          rejectionReason: "Documentation incomplete",
        },
      }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-1" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.withdrawalRequest.status).toBe("REJECTED");

    const walletAfter = await db.financialAccount.findUnique({
      where: { id: seed.shipperWallet.id },
    });
    expect(Number(walletAfter!.balance)).toBe(balanceBefore + 1000);
  });

  // WRR-2: Rejection creates REFUND journal entry
  it("WRR-2: Admin rejects PENDING withdrawal — REFUND journal entry created", async () => {
    useAdminSession();

    await db.withdrawalRequest.create({
      data: {
        id: "wrr-2",
        requestedById: seed.shipperUser.id,
        amount: 500,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "9999999999",
        accountHolder: "Test Shipper",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-2",
      { body: { action: "REJECTED", rejectionReason: "Fraud suspicion" } }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-2" });
    expect(res.status).toBe(200);

    // Journal entry with reference WITHDRAW-REJ-wrr-2 must exist
    const entries = await db.journalEntry.findMany({
      where: { reference: "WITHDRAW-REJ-wrr-2" },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].transactionType).toBe("REFUND");
  });

  // WRR-3: Approval decrements wallet balance (regression)
  it("WRR-3: Admin approves PENDING withdrawal — carrier wallet balance decremented", async () => {
    useAdminSession();

    await db.withdrawalRequest.create({
      data: {
        id: "wrr-3",
        requestedById: seed.carrierUser.id,
        amount: 200,
        status: "PENDING",
        bankName: "Dashen",
        bankAccount: "1111111111",
        accountHolder: "Test Carrier",
      },
    });

    const walletBefore = await db.financialAccount.findUnique({
      where: { id: seed.carrierWallet.id },
    });
    const balanceBefore = Number(walletBefore!.balance);

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-3",
      { body: { action: "APPROVED" } }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-3" });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.withdrawalRequest.status).toBe("APPROVED");

    const walletAfter = await db.financialAccount.findUnique({
      where: { id: seed.carrierWallet.id },
    });
    expect(Number(walletAfter!.balance)).toBe(balanceBefore - 200);
  });

  // WRR-4: Approval with insufficient balance → 400
  it("WRR-4: Admin approves withdrawal with insufficient balance → 400", async () => {
    useAdminSession();

    // Create a separate org + user + wallet with a small balance
    await db.organization.create({
      data: {
        id: "org-low-balance",
        name: "Low Balance Org",
        type: "SHIPPER",
        contactEmail: "low@test.com",
        contactPhone: "+251911999999",
      },
    });
    await db.user.create({
      data: {
        id: "user-low-balance",
        email: "low@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Low",
        lastName: "Balance",
        phone: "+251911999999",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "org-low-balance",
      },
    });
    await db.financialAccount.create({
      data: {
        id: "wallet-low-balance",
        organizationId: "org-low-balance",
        accountType: "SHIPPER_WALLET",
        balance: 100,
        currency: "ETB",
        isActive: true,
      },
    });
    await db.withdrawalRequest.create({
      data: {
        id: "wrr-4",
        requestedById: "user-low-balance",
        amount: 5000,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "2222222222",
        accountHolder: "Low Balance User",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-4",
      { body: { action: "APPROVED" } }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-4" });
    expect(res.status).toBe(400);
  });

  // WRR-5: Cannot approve already-APPROVED withdrawal → 400
  it("WRR-5: Admin tries to approve already-APPROVED withdrawal → 400", async () => {
    useAdminSession();
    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/withdrawal-approved-1",
      { body: { action: "APPROVED" } }
    );
    const res = await callHandler(updateWithdrawal, req, {
      id: "withdrawal-approved-1",
    });
    expect(res.status).toBe(400);
  });

  // WRR-6: SHIPPER cannot reject withdrawal → 403
  it("WRR-6: SHIPPER rejects withdrawal → 403", async () => {
    useShipperSession();
    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-1",
      { body: { action: "REJECTED", rejectionReason: "test" } }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-1" });
    expect(res.status).toBe(403);
  });

  // WRR-7: Unauthenticated → 500
  it("WRR-7: Unauthenticated reject → 500", async () => {
    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-1",
      { body: { action: "REJECTED", rejectionReason: "test" } }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-1" });
    expect(res.status).toBe(500);
  });

  // WRR-8: CARRIER withdrawal rejection restores carrier wallet
  it("WRR-8: CARRIER withdrawal rejection — carrier wallet credited back", async () => {
    useAdminSession();

    await db.withdrawalRequest.create({
      data: {
        id: "wrr-8",
        requestedById: seed.carrierUser.id,
        amount: 300,
        status: "PENDING",
        bankName: "Dashen",
        bankAccount: "3333333333",
        accountHolder: "Test Carrier",
      },
    });

    const walletBefore = await db.financialAccount.findUnique({
      where: { id: seed.carrierWallet.id },
    });
    const balanceBefore = Number(walletBefore!.balance);

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/admin/withdrawals/wrr-8",
      { body: { action: "REJECTED", rejectionReason: "Invalid bank details" } }
    );
    const res = await callHandler(updateWithdrawal, req, { id: "wrr-8" });
    expect(res.status).toBe(200);

    const walletAfter = await db.financialAccount.findUnique({
      where: { id: seed.carrierWallet.id },
    });
    expect(Number(walletAfter!.balance)).toBe(balanceBefore + 300);
  });
});
