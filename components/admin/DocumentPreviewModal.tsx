/**
 * Document Preview Modal Component
 *
 * Modal for previewing PDF and image documents.
 *
 * Features:
 * - PDF viewer (embedded iframe)
 * - Image viewer
 * - Download link
 * - Document metadata display
 *
 * Sprint 8 - Story 8.9: Back-Office Verification Dashboard
 */

"use client";

import { VerificationStatus } from "@prisma/client";

interface Document {
  id: string;
  entityType: "company" | "truck";
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: VerificationStatus;
  uploadedAt: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  rejectionReason?: string | null;
  uploadedById: string;
  verifiedById?: string | null;
  organization: {
    id: string;
    name: string;
    contactEmail: string;
    contactPhone: string;
  };
  entity: {
    id: string;
    name: string;
  };
}

interface DocumentPreviewModalProps {
  document: Document;
  onClose: () => void;
}

export default function DocumentPreviewModal({
  document,
  onClose,
}: DocumentPreviewModalProps) {
  const isPDF = document.mimeType === "application/pdf";
  const isImage = document.mimeType.startsWith("image/");

  // Format document type
  const formatDocumentType = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-[#064d51]/50 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#064d51]/15">
            <div>
              <h3 className="text-lg font-medium text-[#064d51]">
                {formatDocumentType(document.type)}
              </h3>
              <p className="mt-1 text-sm text-[#064d51]/60">
                {document.organization.name} • {document.entity.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#064d51]/50 hover:text-[#064d51]"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Document Info */}
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-[#064d51]/80">File Name:</span>
                <span className="ml-2 text-[#064d51]">{document.fileName}</span>
              </div>
              <div>
                <span className="font-medium text-[#064d51]/80">File Size:</span>
                <span className="ml-2 text-[#064d51]">{formatFileSize(document.fileSize)}</span>
              </div>
              <div>
                <span className="font-medium text-[#064d51]/80">Document Type:</span>
                <span className="ml-2 text-[#064d51]">
                  {document.entityType === "company" ? "Company" : "Truck"}
                </span>
              </div>
              <div>
                <span className="font-medium text-[#064d51]/80">Uploaded:</span>
                <span className="ml-2 text-[#064d51]">
                  {new Date(document.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="border border-[#064d51]/15 rounded-lg overflow-hidden bg-[#f0fdfa]">
              {isPDF ? (
                <iframe
                  src={`/api${document.fileUrl}`}
                  className="w-full h-[600px]"
                  title="Document Preview"
                />
              ) : isImage ? (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={`/api${document.fileUrl}`}
                    alt={document.fileName}
                    className="max-w-full max-h-[600px] object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-[#064d51]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-[#064d51]/60">
                      Preview not available for this file type
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[#f0fdfa] border-t border-[#064d51]/15 flex justify-between">
            <a
              href={`/api${document.fileUrl}`}
              download={document.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-[#064d51]/20 text-sm font-medium rounded-md text-[#064d51]/80 bg-white hover:bg-[#f0fdfa]"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#1e9c99] hover:bg-[#064d51]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
