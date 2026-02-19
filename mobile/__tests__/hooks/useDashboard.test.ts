/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for dashboard query hooks — verify query keys, intervals, and queryFn wiring
 */
import { dashboardService } from "../../src/services/dashboard";

let capturedOptions: any = null;

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
}));

jest.mock("../../src/services/dashboard", () => ({
  dashboardService: {
    getCarrierDashboard: jest.fn(),
    getShipperDashboard: jest.fn(),
  },
}));

import {
  useCarrierDashboard,
  useShipperDashboard,
} from "../../src/hooks/useDashboard";

describe("Dashboard Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    jest.clearAllMocks();
  });

  describe("useCarrierDashboard", () => {
    it('should use queryKey ["carrier-dashboard"]', () => {
      useCarrierDashboard();
      expect(capturedOptions.queryKey).toEqual(["carrier-dashboard"]);
    });

    it("should set refetchInterval to 60000", () => {
      useCarrierDashboard();
      expect(capturedOptions.refetchInterval).toBe(60000);
    });

    it("should call dashboardService.getCarrierDashboard as queryFn", () => {
      useCarrierDashboard();
      capturedOptions.queryFn();
      expect(dashboardService.getCarrierDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe("useShipperDashboard", () => {
    it('should use queryKey ["shipper-dashboard"]', () => {
      useShipperDashboard();
      expect(capturedOptions.queryKey).toEqual(["shipper-dashboard"]);
    });

    it("should set refetchInterval to 60000", () => {
      useShipperDashboard();
      expect(capturedOptions.refetchInterval).toBe(60000);
    });

    it("should call dashboardService.getShipperDashboard as queryFn", () => {
      useShipperDashboard();
      capturedOptions.queryFn();
      expect(dashboardService.getShipperDashboard).toHaveBeenCalledTimes(1);
    });
  });
});
