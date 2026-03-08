/**
 * Admin Withdrawal Approval/Rejection → Notification Tests — Round N4
 *
 * WD-1: APPROVED fires WITHDRAWAL_APPROVED to requesting user's org
 * WD-2: APPROVED includes amount + bank details in metadata
 * WD-3: REJECTED fires WITHDRAWAL_REJECTED with refunded amount
 * WD-4: REJECTED message includes rejection reason when provided
 * WD-5: REJECTED does NOT fire WITHDRAWAL_APPROVED
 * WD-6: APPROVED does NOT fire WITHDRAWAL_REJECTED
 * WD-7: already-processed withdrawal fires no notification
 * WD-8: notification fires even when rejectionReason is absent
 *
 * Gaps: G-W-N4-2 (APPROVED), G-W-N4-3 (REJECTED)
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
    const status =
      error?.statusCode === 400 ? 400 : error?.statusCode === 404 ? 404 : 500;
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status }
    );
  }),
}));

const {
  PATCH: updateWithdrawal,
} = require("@/app/api/admin/withdrawals/[id]/route");

function callPatch(id: string, body: object) {
  const req = createRequest(
    "PATCH",
    `http://localhost:3000/api/admin/withdrawals/${id}`,
    { body }
  );
  return callHandler(updateWithdrawal, req, { id });
}

describe("Admin Withdrawal Notifications (G-W-N4-2, G-W-N4-3)", () => {
  let notifyOrganization: jest.Mock;
  let shipperOrgId: string;
  let shipperUserId: string;
  let carrierOrgId: string;
  let carrierUserId: string;
  let walletId: string;
  let carrierWalletId: string;

  beforeAll(async () => {
    const notifications = require("@/lib/notifications");
    notifyOrganization = notifications.notifyOrganization;

    // Shipper org + user + wallet
    const shipperOrg = await db.organization.create({
      data: {
        id: "wd-shipper-org",
        name: "WD Shipper Org",
        type: "SHIPPER",
        contactEmail: "wd-shipper@test.com",
        contactPhone: "+251911800001",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    shipperOrgId = shipperOrg.id;

    const shipperUser = await db.user.create({
      data: {
        id: "wd-shipper-user",
        email: "wd-shipper@test.com",
        passwordHash: "hash",
        firstName: "WD",
        lastName: "Shipper",
        phone: "+251911800002",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: shipperOrg.id,
      },
    });
    shipperUserId = shipperUser.id;

    const shipperWallet = await db.financialAccount.create({
      data: {
        id: "wd-shipper-wallet",
        organizationId: shipperOrg.id,
        accountType: "SHIPPER_WALLET",
        balance: 20000,
        minimumBalance: 1000,
        currency: "ETB",
        isActive: true,
      },
    });
    walletId = shipperWallet.id;

    // Carrier org + user + wallet
    const carrierOrg = await db.organization.create({
      data: {
        id: "wd-carrier-org",
        name: "WD Carrier Org",
        type: "CARRIER",
        contactEmail: "wd-carrier@test.com",
        contactPhone: "+251911800010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    carrierOrgId = carrierOrg.id;

    const carrierUser = await db.user.create({
      data: {
        id: "wd-carrier-user",
        email: "wd-carrier@test.com",
        passwordHash: "hash",
        firstName: "WD",
        lastName: "Carrier",
        phone: "+251911800011",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrg.id,
      },
    });
    carrierUserId = carrierUser.id;

    const carrierWallet = await db.financialAccount.create({
      data: {
        id: "wd-carrier-wallet",
        organizationId: carrierOrg.id,
        accountType: "CARRIER_WALLET",
        balance: 15000,
        minimumBalance: 500,
        currency: "ETB",
        isActive: true,
      },
    });
    carrierWalletId = carrierWallet.id;

    // Admin
    await db.organization.create({
      data: {
        id: "wd-admin-org",
        name: "WD Admin Org",
        type: "SHIPPER",
        contactEmail: "wd-admin@test.com",
        contactPhone: "+251911800020",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "wd-admin-user",
        email: "wd-admin@test.com",
        passwordHash: "hash",
        firstName: "WD",
        lastName: "Admin",
        phone: "+251911800021",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "wd-admin-org",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(
      createMockSession({
        userId: "wd-admin-user",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "wd-admin-org",
      })
    );
  });

  // WD-1: APPROVED fires WITHDRAWAL_APPROVED to requesting user's org
  it("WD-1: APPROVED action → notifyOrganization called with WITHDRAWAL_APPROVED", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-1",
        requestedById: shipperUserId,
        amount: 3000,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "1000000001",
        accountHolder: "WD Shipper",
      },
    });

    const res = await callPatch("wd-req-1", { action: "APPROVED" });
    expect(res.status).toBe(200);

    expect(notifyOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: shipperOrgId,
        type: "WITHDRAWAL_APPROVED",
        title: "Withdrawal Approved",
      })
    );
  });

  // WD-2: APPROVED notification includes amount + bankName in metadata
  it("WD-2: APPROVED notification metadata contains amount and bankName", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-2",
        requestedById: shipperUserId,
        amount: 4500,
        status: "PENDING",
        bankName: "Dashen",
        bankAccount: "2000000002",
        accountHolder: "WD Shipper",
      },
    });

    const res = await callPatch("wd-req-2", { action: "APPROVED" });
    expect(res.status).toBe(200);

    const call = notifyOrganization.mock.calls.find(
      (c: any[]) => c[0].type === "WITHDRAWAL_APPROVED"
    );
    expect(call).toBeDefined();
    expect(call![0].metadata).toMatchObject({
      withdrawalRequestId: "wd-req-2",
      amount: 4500,
      bankName: "Dashen",
    });
  });

  // WD-3: REJECTED fires WITHDRAWAL_REJECTED with refunded amount
  it("WD-3: REJECTED action → notifyOrganization called with WITHDRAWAL_REJECTED", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-3",
        requestedById: shipperUserId,
        amount: 2000,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "3000000003",
        accountHolder: "WD Shipper",
      },
    });

    const res = await callPatch("wd-req-3", {
      action: "REJECTED",
      rejectionReason: "Incomplete documentation",
    });
    expect(res.status).toBe(200);

    expect(notifyOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: shipperOrgId,
        type: "WITHDRAWAL_REJECTED",
        title: "Withdrawal Request Rejected",
      })
    );
  });

  // WD-4: REJECTED message includes rejection reason
  it("WD-4: REJECTED notification message includes rejectionReason when provided", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-4",
        requestedById: shipperUserId,
        amount: 1500,
        status: "PENDING",
        bankName: "Awash",
        bankAccount: "4000000004",
        accountHolder: "WD Shipper",
      },
    });

    const res = await callPatch("wd-req-4", {
      action: "REJECTED",
      rejectionReason: "Fraud suspicion",
    });
    expect(res.status).toBe(200);

    const call = notifyOrganization.mock.calls.find(
      (c: any[]) => c[0].type === "WITHDRAWAL_REJECTED"
    );
    expect(call).toBeDefined();
    expect(call![0].message).toContain("Fraud suspicion");
    expect(call![0].metadata).toMatchObject({
      rejectionReason: "Fraud suspicion",
    });
  });

  // WD-5: REJECTED does NOT fire WITHDRAWAL_APPROVED
  it("WD-5: REJECTED action does NOT fire WITHDRAWAL_APPROVED", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-5",
        requestedById: shipperUserId,
        amount: 1000,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "5000000005",
        accountHolder: "WD Shipper",
      },
    });

    await callPatch("wd-req-5", { action: "REJECTED" });

    const approvedCalls = notifyOrganization.mock.calls.filter(
      (c: any[]) => c[0].type === "WITHDRAWAL_APPROVED"
    );
    expect(approvedCalls).toHaveLength(0);
  });

  // WD-6: APPROVED does NOT fire WITHDRAWAL_REJECTED
  it("WD-6: APPROVED action does NOT fire WITHDRAWAL_REJECTED", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-6",
        requestedById: carrierUserId,
        amount: 2500,
        status: "PENDING",
        bankName: "CBE",
        bankAccount: "6000000006",
        accountHolder: "WD Carrier",
      },
    });

    await callPatch("wd-req-6", { action: "APPROVED" });

    const rejectedCalls = notifyOrganization.mock.calls.filter(
      (c: any[]) => c[0].type === "WITHDRAWAL_REJECTED"
    );
    expect(rejectedCalls).toHaveLength(0);
  });

  // WD-7: Already-processed withdrawal returns 400 — no notification
  it("WD-7: already-APPROVED withdrawal → 400, no notification", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-7",
        requestedById: shipperUserId,
        amount: 1000,
        status: "APPROVED",
        bankName: "CBE",
        bankAccount: "7000000007",
        accountHolder: "WD Shipper",
      },
    });

    const res = await callPatch("wd-req-7", { action: "REJECTED" });
    expect(res.status).toBe(400);
    expect(notifyOrganization).not.toHaveBeenCalled();
  });

  // WD-8: REJECTED notification fires even when rejectionReason is absent
  it("WD-8: REJECTED without rejectionReason still fires WITHDRAWAL_REJECTED", async () => {
    await db.withdrawalRequest.create({
      data: {
        id: "wd-req-8",
        requestedById: shipperUserId,
        amount: 800,
        status: "PENDING",
        bankName: "Nib",
        bankAccount: "8000000008",
        accountHolder: "WD Shipper",
      },
    });

    const res = await callPatch("wd-req-8", { action: "REJECTED" });
    expect(res.status).toBe(200);

    const call = notifyOrganization.mock.calls.find(
      (c: any[]) => c[0].type === "WITHDRAWAL_REJECTED"
    );
    expect(call).toBeDefined();
    expect(call![0].message).not.toContain("Reason:");
  });
});
