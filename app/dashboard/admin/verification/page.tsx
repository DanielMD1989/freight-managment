/**
 * Admin Document Verification Dashboard
 *
 * Allows admin/ops users to review and verify uploaded documents.
 *
 * Features:
 * - View pending documents grouped by organization
 * - Document preview (PDF/image)
 * - Approve/reject actions with reason
 * - Filtering by status, organization, document type
 * - Pagination
 *
 * Sprint 8 - Story 8.9: Back-Office Verification Dashboard
 */

"use client";

import { useState, useEffect } from "react";
import DocumentVerificationTable from "@/components/admin/DocumentVerificationTable";
import DocumentPreviewModal from "@/components/admin/DocumentPreviewModal";
import VerificationActionModal from "@/components/admin/VerificationActionModal";
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
    isVerified: boolean;
  };
  entity: {
    id: string;
    name: string;
  };
}

export default function VerificationDashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "ALL">("PENDING");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"all" | "company" | "truck">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Modals
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [actionDocument, setActionDocument] = useState<Document | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  // Fetch documents
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((currentPage - 1) * limit).toString(),
        entityType: entityTypeFilter,
      });

      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/admin/verification/queue?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();

      // Filter by search query (client-side for now)
      let filteredDocs = data.documents || [];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredDocs = filteredDocs.filter((doc: Document) =>
          doc.organization.name.toLowerCase().includes(query)
        );
      }

      setDocuments(filteredDocs);
      setTotalCount(data.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchDocuments();
  }, [statusFilter, entityTypeFilter, currentPage]);

  // Handle search (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchDocuments();
      } else {
        setCurrentPage(1); // Reset to first page on search
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle verification action
  const handleVerificationComplete = () => {
    setActionDocument(null);
    setActionType(null);
    fetchDocuments(); // Refresh list
  };

  // Calculate stats
  const stats = {
    total: documents.length,
    pending: documents.filter((d) => d.verificationStatus === "PENDING").length,
    approved: documents.filter((d) => d.verificationStatus === "APPROVED").length,
    rejected: documents.filter((d) => d.verificationStatus === "REJECTED").length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
        <p className="mt-2 text-sm text-gray-600">
          Review and verify company and truck documents
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Documents</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-lg font-semibold text-yellow-600">{stats.pending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                  <dd className="text-lg font-semibold text-green-600">{stats.approved}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                  <dd className="text-lg font-semibold text-red-600">{stats.rejected}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | "ALL")}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value as "all" | "company" | "truck")}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Documents</option>
              <option value="company">Company Documents</option>
              <option value="truck">Truck Documents</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Organization
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Loading documents...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={fetchDocuments}
                className="mt-2 text-sm text-red-600 hover:text-red-500 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <DocumentVerificationTable
            documents={documents}
            onPreview={setPreviewDocument}
            onApprove={(doc) => {
              setActionDocument(doc);
              setActionType("approve");
            }}
            onReject={(doc) => {
              setActionDocument(doc);
              setActionType("reject");
            }}
          />
        )}
      </div>

      {/* Pagination */}
      {!loading && documents.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * limit >= totalCount}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * limit + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * limit, totalCount)}
                </span>{" "}
                of <span className="font-medium">{totalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage * limit >= totalCount}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {/* Verification Action Modal */}
      {actionDocument && actionType && (
        <VerificationActionModal
          document={actionDocument}
          action={actionType}
          onClose={() => {
            setActionDocument(null);
            setActionType(null);
          }}
          onComplete={handleVerificationComplete}
        />
      )}
    </div>
  );
}
