"use client";

/**
 * Add Truck Form Component
 *
 * Form for registering a new truck with Google Places Autocomplete
 * Sprint 12 - Story 12.2: Truck Management
 * Updated: Task 4 - PlacesAutocomplete for location
 * Updated: Document upload during truck creation
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";
import PlacesAutocomplete, {
  PlaceResult,
} from "@/components/PlacesAutocomplete";
import { TRUCK_TYPES } from "@/lib/constants/truckTypes";
import {
  TRUCK_DOCUMENT_REQUIREMENTS,
  REQUIRED_TRUCK_DOCUMENTS,
} from "@/lib/constants/truckDocuments";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

// Ethiopian cities removed - now using Google Places Autocomplete for dynamic location search

const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "Southern Nations, Nationalities, and Peoples",
  "Southwest Ethiopia",
  "Tigray",
];

interface InsuranceFields {
  policyNumber: string;
  insuranceProvider: string;
  coverageAmount: string;
  coverageType: string;
}

interface DocumentSlot {
  file: File | null;
  expiresAt: string;
  insuranceFields?: InsuranceFields;
}

export default function AddTruckForm() {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [formData, setFormData] = useState({
    truckType: "FLATBED",
    licensePlate: "",
    capacity: "",
    volume: "",
    currentCity: "",
    currentRegion: "",
    currentLat: undefined as number | undefined,
    currentLng: undefined as number | undefined,
    isAvailable: true,
    imei: "",
    // G-M9-1: Sprint 8 fields
    lengthM: "",
    ownerName: "",
    contactName: "",
    contactPhone: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Document upload state — one slot per document type
  const [documentSlots, setDocumentSlots] = useState<
    Record<string, DocumentSlot>
  >({});
  const [uploadingDocs, setUploadingDocs] = useState(false);

  /**
   * Handle input change
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    });
  };

  /**
   * Handle location change from PlacesAutocomplete
   */
  const handleLocationChange = (value: string, place?: PlaceResult) => {
    if (place) {
      // Full place selected with coordinates
      setFormData({
        ...formData,
        currentCity: place.city || value,
        currentRegion: place.region || "",
        currentLat: place.coordinates.lat,
        currentLng: place.coordinates.lng,
      });
    } else {
      // Manual text input
      setFormData({
        ...formData,
        currentCity: value,
        currentLat: undefined,
        currentLng: undefined,
      });
    }
  };

  /**
   * Handle document file selection
   */
  /**
   * Handle file selection for a specific document type slot
   */
  const handleFileSelectForSlot = (
    docType: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Please upload PDF, JPG, or PNG files.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    setDocumentSlots((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        file,
        expiresAt: prev[docType]?.expiresAt || "",
      },
    }));
    toast.success(`${file.name} selected`);
  };

  /**
   * Update a document slot field (expiresAt or insurance fields)
   */
  const updateSlotField = (docType: string, field: string, value: string) => {
    setDocumentSlots((prev) => {
      const slot = prev[docType] || { file: null, expiresAt: "" };
      if (field === "expiresAt") {
        return { ...prev, [docType]: { ...slot, expiresAt: value } };
      }
      // Insurance fields
      const ins = slot.insuranceFields || {
        policyNumber: "",
        insuranceProvider: "",
        coverageAmount: "",
        coverageType: "",
      };
      return {
        ...prev,
        [docType]: {
          ...slot,
          insuranceFields: { ...ins, [field]: value },
        },
      };
    });
  };

  /**
   * Remove file from a document slot
   */
  const removeSlotFile = (docType: string) => {
    setDocumentSlots((prev) => {
      const updated = { ...prev };
      if (updated[docType]) {
        updated[docType] = { ...updated[docType], file: null };
      }
      return updated;
    });
    const ref = fileInputRefs.current[docType];
    if (ref) ref.value = "";
  };

  /**
   * Upload all queued documents after truck creation
   */
  const uploadDocumentSlots = async (truckId: string): Promise<boolean> => {
    const slotsWithFiles = Object.entries(documentSlots).filter(
      ([, slot]) => slot.file
    );
    if (slotsWithFiles.length === 0) return true;

    setUploadingDocs(true);
    let allSuccessful = true;

    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      toast.error("Security token expired. Please refresh and try again.");
      setUploadingDocs(false);
      return false;
    }

    for (const [docType, slot] of slotsWithFiles) {
      if (!slot.file) continue;
      try {
        const fd = new FormData();
        fd.append("file", slot.file);
        fd.append("type", docType);
        fd.append("entityType", "truck");
        fd.append("entityId", truckId);
        if (slot.expiresAt) fd.append("expiresAt", slot.expiresAt);

        if (slot.insuranceFields) {
          const ins = slot.insuranceFields;
          if (ins.policyNumber) fd.append("policyNumber", ins.policyNumber);
          if (ins.insuranceProvider)
            fd.append("insuranceProvider", ins.insuranceProvider);
          if (ins.coverageAmount)
            fd.append("coverageAmount", ins.coverageAmount);
          if (ins.coverageType) fd.append("coverageType", ins.coverageType);
        }

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
          body: fd,
        });

        if (!response.ok) {
          console.error(`Failed to upload ${slot.file.name}`);
          allSuccessful = false;
        }
      } catch (err) {
        console.error(`Error uploading ${docType}:`, err);
        allSuccessful = false;
      }
    }

    setUploadingDocs(false);
    return allSuccessful;
  };

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    if (!formData.licensePlate.trim()) {
      setError("License plate is required");
      return false;
    }

    if (!formData.capacity || parseFloat(formData.capacity) <= 0) {
      setError("Capacity must be greater than 0");
      return false;
    }

    if (formData.volume && parseFloat(formData.volume) <= 0) {
      setError("Volume must be greater than 0");
      return false;
    }

    setError("");
    return true;
  };

  // Count uploaded required documents
  const uploadedRequiredCount = REQUIRED_TRUCK_DOCUMENTS.filter(
    (type) => documentSlots[type]?.file
  ).length;
  const totalRequiredCount = REQUIRED_TRUCK_DOCUMENTS.length;

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Warn if required documents are missing (don't block — carrier can upload later)
    if (uploadedRequiredCount < totalRequiredCount) {
      const missing = REQUIRED_TRUCK_DOCUMENTS.filter(
        (type) => !documentSlots[type]?.file
      );
      const missingLabels = missing.map(
        (type) =>
          TRUCK_DOCUMENT_REQUIREMENTS.find((d) => d.type === type)?.label ||
          type
      );
      const proceed = window.confirm(
        `Missing required documents: ${missingLabels.join(", ")}.\n\n` +
          `Your truck will stay in PENDING status until all required documents are uploaded and approved.\n\n` +
          `Continue anyway?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setError("Failed to get CSRF token. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Prepare data
      const truckData = {
        truckType: formData.truckType,
        licensePlate: formData.licensePlate.trim(),
        capacity: parseFloat(formData.capacity),
        volume: formData.volume ? parseFloat(formData.volume) : undefined,
        currentCity: formData.currentCity || undefined,
        currentRegion: formData.currentRegion || undefined,
        isAvailable: formData.isAvailable,
        imei: formData.imei || undefined,
        // G-M9-1: Sprint 8 fields
        lengthM: formData.lengthM ? parseFloat(formData.lengthM) : undefined,
        ownerName: formData.ownerName || undefined,
        contactName: formData.contactName || undefined,
        contactPhone: formData.contactPhone || undefined,
      };

      const response = await fetch("/api/trucks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(truckData),
        credentials: "include",
      });

      if (response.ok) {
        const responseData = await response.json();
        const createdTruck = responseData.truck;

        // Upload document slots
        const slotsWithFiles = Object.values(documentSlots).filter(
          (s) => s.file
        );
        if (slotsWithFiles.length > 0) {
          toast("Uploading documents...");
          const docsUploaded = await uploadDocumentSlots(createdTruck.id);
          if (!docsUploaded) {
            toast(
              "Truck created but some documents failed to upload. You can upload them from the truck detail page."
            );
          } else {
            toast.success("Documents uploaded successfully!");
          }
        }

        // Success - redirect to trucks list with pending tab selected
        // Sprint 18: Trucks are now pending admin approval
        toast.success("Truck submitted for admin approval!");
        router.push("/carrier/trucks?tab=pending&success=truck-added");
        router.refresh();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to add truck";
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error adding truck:", error);
      const errorMessage = "Failed to add truck. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Professional input styling - Teal design system
  const inputClass =
    "w-full h-9 px-3 text-sm bg-[#f0fdfa] dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded focus:ring-1 focus:ring-[#1e9c99] focus:border-[#1e9c99] focus:bg-white dark:focus:bg-slate-700 placeholder-[#064d51]/50 transition-colors";
  const selectClass =
    "w-full h-9 px-3 text-sm bg-[#f0fdfa] dark:bg-slate-800 text-[#064d51] dark:text-gray-100 border border-[#064d51]/20 dark:border-slate-600 rounded focus:ring-1 focus:ring-[#1e9c99] focus:border-[#1e9c99] focus:bg-white dark:focus:bg-slate-700 transition-colors";
  const labelClass =
    "block text-xs font-medium text-[#064d51] dark:text-gray-400 mb-1 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-r border-l-4 border-red-500 bg-red-50 p-3 dark:bg-red-900/20">
          <svg
            className="h-4 w-4 flex-shrink-0 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Vehicle Information Section */}
      <div className="overflow-hidden rounded-lg border border-[#064d51]/20 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-[#064d51]/10 bg-[#f0fdfa] px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#064d51] dark:text-gray-200">
            <svg
              className="h-4 w-4 text-[#1e9c99]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
              />
            </svg>
            Vehicle Information
          </h3>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Truck Type <span className="text-red-500">*</span>
              </label>
              <select
                name="truckType"
                value={formData.truckType}
                onChange={handleChange}
                required
                className={selectClass}
              >
                {TRUCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                License Plate <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="licensePlate"
                value={formData.licensePlate}
                onChange={handleChange}
                required
                placeholder="AA-12345"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Capacity (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                required
                min="1"
                placeholder="5000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Volume (m³)</label>
              <input
                type="number"
                name="volume"
                value={formData.volume}
                onChange={handleChange}
                min="0.01"
                placeholder="20"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Length (m)</label>
            <input
              type="number"
              name="lengthM"
              value={formData.lengthM}
              onChange={handleChange}
              min="0.01"
              placeholder="12"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Owner Name</label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="Vehicle owner"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Contact Name</label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                placeholder="Driver or contact"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Contact Phone</label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="+251..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Location Section */}
      <div className="overflow-hidden rounded-lg border border-[#064d51]/20 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-[#064d51]/10 bg-[#f0fdfa] px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#064d51] dark:text-gray-200">
            <svg
              className="h-4 w-4 text-[#1e9c99]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Current Location
          </h3>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>City</label>
              <PlacesAutocomplete
                value={formData.currentCity}
                onChange={handleLocationChange}
                placeholder="Search city..."
                className={inputClass}
                countryRestriction={["ET", "DJ"]}
                types={["(cities)"]}
                name="currentCity"
              />
            </div>
            <div>
              <label className={labelClass}>Region</label>
              <select
                name="currentRegion"
                value={formData.currentRegion}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">Select...</option>
                {ETHIOPIAN_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>
              GPS IMEI{" "}
              <span className="font-normal text-[#064d51]/50 normal-case">
                (optional — required before posting)
              </span>
            </label>
            <input
              type="text"
              name="imei"
              value={formData.imei || ""}
              onChange={handleChange}
              placeholder="15-digit IMEI number"
              maxLength={15}
              pattern="\d{15}"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Documents Section — Checklist */}
      <div className="overflow-hidden rounded-lg border border-[#064d51]/20 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-[#064d51]/10 bg-[#f0fdfa] px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#064d51] dark:text-gray-200">
            <svg
              className="h-4 w-4 text-[#1e9c99]"
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
            Documents
          </h3>
          <p className="mt-0.5 text-xs text-[#064d51]/60 dark:text-gray-400">
            Upload all required documents for truck approval
            <span className="ml-2 font-medium text-[#1e9c99]">
              {uploadedRequiredCount}/{totalRequiredCount} required
            </span>
          </p>
        </div>
        <div className="divide-y divide-[#064d51]/10 dark:divide-slate-700">
          {TRUCK_DOCUMENT_REQUIREMENTS.map((docReq) => {
            const slot = documentSlots[docReq.type];
            const hasFile = !!slot?.file;

            return (
              <div key={docReq.type} className="p-4">
                {/* Document header */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        hasFile
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {hasFile ? "✓" : ""}
                    </span>
                    <span className="text-sm font-medium text-[#064d51] dark:text-gray-200">
                      {docReq.label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        docReq.required
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {docReq.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  {hasFile && (
                    <button
                      type="button"
                      onClick={() => removeSlotFile(docReq.type)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="mb-2 text-xs text-[#064d51]/50 dark:text-gray-500">
                  {docReq.description}
                </p>

                {/* File input or uploaded indicator */}
                {hasFile ? (
                  <div className="flex items-center gap-2 rounded bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <span>{slot!.file!.name}</span>
                    <span className="text-xs text-emerald-500">
                      ({(slot!.file!.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                ) : (
                  <input
                    ref={(el) => {
                      fileInputRefs.current[docReq.type] = el;
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileSelectForSlot(docReq.type, e)}
                    className="h-9 w-full cursor-pointer text-sm text-[#064d51]/70 file:mr-2 file:h-9 file:rounded file:border-0 file:bg-[#064d51] file:px-3 file:text-xs file:font-medium file:text-white hover:file:bg-[#053d40]"
                  />
                )}

                {/* Expiry date (for document types that have expiry) */}
                {docReq.hasExpiry && (
                  <div className="mt-2">
                    <label className={labelClass}>Expiry Date</label>
                    <input
                      type="date"
                      value={slot?.expiresAt || ""}
                      onChange={(e) =>
                        updateSlotField(
                          docReq.type,
                          "expiresAt",
                          e.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                )}

                {/* Insurance-specific fields */}
                {docReq.hasInsuranceFields && (
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-800 dark:bg-blue-900/20">
                    <div>
                      <label className={labelClass}>Policy Number</label>
                      <input
                        type="text"
                        value={slot?.insuranceFields?.policyNumber || ""}
                        onChange={(e) =>
                          updateSlotField(
                            docReq.type,
                            "policyNumber",
                            e.target.value
                          )
                        }
                        placeholder="POL-12345"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Provider</label>
                      <input
                        type="text"
                        value={slot?.insuranceFields?.insuranceProvider || ""}
                        onChange={(e) =>
                          updateSlotField(
                            docReq.type,
                            "insuranceProvider",
                            e.target.value
                          )
                        }
                        placeholder="Insurance Co."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Coverage (ETB)</label>
                      <input
                        type="number"
                        value={slot?.insuranceFields?.coverageAmount || ""}
                        onChange={(e) =>
                          updateSlotField(
                            docReq.type,
                            "coverageAmount",
                            e.target.value
                          )
                        }
                        placeholder="500000"
                        min="0"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Coverage Type</label>
                      <select
                        value={slot?.insuranceFields?.coverageType || ""}
                        onChange={(e) =>
                          updateSlotField(
                            docReq.type,
                            "coverageType",
                            e.target.value
                          )
                        }
                        className={selectClass}
                      >
                        <option value="">Select...</option>
                        <option value="CARGO">Cargo</option>
                        <option value="LIABILITY">Liability</option>
                        <option value="COMPREHENSIVE">Comprehensive</option>
                        <option value="THIRD_PARTY">Third Party</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Availability Toggle */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#064d51]/20 bg-white p-4 transition-colors hover:bg-[#f0fdfa] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
        <input
          type="checkbox"
          name="isAvailable"
          checked={formData.isAvailable}
          onChange={handleChange}
          className="h-4 w-4 rounded border-[#064d51]/30 text-[#1e9c99] focus:ring-[#1e9c99]"
        />
        <div>
          <p className="text-sm font-medium text-[#064d51] dark:text-gray-200">
            Available for loads
          </p>
          <p className="text-xs text-[#064d51]/60">
            This truck can be matched with available loads
          </p>
        </div>
      </label>

      {/* Submit Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || uploadingDocs}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#064d51] text-sm font-medium text-white transition-colors hover:bg-[#053d40] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(isSubmitting || uploadingDocs) && (
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {uploadingDocs
            ? "Uploading..."
            : isSubmitting
              ? "Submitting..."
              : "Submit for Approval"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting || uploadingDocs}
          className="h-10 rounded-lg border border-[#064d51]/20 bg-white px-6 text-sm font-medium text-[#064d51] transition-colors hover:bg-[#f0fdfa] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
