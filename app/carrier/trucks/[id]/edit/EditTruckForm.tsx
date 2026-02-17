"use client";

/**
 * Edit Truck Form Component
 *
 * Form for editing an existing truck or resubmitting a rejected truck
 * Sprint 12 - Story 12.2: Truck Management
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";
import PlacesAutocomplete, {
  PlaceResult,
} from "@/components/PlacesAutocomplete";

import { TRUCK_TYPES } from "@/lib/constants/truckTypes";

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

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume?: number | null;
  currentCity?: string | null;
  currentRegion?: string | null;
  isAvailable: boolean;
  status: string;
  approvalStatus: string;
  rejectionReason?: string | null;
}

interface EditTruckFormProps {
  truck: Truck;
  isResubmit: boolean;
}

export default function EditTruckForm({
  truck,
  isResubmit,
}: EditTruckFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    truckType: truck.truckType,
    licensePlate: truck.licensePlate,
    capacity: truck.capacity.toString(),
    volume: truck.volume?.toString() || "",
    currentCity: truck.currentCity || "",
    currentRegion: truck.currentRegion || "",
    isAvailable: truck.isAvailable,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      setFormData({
        ...formData,
        currentCity: place.city || value,
        currentRegion: place.region || "",
      });
    } else {
      setFormData({
        ...formData,
        currentCity: value,
      });
    }
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

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
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

      // Prepare update data
      const updateData: Record<string, unknown> = {
        truckType: formData.truckType,
        licensePlate: formData.licensePlate.trim(),
        capacity: parseFloat(formData.capacity),
        volume: formData.volume ? parseFloat(formData.volume) : null,
        currentCity: formData.currentCity || null,
        currentRegion: formData.currentRegion || null,
        isAvailable: formData.isAvailable,
      };

      // If resubmitting, reset approval status to PENDING
      if (isResubmit) {
        updateData.approvalStatus = "PENDING";
        updateData.rejectionReason = null;
      }

      const response = await fetch(`/api/trucks/${truck.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(updateData),
        credentials: "include",
      });

      if (response.ok) {
        if (isResubmit) {
          toast.success("Truck resubmitted for approval!");
          router.push("/carrier/trucks?tab=pending&success=truck-resubmitted");
        } else {
          toast.success("Truck updated successfully!");
          router.push("/carrier/trucks?success=truck-updated");
        }
        router.refresh();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to update truck";
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error updating truck:", error);
      const errorMessage = "Failed to update truck. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Standard input class for consistency - Teal design system
  const inputClass =
    "w-full px-4 py-3 bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] placeholder-[#064d51]/50 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600";
  const selectClass =
    "w-full px-4 py-3 bg-white text-[#064d51] border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600";
  const labelClass =
    "block text-sm font-semibold text-[#064d51] dark:text-gray-200 mb-2";
  const hintClass = "text-xs text-[#064d51]/60 dark:text-gray-400 mt-1";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-white p-6 shadow-lg md:p-8 dark:bg-slate-900"
    >
      <div className="space-y-6">
        {/* Form Header */}
        <div className="border-b border-[#064d51]/10 pb-4 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-[#064d51] dark:text-white">
            {isResubmit ? "Resubmit Truck" : "Edit Truck"}
          </h2>
          <p className="mt-1 text-[#064d51]/70 dark:text-gray-400">
            {isResubmit
              ? "Update and resubmit your truck for admin approval"
              : "Update your truck information"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {error}
            </p>
          </div>
        )}

        {/* Truck Type */}
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

        {/* License Plate */}
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
            placeholder="e.g., AA-12345"
            className={inputClass}
          />
          <p className={hintClass}>Must be unique and at least 3 characters</p>
        </div>

        {/* Capacity and Volume */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              step="0.01"
              placeholder="e.g., 5000"
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
              step="0.01"
              placeholder="e.g., 20"
              className={inputClass}
            />
          </div>
        </div>

        {/* Current Location - Google Places Autocomplete */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className={labelClass}>Current City</label>
            <PlacesAutocomplete
              value={formData.currentCity}
              onChange={handleLocationChange}
              placeholder="Search for city..."
              className={inputClass}
              countryRestriction={["ET", "DJ"]}
              types={["(cities)"]}
              name="currentCity"
            />
            <p className={hintClass}>
              Start typing to search Ethiopian and Djibouti cities
            </p>
          </div>

          <div>
            <label className={labelClass}>Current Region</label>
            <select
              name="currentRegion"
              value={formData.currentRegion}
              onChange={handleChange}
              className={selectClass}
            >
              <option value="">Select region...</option>
              {ETHIOPIAN_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <p className={hintClass}>Auto-populated when selecting a city</p>
          </div>
        </div>

        {/* Is Available */}
        <div className="flex items-center rounded-lg bg-[#f0fdfa] p-4 dark:bg-slate-800">
          <input
            type="checkbox"
            name="isAvailable"
            checked={formData.isAvailable}
            onChange={handleChange}
            className="h-5 w-5 rounded border-[#064d51]/30 text-[#1e9c99] focus:ring-[#1e9c99]"
          />
          <label className="ml-3 block text-sm font-medium text-[#064d51] dark:text-gray-200">
            Mark truck as available for new loads
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 border-t border-[#064d51]/10 pt-6 dark:border-slate-700">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-[#064d51] px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#053d40] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? isResubmit
                ? "Resubmitting..."
                : "Saving..."
              : isResubmit
                ? "Resubmit for Approval"
                : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="rounded-lg border border-[#064d51]/20 bg-white px-6 py-3 font-semibold text-[#064d51] transition-colors hover:bg-[#f0fdfa] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
