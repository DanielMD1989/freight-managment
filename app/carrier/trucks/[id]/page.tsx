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

import { useCallback, useState, useEffect, use } from "react";
import Link from "next/link";
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
  rejectionReason?: string | null;
  documentsLockedAt: string | null;
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

function formatTruckType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TruckDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
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

  const fetchTruck = useCallback(async () => {
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
  }, [resolvedParams.id]);

  const fetchDocuments = useCallback(async () => {
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
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchTruck();
    fetchDocuments();
  }, [fetchTruck, fetchDocuments]);

  const handleDocumentUpload = (document: TruckDocument) => {
    setDocuments((prev) => [...prev, document]);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-48 rounded-xl bg-slate-200" />
          <div className="h-64 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-800">Error</h2>
          <p className="mb-4 text-red-600">{error || "Truck not found"}</p>
          <Link
            href="/carrier/trucks"
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to My Trucks
          </Link>
        </div>
      </div>
    );
  }

  const approvalColors: Record<string, string> = {
    APPROVED:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const verificationColors: Record<string, string> = {
    VERIFIED:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/carrier/trucks"
        className="text-sm text-slate-500 hover:text-slate-300"
      >
        &larr; Back to My Trucks
      </Link>

      {/* Header card */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {truck.licensePlate}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {formatTruckType(truck.truckType)} &middot;{" "}
              {truck.capacity.toLocaleString()} kg
              {truck.volume ? ` &middot; ${truck.volume} m³` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Added {formatDate(truck.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                approvalColors[truck.approvalStatus] ??
                "bg-slate-100 text-slate-600"
              }`}
            >
              {truck.approvalStatus}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                truck.isAvailable
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {truck.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/carrier/trucks/${truck.id}/edit`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Edit Truck
          </Link>
        </div>
      </div>

      {/* Rejection reason banner */}
      {truck.approvalStatus === "REJECTED" && truck.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Rejection Reason</p>
          <p className="mt-1 text-sm text-red-700">{truck.rejectionReason}</p>
          <Link
            href={`/carrier/trucks/${truck.id}/edit?resubmit=true`}
            className="mt-3 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Edit &amp; Resubmit
          </Link>
        </div>
      )}

      {/* Truck details grid */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
          Truck Information
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {formatTruckType(truck.truckType)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Capacity</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {truck.capacity.toLocaleString()} kg
            </dd>
          </div>
          {truck.volume && (
            <div>
              <dt className="text-slate-500">Volume</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {truck.volume} m³
              </dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">City</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {truck.currentCity || "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Region</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {truck.currentRegion || "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Carrier</dt>
            <dd className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {truck.carrier.name}
              {truck.carrier.isVerified && (
                <svg
                  className="h-4 w-4 text-emerald-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </dd>
          </div>
        </dl>

        {/* GPS Device */}
        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-white">
            GPS Device
          </h3>
          {truck.gpsDevice ? (
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-slate-500">IMEI</dt>
                <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {truck.gpsDevice.imei}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Provider</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  {truck.gpsDevice.provider}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      truck.gpsDevice.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {truck.gpsDevice.status}
                  </span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No GPS device configured
            </p>
          )}
        </div>
      </div>

      {/* Documents section */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
          Documents
        </h2>

        {/* Existing documents */}
        {documents.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-slate-700">
              Uploaded Documents
            </h3>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900">
                      <svg
                        className="h-5 w-5 text-indigo-600"
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
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {doc.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-slate-400">{doc.fileName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        verificationColors[doc.verificationStatus] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {doc.verificationStatus}
                    </span>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload new document */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-700">
            Upload New Document
          </h3>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-slate-500">
              Document Type
            </label>
            <select
              value={selectedDocType}
              onChange={(e) =>
                setSelectedDocType(e.target.value as TruckDocumentType)
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none md:w-64 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              {TRUCK_DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {
                TRUCK_DOCUMENT_TYPES.find((t) => t.value === selectedDocType)
                  ?.description
              }
            </p>
          </div>

          {/* Insurance-specific fields */}
          {selectedDocType === "INSURANCE" && (
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 md:grid-cols-2 dark:border-indigo-800 dark:bg-indigo-950">
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-indigo-800">
                  Insurance Details (optional)
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Policy Number
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="e.g., POL-12345"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="e.g., Ethiopian Insurance Corp."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Coverage Amount (ETB)
                </label>
                <input
                  type="number"
                  value={coverageAmount}
                  onChange={(e) => setCoverageAmount(e.target.value)}
                  placeholder="e.g., 500000"
                  min="0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Coverage Type
                </label>
                <select
                  value={coverageType}
                  onChange={(e) => setCoverageType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
              setPolicyNumber("");
              setInsuranceProvider("");
              setCoverageAmount("");
              setCoverageType("");
            }}
            helperText="Upload vehicle registration, insurance, or inspection documents"
            isLocked={!!truck.documentsLockedAt}
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
    </div>
  );
}
