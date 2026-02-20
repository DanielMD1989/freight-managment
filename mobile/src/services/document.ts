/**
 * Document Service - API calls for company document management
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface CompanyDocument {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType?: string;
  verificationStatus: string;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
  policyNumber: string | null;
  insuranceProvider: string | null;
  coverageAmount: number | null;
  coverageType: string | null;
}

export interface DocumentsResponse {
  documents: CompanyDocument[];
  total: number;
  entityType: string;
  entityId: string;
}

class DocumentService {
  /** Get documents for an entity */
  async getDocuments(params: {
    entityType: "company" | "truck";
    entityId: string;
    type?: string;
    status?: string;
  }): Promise<DocumentsResponse> {
    try {
      const response = await apiClient.get("/api/documents", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Upload a document */
  async uploadDocument(
    formData: FormData
  ): Promise<{ document: CompanyDocument; message: string }> {
    try {
      const response = await apiClient.post("/api/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Delete a document */
  async deleteDocument(
    id: string,
    entityType: "company" | "truck"
  ): Promise<void> {
    try {
      await apiClient.delete(`/api/documents/${id}`, {
        params: { entityType },
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const documentService = new DocumentService();
