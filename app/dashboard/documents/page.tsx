/**
 * Documents Management Page
 *
 * Manage company and truck documents with upload and verification status.
 *
 * Features:
 * - Upload company documents (license, TIN certificate, etc.)
 * - Upload truck documents (registration, insurance, etc.)
 * - View document verification status
 * - Delete pending documents
 *
 * Sprint 8 - Story 8.5: Document Upload System - Phase 2 UI
 */

"use client";

import { useState } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import { CompanyDocumentType, TruckDocumentType } from "@prisma/client";

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<"company" | "truck">("company");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // TODO: Get actual organization/truck IDs from auth context
  // For MVP, using placeholders
  const organizationId = "test-org-id"; // PLACEHOLDER
  const truckId = "test-truck-id"; // PLACEHOLDER

  const handleUploadComplete = () => {
    // Trigger refresh of document list
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDocumentDeleted = () => {
    // Trigger refresh of document list
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload and manage your company and truck documents for verification.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("company")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "company"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Company Documents
          </button>
          <button
            onClick={() => setActiveTab("truck")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "truck"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Truck Documents
          </button>
        </nav>
      </div>

      {/* Company Documents Tab */}
      {activeTab === "company" && (
        <div className="space-y-8">
          {/* Info Box */}
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Upload your company documents to get verified. All documents will be
                  reviewed by our team within 24-48 hours.
                </p>
              </div>
            </div>
          </div>

          {/* Upload Sections */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Company License */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Company License
              </h3>
              <DocumentUpload
                entityType="company"
                entityId={organizationId}
                documentType={CompanyDocumentType.COMPANY_LICENSE}
                onUploadComplete={handleUploadComplete}
                helperText="Upload your company business license"
              />
            </div>

            {/* TIN Certificate */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                TIN Certificate
              </h3>
              <DocumentUpload
                entityType="company"
                entityId={organizationId}
                documentType={CompanyDocumentType.TIN_CERTIFICATE}
                onUploadComplete={handleUploadComplete}
                helperText="Upload your Tax Identification Number certificate"
              />
            </div>

            {/* VAT Certificate */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                VAT Certificate
              </h3>
              <DocumentUpload
                entityType="company"
                entityId={organizationId}
                documentType={CompanyDocumentType.VAT_CERTIFICATE}
                onUploadComplete={handleUploadComplete}
                helperText="Upload your VAT certificate (if applicable)"
              />
            </div>

            {/* Trade License */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Trade License
              </h3>
              <DocumentUpload
                entityType="company"
                entityId={organizationId}
                documentType={CompanyDocumentType.TRADE_LICENSE}
                onUploadComplete={handleUploadComplete}
                helperText="Upload your trade license"
              />
            </div>
          </div>

          {/* Uploaded Documents List */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Uploaded Documents
            </h3>
            <DocumentList
              entityType="company"
              entityId={organizationId}
              onDocumentDeleted={handleDocumentDeleted}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      )}

      {/* Truck Documents Tab */}
      {activeTab === "truck" && (
        <div className="space-y-8">
          {/* Info Box */}
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Upload truck documents to verify vehicle eligibility. Each truck
                  must have valid registration and insurance.
                </p>
              </div>
            </div>
          </div>

          {/* Upload Sections */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Registration */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Vehicle Registration
              </h3>
              <DocumentUpload
                entityType="truck"
                entityId={truckId}
                documentType={TruckDocumentType.REGISTRATION}
                onUploadComplete={handleUploadComplete}
                helperText="Upload vehicle registration certificate"
              />
            </div>

            {/* Insurance */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Insurance Certificate
              </h3>
              <DocumentUpload
                entityType="truck"
                entityId={truckId}
                documentType={TruckDocumentType.INSURANCE}
                onUploadComplete={handleUploadComplete}
                helperText="Upload valid insurance certificate"
              />
            </div>

            {/* Road Worthiness */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Road Worthiness Certificate
              </h3>
              <DocumentUpload
                entityType="truck"
                entityId={truckId}
                documentType={TruckDocumentType.ROAD_WORTHINESS}
                onUploadComplete={handleUploadComplete}
                helperText="Upload road worthiness/inspection certificate"
              />
            </div>

            {/* Title Deed */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Title Deed / Ownership
              </h3>
              <DocumentUpload
                entityType="truck"
                entityId={truckId}
                documentType={TruckDocumentType.TITLE_DEED}
                onUploadComplete={handleUploadComplete}
                helperText="Upload title deed or proof of ownership"
              />
            </div>
          </div>

          {/* Uploaded Documents List */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Uploaded Documents
            </h3>
            <DocumentList
              entityType="truck"
              entityId={truckId}
              onDocumentDeleted={handleDocumentDeleted}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      )}
    </div>
  );
}
