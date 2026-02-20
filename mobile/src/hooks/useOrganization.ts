/**
 * Organization query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  organizationService,
  type UpdateOrganizationData,
} from "../services/organization";

const ORG_KEY = ["organization"] as const;

/** Fetch organization by ID */
export function useOrganization(id: string | null | undefined) {
  return useQuery({
    queryKey: [...ORG_KEY, id],
    queryFn: () => organizationService.getOrganization(id!),
    enabled: !!id,
  });
}

/** Update organization mutation */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrganizationData }) =>
      organizationService.updateOrganization(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...ORG_KEY, variables.id] });
    },
  });
}
