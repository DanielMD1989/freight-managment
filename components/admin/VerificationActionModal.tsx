/**
 * Verification Action Modal Component
 *
 * Modal for approving or rejecting documents with confirmation.
 *
 * Features:
 * - Approve confirmation
 * - Reject with required reason
 * - Optional expiration date setting
 * - API integration
 *
 * Sprint 8 - Story 8.9: Back-Office Verification Dashboard
 */

"use client";

import { useState } from "react";
import { VerificationStatus } from "@prisma/client";

interface Document {
  id: string;
  entityType: "company" | "truck";
  type: string;
  fileName: string;
  uploadedById: string;
  verifiedById?: string | null;
  organization: {
    id: string;
    name: string;
  };
  entity: {
    id: string;
    name: string;
  };
}

interface VerificationActionModalProps {
  document: Document;
  action: "approve" | "reject";
  onClose: () => void;
  onComplete: () => void;
}

export default function VerificationActionModal({
  document,
  action,
  onClose,
  onComplete,
}: VerificationActionModalProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApprove = action === "approve";

  // Format document type
  const formatDocumentType = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate rejection reason
    if (!isApprove && !rejectionReason.trim()) {
      setError("Rejection reason is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/verification/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityType: document.entityType,
          verificationStatus: isApprove ? "APPROVED" : "REJECTED",
          rejectionReason: !isApprove ? rejectionReason.trim() : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update document");
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to update document");
    } finally {
      setLoading(false);
    }
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#064d51]/15">
              <h3 className="text-lg font-medium text-[#064d51]">
                {isApprove ? "Approve Document" : "Reject Document"}
              </h3>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Document Info */}
              <div className="bg-[#f0fdfa] rounded-lg p-4">
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium text-[#064d51]/80">Organization:</span>
                    <span className="ml-2 text-[#064d51]">{document.organization.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[#064d51]/80">Document:</span>
                    <span className="ml-2 text-[#064d51]">{formatDocumentType(document.type)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[#064d51]/80">Entity:</span>
                    <span className="ml-2 text-[#064d51]">{document.entity.name}</span>
                  </div>
                </div>
              </div>

              {/* Confirmation Message */}
              {isApprove ? (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-green-800">
                        This document will be marked as <strong>APPROVED</strong>. The organization will be notified.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">
                        This document will be marked as <strong>REJECTED</strong>. Please provide a reason for rejection.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {!isApprove && (
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="block w-full rounded-md border-[#064d51]/20 shadow-sm focus:border-red-500 focus:ring-red-500"
                    placeholder="Explain why this document is being rejected..."
                    required
                  />
                  <p className="mt-1 text-xs text-[#064d51]/60">
                    This reason will be visible to the organization.
                  </p>
                </div>
              )}

              {/* Expiration Date (Optional) */}
              {isApprove && (
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-2">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="block w-full rounded-md border-[#064d51]/20 shadow-sm focus:border-[#1e9c99] focus:ring-[#1e9c99]"
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <p className="mt-1 text-xs text-[#064d51]/60">
                    Set an expiration date for documents that need periodic renewal.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#f0fdfa] border-t border-[#064d51]/15 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-[#064d51]/20 text-sm font-medium rounded-md text-[#064d51]/80 bg-white hover:bg-[#f0fdfa] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  isApprove
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } disabled:opacity-50`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : isApprove ? (
                  "Approve Document"
                ) : (
                  "Reject Document"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
