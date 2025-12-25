/**
 * Document List Component
 *
 * Displays a list of uploaded documents with status badges and actions.
 *
 * Features:
 * - Document preview links
 * - Status badges (pending, approved, rejected)
 * - Delete action for pending documents
 * - File size and upload date display
 * - Empty state when no documents
 *
 * Sprint 8 - Story 8.5: Document Upload System - Phase 2 UI
 */

"use client";

import { useState, useEffect } from "react";
import DocumentStatusBadge from "./DocumentStatusBadge";
import { VerificationStatus } from "@prisma/client";

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  verificationStatus: VerificationStatus;
  uploadedAt: string;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
}

interface DocumentListProps {
  entityType: "company" | "truck";
  entityId: string;
  onDocumentDeleted?: () => void;
  refreshTrigger?: number; // Change this to trigger refresh
}

export default function DocumentList({
  entityType,
  entityId,
  onDocumentDeleted,
  refreshTrigger = 0,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch documents
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/documents?entityType=${entityType}&entityId=${entityId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  // Delete document
  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    setDeletingId(documentId);

    try {
      const response = await fetch(
        `/api/documents/${documentId}?entityType=${entityType}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      // Remove from list
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));

      if (onDocumentDeleted) {
        onDocumentDeleted();
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format document type
  const formatDocumentType = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Fetch on mount and when refreshTrigger changes
  useEffect(() => {
    fetchDocuments();
  }, [entityType, entityId, refreshTrigger]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-2 text-sm text-gray-600">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={fetchDocuments}
          className="mt-2 text-sm text-red-600 hover:text-red-500 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload your first document to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {/* File Icon */}
              <div className="flex-shrink-0">
                {doc.fileName.endsWith(".pdf") ? (
                  <svg className="h-10 w-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                ) : (
                  <svg className="h-10 w-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {formatDocumentType(doc.type)}
                  </p>
                  <DocumentStatusBadge status={doc.verificationStatus} size="sm" />
                </div>
                <p className="text-xs text-gray-500 truncate">{doc.fileName}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>•</span>
                  <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                </div>
                {doc.rejectionReason && (
                  <p className="mt-1 text-xs text-red-600">
                    Reason: {doc.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* View/Download Button */}
            <a
              href={`/api${doc.fileUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </a>

            {/* Delete Button (only for pending documents) */}
            {doc.verificationStatus === "PENDING" && (
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === doc.id ? (
                  <>
                    <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-red-600 border-r-transparent" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
