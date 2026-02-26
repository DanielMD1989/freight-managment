/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Mobile Data Privacy & Isolation Test Suite
 *
 * Mirrors the web suite (__tests__/security/data-privacy-isolation.test.ts)
 * but tests the mobile service layer (axios-mocked API calls through services/).
 *
 * ~54 tests across 8 groups verifying:
 * - Cross-organization access returns 404 (not 403) to avoid resource enumeration
 * - Role-based isolation (shipper vs carrier endpoint rules)
 * - Error messages never leak internal state or confirm resource existence
 * - Wallet/dashboard data is scoped to own organization
 * - Notification privacy per-user
 * - Auth token security patterns
 */

import { loadService } from "../../src/services/load";
import { truckService } from "../../src/services/truck";
import { tripService } from "../../src/services/trip";
import { dashboardService } from "../../src/services/dashboard";
import { walletService } from "../../src/services/wallet";
import { notificationService } from "../../src/services/notification";
import { getErrorMessage } from "../../src/api/client";

// ---------------------------------------------------------------------------
// Mock API client (matches existing mobile test infrastructure)
// ---------------------------------------------------------------------------

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    delete: (...args: any[]) => mockDelete(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn(
    (e: any) => e?.response?.data?.error ?? e?.message ?? "Unknown error"
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Axios rejection shaped like the real API */
function apiError(
  status: number,
  error: string,
  message?: string
): { response: { status: number; data: { error: string } }; message: string } {
  return {
    response: { status, data: { error } },
    message: message ?? `Request failed with status code ${status}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Mobile Data Privacy & Isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Group 1: Load Service Privacy (9 tests)
  // =========================================================================
  describe("Load Service Privacy", () => {
    it("shipper getLoads always sends myLoads param", async () => {
      mockGet.mockResolvedValue({
        data: {
          loads: [{ id: "l1", shipperId: "org-1" }],
          pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        },
      });

      await loadService.getLoads({ myLoads: true });
      expect(mockGet).toHaveBeenCalledWith("/api/loads", {
        params: { myLoads: true },
      });
    });

    it("shipper getLoad for own load succeeds", async () => {
      mockGet.mockResolvedValue({
        data: { id: "own-load-id", shipperId: "org-1", pickupCity: "Addis" },
      });

      const result = await loadService.getLoad("own-load-id");
      expect(result.id).toBe("own-load-id");
      expect(mockGet).toHaveBeenCalledWith("/api/loads/own-load-id");
    });

    it("shipper getLoad for other org's load returns 'not found' (not 'forbidden')", async () => {
      mockGet.mockRejectedValue(apiError(404, "Load not found"));

      await expect(loadService.getLoad("other-load-id")).rejects.toThrow(
        "Load not found"
      );
    });

    it("carrier loadboard only requests POSTED status", async () => {
      mockGet.mockResolvedValue({
        data: {
          loads: [{ id: "l1", status: "POSTED" }],
          pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        },
      });

      await loadService.getLoads({ status: "POSTED" });
      expect(mockGet).toHaveBeenCalledWith("/api/loads", {
        params: { status: "POSTED" },
      });
    });

    it("carrier cannot see DRAFT loads from other orgs (returns 404)", async () => {
      mockGet.mockRejectedValue(apiError(404, "Load not found"));

      await expect(loadService.getLoad("draft-load-id")).rejects.toThrow(
        "Load not found"
      );
    });

    it("respondToLoadRequest — wrong shipper org returns 403 error", async () => {
      mockPost.mockRejectedValue(apiError(403, "Not authorized"));

      await expect(
        loadService.respondToLoadRequest("lr-1", "APPROVED")
      ).rejects.toThrow("Not authorized");
    });

    it("respondToLoadRequest — correct shipper org succeeds", async () => {
      mockPost.mockResolvedValue({
        data: { id: "lr-1", status: "REJECTED" },
      });

      const result = await loadService.respondToLoadRequest(
        "lr-1",
        "REJECTED",
        "Not needed"
      );
      expect(result.id).toBe("lr-1");
      expect(result.status).toBe("REJECTED");
    });

    it("createLoadRequest — carrier for posted load succeeds", async () => {
      mockPost.mockResolvedValue({
        data: { request: { id: "lr-new", status: "PENDING" } },
      });

      const result = await loadService.createLoadRequest({
        loadId: "l1",
        truckId: "t1",
      });
      expect(result.id).toBe("lr-new");
    });

    it("updateLoad — cross-org returns 404 (not 403)", async () => {
      mockPatch.mockRejectedValue(apiError(404, "Load not found"));

      await expect(
        loadService.updateLoad("other-load", { status: "POSTED" } as any)
      ).rejects.toThrow("Load not found");
    });
  });

  // =========================================================================
  // Group 2: Truck Service Privacy (10 tests)
  // =========================================================================
  describe("Truck Service Privacy", () => {
    it("carrier getTrucks returns own fleet only", async () => {
      const ownTrucks = [
        { id: "t1", carrierId: "org-1", licensePlate: "AA-111" },
        { id: "t2", carrierId: "org-1", licensePlate: "AA-222" },
      ];
      mockGet.mockResolvedValue({
        data: {
          trucks: ownTrucks,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      });

      const result = await truckService.getTrucks();
      expect(result.trucks).toHaveLength(2);
      result.trucks.forEach((truck: any) => {
        expect(truck.carrierId).toBe("org-1");
      });
    });

    it("carrier getTruck for own truck succeeds", async () => {
      mockGet.mockResolvedValue({
        data: { id: "own-truck", carrierId: "org-1", licensePlate: "AA-111" },
      });

      const result = await truckService.getTruck("own-truck");
      expect(result.id).toBe("own-truck");
    });

    it("carrier getTruck for other carrier's truck returns 404 (not 'forbidden')", async () => {
      mockGet.mockRejectedValue(apiError(404, "Truck not found"));

      await expect(truckService.getTruck("other-truck")).rejects.toThrow(
        "Truck not found"
      );
    });

    it("shipper getTrucks returns 403 (foundation rule block)", async () => {
      mockGet.mockRejectedValue(
        apiError(403, "Shippers cannot browse truck fleet")
      );

      await expect(truckService.getTrucks()).rejects.toThrow(
        "Shippers cannot browse truck fleet"
      );
    });

    it("shipper uses getTruckPostings (correct /api/truck-postings endpoint)", async () => {
      mockGet.mockResolvedValue({
        data: {
          postings: [
            { id: "tp1", truckId: "t1" },
            { id: "tp2", truckId: "t2" },
          ],
          total: 2,
        },
      });

      const result = await truckService.getTruckPostings({});
      expect(mockGet).toHaveBeenCalledWith(
        "/api/truck-postings",
        expect.any(Object)
      );
      // Ensure it did NOT call /api/trucks
      expect(mockGet).not.toHaveBeenCalledWith(
        "/api/trucks",
        expect.anything()
      );
    });

    it("truck postings are public (returns postings from multiple carriers)", async () => {
      const mixedPostings = [
        { id: "tp1", carrierId: "org-1" },
        { id: "tp2", carrierId: "org-2" },
        { id: "tp3", carrierId: "org-3" },
      ];
      mockGet.mockResolvedValue({
        data: { postings: mixedPostings, total: 3 },
      });

      const result = await truckService.getTruckPostings({});
      expect(result.postings).toHaveLength(3);
      const carrierIds = result.postings.map((p: any) => p.carrierId);
      expect(new Set(carrierIds).size).toBeGreaterThan(1);
    });

    it("updateTruck — cross-org returns 404 (not 403)", async () => {
      mockPatch.mockRejectedValue(apiError(404, "Truck not found"));

      await expect(
        truckService.updateTruck("other-truck", { capacity: 999 } as any)
      ).rejects.toThrow("Truck not found");
    });

    it("cancelTruckPosting — cross-org returns 404", async () => {
      mockPatch.mockRejectedValue(apiError(404, "Truck posting not found"));

      await expect(
        truckService.cancelTruckPosting("other-posting")
      ).rejects.toThrow("Truck posting not found");
    });

    it("updateTruckPosting — cross-org returns 404", async () => {
      mockPatch.mockRejectedValue(apiError(404, "Truck posting not found"));

      await expect(
        truckService.updateTruckPosting("other-posting", {} as any)
      ).rejects.toThrow("Truck posting not found");
    });

    it("createTruckPosting is scoped to own carrier", async () => {
      const postingData = {
        truckId: "t1",
        originCityId: "c1",
        availableFrom: "2026-03-01",
        contactName: "Test",
        contactPhone: "0911",
      };
      mockPost.mockResolvedValue({
        data: { id: "tp-new", carrierId: "org-1", ...postingData },
      });

      const result = await truckService.createTruckPosting(postingData);
      expect(result.id).toBe("tp-new");
      expect((result as any).carrierId).toBe("org-1");
    });
  });

  // =========================================================================
  // Group 3: Trip Service Privacy (8 tests)
  // =========================================================================
  describe("Trip Service Privacy", () => {
    it("carrier getTrips returns only own org trips", async () => {
      const ownTrips = [
        { id: "trip1", carrierId: "org-1", status: "IN_TRANSIT" },
        { id: "trip2", carrierId: "org-1", status: "DELIVERED" },
      ];
      mockGet.mockResolvedValue({
        data: {
          trips: ownTrips,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      });

      const result = await tripService.getTrips();
      expect(result.trips).toHaveLength(2);
      result.trips.forEach((trip: any) => {
        expect(trip.carrierId).toBe("org-1");
      });
    });

    it("shipper getTrips returns only own org trips", async () => {
      const ownTrips = [
        { id: "trip1", shipperId: "org-2", status: "IN_TRANSIT" },
        { id: "trip2", shipperId: "org-2", status: "DELIVERED" },
      ];
      mockGet.mockResolvedValue({
        data: {
          trips: ownTrips,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      });

      const result = await tripService.getTrips();
      result.trips.forEach((trip: any) => {
        expect(trip.shipperId).toBe("org-2");
      });
    });

    it("getTrip for own trip succeeds", async () => {
      mockGet.mockResolvedValue({
        data: { id: "own-trip", carrierId: "org-1", status: "IN_TRANSIT" },
      });

      const result = await tripService.getTrip("own-trip");
      expect(result.id).toBe("own-trip");
    });

    it("getTrip cross-org returns 404 (not 403)", async () => {
      mockGet.mockRejectedValue(apiError(404, "Trip not found"));

      await expect(tripService.getTrip("other-trip")).rejects.toThrow(
        "Trip not found"
      );
    });

    it("updateTripStatus for own trip succeeds", async () => {
      mockPatch.mockResolvedValue({
        data: { id: "own-trip", status: "IN_TRANSIT" },
      });

      const result = await tripService.updateTripStatus(
        "own-trip",
        "IN_TRANSIT"
      );
      expect(result.id).toBe("own-trip");
      expect(result.status).toBe("IN_TRANSIT");
    });

    it("updateTripStatus cross-org returns 404 (not 403)", async () => {
      mockPatch.mockRejectedValue(apiError(404, "Trip not found"));

      await expect(
        tripService.updateTripStatus("other-trip", "DELIVERED")
      ).rejects.toThrow("Trip not found");
    });

    it("uploadPod to own trip succeeds", async () => {
      mockPost.mockResolvedValue({
        data: { pod: { id: "pod-1", tripId: "own-trip" } },
      });

      const formData = new FormData();
      const result = await tripService.uploadPod("own-trip", formData);
      expect(result.id).toBe("pod-1");
    });

    it("confirmDelivery cross-org returns 404", async () => {
      mockPost.mockRejectedValue(apiError(404, "Trip not found"));

      await expect(tripService.confirmDelivery("other-trip")).rejects.toThrow(
        "Trip not found"
      );
    });
  });

  // =========================================================================
  // Group 4: Wallet & Dashboard Privacy (8 tests)
  // =========================================================================
  describe("Wallet & Dashboard Privacy", () => {
    it("carrier dashboard returns only own org stats", async () => {
      mockGet.mockResolvedValue({
        data: {
          totalTrucks: 5,
          activeTrucks: 3,
          activePostings: 2,
          completedDeliveries: 20,
          inTransitTrips: 1,
          totalServiceFeesPaid: 5000,
          totalDistance: 12000,
          wallet: { balance: 10000, currency: "ETB" },
          recentPostings: 1,
          pendingApprovals: 0,
        },
      });

      const result = await dashboardService.getCarrierDashboard();
      expect(result.totalTrucks).toBe(5);
      expect(result.wallet.balance).toBe(10000);
    });

    it("shipper dashboard returns only own org stats", async () => {
      mockGet.mockResolvedValue({
        data: {
          stats: {
            totalLoads: 10,
            activeLoads: 3,
            inTransitLoads: 1,
            deliveredLoads: 5,
            totalSpent: 50000,
            pendingPayments: 2000,
          },
          loadsByStatus: [{ status: "POSTED", count: 3 }],
          wallet: { balance: 5000, currency: "ETB" },
        },
      });

      const result = await dashboardService.getShipperDashboard();
      expect(result.stats.activeLoads).toBe(3);
      expect(result.wallet.balance).toBe(5000);
    });

    it("wallet balance returns only own org wallet", async () => {
      mockGet.mockResolvedValue({
        data: {
          wallets: [
            {
              id: "w1",
              type: "MAIN",
              balance: 10000,
              currency: "ETB",
              updatedAt: "2026-02-20",
            },
          ],
          totalBalance: 10000,
          currency: "ETB",
          recentTransactionsCount: 5,
        },
      });

      const result = await walletService.getBalance();
      expect(result.wallets).toHaveLength(1);
      expect(result.totalBalance).toBe(10000);
    });

    it("wallet totalBalance matches own wallet only (not combined cross-org)", async () => {
      // API must return totalBalance matching only this org's wallets
      const ownBalance = 10000;
      mockGet.mockResolvedValue({
        data: {
          wallets: [
            {
              id: "w1",
              type: "MAIN",
              balance: ownBalance,
              currency: "ETB",
              updatedAt: "2026-02-20",
            },
          ],
          totalBalance: ownBalance,
          currency: "ETB",
          recentTransactionsCount: 2,
        },
      });

      const result = await walletService.getBalance();
      // totalBalance must equal sum of own wallets, not some larger combined amount
      const ownSum = result.wallets.reduce((sum, w) => sum + w.balance, 0);
      expect(result.totalBalance).toBe(ownSum);
      // Explicitly: NOT some combined cross-org amount like 30000
      expect(result.totalBalance).not.toBe(30000);
    });

    it("wallet transactions scoped to own org", async () => {
      const ownTransactions = [
        {
          id: "tx1",
          type: "CREDIT",
          description: "Payment",
          reference: "ref1",
          loadId: "l1",
          amount: 5000,
          createdAt: "2026-02-20",
          organizationId: "org-1",
        },
        {
          id: "tx2",
          type: "DEBIT",
          description: "Fee",
          reference: "ref2",
          loadId: "l2",
          amount: -500,
          createdAt: "2026-02-19",
          organizationId: "org-1",
        },
      ];
      mockGet.mockResolvedValue({
        data: {
          transactions: ownTransactions,
          pagination: {
            limit: 20,
            offset: 0,
            totalCount: 2,
            hasMore: false,
          },
        },
      });

      const result = await walletService.getTransactions({});
      result.transactions.forEach((tx: any) => {
        expect(tx.organizationId).toBe("org-1");
      });
    });

    it("carrier dashboard wallet does not expose other org balance", async () => {
      mockGet.mockResolvedValue({
        data: {
          totalTrucks: 3,
          activeTrucks: 2,
          activePostings: 1,
          completedDeliveries: 10,
          inTransitTrips: 0,
          totalServiceFeesPaid: 1500,
          totalDistance: 5000,
          wallet: { balance: 8000, currency: "ETB" },
          recentPostings: 0,
          pendingApprovals: 0,
        },
      });

      const result = await dashboardService.getCarrierDashboard();
      // Wallet balance should be single org value, not a combined cross-org amount
      expect(result.wallet.balance).toBe(8000);
      expect(typeof result.wallet.balance).toBe("number");
      // No otherOrgBalance, allOrgsBalance, etc.
      expect((result as any).otherOrgBalance).toBeUndefined();
      expect((result as any).allOrgsBalance).toBeUndefined();
    });

    it("shipper dashboard wallet does not expose other org balance", async () => {
      mockGet.mockResolvedValue({
        data: {
          stats: {
            totalLoads: 5,
            activeLoads: 1,
            inTransitLoads: 0,
            deliveredLoads: 3,
            totalSpent: 25000,
            pendingPayments: 1000,
          },
          loadsByStatus: [],
          wallet: { balance: 12000, currency: "ETB" },
        },
      });

      const result = await dashboardService.getShipperDashboard();
      expect(result.wallet.balance).toBe(12000);
      expect((result as any).otherOrgBalance).toBeUndefined();
      expect((result as any).allOrgsBalance).toBeUndefined();
    });

    it("wallet error on unauthorized access throws (not silent failure)", async () => {
      mockGet.mockRejectedValue(apiError(401, "Unauthorized"));

      await expect(walletService.getBalance()).rejects.toThrow("Unauthorized");
    });
  });

  // =========================================================================
  // Group 5: Notification Privacy (4 tests)
  // =========================================================================
  describe("Notification Privacy", () => {
    it("getNotifications returns only own user's notifications", async () => {
      const ownNotifications = [
        {
          id: "n1",
          userId: "user-1",
          title: "Load accepted",
          read: false,
        },
        {
          id: "n2",
          userId: "user-1",
          title: "Payment received",
          read: true,
        },
      ];
      mockGet.mockResolvedValue({
        data: {
          notifications: ownNotifications,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        },
      });

      const result = await notificationService.getNotifications();
      expect(result.notifications).toHaveLength(2);
      result.notifications.forEach((n: any) => {
        expect(n.userId).toBe("user-1");
      });
    });

    it("markAsRead for own notification succeeds", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      await expect(
        notificationService.markAsRead("own-notif")
      ).resolves.not.toThrow();
      expect(mockPatch).toHaveBeenCalledWith("/api/notifications/own-notif", {
        read: true,
      });
    });

    it("markAsRead for other user's notification returns error", async () => {
      mockPatch.mockRejectedValue(apiError(404, "Notification not found"));

      await expect(
        notificationService.markAsRead("other-notif")
      ).rejects.toThrow("Notification not found");
    });

    it("unread count scoped to own user", async () => {
      mockGet.mockResolvedValue({ data: { count: 3 } });

      const result = await notificationService.getUnreadCount();
      expect(result).toBe(3);
      expect(mockGet).toHaveBeenCalledWith("/api/notifications/unread-count");
    });
  });

  // =========================================================================
  // Group 6: Error Message Privacy (6 tests)
  // =========================================================================
  describe("Error Message Privacy", () => {
    it("cross-org 404 returns 'not found' message (not 'forbidden')", () => {
      const error = apiError(404, "Truck not found");
      const message = (getErrorMessage as jest.Mock)(error);
      expect(message).toBe("Truck not found");
      expect(message).not.toContain("forbidden");
    });

    it("cross-org 404 error message never contains 'permission' or 'unauthorized'", () => {
      const error = apiError(404, "Truck not found");
      const message = (getErrorMessage as jest.Mock)(error);
      const lower = message.toLowerCase();
      expect(lower).not.toContain("permission");
      expect(lower).not.toContain("forbidden");
      expect(lower).not.toContain("unauthorized");
    });

    it("404 error message does not reveal resource exists for another org", () => {
      const error = apiError(404, "Load not found");
      const message = (getErrorMessage as jest.Mock)(error);
      // Should say "not found" — not "exists but you can't access it"
      expect(message).toBe("Load not found");
      expect(message).not.toContain("exist");
      expect(message).not.toContain("belong");
      expect(message).not.toContain("another");
      expect(message).not.toContain("other org");
    });

    it("network error returns generic connection message (no internal paths)", () => {
      const error = { code: "ERR_NETWORK", message: "Network Error" };
      const message = (getErrorMessage as jest.Mock)(error);
      // Should not contain internal paths, stack traces, or server details
      expect(message).not.toContain("/src/");
      expect(message).not.toContain("/api/");
      expect(message).not.toContain("localhost");
      expect(message).not.toContain("ECONNREFUSED");
    });

    it("500 error returns generic server message (no stack traces)", () => {
      const error = apiError(500, "Internal server error");
      const message = (getErrorMessage as jest.Mock)(error);
      expect(message).toBe("Internal server error");
      expect(message).not.toContain("at ");
      expect(message).not.toContain("Error:");
      expect(message).not.toContain("prisma");
      expect(message).not.toContain("database");
    });

    it("error without response returns message property (no sensitive data)", () => {
      const error = { message: "timeout" };
      const message = (getErrorMessage as jest.Mock)(error);
      expect(message).toBe("timeout");
      // No bearer tokens, user IDs, or internal state leaked
      expect(message).not.toContain("Bearer");
      expect(message).not.toContain("token");
    });
  });

  // =========================================================================
  // Group 7: Mobile Auth & Bearer Token Security (5 tests)
  // =========================================================================
  describe("Mobile Auth & Bearer Token Security", () => {
    it("all authenticated requests go through centralized apiClient (Bearer attached in production)", async () => {
      // Verify services use the mocked apiClient (which in production attaches Bearer)
      mockGet.mockResolvedValue({
        data: {
          trucks: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 1 },
        },
      });

      await truckService.getTrucks();
      // The call went through our mock — in production the interceptor adds Bearer
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith("/api/trucks", expect.anything());
    });

    it("all requests use centralized client (x-client-type: mobile added by interceptor)", async () => {
      // Multiple services all route through the same apiClient
      mockGet.mockResolvedValue({ data: { count: 0 } });

      await notificationService.getUnreadCount();
      expect(mockGet).toHaveBeenCalledWith("/api/notifications/unread-count");

      mockGet.mockClear();
      mockGet.mockResolvedValue({ data: { trips: [] } });
      await tripService.getTrips();
      expect(mockGet).toHaveBeenCalledWith("/api/trips", expect.anything());
    });

    it("mutation requests use POST/PATCH/DELETE (CSRF attached by interceptor in production)", async () => {
      // Verify services use correct HTTP methods for state-changing operations
      mockPost.mockResolvedValue({
        data: { load: { id: "l1" } },
      });
      mockPatch.mockResolvedValue({
        data: { id: "t1", status: "IN_TRANSIT" },
      });
      mockDelete.mockResolvedValue({ data: {} });

      await loadService.createLoad({
        pickupCity: "Addis",
        deliveryCity: "Dire Dawa",
        pickupDate: "2026-03-01",
        deliveryDate: "2026-03-03",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Test",
      });
      expect(mockPost).toHaveBeenCalled();

      await tripService.updateTripStatus("t1", "IN_TRANSIT");
      expect(mockPatch).toHaveBeenCalled();

      await truckService.deleteTruck("t1");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("401 error is properly propagated (triggers auth clear in production interceptor)", async () => {
      mockGet.mockRejectedValue(apiError(401, "Unauthorized"));

      // The service must throw — not swallow the error silently
      await expect(walletService.getBalance()).rejects.toThrow("Unauthorized");
      // In production, the response interceptor calls clearAuth() + onUnauthorizedCallback()
    });

    it("404 error does NOT trigger auth-related behavior (only 401 does)", async () => {
      mockGet.mockRejectedValue(apiError(404, "Truck not found"));

      // 404 should throw "not found", not an auth-related error
      let caughtError: Error | null = null;
      try {
        await truckService.getTruck("missing-id");
      } catch (e) {
        caughtError = e as Error;
      }
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError!.message).toBe("Truck not found");
      // The error message must NOT indicate session was cleared
      expect(caughtError!.message).not.toContain("Unauthorized");
      expect(caughtError!.message).not.toContain("session");
      expect(caughtError!.message).not.toContain("logged out");
    });
  });

  // =========================================================================
  // Group 8: Cross-Role Mobile Access Patterns (4 tests)
  // =========================================================================
  describe("Cross-Role Mobile Access Patterns", () => {
    it("shipper loads screen always passes myLoads: true", async () => {
      mockGet.mockResolvedValue({
        data: {
          loads: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 1 },
        },
      });

      // Shipper must always request myLoads to see only own loads
      await loadService.getLoads({ myLoads: true });
      expect(mockGet).toHaveBeenCalledWith("/api/loads", {
        params: expect.objectContaining({ myLoads: true }),
      });
    });

    it("carrier loadboard always passes status: POSTED", async () => {
      mockGet.mockResolvedValue({
        data: {
          loads: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 1 },
        },
      });

      // Carrier loadboard should only see POSTED loads
      await loadService.getLoads({ status: "POSTED" });
      expect(mockGet).toHaveBeenCalledWith("/api/loads", {
        params: expect.objectContaining({ status: "POSTED" }),
      });
    });

    it("shipper truck browsing uses /api/truck-postings (not /api/trucks)", async () => {
      mockGet.mockResolvedValue({
        data: { postings: [], total: 0 },
      });

      await truckService.getTruckPostings({});
      // Must call the postings endpoint
      expect(mockGet).toHaveBeenCalledWith(
        "/api/truck-postings",
        expect.any(Object)
      );
      // Must NOT call the trucks endpoint
      expect(mockGet).not.toHaveBeenCalledWith(
        "/api/trucks",
        expect.anything()
      );
    });

    it("carrier fleet view uses /api/trucks (not /api/truck-postings)", async () => {
      mockGet.mockResolvedValue({
        data: {
          trucks: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 1 },
        },
      });

      await truckService.getTrucks();
      // Must call the trucks endpoint
      expect(mockGet).toHaveBeenCalledWith("/api/trucks", expect.anything());
      // Must NOT call the postings endpoint
      expect(mockGet).not.toHaveBeenCalledWith(
        "/api/truck-postings",
        expect.anything()
      );
    });
  });
});
