/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for load query hooks — verify query keys, enabled flags, queryFn wiring,
 * and cache invalidation patterns
 */
import { loadService } from "../../src/services/load";

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

jest.mock("../../src/services/load", () => ({
  loadService: {
    getLoads: jest.fn(),
    getLoad: jest.fn(),
    createLoad: jest.fn(),
    updateLoad: jest.fn(),
    deleteLoad: jest.fn(),
    createLoadRequest: jest.fn(),
    getLoadRequests: jest.fn(),
    respondToLoadRequest: jest.fn(),
    getReceivedLoadRequests: jest.fn(),
    cancelLoadRequest: jest.fn(),
    getMyLoadRequests: jest.fn(),
  },
}));

import {
  useLoads,
  useLoad,
  useCreateLoad,
  useUpdateLoad,
  useDeleteLoad,
  useCreateLoadRequest,
  useLoadRequests,
  useRespondToLoadRequest,
  useReceivedLoadRequests,
  useCancelLoadRequest,
  useMyLoadRequests,
} from "../../src/hooks/useLoads";

describe("Load Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  describe("useLoads", () => {
    it('should use queryKey ["loads", params]', () => {
      const params = { status: "POSTED", limit: 10 };
      useLoads(params);
      expect(capturedOptions.queryKey).toEqual(["loads", params]);
    });

    it("should call loadService.getLoads as queryFn", () => {
      const params = { myLoads: true };
      useLoads(params);
      capturedOptions.queryFn();
      expect(loadService.getLoads).toHaveBeenCalledWith(params);
    });
  });

  describe("useLoad", () => {
    it('should use queryKey ["loads", id]', () => {
      useLoad("load-123");
      expect(capturedOptions.queryKey).toEqual(["loads", "load-123"]);
    });

    it("should set enabled: true when id is truthy", () => {
      useLoad("load-123");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is undefined", () => {
      useLoad(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call loadService.getLoad as queryFn", () => {
      useLoad("load-123");
      capturedOptions.queryFn();
      expect(loadService.getLoad).toHaveBeenCalledWith("load-123");
    });
  });

  describe("useCreateLoad", () => {
    it("should call loadService.createLoad as mutationFn", () => {
      useCreateLoad();
      const data = {
        pickupCity: "Addis",
        deliveryCity: "Dire Dawa",
        pickupDate: "2026-03-01",
        deliveryDate: "2026-03-03",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Test",
      };
      capturedMutationOptions.mutationFn(data);
      expect(loadService.createLoad).toHaveBeenCalledWith(data);
    });

    it('should invalidate ["loads"] on success', () => {
      useCreateLoad();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["loads"],
      });
    });
  });

  describe("useUpdateLoad", () => {
    it("should call loadService.updateLoad as mutationFn", () => {
      useUpdateLoad();
      capturedMutationOptions.mutationFn({ id: "l1", data: { weight: 6000 } });
      expect(loadService.updateLoad).toHaveBeenCalledWith("l1", {
        weight: 6000,
      });
    });

    it('should invalidate ["loads"] on success', () => {
      useUpdateLoad();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["loads"],
      });
    });
  });

  describe("useDeleteLoad", () => {
    it("should call loadService.deleteLoad as mutationFn", () => {
      useDeleteLoad();
      capturedMutationOptions.mutationFn("l1");
      expect(loadService.deleteLoad).toHaveBeenCalledWith("l1");
    });

    it('should invalidate ["loads"] on success', () => {
      useDeleteLoad();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["loads"],
      });
    });
  });

  describe("useCreateLoadRequest", () => {
    it("should call loadService.createLoadRequest as mutationFn", () => {
      useCreateLoadRequest();
      const data = { loadId: "l1", truckId: "t1" };
      capturedMutationOptions.mutationFn(data);
      expect(loadService.createLoadRequest).toHaveBeenCalledWith(data);
    });

    it('should invalidate ["load-requests"] on success', () => {
      useCreateLoadRequest();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["load-requests"],
      });
    });
  });

  describe("useLoadRequests", () => {
    it("should use queryKey with loadId", () => {
      useLoadRequests("l1");
      expect(capturedOptions.queryKey).toEqual(["load-requests", "l1"]);
    });

    it("should set enabled: true when loadId is truthy", () => {
      useLoadRequests("l1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when loadId is undefined", () => {
      useLoadRequests(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });
  });

  describe("useRespondToLoadRequest", () => {
    it("should call loadService.respondToLoadRequest as mutationFn", () => {
      useRespondToLoadRequest();
      capturedMutationOptions.mutationFn({
        requestId: "r1",
        action: "APPROVED" as const,
        notes: "Looks good",
      });
      expect(loadService.respondToLoadRequest).toHaveBeenCalledWith(
        "r1",
        "APPROVED",
        "Looks good"
      );
    });

    it('should invalidate BOTH ["load-requests"] AND ["loads"] on success', () => {
      useRespondToLoadRequest();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["load-requests"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["loads"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });
  });

  describe("useReceivedLoadRequests", () => {
    it('should use queryKey ["load-requests", "received", params]', () => {
      const params = { status: "PENDING", limit: 5 };
      useReceivedLoadRequests(params);
      expect(capturedOptions.queryKey).toEqual([
        "load-requests",
        "received",
        params,
      ]);
    });

    it("should call loadService.getReceivedLoadRequests as queryFn", () => {
      const params = { status: "PENDING" };
      useReceivedLoadRequests(params);
      capturedOptions.queryFn();
      expect(loadService.getReceivedLoadRequests).toHaveBeenCalledWith(params);
    });
  });

  describe("useCancelLoadRequest", () => {
    it("should call loadService.cancelLoadRequest as mutationFn", () => {
      useCancelLoadRequest();
      capturedMutationOptions.mutationFn("r1");
      expect(loadService.cancelLoadRequest).toHaveBeenCalledWith("r1");
    });

    it('should invalidate ["load-requests"] on success', () => {
      useCancelLoadRequest();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["load-requests"],
      });
    });
  });

  describe("useMyLoadRequests", () => {
    it('should use queryKey ["load-requests", "mine", params]', () => {
      const params = { page: 1, limit: 10 };
      useMyLoadRequests(params);
      expect(capturedOptions.queryKey).toEqual([
        "load-requests",
        "mine",
        params,
      ]);
    });

    it("should call loadService.getMyLoadRequests as queryFn", () => {
      const params = { status: "PENDING" };
      useMyLoadRequests(params);
      capturedOptions.queryFn();
      expect(loadService.getMyLoadRequests).toHaveBeenCalledWith(params);
    });
  });
});
