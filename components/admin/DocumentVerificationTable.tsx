/**
 * Document Verification Table Component
 *
 * Displays documents in a table with verification actions.
 *
 * Features:
 * - Document information display
 * - Organization grouping
 * - Status badges
 * - Quick actions (preview, approve, reject)
 *
 * Sprint 8 - Story 8.9: Back-Office Verification Dashboard
 */

"use client";

import { VerificationStatus } from "@prisma/client";
import DocumentStatusBadge from "../DocumentStatusBadge";

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
    isVerified: boolean;
  };
  entity: {
    id: string;
    name: string;
  };
}

interface DocumentVerificationTableProps {
  documents: Document[];
  onPreview: (document: Document) => void;
  onApprove: (document: Document) => void;
  onReject: (document: Document) => void;
}

export default function DocumentVerificationTable({
  documents,
  onPreview,
  onApprove,
  onReject,
}: DocumentVerificationTableProps) {
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

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50">
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your filters or search query.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Organization
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Document
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Uploaded
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              {/* Organization */}
              <td className="px-6 py-4">
                <div className="flex items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">
                        {doc.organization.name}
                      </div>
                      {doc.organization.isVerified && (
                        <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{doc.organization.contactEmail}</div>
                  </div>
                </div>
              </td>

              {/* Document */}
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{doc.entity.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <span>{formatDocumentType(doc.type)}</span>
                  <span>•</span>
                  <span>{formatFileSize(doc.fileSize)}</span>
                </div>
              </td>

              {/* Type */}
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  doc.entityType === "company"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {doc.entityType === "company" ? "Company" : "Truck"}
                </span>
              </td>

              {/* Uploaded */}
              <td className="px-6 py-4 text-sm text-gray-500">
                {formatDate(doc.uploadedAt)}
              </td>

              {/* Status */}
              <td className="px-6 py-4">
                <DocumentStatusBadge status={doc.verificationStatus} size="sm" />
                {doc.rejectionReason && (
                  <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={doc.rejectionReason}>
                    {doc.rejectionReason}
                  </div>
                )}
              </td>

              {/* Actions */}
              <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                <button
                  onClick={() => onPreview(doc)}
                  className="text-blue-600 hover:text-blue-900"
                  title="Preview document"
                >
                  <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>

                {doc.verificationStatus === "PENDING" && (
                  <>
                    <button
                      onClick={() => onApprove(doc)}
                      className="text-green-600 hover:text-green-900"
                      title="Approve document"
                    >
                      <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onReject(doc)}
                      className="text-red-600 hover:text-red-900"
                      title="Reject document"
                    >
                      <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
