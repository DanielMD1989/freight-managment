/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for truck hooks — all 17 hooks across 3 cache key families:
 *   ["trucks"], ["truck-postings"], ["truck-requests"]
 */
import { truckService } from "../../src/services/truck";

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

jest.mock("../../src/services/truck", () => ({
  truckService: {
    getTrucks: jest.fn(),
    getTruck: jest.fn(),
    createTruck: jest.fn(),
    updateTruck: jest.fn(),
    deleteTruck: jest.fn(),
    getTruckPostings: jest.fn(),
    getTruckPosting: jest.fn(),
    createTruckPosting: jest.fn(),
    createTruckRequest: jest.fn(),
    getMyTruckRequests: jest.fn(),
    cancelTruckRequest: jest.fn(),
    getReceivedTruckRequests: jest.fn(),
    respondToTruckRequest: jest.fn(),
    getMyTruckPostings: jest.fn(),
    updateTruckPosting: jest.fn(),
    cancelTruckPosting: jest.fn(),
    getMatchingLoadsForPosting: jest.fn(),
    duplicateTruckPosting: jest.fn(),
  },
}));

import {
  useTrucks,
  useTruck,
  useCreateTruck,
  useUpdateTruck,
  useDeleteTruck,
  useTruckPostings,
  useTruckPosting,
  useCreateTruckPosting,
  useCreateTruckRequest,
  useMyTruckRequests,
  useCancelTruckRequest,
  useReceivedTruckRequests,
  useRespondToTruckRequest,
  useMyTruckPostings,
  useUpdateTruckPosting,
  useCancelTruckPosting,
  useMatchingLoadsForPosting,
  useDuplicateTruckPosting,
} from "../../src/hooks/useTrucks";

