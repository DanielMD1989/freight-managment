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

const TRUCK_DOCUMENT_TYPES: {
  value: TruckDocumentType;
  label: string;
  description: string;
}[] = [
  {
    value: "TITLE_DEED",
    label: "Title Deed",
    description: "Proof of truck ownership",
  },
  {
    value: "REGISTRATION",
    label: "Vehicle Registration",
    description: "Official vehicle registration document",
  },
  {
    value: "INSURANCE",
    label: "Insurance Certificate",
    description: "Valid insurance coverage document",
  },
  {
    value: "ROAD_WORTHINESS",
    label: "Road Worthiness",
    description: "Road worthiness certification",
  },
  {
    value: "DRIVER_LICENSE",
    label: "Driver License",
    description: "Driver's license for this truck",
  },
  {
    value: "OTHER",
    label: "Other Document",
    description: "Any other relevant document",
  },
];

export default function TruckDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [documents, setDocuments] = useState<TruckDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] =
    useState<TruckDocumentType>("REGISTRATION");

  // Insurance fields (shown when document type is INSURANCE)
  const [policyNumber, setPolicyNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [coverageType, setCoverageType] = useState("");

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
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        `/api/documents?entityType=truck&entityId=${resolvedParams.id}`
      );
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
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="mb-8 h-4 w-1/2 rounded bg-gray-200"></div>
          <div className="space-y-4">
            <div className="h-32 rounded bg-gray-200"></div>
            <div className="h-32 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-800">Error</h2>
          <p className="mb-4 text-red-600">{error || "Truck not found"}</p>
          <Link
            href="/carrier/trucks"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to My Trucks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {truck.licensePlate}
            </h1>
            <p className="text-gray-500">Truck Details</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/carrier/trucks/${truck.id}/edit`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Edit Truck
            </Link>
            <Link
              href="/carrier/trucks"
              className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      {/* Truck Details Card */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Truck Information</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
            <span
              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(truck.status)}`}
            >
              {truck.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Approval Status</p>
            <span
              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getApprovalStatusColor(truck.approvalStatus)}`}
            >
              {truck.approvalStatus}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Availability</p>
            <span
              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${truck.isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
            >
              {truck.isAvailable ? "Available" : "Not Available"}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Added</p>
            <p className="font-medium">
              {new Date(truck.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* GPS Device Info */}
        <div className="mt-6 border-t pt-4">
          <h3 className="text-md mb-3 font-semibold">GPS Device</h3>
          {truck.gpsDevice ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${truck.gpsDevice.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                >
                  {truck.gpsDevice.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No GPS device configured</p>
          )}
        </div>
      </div>

      {/* Documents Section */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Documents</h2>

        {/* Existing Documents */}
        {documents.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md mb-3 font-medium">Uploaded Documents</h3>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-blue-100 p-2">
                      <svg
                        className="h-5 w-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {doc.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-500">{doc.fileName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getVerificationStatusColor(doc.verificationStatus)}`}
                    >
                      {doc.verificationStatus}
                    </span>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
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
          <h3 className="text-md mb-3 font-medium">Upload New Document</h3>
          <div className="mb-4">
            <label className="mb-2 block text-sm text-gray-600">
              Document Type
            </label>
            <select
              value={selectedDocType}
              onChange={(e) =>
                setSelectedDocType(e.target.value as TruckDocumentType)
              }
              className="w-full rounded-md border p-2 md:w-64"
            >
              {TRUCK_DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {
                TRUCK_DOCUMENT_TYPES.find((t) => t.value === selectedDocType)
                  ?.description
              }
            </p>
          </div>
          {/* Insurance-specific fields (shown when INSURANCE is selected) */}
          {selectedDocType === "INSURANCE" && (
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-blue-800">
                  Insurance Details (optional)
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Policy Number
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="e.g., POL-12345"
                  className="w-full rounded-md border p-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="e.g., Ethiopian Insurance Corp."
                  className="w-full rounded-md border p-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Coverage Amount (ETB)
                </label>
                <input
                  type="number"
                  value={coverageAmount}
                  onChange={(e) => setCoverageAmount(e.target.value)}
                  placeholder="e.g., 500000"
                  min="0"
                  className="w-full rounded-md border p-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Coverage Type
                </label>
                <select
                  value={coverageType}
                  onChange={(e) => setCoverageType(e.target.value)}
                  className="w-full rounded-md border p-2 text-sm"
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
          <DocumentUpload
            entityType="truck"
            entityId={truck.id}
            documentType={selectedDocType}
            onUploadComplete={(doc) => {
              handleDocumentUpload(doc);
              // Reset insurance fields after upload
              setPolicyNumber("");
              setInsuranceProvider("");
              setCoverageAmount("");
              setCoverageType("");
            }}
            helperText="Upload vehicle registration, insurance, or inspection documents"
            extraFormData={
              selectedDocType === "INSURANCE"
                ? {
                    policyNumber,
                    insuranceProvider,
                    coverageAmount,
                    coverageType,
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* Carrier Info */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Carrier Information</h2>
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-gray-100 p-3">
            <svg
              className="h-6 w-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium">{truck.carrier.name}</p>
            <div className="mt-1 flex items-center gap-2">
              {truck.carrier.isVerified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
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
