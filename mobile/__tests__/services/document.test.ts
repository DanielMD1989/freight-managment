/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for document service — document CRUD operations
 */
import { documentService } from "../../src/services/document";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Document Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDocuments", () => {
    it("should call GET /api/documents with entityType and entityId params", async () => {
      const mockData = {
        documents: [
          { id: "d1", type: "BUSINESS_LICENSE", fileName: "license.pdf" },
        ],
        total: 1,
        entityType: "company",
        entityId: "c1",
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await documentService.getDocuments({
        entityType: "company",
        entityId: "c1",
      });
      expect(mockGet).toHaveBeenCalledWith("/api/documents", {
        params: { entityType: "company", entityId: "c1" },
      });
      expect(result.documents).toHaveLength(1);
    });

    it("should pass optional type and status filters", async () => {
      mockGet.mockResolvedValue({
        data: { documents: [], total: 0, entityType: "truck", entityId: "t1" },
      });

      await documentService.getDocuments({
        entityType: "truck",
        entityId: "t1",
        type: "INSURANCE",
        status: "VERIFIED",
      });
      expect(mockGet).toHaveBeenCalledWith("/api/documents", {
        params: {
          entityType: "truck",
          entityId: "t1",
          type: "INSURANCE",
          status: "VERIFIED",
        },
      });
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(
        documentService.getDocuments({ entityType: "company", entityId: "c1" })
      ).rejects.toThrow("Not found");
    });
  });

  describe("uploadDocument", () => {
    it("should call POST /api/documents/upload with FormData", async () => {
      const formData = new FormData();
      const mockData = {
        document: {
          id: "d1",
          type: "BUSINESS_LICENSE",
          fileName: "license.pdf",
        },
        message: "Document uploaded",
      };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await documentService.uploadDocument(formData);
      expect(mockPost).toHaveBeenCalledWith("/api/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      expect(result.document.id).toBe("d1");
      expect(result.message).toBe("Document uploaded");
    });

    it('should set Content-Type to "multipart/form-data"', async () => {
      const formData = new FormData();
      mockPost.mockResolvedValue({
        data: { document: { id: "d1" }, message: "OK" },
      });

      await documentService.uploadDocument(formData);
      const callArgs = mockPost.mock.calls[0];
      expect(callArgs[2]).toEqual({
        headers: { "Content-Type": "multipart/form-data" },
      });
    });

    it("should return { document, message } shape", async () => {
      const formData = new FormData();
      mockPost.mockResolvedValue({
        data: {
          document: { id: "d1", type: "INSURANCE", fileName: "ins.pdf" },
          message: "Uploaded successfully",
        },
      });

      const result = await documentService.uploadDocument(formData);
      expect(result).toEqual(
        expect.objectContaining({
          document: expect.objectContaining({ id: "d1" }),
          message: expect.any(String),
        })
      );
    });

    it("should propagate errors", async () => {
      const formData = new FormData();
      mockPost.mockRejectedValue(new Error("File too large"));

      await expect(documentService.uploadDocument(formData)).rejects.toThrow(
        "File too large"
      );
    });
  });

  describe("deleteDocument", () => {
    it("should call DELETE /api/documents/:id with entityType query param", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await documentService.deleteDocument("d1", "company");
      expect(mockDelete).toHaveBeenCalledWith("/api/documents/d1", {
        params: { entityType: "company" },
      });
    });

    it("should pass truck entityType correctly", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await documentService.deleteDocument("d2", "truck");
      expect(mockDelete).toHaveBeenCalledWith("/api/documents/d2", {
        params: { entityType: "truck" },
      });
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Forbidden"));

      await expect(
        documentService.deleteDocument("d1", "company")
      ).rejects.toThrow("Forbidden");
    });
  });
});
