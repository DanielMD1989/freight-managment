/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for rating hooks — §12 Ratings & Reviews
 */
import { ratingService } from "../../src/services/rating";

let capturedOptions: any = null;
let capturedMutationOptions: any = null;
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
  useMutation: (options: any) => {
    capturedMutationOptions = options;
    return { mutate: jest.fn(), isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock("../../src/services/rating", () => ({
  ratingService: {
    submitRating: jest.fn(),
    getTripRatings: jest.fn(),
    getOrgRatings: jest.fn(),
  },
}));

import {
  useTripRatings,
  useSubmitRating,
  useOrgRatings,
} from "../../src/hooks/useRatings";

describe("Rating Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ── useTripRatings ──

  describe("useTripRatings", () => {
    it('should use queryKey ["ratings", "trip", tripId]', () => {
      useTripRatings("trip-1");
      expect(capturedOptions.queryKey).toEqual(["ratings", "trip", "trip-1"]);
    });

    it("should set enabled: true when tripId is truthy", () => {
      useTripRatings("trip-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when tripId is undefined", () => {
      useTripRatings(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call ratingService.getTripRatings as queryFn", () => {
      useTripRatings("trip-1");
      capturedOptions.queryFn();
      expect(ratingService.getTripRatings).toHaveBeenCalledWith("trip-1");
    });
  });

  // ── useSubmitRating ──

  describe("useSubmitRating", () => {
    it("should call ratingService.submitRating with tripId and data", () => {
      useSubmitRating();
      capturedMutationOptions.mutationFn({
        tripId: "trip-1",
        data: { stars: 5, comment: "Great" },
      });
      expect(ratingService.submitRating).toHaveBeenCalledWith("trip-1", {
        stars: 5,
        comment: "Great",
      });
    });

    it("should invalidate trip ratings and trips on success", () => {
      useSubmitRating();
      capturedMutationOptions.onSuccess(
        {},
        { tripId: "trip-1", data: { stars: 5 } }
      );
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["ratings", "trip", "trip-1"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
    });
  });

  // ── useOrgRatings ──

  describe("useOrgRatings", () => {
    it('should use queryKey ["ratings", "org", orgId]', () => {
      useOrgRatings("org-1");
      expect(capturedOptions.queryKey).toEqual(["ratings", "org", "org-1"]);
    });

    it("should set enabled: true when orgId is truthy", () => {
      useOrgRatings("org-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when orgId is undefined", () => {
      useOrgRatings(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call ratingService.getOrgRatings as queryFn", () => {
      useOrgRatings("org-1");
      capturedOptions.queryFn();
      expect(ratingService.getOrgRatings).toHaveBeenCalledWith("org-1");
    });
  });
});
