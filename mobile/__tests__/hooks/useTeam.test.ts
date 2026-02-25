/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for team management hooks — query keys, enabled flags, queryFn wiring,
 * and cache invalidation for all 5 hooks
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
    getMembers: jest.fn(),
    getInvitations: jest.fn(),
    inviteMember: jest.fn(),
    removeMember: jest.fn(),
    cancelInvitation: jest.fn(),
  },
}));

import {
  useTeamMembers,
  useTeamInvitations,
  useInviteMember,
  useRemoveMember,
  useCancelInvitation,
} from "../../src/hooks/useTeam";

describe("Team Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ---- useTeamMembers ----

  describe("useTeamMembers", () => {
    it('should use queryKey ["team", orgId, "members"]', () => {
      useTeamMembers("org-1");
      expect(capturedOptions.queryKey).toEqual(["team", "org-1", "members"]);
    });

    it("should set enabled: true when orgId is truthy", () => {
      useTeamMembers("org-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when orgId is null", () => {
      useTeamMembers(null);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set enabled: false when orgId is undefined", () => {
      useTeamMembers(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call organizationService.getMembers as queryFn", () => {
      useTeamMembers("org-1");
      capturedOptions.queryFn();
      expect(organizationService.getMembers).toHaveBeenCalledWith("org-1");
    });
  });

  // ---- useTeamInvitations ----

  describe("useTeamInvitations", () => {
    it('should use queryKey ["team", orgId, "invitations"]', () => {
      useTeamInvitations("org-2");
      expect(capturedOptions.queryKey).toEqual([
        "team",
        "org-2",
        "invitations",
      ]);
    });

    it("should set enabled: true when orgId is truthy", () => {
      useTeamInvitations("org-2");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when orgId is undefined", () => {
      useTeamInvitations(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call organizationService.getInvitations as queryFn", () => {
      useTeamInvitations("org-2");
      capturedOptions.queryFn();
      expect(organizationService.getInvitations).toHaveBeenCalledWith("org-2");
    });
  });

  // ---- useInviteMember ----

  describe("useInviteMember", () => {
    it("should call organizationService.inviteMember(orgId, data) as mutationFn", () => {
      useInviteMember();
      capturedMutationOptions.mutationFn({
        orgId: "org-1",
        data: { email: "new@test.com", role: "CARRIER" },
      });
      expect(organizationService.inviteMember).toHaveBeenCalledWith("org-1", {
        email: "new@test.com",
        role: "CARRIER",
      });
    });

    it('should invalidate ["team"] on success', () => {
      useInviteMember();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["team"],
      });
    });
  });

  // ---- useRemoveMember ----

  describe("useRemoveMember", () => {
    it("should call organizationService.removeMember(orgId, userId) as mutationFn", () => {
      useRemoveMember();
      capturedMutationOptions.mutationFn({
        orgId: "org-1",
        userId: "user-42",
      });
      expect(organizationService.removeMember).toHaveBeenCalledWith(
        "org-1",
        "user-42"
      );
    });

    it('should invalidate ["team"] on success', () => {
      useRemoveMember();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["team"],
      });
    });
  });

  // ---- useCancelInvitation ----

  describe("useCancelInvitation", () => {
    it("should call organizationService.cancelInvitation(orgId, invitationId) as mutationFn", () => {
      useCancelInvitation();
      capturedMutationOptions.mutationFn({
        orgId: "org-1",
        invitationId: "inv-99",
      });
      expect(organizationService.cancelInvitation).toHaveBeenCalledWith(
        "org-1",
        "inv-99"
      );
    });

    it('should invalidate ["team"] on success', () => {
      useCancelInvitation();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["team"],
      });
    });
  });
});
