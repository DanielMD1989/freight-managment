'use client';

/**
 * Verification Queue Client Component
 *
 * Interactive document verification with approve/reject actions
 * Sprint 10 - Story 10.4: Document Verification Queue
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCSRFToken } from '@/lib/csrfFetch';

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
  entityType: 'company' | 'truck';
  entityName: string;
  organization: {
    id: string;
    name: string;
    type: string;
  };
  uploadedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  verifiedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Statistics {
  companyDocuments: number;
  truckDocuments: number;
  total: number;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending Review', color: 'yellow' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All Documents' },
  { value: 'company', label: 'Company Documents' },
  { value: 'truck', label: 'Truck Documents' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getUploaderName(uploader: Document['uploadedBy']): string {
  if (uploader.firstName && uploader.lastName) {
    return `${uploader.firstName} ${uploader.lastName}`;
  }
  return uploader.email;
}

export default function VerificationQueueClient({
  initialDocuments,
  pagination,
  statistics,
  initialStatus,
  initialEntityType,
}: {
  initialDocuments: Document[];
  pagination: Pagination;
  statistics: Statistics;
  initialStatus?: string;
  initialEntityType?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState(initialStatus || 'PENDING');
  const [entityTypeFilter, setEntityTypeFilter] = useState(
    initialEntityType || 'all'
  );
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle status filter change
   */
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', status);
    params.delete('page');
    router.push(`/admin/verification?${params.toString()}`);
  };

  /**
   * Handle entity type filter change
   */
  const handleEntityTypeChange = (entityType: string) => {
    setEntityTypeFilter(entityType);
    const params = new URLSearchParams(searchParams.toString());
    params.set('entityType', entityType);
    params.delete('page');
    router.push(`/admin/verification?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/admin/verification?${params.toString()}`);
  };

  /**
   * Handle document approval
   */
  const handleApprove = async (doc: Document) => {
    if (
      !confirm(
        `Are you sure you want to approve this ${doc.entityType} document for ${doc.organization.name}?`
      )
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        alert('Failed to get CSRF token. Please try again.');
        return;
      }

      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          entityType: doc.entityType,
          verificationStatus: 'APPROVED',
        }),
        credentials: 'include',
      });

      if (response.ok) {
        alert('Document approved successfully!');
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Failed to approve document: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error approving document:', error);
      alert('Failed to approve document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle document rejection
   */
  const handleReject = async (doc: Document) => {
    setSelectedDocument(doc);
    setRejectionReason('');
  };

  /**
   * Submit rejection
   */
  const submitRejection = async () => {
    if (!selectedDocument) return;

    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        alert('Failed to get CSRF token. Please try again.');
        return;
      }

      const response = await fetch(`/api/documents/${selectedDocument.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          entityType: selectedDocument.entityType,
          verificationStatus: 'REJECTED',
          rejectionReason: rejectionReason.trim(),
        }),
        credentials: 'include',
      });

      if (response.ok) {
        alert('Document rejected successfully!');
        setSelectedDocument(null);
        setRejectionReason('');
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Failed to reject document: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
      alert('Failed to reject document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Pending</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            {statistics.total}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Company Documents</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {statistics.companyDocuments}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Truck Documents</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {statistics.truckDocuments}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Filter by Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label
              htmlFor="entityType"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Filter by Type
            </label>
            <select
              id="entityType"
              value={entityTypeFilter}
              onChange={(e) => handleEntityTypeChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ENTITY_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upload Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  {/* Document */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {doc.type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {doc.fileName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatFileSize(doc.fileSize)} •{' '}
                        <span className="capitalize">
                          {doc.entityType}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Organization */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm">
                      <div className="font-medium text-gray-900">
                        {doc.organization.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {doc.organization.type.replace(/_/g, ' ')}
                      </div>
                      {doc.entityType === 'truck' && (
                        <div className="text-xs text-gray-400">
                          {doc.entityName.split(' - ')[1]}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Uploaded By */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {getUploaderName(doc.uploadedBy)}
                  </td>

                  {/* Upload Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(doc.uploadedAt)}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {doc.verificationStatus === 'PENDING' && (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                    {doc.verificationStatus === 'APPROVED' && (
                      <div className="flex flex-col">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Approved
                        </span>
                        {doc.verifiedAt && (
                          <span className="text-xs text-gray-500 mt-1">
                            {formatDate(doc.verifiedAt)}
                          </span>
                        )}
                      </div>
                    )}
                    {doc.verificationStatus === 'REJECTED' && (
                      <div className="flex flex-col">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Rejected
                        </span>
                        {doc.rejectionReason && (
                          <span className="text-xs text-gray-500 mt-1">
                            {doc.rejectionReason}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </a>
                    {doc.verificationStatus === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(doc)}
                          disabled={isSubmitting}
                          className="text-green-600 hover:text-green-900 mr-3 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(doc)}
                          disabled={isSubmitting}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

              {initialDocuments.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No documents found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-medium">{pagination.total}</span>{' '}
              documents
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Reject Document
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for rejecting this document. The user
                will be notified via email.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSelectedDocument(null);
                    setRejectionReason('');
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRejection}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Rejecting...' : 'Reject Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