describe("Truck Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ==== Carrier CRUD (["trucks"]) ====

  describe("useTrucks", () => {
    it('should use queryKey ["trucks", params]', () => {
      const params = { status: "ACTIVE", limit: 10 };
      useTrucks(params);
      expect(capturedOptions.queryKey).toEqual(["trucks", params]);
    });

    it("should call truckService.getTrucks as queryFn", () => {
      const params = { page: 1 };
      useTrucks(params);
      capturedOptions.queryFn();
      expect(truckService.getTrucks).toHaveBeenCalledWith(params);
    });
  });

  describe("useTruck", () => {
    it('should use queryKey ["trucks", id]', () => {
      useTruck("t-1");
      expect(capturedOptions.queryKey).toEqual(["trucks", "t-1"]);
    });

    it("should set enabled: true when id is truthy", () => {
      useTruck("t-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is undefined", () => {
      useTruck(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call truckService.getTruck as queryFn", () => {
      useTruck("t-1");
      capturedOptions.queryFn();
      expect(truckService.getTruck).toHaveBeenCalledWith("t-1");
    });
  });

  describe("useCreateTruck", () => {
    it("should call truckService.createTruck as mutationFn", () => {
      useCreateTruck();
      const data = {
        truckType: "DRY_VAN",
        licensePlate: "AA-123",
        capacity: 5000,
      };
      capturedMutationOptions.mutationFn(data);
      expect(truckService.createTruck).toHaveBeenCalledWith(data);
    });

    it('should invalidate ["trucks"] on success', () => {
      useCreateTruck();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trucks"],
      });
    });
  });

  describe("useUpdateTruck", () => {
    it("should call truckService.updateTruck(id, data) as mutationFn", () => {
      useUpdateTruck();
      capturedMutationOptions.mutationFn({
        id: "t-1",
        data: { capacity: 6000 },
      });
      expect(truckService.updateTruck).toHaveBeenCalledWith("t-1", {
        capacity: 6000,
      });
    });

    it('should invalidate ["trucks"] on success', () => {
      useUpdateTruck();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trucks"],
      });
    });
  });

  describe("useDeleteTruck", () => {
    it("should call truckService.deleteTruck(id) as mutationFn", () => {
      useDeleteTruck();
      capturedMutationOptions.mutationFn("t-1");
      expect(truckService.deleteTruck).toHaveBeenCalledWith("t-1");
    });

    it('should invalidate ["trucks"] on success', () => {
      useDeleteTruck();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trucks"],
      });
    });
  });

  // ==== Postings (["truck-postings"]) ====

  describe("useTruckPostings", () => {
    it('should use queryKey ["truck-postings", params]', () => {
      const params = { truckType: "FLATBED", limit: 20 };
      useTruckPostings(params);
      expect(capturedOptions.queryKey).toEqual(["truck-postings", params]);
    });

    it("should call truckService.getTruckPostings as queryFn", () => {
      const params = { page: 1 };
      useTruckPostings(params);
      capturedOptions.queryFn();
      expect(truckService.getTruckPostings).toHaveBeenCalledWith(params);
    });
  });

  describe("useTruckPosting", () => {
    it('should use queryKey ["truck-postings", id]', () => {
      useTruckPosting("tp-1");
      expect(capturedOptions.queryKey).toEqual(["truck-postings", "tp-1"]);
    });

    it("should set enabled: true when id is truthy", () => {
      useTruckPosting("tp-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is undefined", () => {
      useTruckPosting(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call truckService.getTruckPosting as queryFn", () => {
      useTruckPosting("tp-1");
      capturedOptions.queryFn();
      expect(truckService.getTruckPosting).toHaveBeenCalledWith("tp-1");
    });
  });

  describe("useCreateTruckPosting", () => {
    it("should call truckService.createTruckPosting as mutationFn", () => {
      useCreateTruckPosting();
      const data = {
        truckId: "t-1",
        originCityId: "c-1",
        availableFrom: "2026-03-01",
        contactName: "John",
        contactPhone: "+251911",
      };
      capturedMutationOptions.mutationFn(data);
      expect(truckService.createTruckPosting).toHaveBeenCalledWith(data);
    });

    it('should invalidate ["truck-postings"] on success', () => {
      useCreateTruckPosting();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-postings"],
      });
    });
  });

  describe("useMyTruckPostings", () => {
    it('should use queryKey ["truck-postings", "mine", params]', () => {
      const params = { organizationId: "org-1", limit: 10 };
      useMyTruckPostings(params);
      expect(capturedOptions.queryKey).toEqual([
        "truck-postings",
        "mine",
        params,
      ]);
    });

    it("should set enabled: true when organizationId is truthy", () => {
      useMyTruckPostings({ organizationId: "org-1" });
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when organizationId is missing", () => {
      useMyTruckPostings({ limit: 10 });
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call truckService.getMyTruckPostings as queryFn", () => {
      const params = { organizationId: "org-1" };
      useMyTruckPostings(params);
      capturedOptions.queryFn();
      expect(truckService.getMyTruckPostings).toHaveBeenCalledWith(params);
    });
  });

  describe("useUpdateTruckPosting", () => {
    it("should call truckService.updateTruckPosting(id, data) as mutationFn", () => {
      useUpdateTruckPosting();
      capturedMutationOptions.mutationFn({
        id: "tp-1",
        data: { notes: "Updated" },
      });
      expect(truckService.updateTruckPosting).toHaveBeenCalledWith("tp-1", {
        notes: "Updated",
      });
    });

    it('should invalidate ["truck-postings"] on success', () => {
      useUpdateTruckPosting();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-postings"],
      });
    });
  });

  describe("useCancelTruckPosting", () => {
    it("should call truckService.cancelTruckPosting(id) as mutationFn", () => {
      useCancelTruckPosting();
      capturedMutationOptions.mutationFn("tp-1");
      expect(truckService.cancelTruckPosting).toHaveBeenCalledWith("tp-1");
    });

    it('should invalidate ["truck-postings"] on success', () => {
      useCancelTruckPosting();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-postings"],
      });
    });
  });

  describe("useMatchingLoadsForPosting", () => {
    it('should use queryKey ["truck-postings", postingId, "matching-loads", params]', () => {
      useMatchingLoadsForPosting("tp-1", { minScore: 50 });
      expect(capturedOptions.queryKey).toEqual([
        "truck-postings",
        "tp-1",
        "matching-loads",
        { minScore: 50 },
      ]);
    });

    it("should set enabled: true when postingId is truthy", () => {
      useMatchingLoadsForPosting("tp-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when postingId is undefined", () => {
      useMatchingLoadsForPosting(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call truckService.getMatchingLoadsForPosting as queryFn", () => {
      const params = { minScore: 70, limit: 5 };
      useMatchingLoadsForPosting("tp-1", params);
      capturedOptions.queryFn();
      expect(truckService.getMatchingLoadsForPosting).toHaveBeenCalledWith(
        "tp-1",
        params
      );
    });
  });

  describe("useDuplicateTruckPosting", () => {
    it("should call truckService.duplicateTruckPosting(id) as mutationFn", () => {
      useDuplicateTruckPosting();
      capturedMutationOptions.mutationFn("tp-1");
      expect(truckService.duplicateTruckPosting).toHaveBeenCalledWith("tp-1");
    });

    it('should invalidate ["truck-postings"] on success', () => {
      useDuplicateTruckPosting();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-postings"],
      });
    });
  });

  // ==== Truck Requests (["truck-requests"]) ====

  describe("useCreateTruckRequest", () => {
    it("should call truckService.createTruckRequest as mutationFn", () => {
      useCreateTruckRequest();
      const data = { loadId: "l1", truckId: "t1" };
      capturedMutationOptions.mutationFn(data);
      expect(truckService.createTruckRequest).toHaveBeenCalledWith(data);
    });

    it('should invalidate ["truck-requests"] on success', () => {
      useCreateTruckRequest();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-requests"],
      });
    });
  });

  describe("useMyTruckRequests", () => {
    it('should use queryKey ["truck-requests", "mine", params]', () => {
      const params = { status: "PENDING", limit: 10 };
      useMyTruckRequests(params);
      expect(capturedOptions.queryKey).toEqual([
        "truck-requests",
        "mine",
        params,
      ]);
    });

    it("should call truckService.getMyTruckRequests as queryFn", () => {
      const params = { status: "APPROVED" };
      useMyTruckRequests(params);
      capturedOptions.queryFn();
      expect(truckService.getMyTruckRequests).toHaveBeenCalledWith(params);
    });
  });

  describe("useCancelTruckRequest", () => {
    it("should call truckService.cancelTruckRequest(id) as mutationFn", () => {
      useCancelTruckRequest();
      capturedMutationOptions.mutationFn("tr-1");
      expect(truckService.cancelTruckRequest).toHaveBeenCalledWith("tr-1");
    });

    it('should invalidate ["truck-requests"] on success', () => {
      useCancelTruckRequest();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-requests"],
      });
    });
  });

  describe("useReceivedTruckRequests", () => {
    it('should use queryKey ["truck-requests", "received", params]', () => {
      const params = { status: "PENDING", limit: 5 };
      useReceivedTruckRequests(params);
      expect(capturedOptions.queryKey).toEqual([
        "truck-requests",
        "received",
        params,
      ]);
    });

    it("should call truckService.getReceivedTruckRequests as queryFn", () => {
      const params = { status: "PENDING" };
      useReceivedTruckRequests(params);
      capturedOptions.queryFn();
      expect(truckService.getReceivedTruckRequests).toHaveBeenCalledWith(
        params
      );
    });
  });

  describe("useRespondToTruckRequest", () => {
    it("should call truckService.respondToTruckRequest(id, action, notes) as mutationFn", () => {
      useRespondToTruckRequest();
      capturedMutationOptions.mutationFn({
        id: "tr-1",
        action: "APPROVED" as const,
        notes: "Looks good",
      });
      expect(truckService.respondToTruckRequest).toHaveBeenCalledWith(
        "tr-1",
        "APPROVED",
        "Looks good"
      );
    });

    it('should invalidate ["truck-requests"] on success', () => {
      useRespondToTruckRequest();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["truck-requests"],
      });
    });
  });
});
