/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for rating service — §12 Ratings & Reviews
 */
import { ratingService } from "../../src/services/rating";

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

describe("Rating Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── submitRating ──

  describe("submitRating", () => {
    it("should call POST /api/trips/:id/rate", async () => {
      const mockRating = { id: "r1", stars: 5, tripId: "t1" };
      mockPost.mockResolvedValue({ data: { rating: mockRating } });

      const result = await ratingService.submitRating("t1", {
        stars: 5,
        comment: "Great",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t1/rate", {
        stars: 5,
        comment: "Great",
      });
      expect(result.id).toBe("r1");
    });

    it("should handle unwrapped response", async () => {
      const mockRating = { id: "r2", stars: 4, tripId: "t1" };
      mockPost.mockResolvedValue({ data: mockRating });

      const result = await ratingService.submitRating("t1", { stars: 4 });
      expect(result.id).toBe("r2");
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Forbidden"));

      await expect(
        ratingService.submitRating("t1", { stars: 3 })
      ).rejects.toThrow("Forbidden");
    });
  });

  // ── getTripRatings ──

  describe("getTripRatings", () => {
    it("should call GET /api/trips/:id/rate", async () => {
      const mockData = { ratings: [], myRating: null };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await ratingService.getTripRatings("t1");
      expect(mockGet).toHaveBeenCalledWith("/api/trips/t1/rate");
      expect(result.ratings).toEqual([]);
      expect(result.myRating).toBeNull();
    });

    it("should return ratings array", async () => {
      const mockData = {
        ratings: [{ id: "r1", stars: 5 }],
        myRating: { id: "r1", stars: 5 },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await ratingService.getTripRatings("t1");
      expect(result.ratings).toHaveLength(1);
      expect(result.myRating?.id).toBe("r1");
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(ratingService.getTripRatings("t1")).rejects.toThrow(
        "Not found"
      );
    });
  });

  // ── getOrgRatings ──

  describe("getOrgRatings", () => {
    it("should call GET /api/organizations/:id/ratings", async () => {
      const mockData = {
        ratings: [],
        averageRating: null,
        totalRatings: 0,
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await ratingService.getOrgRatings("org1");
      expect(mockGet).toHaveBeenCalledWith("/api/organizations/org1/ratings", {
        params: undefined,
      });
      expect(result.totalRatings).toBe(0);
    });

    it("should pass pagination params", async () => {
      const mockData = {
        ratings: [{ id: "r1" }],
        averageRating: 4.5,
        totalRatings: 1,
        pagination: { page: 2, limit: 5, total: 6, pages: 2 },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await ratingService.getOrgRatings("org1", {
        page: 2,
        limit: 5,
      });
      expect(mockGet).toHaveBeenCalledWith("/api/organizations/org1/ratings", {
        params: { page: 2, limit: 5 },
      });
      expect(result.averageRating).toBe(4.5);
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("Server error"));

      await expect(ratingService.getOrgRatings("org1")).rejects.toThrow(
        "Server error"
      );
    });
  });
});
