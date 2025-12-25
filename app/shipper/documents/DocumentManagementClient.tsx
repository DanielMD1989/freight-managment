'use client';

/**
 * Document Management Client Component
 *
 * Upload and manage company documents
 * Sprint 11 - Story 11.5: Document Management
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  { value: 'BUSINESS_LICENSE', label: 'Business License' },
  { value: 'TAX_CERTIFICATE', label: 'Tax Certificate' },
  { value: 'TRADE_PERMIT', label: 'Trade Permit' },
  { value: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'OTHER', label: 'Other Document' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
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
  const [uploadError, setUploadError] = useState('');

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('BUSINESS_LICENSE');

  /**
   * Get CSRF token
   */
  const getCSRFToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/csrf');
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return null;
    }
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File size must be less than 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ];
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Only PDF, JPG, and PNG files are allowed');
        return;
      }

      setSelectedFile(file);
      setUploadError('');
    }
  };

  /**
   * Handle file upload
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setUploadError('Failed to get CSRF token. Please try again.');
        setIsUploading(false);
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'company');
      formData.append('entityId', organizationId);
      formData.append('documentType', documentType);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        // Success - refresh the page to show new document
        router.refresh();
        setShowUploadForm(false);
        setSelectedFile(null);
      } else {
        const errorData = await response.json();
        setUploadError(errorData.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploadError('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Delete document
   */
  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        alert('Failed to get CSRF token. Please try again.');
        return;
      }

      const response = await fetch(
        `/api/documents/${documentId}?entityType=company`,
        {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
        }
      );

      if (response.ok) {
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  // Group documents by status
  const pendingDocs = documents.filter((d) => d.verificationStatus === 'PENDING');
  const approvedDocs = documents.filter((d) => d.verificationStatus === 'APPROVED');
  const rejectedDocs = documents.filter((d) => d.verificationStatus === 'REJECTED');

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Upload Document</h2>
          {!showUploadForm && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              + Upload New Document
            </button>
          )}
        </div>

        {showUploadForm && (
          <div className="border-t border-gray-200 pt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File *
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max file size: 10MB. Allowed formats: PDF, JPG, PNG
                </p>
              </div>

              {selectedFile && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
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
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-red-800 text-sm">{uploadError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </button>
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setSelectedFile(null);
                    setUploadError('');
                  }}
                  disabled={isUploading}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Documents Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Pending Review</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            {pendingDocs.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {approvedDocs.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {rejectedDocs.length}
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
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
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {doc.type.replace(/_/g, ' ')}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          doc.verificationStatus
                        )}`}
                      >
                        {doc.verificationStatus}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      {doc.fileName} • {formatFileSize(doc.fileSize)}
                    </div>

                    <div className="text-xs text-gray-500">
                      Uploaded: {formatDate(doc.uploadedAt)}
                      {doc.verifiedAt && (
                        <> • Verified: {formatDate(doc.verifiedAt)}</>
                      )}
                    </div>

                    {doc.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-xs text-red-800">
                          <strong>Rejection Reason:</strong> {doc.rejectionReason}
                        </p>
                      </div>
                    )}

                    {doc.expiresAt && (
                      <div className="mt-2 text-xs text-orange-600">
                        Expires: {formatDate(doc.expiresAt)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View
                    </a>
                    {doc.verificationStatus === 'PENDING' && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-700 font-medium"
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
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Documents Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Upload your company documents to get verified and start shipping.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
