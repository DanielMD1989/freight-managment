/**
 * Truck Details Page
 *
 * Displays individual truck information and allows document upload.
 *
 * Features:
 * - View truck details (type, capacity, location, GPS status)
 * - Upload truck documents (registration, insurance, etc.)
 * - View uploaded documents
 * - Edit truck link
 */

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TruckDocumentType } from "@prisma/client";
import DocumentUpload from "@/components/DocumentUpload";

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  volume?: number | null;
  currentCity?: string | null;
  currentRegion?: string | null;
  isAvailable: boolean;
  status: string;
  approvalStatus: string;
  createdAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  gpsDevice?: {
    id: string;
    imei: string;
    provider: string;
    status: string;
  } | null;
}

interface TruckDocument {
  id: string;
  type: TruckDocumentType;
  fileName: string;
  fileUrl: string;
  verificationStatus: string;
  createdAt: string;
}

const TRUCK_DOCUMENT_TYPES: { value: TruckDocumentType; label: string; description: string }[] = [
  { value: "TITLE_DEED", label: "Title Deed", description: "Proof of truck ownership" },
  { value: "REGISTRATION", label: "Vehicle Registration", description: "Official vehicle registration document" },
  { value: "INSURANCE", label: "Insurance Certificate", description: "Valid insurance coverage document" },
  { value: "ROAD_WORTHINESS", label: "Road Worthiness", description: "Road worthiness certification" },
  { value: "DRIVER_LICENSE", label: "Driver License", description: "Driver's license for this truck" },
  { value: "OTHER", label: "Other Document", description: "Any other relevant document" },
];

export default function TruckDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [documents, setDocuments] = useState<TruckDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<TruckDocumentType>("REGISTRATION");

  useEffect(() => {
    fetchTruck();
    fetchDocuments();
  }, [resolvedParams.id]);

  const fetchTruck = async () => {
    try {
      const response = await fetch(`/api/trucks/${resolvedParams.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Truck not found");
        }
        throw new Error("Failed to fetch truck details");
      }
      const data = await response.json();
      setTruck(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?entityType=truck&entityId=${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const handleDocumentUpload = (document: TruckDocument) => {
    setDocuments((prev) => [...prev, document]);
  };

  // Status colors from StatusBadge.tsx (source of truth)
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "AVAILABLE":
        return "bg-emerald-500/10 text-emerald-600";
      case "IN_TRANSIT":
      case "ON_JOB":
        return "bg-indigo-500/10 text-indigo-600";
      case "MAINTENANCE":
        return "bg-amber-500/10 text-amber-600";
      case "INACTIVE":
        return "bg-gray-500/10 text-gray-600";
      default:
        return "bg-slate-500/10 text-slate-600";
    }
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-500/10 text-emerald-600";
      case "PENDING":
        return "bg-amber-500/10 text-amber-600";
      case "REJECTED":
        return "bg-rose-500/10 text-rose-600";
      default:
        return "bg-slate-500/10 text-slate-600";
    }
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-emerald-500/10 text-emerald-600";
      case "PENDING":
        return "bg-amber-500/10 text-amber-600";
      case "REJECTED":
        return "bg-rose-500/10 text-rose-600";
      default:
        return "bg-slate-500/10 text-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error || "Truck not found"}</p>
          <Link
            href="/carrier/trucks"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to My Trucks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{truck.licensePlate}</h1>
            <p className="text-gray-500">Truck Details</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/carrier/trucks/${truck.id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Edit Truck
            </Link>
            <Link
              href="/carrier/trucks"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      {/* Truck Details Card */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Truck Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Type</p>
            <p className="font-medium">{truck.truckType.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Capacity</p>
            <p className="font-medium">{truck.capacity.toLocaleString()} kg</p>
          </div>
          {truck.volume && (
            <div>
              <p className="text-sm text-gray-500">Volume</p>
              <p className="font-medium">{truck.volume} m³</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Location</p>
            <p className="font-medium">{truck.currentCity || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Region</p>
            <p className="font-medium">{truck.currentRegion || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(truck.status)}`}>
              {truck.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Approval Status</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getApprovalStatusColor(truck.approvalStatus)}`}>
              {truck.approvalStatus}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Availability</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${truck.isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
              {truck.isAvailable ? "Available" : "Not Available"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Added</p>
            <p className="font-medium">{new Date(truck.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* GPS Device Info */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-md font-semibold mb-3">GPS Device</h3>
          {truck.gpsDevice ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">IMEI</p>
                <p className="font-medium">{truck.gpsDevice.imei}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Provider</p>
                <p className="font-medium">{truck.gpsDevice.provider}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${truck.gpsDevice.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                  {truck.gpsDevice.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No GPS device configured</p>
          )}
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Documents</h2>

        {/* Existing Documents */}
        {documents.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium mb-3">Uploaded Documents</h3>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{doc.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500">{doc.fileName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getVerificationStatusColor(doc.verificationStatus)}`}>
                      {doc.verificationStatus}
                    </span>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload New Document */}
        <div>
          <h3 className="text-md font-medium mb-3">Upload New Document</h3>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-2">Document Type</label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as TruckDocumentType)}
              className="w-full md:w-64 p-2 border rounded-md"
            >
              {TRUCK_DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {TRUCK_DOCUMENT_TYPES.find((t) => t.value === selectedDocType)?.description}
            </p>
          </div>
          <DocumentUpload
            entityType="truck"
            entityId={truck.id}
            documentType={selectedDocType}
            onUploadComplete={handleDocumentUpload}
            helperText="Upload vehicle registration, insurance, or inspection documents"
          />
        </div>
      </div>

      {/* Carrier Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Carrier Information</h2>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gray-100 rounded-full">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="font-medium">{truck.carrier.name}</p>
            <div className="flex items-center gap-2 mt-1">
              {truck.carrier.isVerified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified Carrier
                </span>
              ) : (
                <span className="text-xs text-gray-500">Unverified</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
