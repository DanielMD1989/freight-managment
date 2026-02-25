/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for match query hooks — verify query keys, enabled flags, and triple invalidation
 */
import { matchService } from "../../src/services/match";

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

jest.mock("../../src/services/match", () => ({
  matchService: {
    getMatchingTrucks: jest.fn(),
    assignTruck: jest.fn(),
  },
}));

import { useMatchingTrucks, useAssignTruck } from "../../src/hooks/useMatches";

describe("Match Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  describe("useMatchingTrucks", () => {
    it('should use queryKey ["matching-trucks", loadId, params]', () => {
      const params = { minScore: 80, limit: 5 };
      useMatchingTrucks("l1", params);
      expect(capturedOptions.queryKey).toEqual([
        "matching-trucks",
        "l1",
        params,
      ]);
    });

    it("should set enabled: true when loadId is truthy", () => {
      useMatchingTrucks("l1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when loadId is undefined", () => {
      useMatchingTrucks(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call matchService.getMatchingTrucks as queryFn", () => {
      const params = { minScore: 70 };
      useMatchingTrucks("l1", params);
      capturedOptions.queryFn();
      expect(matchService.getMatchingTrucks).toHaveBeenCalledWith("l1", params);
    });

    it("should include undefined params in queryKey when not provided", () => {
      useMatchingTrucks("l1");
      expect(capturedOptions.queryKey).toEqual([
        "matching-trucks",
        "l1",
        undefined,
      ]);
    });
  });

  describe("useAssignTruck", () => {
    it("should call matchService.assignTruck as mutationFn", () => {
      useAssignTruck();
      capturedMutationOptions.mutationFn({ loadId: "l1", truckId: "t1" });
      expect(matchService.assignTruck).toHaveBeenCalledWith("l1", "t1");
    });

    it('should invalidate 3 keys: ["matching-trucks"], ["loads"], ["trips"]', () => {
      useAssignTruck();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["matching-trucks"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["loads"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    });
  });
});
