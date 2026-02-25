/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for tracking query hooks — verify query keys, enabled flags,
 * refetchInterval, and queryFn wiring
 */
import { trackingService } from "../../src/services/tracking";

let capturedOptions: any = null;

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
}));

jest.mock("../../src/services/tracking", () => ({
  trackingService: {
    getLoadProgress: jest.fn(),
  },
}));

import { useLoadProgress } from "../../src/hooks/useTracking";

describe("Tracking Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    jest.clearAllMocks();
  });

  describe("useLoadProgress", () => {
    it('should use queryKey ["load-progress", loadId]', () => {
      useLoadProgress("l1");
      expect(capturedOptions.queryKey).toEqual(["load-progress", "l1"]);
    });

    it("should set enabled: true when loadId is truthy", () => {
      useLoadProgress("l1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when loadId is undefined", () => {
      useLoadProgress(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set refetchInterval to 30000ms", () => {
      useLoadProgress("l1");
      expect(capturedOptions.refetchInterval).toBe(30000);
    });

    it("should call trackingService.getLoadProgress as queryFn", () => {
      useLoadProgress("l1");
      capturedOptions.queryFn();
      expect(trackingService.getLoadProgress).toHaveBeenCalledWith("l1");
    });
  });
});
