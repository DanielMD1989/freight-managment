/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for dashboard service — locks in 3-layer bug fix:
 *   Bug #1: URL correctness (was /api/dashboard, now role-specific)
 *   Bug #2: Field mapping (carrier flat, shipper nested)
 *   Bug #3: Error propagation (throw, never silently fail)
 */
import { dashboardService } from "../../src/services/dashboard";
import type {
  CarrierDashboardStats,
  ShipperDashboardStats,
} from "../../src/types";

const mockGet = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn(
    (e: any) => e?.response?.data?.error ?? e?.message ?? "Unknown error"
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures matching real API response shapes
// ---------------------------------------------------------------------------

const fullCarrierResponse: CarrierDashboardStats = {
  totalTrucks: 12,
  activeTrucks: 8,
  activePostings: 5,
  completedDeliveries: 143,
  inTransitTrips: 3,
  totalServiceFeesPaid: 28500.75,
  totalDistance: 94320,
  wallet: { balance: 15200.5, currency: "ETB" },
  recentPostings: 2,
  pendingApprovals: 1,
};

const zeroCarrierResponse: CarrierDashboardStats = {
  totalTrucks: 0,
  activeTrucks: 0,
  activePostings: 0,
  completedDeliveries: 0,
  inTransitTrips: 0,
  totalServiceFeesPaid: 0,
  totalDistance: 0,
  wallet: { balance: 0, currency: "ETB" },
  recentPostings: 0,
  pendingApprovals: 0,
};

const fullShipperResponse: ShipperDashboardStats = {
  stats: {
    totalLoads: 45,
    activeLoads: 7,
    inTransitLoads: 3,
    deliveredLoads: 32,
    totalSpent: 125000.25,
    pendingPayments: 8500,
  },
  loadsByStatus: [
    { status: "POSTED", count: 4 },
    { status: "IN_TRANSIT", count: 3 },
    { status: "DELIVERED", count: 32 },
    { status: "CANCELLED", count: 6 },
  ],
  wallet: { balance: 42000, currency: "ETB" },
};

const zeroShipperResponse: ShipperDashboardStats = {
  stats: {
    totalLoads: 0,
    activeLoads: 0,
    inTransitLoads: 0,
    deliveredLoads: 0,
    totalSpent: 0,
    pendingPayments: 0,
  },
  loadsByStatus: [],
  wallet: { balance: 0, currency: "ETB" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dashboard Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // getCarrierDashboard — 11 tests
  // =========================================================================
  describe("getCarrierDashboard", () => {
    // --- URL correctness (Bug #1) ---
    it("should call GET /api/carrier/dashboard", async () => {
      mockGet.mockResolvedValue({ data: fullCarrierResponse });

      await dashboardService.getCarrierDashboard();
      expect(mockGet).toHaveBeenCalledWith("/api/carrier/dashboard");
    });

    it("should NOT call /api/dashboard (old buggy URL)", async () => {
      mockGet.mockResolvedValue({ data: fullCarrierResponse });

      await dashboardService.getCarrierDashboard();
      expect(mockGet).not.toHaveBeenCalledWith("/api/dashboard");
    });

    // --- Field mapping (Bug #2) ---
    it("should return all CarrierDashboardStats fields", async () => {
      mockGet.mockResolvedValue({ data: fullCarrierResponse });

      const result = await dashboardService.getCarrierDashboard();
      expect(result).toEqual(fullCarrierResponse);
      expect(result.totalTrucks).toBe(12);
      expect(result.activeTrucks).toBe(8);
      expect(result.activePostings).toBe(5);
      expect(result.completedDeliveries).toBe(143);
      expect(result.inTransitTrips).toBe(3);
      expect(result.totalServiceFeesPaid).toBe(28500.75);
      expect(result.totalDistance).toBe(94320);
      expect(result.recentPostings).toBe(2);
      expect(result.pendingApprovals).toBe(1);
    });

    it("should return nested wallet object with balance and currency", async () => {
      mockGet.mockResolvedValue({ data: fullCarrierResponse });

      const result = await dashboardService.getCarrierDashboard();
      expect(result.wallet).toEqual({ balance: 15200.5, currency: "ETB" });
      expect(result.wallet.balance).toBe(15200.5);
      expect(result.wallet.currency).toBe("ETB");
    });

    it("should pass through response.data directly (no unwrap)", async () => {
      mockGet.mockResolvedValue({ data: fullCarrierResponse });

      const result = await dashboardService.getCarrierDashboard();
      // response.data is returned as-is, not response.data.dashboard
      expect(result).toBe(fullCarrierResponse);
    });

    // --- Edge cases ---
    it("should handle all-zero stats (new carrier with no activity)", async () => {
      mockGet.mockResolvedValue({ data: zeroCarrierResponse });

      const result = await dashboardService.getCarrierDashboard();
      expect(result.totalTrucks).toBe(0);
      expect(result.activeTrucks).toBe(0);
      expect(result.completedDeliveries).toBe(0);
      expect(result.inTransitTrips).toBe(0);
      expect(result.totalServiceFeesPaid).toBe(0);
      expect(result.totalDistance).toBe(0);
    });

    it("should handle zero wallet balance", async () => {
      mockGet.mockResolvedValue({ data: zeroCarrierResponse });

      const result = await dashboardService.getCarrierDashboard();
      expect(result.wallet.balance).toBe(0);
      expect(result.wallet.currency).toBe("ETB");
    });

    it("should handle decimal values in financial fields", async () => {
      const decimalResponse = {
        ...fullCarrierResponse,
        totalServiceFeesPaid: 1234.56,
        wallet: { balance: 0.01, currency: "ETB" },
      };
      mockGet.mockResolvedValue({ data: decimalResponse });

      const result = await dashboardService.getCarrierDashboard();
      expect(result.totalServiceFeesPaid).toBe(1234.56);
      expect(result.wallet.balance).toBe(0.01);
    });

    // --- Error propagation (Bug #3) ---
    it("should throw Error with API error message on 403", async () => {
      mockGet.mockRejectedValue({
        response: { data: { error: "Forbidden" }, status: 403 },
        message: "Request failed with status code 403",
      });

      await expect(dashboardService.getCarrierDashboard()).rejects.toThrow(
        "Forbidden"
      );
    });

    it("should throw Error on 500 (not silently fail)", async () => {
      mockGet.mockRejectedValue({
        response: { data: { error: "Internal server error" }, status: 500 },
        message: "Request failed with status code 500",
      });

      await expect(dashboardService.getCarrierDashboard()).rejects.toThrow(
        "Internal server error"
      );
    });

    it("should throw Error on network failure", async () => {
      mockGet.mockRejectedValue({
        message: "Network Error",
      });

      await expect(dashboardService.getCarrierDashboard()).rejects.toThrow(
        "Network Error"
      );
    });
  });

  // =========================================================================
  // getShipperDashboard — 11 tests
  // =========================================================================
  describe("getShipperDashboard", () => {
    // --- URL correctness (Bug #1) ---
    it("should call GET /api/shipper/dashboard", async () => {
      mockGet.mockResolvedValue({ data: fullShipperResponse });

      await dashboardService.getShipperDashboard();
      expect(mockGet).toHaveBeenCalledWith("/api/shipper/dashboard");
    });

    it("should NOT call /api/dashboard (old buggy URL)", async () => {
      mockGet.mockResolvedValue({ data: fullShipperResponse });

      await dashboardService.getShipperDashboard();
      expect(mockGet).not.toHaveBeenCalledWith("/api/dashboard");
    });

    // --- Field mapping (Bug #2) ---
    it("should return nested stats object with all 6 fields", async () => {
      mockGet.mockResolvedValue({ data: fullShipperResponse });

      const result = await dashboardService.getShipperDashboard();
      expect(result.stats).toEqual({
        totalLoads: 45,
        activeLoads: 7,
        inTransitLoads: 3,
        deliveredLoads: 32,
        totalSpent: 125000.25,
        pendingPayments: 8500,
      });
    });

    it("should return loadsByStatus as array of {status, count}", async () => {
      mockGet.mockResolvedValue({ data: fullShipperResponse });

      const result = await dashboardService.getShipperDashboard();
      expect(Array.isArray(result.loadsByStatus)).toBe(true);
      expect(result.loadsByStatus).toHaveLength(4);
      expect(result.loadsByStatus[0]).toEqual({ status: "POSTED", count: 4 });
      expect(result.loadsByStatus[2]).toEqual({
        status: "DELIVERED",
        count: 32,
      });
    });

    it("should return nested wallet object", async () => {
      mockGet.mockResolvedValue({ data: fullShipperResponse });

      const result = await dashboardService.getShipperDashboard();
      expect(result.wallet).toEqual({ balance: 42000, currency: "ETB" });
    });

    it("should pass through response.data directly (no unwrap)", async () => {
      mockGet.mockResolvedValue({ data: fullShipperResponse });

      const result = await dashboardService.getShipperDashboard();
      expect(result).toBe(fullShipperResponse);
    });

    // --- Edge cases ---
    it("should handle all-zero stats (new shipper)", async () => {
      mockGet.mockResolvedValue({ data: zeroShipperResponse });

      const result = await dashboardService.getShipperDashboard();
      expect(result.stats.totalLoads).toBe(0);
      expect(result.stats.activeLoads).toBe(0);
      expect(result.stats.inTransitLoads).toBe(0);
      expect(result.stats.deliveredLoads).toBe(0);
      expect(result.stats.totalSpent).toBe(0);
      expect(result.stats.pendingPayments).toBe(0);
    });

    it("should handle empty loadsByStatus array", async () => {
      mockGet.mockResolvedValue({ data: zeroShipperResponse });

      const result = await dashboardService.getShipperDashboard();
      expect(result.loadsByStatus).toEqual([]);
      expect(result.loadsByStatus).toHaveLength(0);
    });

    // --- Error propagation (Bug #3) ---
    it("should throw Error with API error message on 403", async () => {
      mockGet.mockRejectedValue({
        response: { data: { error: "Forbidden" }, status: 403 },
        message: "Request failed with status code 403",
      });

      await expect(dashboardService.getShipperDashboard()).rejects.toThrow(
        "Forbidden"
      );
    });

    it("should throw Error on 500 (not silently fail)", async () => {
      mockGet.mockRejectedValue({
        response: { data: { error: "Internal server error" }, status: 500 },
        message: "Request failed with status code 500",
      });

      await expect(dashboardService.getShipperDashboard()).rejects.toThrow(
        "Internal server error"
      );
    });

    it("should throw Error on network failure", async () => {
      mockGet.mockRejectedValue({
        message: "Network Error",
      });

      await expect(dashboardService.getShipperDashboard()).rejects.toThrow(
        "Network Error"
      );
    });
  });
});
