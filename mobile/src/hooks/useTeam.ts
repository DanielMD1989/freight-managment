/**
 * Team management hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationService } from "../services/organization";

const TEAM_KEY = ["team"] as const;

export function useTeamMembers(orgId: string | null | undefined) {
  return useQuery({
    queryKey: [...TEAM_KEY, orgId, "members"],
    queryFn: () => organizationService.getMembers(orgId!),
    enabled: !!orgId,
  });
}

export function useTeamInvitations(orgId: string | null | undefined) {
  return useQuery({
    queryKey: [...TEAM_KEY, orgId, "invitations"],
    queryFn: () => organizationService.getInvitations(orgId!),
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      data,
    }: {
      orgId: string;
      data: { email: string; role: string };
    }) => organizationService.inviteMember(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      organizationService.removeMember(orgId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      invitationId,
    }: {
      orgId: string;
      invitationId: string;
    }) => organizationService.cancelInvitation(orgId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    },
  });
}
