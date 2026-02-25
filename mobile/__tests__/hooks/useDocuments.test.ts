/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for document query hooks — verify query keys, enabled flags,
 * and cache invalidation
 */
import { documentService } from "../../src/services/document";

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

jest.mock("../../src/services/document", () => ({
  documentService: {
    getDocuments: jest.fn(),
    uploadDocument: jest.fn(),
    deleteDocument: jest.fn(),
  },
}));

import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "../../src/hooks/useDocuments";

describe("Document Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  describe("useDocuments", () => {
    it('should use queryKey ["documents", entityType, entityId]', () => {
      useDocuments({ entityType: "company", entityId: "c1" });
      expect(capturedOptions.queryKey).toEqual(["documents", "company", "c1"]);
    });

    it("should set enabled: true when entityId is truthy", () => {
      useDocuments({ entityType: "company", entityId: "c1" });
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when entityId is null", () => {
      useDocuments({ entityType: "company", entityId: null });
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set enabled: false when entityId is undefined", () => {
      useDocuments({ entityType: "truck", entityId: undefined });
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call documentService.getDocuments as queryFn", () => {
      useDocuments({ entityType: "truck", entityId: "t1" });
      capturedOptions.queryFn();
      expect(documentService.getDocuments).toHaveBeenCalledWith({
        entityType: "truck",
        entityId: "t1",
      });
    });
  });

  describe("useUploadDocument", () => {
    it("should call documentService.uploadDocument as mutationFn", () => {
      useUploadDocument();
      const formData = new FormData();
      capturedMutationOptions.mutationFn(formData);
      expect(documentService.uploadDocument).toHaveBeenCalledWith(formData);
    });

    it('should invalidate ["documents"] on success', () => {
      useUploadDocument();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["documents"],
      });
    });
  });

  describe("useDeleteDocument", () => {
    it("should call documentService.deleteDocument as mutationFn", () => {
      useDeleteDocument();
      capturedMutationOptions.mutationFn({
        id: "d1",
        entityType: "company" as const,
      });
      expect(documentService.deleteDocument).toHaveBeenCalledWith(
        "d1",
        "company"
      );
    });

    it('should invalidate ["documents"] on success', () => {
      useDeleteDocument();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["documents"],
      });
    });
  });
});
