/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for organization hooks — query keys, enabled flags, queryFn wiring,
 * and cache invalidation
 */
import { organizationService } from "../../src/services/organization";

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

jest.mock("../../src/services/organization", () => ({
  organizationService: {
    getOrganization: jest.fn(),
    updateOrganization: jest.fn(),
  },
}));

import {
  useOrganization,
  useUpdateOrganization,
} from "../../src/hooks/useOrganization";

describe("Organization Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ---- useOrganization ----

  describe("useOrganization", () => {
    it('should use queryKey ["organization", id]', () => {
      useOrganization("org-1");
      expect(capturedOptions.queryKey).toEqual(["organization", "org-1"]);
    });

    it("should set enabled: true when id is a string", () => {
      useOrganization("org-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is null", () => {
      useOrganization(null);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set enabled: false when id is undefined", () => {
      useOrganization(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call organizationService.getOrganization as queryFn", () => {
      useOrganization("org-1");
      capturedOptions.queryFn();
      expect(organizationService.getOrganization).toHaveBeenCalledWith("org-1");
    });
  });

  // ---- useUpdateOrganization ----

  describe("useUpdateOrganization", () => {
    it("should call organizationService.updateOrganization as mutationFn", () => {
      useUpdateOrganization();
      capturedMutationOptions.mutationFn({
        id: "org-1",
        data: { name: "Updated" },
      });
      expect(organizationService.updateOrganization).toHaveBeenCalledWith(
        "org-1",
        { name: "Updated" }
      );
    });

    it('should invalidate ["organization", variables.id] on success (specific key)', () => {
      useUpdateOrganization();
      capturedMutationOptions.onSuccess({}, { id: "org-1", data: {} });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["organization", "org-1"],
      });
    });

    it("should NOT invalidate broadly (only specific org key)", () => {
      useUpdateOrganization();
      capturedMutationOptions.onSuccess({}, { id: "org-2", data: {} });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["organization", "org-2"],
      });
    });
  });
});
