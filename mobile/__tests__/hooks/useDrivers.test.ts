/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for driver hooks — all 8 hooks across 2 cache key families:
 *   ["drivers"], ["trips"]
 *
 * Mirrors the pattern in useTrucks.test.ts: mock @tanstack/react-query,
 * capture the options object, assert queryKey / queryFn / onSuccess.
 */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockPut = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
    put: (...args: any[]) => mockPut(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

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

import {
  useDrivers,
  useDriver,
  useInviteDriver,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
  useAssignDriver,
  useUnassignDriver,
} from "../../src/hooks/useDrivers";

describe("Driver Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ==== Query hooks (["drivers"]) ====

  describe("useDrivers", () => {
    it('should use queryKey ["drivers", params]', () => {
      const params = { status: "ACTIVE", limit: 10 };
      useDrivers(params);
      expect(capturedOptions.queryKey).toEqual(["drivers", params]);
    });

    it("should call apiClient.get /api/drivers as queryFn", async () => {
      const params = { page: 1, limit: 20 };
      mockGet.mockResolvedValue({ data: { drivers: [], total: 0 } });
      useDrivers(params);
      await capturedOptions.queryFn();
      expect(mockGet).toHaveBeenCalledWith("/api/drivers", { params });
    });

    it('should use queryKey ["drivers", undefined] when no params', () => {
      useDrivers();
      expect(capturedOptions.queryKey).toEqual(["drivers", undefined]);
    });
  });

  describe("useDriver", () => {
    it('should use queryKey ["drivers", id]', () => {
      useDriver("d-1");
      expect(capturedOptions.queryKey).toEqual(["drivers", "d-1"]);
    });

    it("should set enabled: true when id is truthy", () => {
      useDriver("d-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is undefined", () => {
      useDriver(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call apiClient.get /api/drivers/:id as queryFn", async () => {
      mockGet.mockResolvedValue({ data: { id: "d-1", status: "ACTIVE" } });
      useDriver("d-1");
      await capturedOptions.queryFn();
      expect(mockGet).toHaveBeenCalledWith("/api/drivers/d-1");
    });
  });

  // ==== Mutation hooks (["drivers"]) ====

  describe("useInviteDriver", () => {
    it("should call POST /api/drivers/invite as mutationFn", async () => {
      mockPost.mockResolvedValue({
        data: { success: true, inviteCode: "ABC123" },
      });
      useInviteDriver();
      const payload = {
        name: "John Driver",
        phone: "+251911222333",
        email: "john@test.com",
      };
      await capturedMutationOptions.mutationFn(payload);
      expect(mockPost).toHaveBeenCalledWith("/api/drivers/invite", payload);
    });

    it('should invalidate ["drivers"] on success', () => {
      useInviteDriver();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["drivers"],
      });
    });
  });

  describe("useApproveDriver", () => {
    it("should call POST /api/drivers/:id/approve as mutationFn", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      useApproveDriver();
      await capturedMutationOptions.mutationFn("d-1");
      expect(mockPost).toHaveBeenCalledWith("/api/drivers/d-1/approve");
    });

    it('should invalidate ["drivers"] on success', () => {
      useApproveDriver();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["drivers"],
      });
    });
  });

  describe("useRejectDriver", () => {
    it("should call POST /api/drivers/:id/reject with reason as mutationFn", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      useRejectDriver();
      await capturedMutationOptions.mutationFn({
        driverId: "d-1",
        reason: "Failed background check",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/drivers/d-1/reject", {
        reason: "Failed background check",
      });
    });

    it('should invalidate ["drivers"] on success', () => {
      useRejectDriver();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["drivers"],
      });
    });
  });

  describe("useSuspendDriver", () => {
    it("should call DELETE /api/drivers/:id as mutationFn", async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });
      useSuspendDriver();
      await capturedMutationOptions.mutationFn("d-1");
      expect(mockDelete).toHaveBeenCalledWith("/api/drivers/d-1");
    });

    it('should invalidate ["drivers"] on success', () => {
      useSuspendDriver();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["drivers"],
      });
    });
  });

  // ==== Trip-driver mutations (["trips"] + ["drivers"]) ====

  describe("useAssignDriver", () => {
    it("should call POST /api/trips/:id/assign-driver with driverId", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      useAssignDriver();
      await capturedMutationOptions.mutationFn({
        tripId: "t-1",
        driverId: "d-1",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t-1/assign-driver", {
        driverId: "d-1",
      });
    });

    it('should invalidate both ["trips"] and ["drivers"] on success', () => {
      useAssignDriver();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["drivers"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });
  });

  describe("useUnassignDriver", () => {
    it("should call POST /api/trips/:id/unassign-driver as mutationFn", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      useUnassignDriver();
      await capturedMutationOptions.mutationFn("t-1");
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t-1/unassign-driver");
    });

    it('should invalidate both ["trips"] and ["drivers"] on success', () => {
      useUnassignDriver();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["drivers"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });
  });
});
