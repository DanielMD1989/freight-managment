/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for match service — truck-load matching and assignment
 */
import { matchService } from "../../src/services/match";

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Match Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMatchingTrucks", () => {
    it("should call GET /api/loads/:loadId/matching-trucks", async () => {
      const mockData = {
        trucks: [{ id: "t1", score: 95, isExactMatch: true }],
        total: 1,
        exactMatches: 1,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await matchService.getMatchingTrucks("l1");
      expect(mockGet).toHaveBeenCalledWith("/api/loads/l1/matching-trucks", {
        params: undefined,
      });
      expect(result.trucks).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.exactMatches).toBe(1);
    });

    it("should pass minScore and limit params", async () => {
      mockGet.mockResolvedValue({
        data: { trucks: [], total: 0, exactMatches: 0 },
      });

      await matchService.getMatchingTrucks("l1", {
        minScore: 80,
        limit: 5,
      });
      expect(mockGet).toHaveBeenCalledWith("/api/loads/l1/matching-trucks", {
        params: { minScore: 80, limit: 5 },
      });
    });

    it("should return { trucks, total, exactMatches } shape", async () => {
      const mockData = {
        trucks: [
          { id: "t1", score: 95, isExactMatch: true },
          { id: "t2", score: 70, isExactMatch: false },
        ],
        total: 2,
        exactMatches: 1,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await matchService.getMatchingTrucks("l1");
      expect(result).toEqual(
        expect.objectContaining({
          trucks: expect.any(Array),
          total: expect.any(Number),
          exactMatches: expect.any(Number),
        })
      );
    });

    it("should not send undefined params when called without options", async () => {
      mockGet.mockResolvedValue({
        data: { trucks: [], total: 0, exactMatches: 0 },
      });

      await matchService.getMatchingTrucks("l1");
      const callArgs = mockGet.mock.calls[0];
      expect(callArgs[1]).toEqual({ params: undefined });
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Load not found"));

      await expect(
        matchService.getMatchingTrucks("nonexistent")
      ).rejects.toThrow("Load not found");
    });
  });

  describe("assignTruck", () => {
    it("should call POST /api/loads/:loadId/assign with { truckId }", async () => {
      const mockData = {
        load: { id: "l1", status: "ASSIGNED" },
        trip: {
          id: "trip1",
          status: "ASSIGNED",
          trackingUrl: "https://track.test/trip1",
        },
        trackingUrl: "https://track.test/trip1",
        message: "Truck assigned successfully",
      };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await matchService.assignTruck("l1", "t1");
      expect(mockPost).toHaveBeenCalledWith("/api/loads/l1/assign", {
        truckId: "t1",
      });
      expect(result.load.id).toBe("l1");
      expect(result.trip.id).toBe("trip1");
      expect(result.message).toBe("Truck assigned successfully");
    });

    it("should return { load, trip, trackingUrl, message } shape", async () => {
      const mockData = {
        load: { id: "l1", status: "ASSIGNED" },
        trip: {
          id: "trip1",
          status: "ASSIGNED",
          trackingUrl: "https://track.test/trip1",
        },
        trackingUrl: null,
        message: "Assigned",
      };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await matchService.assignTruck("l1", "t1");
      expect(result).toEqual(
        expect.objectContaining({
          load: expect.objectContaining({ id: "l1" }),
          trip: expect.objectContaining({ id: "trip1" }),
          trackingUrl: null,
          message: "Assigned",
        })
      );
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Already assigned"));

      await expect(matchService.assignTruck("l1", "t1")).rejects.toThrow(
        "Already assigned"
      );
    });
  });
});
