/**
 * Admin Wallet Topup → WALLET_TOPUP_CONFIRMED Notification Tests — Round N4
 *
 * WT-1: topup fires WALLET_TOPUP_CONFIRMED to org
 * WT-2: correct metadata (amount/balance/depositId/paymentMethod)
 * WT-3: non-admin cannot call topup (no notification)
 * WT-4: notification not fired on failed topup (invalid amount)
 * WT-5: notifyOrganization called exactly once per successful topup
 *
 * Gap: G-W-N4-1
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createMockSession,
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
  mockLogger,
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
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }),
}));

const {
  POST: walletTopup,
} = require("@/app/api/admin/users/[id]/wallet/topup/route");

function callTopup(userId: string, body: object) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/admin/users/${userId}/wallet/topup`,
    { body }
  );
  return callHandler(walletTopup, req, { id: userId });
}

describe("Admin Wallet Topup → WALLET_TOPUP_CONFIRMED Notification (G-W-N4-1)", () => {
  let notifyOrganization: jest.Mock;
  let shipperOrgId: string;
  let shipperUserId: string;
  let walletId: string;

  beforeAll(async () => {
    const notifications = require("@/lib/notifications");
    notifyOrganization = notifications.notifyOrganization;

    // Seed shipper org, user, wallet
    const org = await db.organization.create({
      data: {
        id: "wt-shipper-org",
        name: "WT Shipper Org",
        type: "SHIPPER",
        contactEmail: "wt-shipper@test.com",
        contactPhone: "+251911700001",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    shipperOrgId = org.id;

    const user = await db.user.create({
      data: {
        id: "wt-shipper-user",
        email: "wt-shipper@test.com",
        passwordHash: "hash",
        firstName: "WT",
        lastName: "Shipper",
        phone: "+251911700002",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    shipperUserId = user.id;

    const wallet = await db.financialAccount.create({
      data: {
        id: "wt-shipper-wallet",
        organizationId: org.id,
        accountType: "SHIPPER_WALLET",
        balance: 5000,
        minimumBalance: 1000,
        currency: "ETB",
        isActive: true,
      },
    });
    walletId = wallet.id;

    // Admin user
    await db.organization.create({
      data: {
        id: "wt-admin-org",
        name: "WT Admin Org",
        type: "SHIPPER",
        contactEmail: "wt-admin@test.com",
        contactPhone: "+251911700010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "wt-admin-user",
        email: "wt-admin@test.com",
        passwordHash: "hash",
        firstName: "WT",
        lastName: "Admin",
        phone: "+251911700011",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "wt-admin-org",
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

  function useAdminSession() {
    setAuthSession(
      createMockSession({
        userId: "wt-admin-user",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "wt-admin-org",
      })
    );
  }

  // WT-1: Successful topup fires WALLET_TOPUP_CONFIRMED to org
  it("WT-1: admin topup → notifyOrganization called with type=WALLET_TOPUP_CONFIRMED", async () => {
    useAdminSession();

    const res = await callTopup(shipperUserId, {
      amount: 2000,
      paymentMethod: "BANK_TRANSFER_SLIP",
    });
    expect(res.status).toBe(200);

    expect(notifyOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: shipperOrgId,
        type: "WALLET_TOPUP_CONFIRMED",
        title: "Wallet Topped Up",
      })
    );
  });

  // WT-2: Correct metadata in notification
  it("WT-2: topup notification includes amount, newBalance, paymentMethod", async () => {
    useAdminSession();

    const res = await callTopup(shipperUserId, {
      amount: 1500,
      paymentMethod: "TELEBIRR",
    });
    expect(res.status).toBe(200);

    const call = notifyOrganization.mock.calls.find(
      (c: any[]) => c[0].type === "WALLET_TOPUP_CONFIRMED"
    );
    expect(call).toBeDefined();
    expect(call![0].metadata).toMatchObject({
      amount: 1500,
      paymentMethod: "TELEBIRR",
    });
    expect(call![0].metadata).toHaveProperty("newBalance");
    expect(call![0].metadata).toHaveProperty("depositId");
  });

  // WT-3: Non-admin cannot call topup — notifyOrganization NOT called
  it("WT-3: non-admin (SHIPPER) gets 403 — notifyOrganization NOT called", async () => {
    setAuthSession(
      createMockSession({
        userId: shipperUserId,
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: shipperOrgId,
      })
    );

    const res = await callTopup(shipperUserId, { amount: 500 });
    expect(res.status).toBe(403);
    expect(notifyOrganization).not.toHaveBeenCalled();
  });

  // WT-4: Invalid amount (zero) causes parse failure — notifyOrganization NOT called
  it("WT-4: invalid amount (0) causes validation error — notifyOrganization NOT called", async () => {
    useAdminSession();

    const res = await callTopup(shipperUserId, { amount: 0 });
    // Zod validation error or 500
    expect([400, 500].includes(res.status)).toBe(true);
    expect(notifyOrganization).not.toHaveBeenCalled();
  });

  // WT-5: notifyOrganization called exactly once per successful topup
  it("WT-5: notifyOrganization called exactly once per topup", async () => {
    useAdminSession();

    const res = await callTopup(shipperUserId, { amount: 750 });
    expect(res.status).toBe(200);

    const walletTopupCalls = notifyOrganization.mock.calls.filter(
      (c: any[]) => c[0].type === "WALLET_TOPUP_CONFIRMED"
    );
    expect(walletTopupCalls).toHaveLength(1);
  });
});
