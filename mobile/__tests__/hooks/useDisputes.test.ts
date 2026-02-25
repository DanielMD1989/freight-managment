/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for dispute query hooks — verify query keys, enabled flags, queryFn wiring,
 * and cache invalidation patterns
 */
import { disputeService } from "../../src/services/dispute";

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

jest.mock("../../src/services/dispute", () => ({
  disputeService: {
    getDisputes: jest.fn(),
    getDispute: jest.fn(),
    createDispute: jest.fn(),
  },
}));

import {
  useDisputes,
  useDispute,
  useCreateDispute,
} from "../../src/hooks/useDisputes";

describe("Dispute Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  describe("useDisputes", () => {
    it('should use queryKey ["disputes", params]', () => {
      const params = { status: "OPEN" };
      useDisputes(params);
      expect(capturedOptions.queryKey).toEqual(["disputes", params]);
    });

    it('should use queryKey ["disputes", undefined] when no params', () => {
      useDisputes();
      expect(capturedOptions.queryKey).toEqual(["disputes", undefined]);
    });

    it("should call disputeService.getDisputes as queryFn", () => {
      const params = { status: "OPEN" };
      useDisputes(params);
      capturedOptions.queryFn();
      expect(disputeService.getDisputes).toHaveBeenCalledWith(params);
    });
  });

  describe("useDispute", () => {
    it('should use queryKey ["disputes", id]', () => {
      useDispute("d1");
      expect(capturedOptions.queryKey).toEqual(["disputes", "d1"]);
    });

    it("should set enabled: true when id is truthy", () => {
      useDispute("d1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is undefined", () => {
      useDispute(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call disputeService.getDispute as queryFn", () => {
      useDispute("d1");
      capturedOptions.queryFn();
      expect(disputeService.getDispute).toHaveBeenCalledWith("d1");
    });
  });

  describe("useCreateDispute", () => {
    it("should call disputeService.createDispute as mutationFn", () => {
      useCreateDispute();
      const data = {
        loadId: "l1",
        type: "DAMAGE",
        description: "Cargo damaged",
      };
      capturedMutationOptions.mutationFn(data);
      expect(disputeService.createDispute).toHaveBeenCalledWith(data);
    });

    it('should invalidate ["disputes"] on success', () => {
      useCreateDispute();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["disputes"],
      });
    });
  });
});
