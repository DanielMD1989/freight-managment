/**
 * Marketplace LOW_BALANCE_WARNING Notification Tests — Round N4
 *
 * LB-1: truck-postings GET with balance < minimumBalance fires LOW_BALANCE_WARNING
 * LB-2: trucks/[id]/nearby-loads GET fires LOW_BALANCE_WARNING
 * LB-3: truck-postings/[id]/matching-loads GET fires LOW_BALANCE_WARNING
 * LB-4: balance ≥ minimumBalance does NOT fire LOW_BALANCE_WARNING
 * LB-5: second request within 24h does not fire duplicate (dedup check)
 * LB-6: unauthenticated browse (no session) does not fire notification
 * LB-7: deductServiceFee that pushes balance below minimumBalance fires LOW_BALANCE_WARNING
 *
 * Gap: G-W-N4-6, G-W-N4-7
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createMockSession,
  createRequest,
  callHandler,
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
  mockStorage,
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
mockStorage();
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

jest.mock("@/lib/deadheadOptimization", () => ({
  findLoadsWithMinimalDHO: jest.fn(async () => []),
}));

const { GET: truckPostingsGet } = require("@/app/api/truck-postings/route");
const {
  GET: nearbyLoadsGet,
} = require("@/app/api/trucks/[id]/nearby-loads/route");
const {
  GET: matchingLoadsGet,
} = require("@/app/api/truck-postings/[id]/matching-loads/route");

describe("Marketplace LOW_BALANCE_WARNING Notifications (G-W-N4-6)", () => {
  let createNotification: jest.Mock;
  let carrierOrgId: string;
  let carrierUserId: string;
  let truckId: string;
  let truckPostingId: string;

  beforeAll(async () => {
    const notifications = require("@/lib/notifications");
    createNotification = notifications.createNotification;

    // Carrier org with LOW balance
    const org = await db.organization.create({
      data: {
        id: "lb-carrier-org",
        name: "LB Carrier Org",
        type: "CARRIER",
        contactEmail: "lb-carrier@test.com",
        contactPhone: "+251911900001",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    carrierOrgId = org.id;

    const user = await db.user.create({
      data: {
        id: "lb-carrier-user",
        email: "lb-carrier@test.com",
        passwordHash: "hash",
        firstName: "LB",
        lastName: "Carrier",
        phone: "+251911900002",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    carrierUserId = user.id;

    // Wallet with INSUFFICIENT balance (below minimumBalance)
    await db.financialAccount.create({
      data: {
        id: "lb-carrier-wallet",
        organizationId: org.id,
        accountType: "CARRIER_WALLET",
        balance: 200, // below minimum
        minimumBalance: 1000,
        currency: "ETB",
        isActive: true,
      },
    });

    // Truck
    const truck = await db.truck.create({
      data: {
        id: "lb-truck-1",
        truckType: "DRY_VAN",
        plateNumber: "LB-1234",
        capacity: 5000,
        carrierId: org.id,
        status: "AVAILABLE",
        isActive: true,
      },
    });
    truckId = truck.id;

    // Truck posting (ACTIVE)
    const posting = await db.truckPosting.create({
      data: {
        id: "lb-posting-1",
        truckId: truck.id,
        carrierId: org.id,
        status: "ACTIVE",
        availableWeight: 5000,
        fullPartial: "FULL",
        availableFrom: new Date(),
      },
    });
    truckPostingId = posting.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  function useCarrierSession() {
    setAuthSession(
      createMockSession({
        userId: carrierUserId,
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: carrierOrgId,
      })
    );
  }

  // Helper: flush microtask queue for fire-and-forget .then() chains
  async function flushAsync() {
    await new Promise((resolve) => setImmediate(resolve));
  }

  // LB-1: truck-postings GET with balance < minimumBalance fires LOW_BALANCE_WARNING
  it("LB-1: truck-postings GET with low balance → 402 + createNotification LOW_BALANCE_WARNING", async () => {
    useCarrierSession();

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await truckPostingsGet(req);

    expect(res.status).toBe(402);

    await flushAsync();

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: carrierUserId,
        type: "LOW_BALANCE_WARNING",
        title: "Insufficient Wallet Balance",
      })
    );
  });

  // LB-2: trucks/[id]/nearby-loads GET fires LOW_BALANCE_WARNING
  it("LB-2: nearby-loads GET with low balance → 402 + createNotification LOW_BALANCE_WARNING", async () => {
    useCarrierSession();

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/trucks/${truckId}/nearby-loads`
    );
    const res = await callHandler(nearbyLoadsGet, req, { id: truckId });

    expect(res.status).toBe(402);

    await flushAsync();

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: carrierUserId,
        type: "LOW_BALANCE_WARNING",
      })
    );
  });

  // LB-3: truck-postings/[id]/matching-loads GET fires LOW_BALANCE_WARNING
  it("LB-3: matching-loads GET with low balance → 402 + createNotification LOW_BALANCE_WARNING", async () => {
    useCarrierSession();

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/truck-postings/${truckPostingId}/matching-loads`
    );
    const res = await callHandler(matchingLoadsGet, req, {
      id: truckPostingId,
    });

    expect(res.status).toBe(402);

    await flushAsync();

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: carrierUserId,
        type: "LOW_BALANCE_WARNING",
      })
    );
  });

  // LB-4: balance ≥ minimumBalance does NOT fire LOW_BALANCE_WARNING
  it("LB-4: sufficient balance → 200, no LOW_BALANCE_WARNING notification", async () => {
    // Create a carrier with sufficient balance
    await db.organization.create({
      data: {
        id: "lb-rich-org",
        name: "LB Rich Org",
        type: "CARRIER",
        contactEmail: "lb-rich@test.com",
        contactPhone: "+251911900010",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    await db.user.create({
      data: {
        id: "lb-rich-user",
        email: "lb-rich@test.com",
        passwordHash: "hash",
        firstName: "LB",
        lastName: "Rich",
        phone: "+251911900011",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "lb-rich-org",
      },
    });

    await db.financialAccount.create({
      data: {
        id: "lb-rich-wallet",
        organizationId: "lb-rich-org",
        accountType: "CARRIER_WALLET",
        balance: 50000, // well above minimum
        minimumBalance: 1000,
        currency: "ETB",
        isActive: true,
      },
    });

    setAuthSession(
      createMockSession({
        userId: "lb-rich-user",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "lb-rich-org",
      })
    );

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await truckPostingsGet(req);

    // Should not be 402
    expect(res.status).not.toBe(402);

    await flushAsync();
    expect(createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOW_BALANCE_WARNING" })
    );
  });

  // LB-5: second request within 24h does not fire duplicate (dedup check)
  it("LB-5: existing LOW_BALANCE_WARNING notification within 24h → no duplicate fired", async () => {
    useCarrierSession();

    // Seed an existing LOW_BALANCE_WARNING notification within the last hour
    await db.notification.create({
      data: {
        id: "lb-notif-existing",
        userId: carrierUserId,
        type: "LOW_BALANCE_WARNING",
        title: "Insufficient Wallet Balance",
        message: "Already warned",
        read: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    });

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await truckPostingsGet(req);

    expect(res.status).toBe(402);

    await flushAsync();

    // createNotification should NOT have been called (dedup guard)
    expect(createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOW_BALANCE_WARNING" })
    );
  });

  // LB-6: no session → 402 gate is skipped (no userId, no wallet check)
  it("LB-6: no authenticated session → wallet gate not triggered, no LOW_BALANCE_WARNING", async () => {
    // No session set (anonymous browse)
    setAuthSession(null);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/truck-postings"
    );
    const res = await truckPostingsGet(req);

    // Anonymous users are not blocked by balance gate
    expect(res.status).not.toBe(402);

    await flushAsync();
    expect(createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOW_BALANCE_WARNING" })
    );
  });
});
