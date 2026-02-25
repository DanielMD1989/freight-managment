/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for tracking service — getLoadProgress, error propagation
 */
import { trackingService } from "../../src/services/tracking";

const mockGet = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Tracking Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLoadProgress", () => {
    it("should call GET /api/loads/:loadId/progress", async () => {
      const progressData = {
        loadId: "l1",
        status: "IN_TRANSIT",
        trackingEnabled: true,
        progress: {
          percent: 45,
          remainingKm: 200,
          totalDistanceKm: 400,
          travelledKm: 200,
          estimatedArrival: "2026-03-01T12:00:00Z",
          isNearDestination: false,
        },
      };
      mockGet.mockResolvedValue({ data: progressData });

      const result = await trackingService.getLoadProgress("l1");
      expect(mockGet).toHaveBeenCalledWith("/api/loads/l1/progress");
      expect(result.loadId).toBe("l1");
      expect(result.progress.percent).toBe(45);
    });

    it("should return full progress object", async () => {
      const progressData = {
        loadId: "l2",
        status: "IN_TRANSIT",
        trackingEnabled: true,
        progress: {
          percent: 80,
          remainingKm: 50,
          totalDistanceKm: 250,
          travelledKm: 200,
          estimatedArrival: null,
          isNearDestination: true,
        },
      };
      mockGet.mockResolvedValue({ data: progressData });

      const result = await trackingService.getLoadProgress("l2");
      expect(result.progress.isNearDestination).toBe(true);
      expect(result.progress.estimatedArrival).toBeNull();
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(trackingService.getLoadProgress("l1")).rejects.toThrow(
        "Not found"
      );
    });
  });
});
