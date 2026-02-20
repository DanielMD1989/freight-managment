/**
 * Document query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentService } from "../services/document";

const DOCS_KEY = ["documents"] as const;

/** Fetch documents */
export function useDocuments(params: {
  entityType: "company" | "truck";
  entityId: string | null | undefined;
}) {
  return useQuery({
    queryKey: [...DOCS_KEY, params.entityType, params.entityId],
    queryFn: () =>
      documentService.getDocuments({
        entityType: params.entityType,
        entityId: params.entityId!,
      }),
    enabled: !!params.entityId,
  });
}

/** Upload document mutation */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      documentService.uploadDocument(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCS_KEY });
    },
  });
}

/** Delete document mutation */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      entityType,
    }: {
      id: string;
      entityType: "company" | "truck";
    }) => documentService.deleteDocument(id, entityType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCS_KEY });
    },
  });
}
