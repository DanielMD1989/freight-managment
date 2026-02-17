"use client";

/**
 * Document Management Client Component
 *
 * Upload and manage company documents
 * Sprint 11 - Story 11.5: Document Management
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: string;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
}

const DOCUMENT_TYPES = [
  { value: "BUSINESS_LICENSE", label: "Business License" },
  { value: "TAX_CERTIFICATE", label: "Tax Certificate" },
  { value: "TRADE_PERMIT", label: "Trade Permit" },
  { value: "INSURANCE_CERTIFICATE", label: "Insurance Certificate" },
  { value: "BANK_STATEMENT", label: "Bank Statement" },
  { value: "OTHER", label: "Other Document" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Status colors from StatusBadge.tsx (source of truth)
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-600",
    APPROVED: "bg-emerald-500/10 text-emerald-600",
    REJECTED: "bg-rose-500/10 text-rose-600",
  };
  return colors[status] || "bg-slate-500/10 text-slate-600";
}

export default function DocumentManagementClient({
  initialDocuments,
  organizationId,
}: {
  initialDocuments: Document[];
  organizationId: string;
}) {
  const router = useRouter();

  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("BUSINESS_LICENSE");

  // Insurance fields (shown when document type is INSURANCE_CERTIFICATE)
  const [policyNumber, setPolicyNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [coverageType, setCoverageType] = useState("");

  /**
   * Handle file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File size must be less than 10MB");
        return;
      }

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!allowedTypes.includes(file.type)) {
        setUploadError("Only PDF, JPG, and PNG files are allowed");
        return;
      }

      setSelectedFile(file);
      setUploadError("");
    }
  };

  /**
   * Handle file upload
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setUploadError("Failed to get CSRF token. Please try again.");
        setIsUploading(false);
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("entityType", "company");
      formData.append("entityId", organizationId);
      formData.append("type", documentType);

      // Append insurance fields if insurance document type
      if (documentType === "INSURANCE_CERTIFICATE") {
        if (policyNumber) formData.append("policyNumber", policyNumber);
        if (insuranceProvider)
          formData.append("insuranceProvider", insuranceProvider);
        if (coverageAmount) formData.append("coverageAmount", coverageAmount);
        if (coverageType) formData.append("coverageType", coverageType);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        // Success - refresh the page to show new document
        router.refresh();
        setShowUploadForm(false);
        setSelectedFile(null);
        setPolicyNumber("");
        setInsuranceProvider("");
        setCoverageAmount("");
        setCoverageType("");
      } else {
        const errorData = await response.json();
        setUploadError(errorData.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadError("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Delete document
   */
  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        alert("Failed to get CSRF token. Please try again.");
        return;
      }

      const response = await fetch(
        `/api/documents/${documentId}?entityType=company`,
        {
          method: "DELETE",
          headers: {
            ...(csrfToken && { "X-CSRF-Token": csrfToken }),
          },
          credentials: "include",
        }
      );

      if (response.ok) {
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document. Please try again.");
    }
  };

  // Group documents by status
  const pendingDocs = documents.filter(
    (d) => d.verificationStatus === "PENDING"
  );
  const approvedDocs = documents.filter(
    (d) => d.verificationStatus === "APPROVED"
  );
  const rejectedDocs = documents.filter(
    (d) => d.verificationStatus === "REJECTED"
  );

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Upload Document
          </h2>
          {!showUploadForm && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Upload New Document
            </button>
          )}
        </div>

        {showUploadForm && (
          <div className="border-t border-gray-200 pt-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Document Type *
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select File *
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Max file size: 10MB. Allowed formats: PDF, JPG, PNG
                </p>
              </div>

              {/* Insurance-specific fields */}
              {documentType === "INSURANCE_CERTIFICATE" && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-blue-800">
                      Insurance Details (optional)
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Policy Number
                    </label>
                    <input
                      type="text"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="e.g., POL-12345"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      placeholder="e.g., Ethiopian Insurance Corp."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Coverage Amount (ETB)
                    </label>
                    <input
                      type="number"
                      value={coverageAmount}
                      onChange={(e) => setCoverageAmount(e.target.value)}
                      placeholder="e.g., 500000"
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Coverage Type
                    </label>
                    <select
                      value={coverageType}
                      onChange={(e) => setCoverageType(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select type...</option>
                      <option value="CARGO">Cargo</option>
                      <option value="LIABILITY">Liability</option>
                      <option value="COMPREHENSIVE">Comprehensive</option>
                      <option value="THIRD_PARTY">Third Party</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedFile && (
                <div className="rounded border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-900">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-blue-700">
                        {formatFileSize(selectedFile.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="rounded border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">{uploadError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="flex-1 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Upload Document"}
                </button>
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setSelectedFile(null);
                    setUploadError("");
                  }}
                  disabled={isUploading}
                  className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Documents Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Pending Review</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {pendingDocs.length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {approvedDocs.length}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {rejectedDocs.length}
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">
            All Documents ({documents.length})
          </h2>
        </div>

        {documents.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">
                        {doc.type.replace(/_/g, " ")}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(
                          doc.verificationStatus
                        )}`}
                      >
                        {doc.verificationStatus}
                      </span>
                    </div>

                    <div className="mb-2 text-sm text-gray-600">
                      {doc.fileName} • {formatFileSize(doc.fileSize)}
                    </div>

                    <div className="text-xs text-gray-500">
                      Uploaded: {formatDate(doc.uploadedAt)}
                      {doc.verifiedAt && (
                        <> • Verified: {formatDate(doc.verifiedAt)}</>
                      )}
                    </div>

                    {doc.rejectionReason && (
                      <div className="mt-2 rounded border border-red-200 bg-red-50 p-2">
                        <p className="text-xs text-red-800">
                          <strong>Rejection Reason:</strong>{" "}
                          {doc.rejectionReason}
                        </p>
                      </div>
                    )}

                    {doc.expiresAt && (
                      <div className="mt-2 text-xs text-orange-600">
                        Expires: {formatDate(doc.expiresAt)}
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex gap-2">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View
                    </a>
                    {doc.verificationStatus === "PENDING" && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="mb-4 text-6xl">📄</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              No Documents Yet
            </h3>
            <p className="mb-6 text-gray-600">
              Upload your company documents to get verified and start shipping.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
