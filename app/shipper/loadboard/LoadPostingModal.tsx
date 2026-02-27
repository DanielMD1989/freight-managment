"use client";

/**
 * Load Posting Modal - Exact copy of inline new load form
 * Used for both creating new loads and editing existing loads
 */

import React, { useState, useEffect } from "react";
import { ETHIOPIAN_LOCATIONS } from "@/lib/constants/ethiopian-locations";
import PlacesAutocomplete, {
  PlaceResult,
} from "@/components/PlacesAutocomplete";
import { getCSRFToken } from "@/lib/csrfFetch";
import type { Load, User } from "@/lib/types/shipper";

// L1 FIX: Add proper TypeScript types
interface LoadPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: Pick<User, "id" | "organizationId">;
  load?: Partial<Load>; // Optional load for editing
}

export default function LoadPostingModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  load,
}: LoadPostingModalProps) {
  const isEditMode = !!load;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    pickupDate: "",
    pickupCity: "",
    deliveryCity: "",
    pickupDockHours: "",
    truckType: "Reefer",
    fullPartial: "Full",
    lengthM: "",
    weight: "",
    shipperContactPhone: "",
    cargoDescription: "",
    specialInstructions: "",
  });

  // Populate form when editing
  useEffect(() => {
    if (load) {
      setFormData({
        pickupDate: load.pickupDate
          ? new Date(load.pickupDate).toISOString().split("T")[0]
          : "",
        pickupCity: load.pickupCity || "",
        deliveryCity: load.deliveryCity || "",
        pickupDockHours: load.pickupDockHours || "",
        truckType: load.truckType || "Reefer",
        fullPartial: load.fullPartial || "Full",
        lengthM: load.lengthM?.toString() || "",
        weight: load.weight?.toString() || "",
        shipperContactPhone: load.shipperContactPhone || "",
        cargoDescription: load.cargoDescription || "",
        specialInstructions: load.specialInstructions || "",
      });
    }
  }, [load]);

  // L2 FIX: Type the value parameter properly
  const handleChange = (
    field: string,
    value: string | { lat: number; lng: number }
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.pickupCity ||
      !formData.deliveryCity ||
      !formData.pickupDate ||
      !formData.truckType
    ) {
      alert(
        "Please fill in all required fields: Origin, Destination, Pickup Date, and Truck Type"
      );
      return;
    }

    setLoading(true);
    try {
      // H33 FIX: Add CSRF token for state-changing operations
      const csrfToken = await getCSRFToken();
      const url = isEditMode ? `/api/loads/${load.id}` : "/api/loads";
      const method = isEditMode ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          ...formData,
          lengthM: formData.lengthM ? parseFloat(formData.lengthM) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          ...(!isEditMode && {
            status: "POSTED",
            deliveryDate: formData.pickupDate,
          }), // Default values for new loads
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Failed to ${isEditMode ? "update" : "create"} load`
        );
      }

      alert(`Load ${isEditMode ? "updated" : "posted"} successfully!`);
      onSuccess();
      onClose();
    } catch (error) {
      // L38 FIX: Proper error handling without any
      console.error(`${isEditMode ? "Update" : "Create"} load error:`, error);
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${isEditMode ? "update" : "create"} load`;
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gray-200 px-6 py-4 dark:border-slate-600 dark:bg-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {isEditMode ? "EDIT LOAD" : "NEW LOAD POST"}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Form - Exact copy of inline new load form */}
        <form onSubmit={handleSubmit}>
          <div
            className="border-b border-slate-300 p-4 dark:border-slate-600"
            style={{ backgroundColor: "#2B2727" }}
          >
            {/* Form Fields Row - Grid matching table columns */}
            <div className="mb-4 grid grid-cols-12 gap-2">
              <div className="flex items-center gap-1 pt-5">
                <input type="checkbox" className="h-4 w-4" />
                <span className="cursor-pointer text-lg text-white">☆</span>
              </div>
              {/* Empty columns for Age and Status */}
              <div></div>
              <div></div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Pickup *
                </label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => handleChange("pickupDate", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Origin *
                </label>
                <PlacesAutocomplete
                  value={formData.pickupCity}
                  onChange={(value, place) => {
                    handleChange("pickupCity", value);
                    if (place?.coordinates) {
                      handleChange("pickupCoordinates", place.coordinates);
                    }
                  }}
                  placeholder="Search city..."
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  countryRestriction={["ET", "DJ"]}
                  types={["(cities)"]}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Destination *
                </label>
                <PlacesAutocomplete
                  value={formData.deliveryCity}
                  onChange={(value, place) => {
                    handleChange("deliveryCity", value);
                    if (place?.coordinates) {
                      handleChange("deliveryCoordinates", place.coordinates);
                    }
                  }}
                  placeholder="Search city..."
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  countryRestriction={["ET", "DJ"]}
                  types={["(cities)"]}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Dock Hours
                </label>
                <input
                  type="text"
                  value={formData.pickupDockHours}
                  onChange={(e) =>
                    handleChange("pickupDockHours", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  placeholder="9am-5pm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Truck *</label>
                <select
                  value={formData.truckType}
                  onChange={(e) => handleChange("truckType", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  required
                >
                  <option>Reefer</option>
                  <option>Van</option>
                  <option>Flatbed</option>
                  <option>Container</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">F/P</label>
                <select
                  value={formData.fullPartial}
                  onChange={(e) => handleChange("fullPartial", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                >
                  <option>Full</option>
                  <option>Partial</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Length</label>
                <input
                  type="number"
                  value={formData.lengthM}
                  onChange={(e) => handleChange("lengthM", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  placeholder="53"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Weight</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleChange("weight", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  placeholder="45000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Contact</label>
                <input
                  type="tel"
                  value={formData.shipperContactPhone}
                  onChange={(e) =>
                    handleChange("shipperContactPhone", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:text-white"
                  placeholder="+251-9xx"
                />
              </div>
            </div>

            {/* Bottom Section: Commodity, Comments, and Actions */}
            <div className="grid grid-cols-3 gap-4">
              {/* Commodity */}
              <div>
                <label className="mb-1 block text-xs text-white">
                  Commodity{" "}
                  <span className="text-gray-400">
                    ({formData.cargoDescription.length}/100 max char)
                  </span>
                </label>
                <textarea
                  value={formData.cargoDescription}
                  onChange={(e) =>
                    handleChange("cargoDescription", e.target.value)
                  }
                  className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:text-white"
                  rows={3}
                  maxLength={100}
                  placeholder="e.g. Steel Coils, Electronics..."
                />
              </div>

              {/* Comments */}
              <div>
                <label className="mb-1 block text-xs text-white">
                  Comments{" "}
                  <span className="text-gray-400">
                    ({formData.specialInstructions.length}/70 max char)
                  </span>
                </label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) =>
                    handleChange("specialInstructions", e.target.value)
                  }
                  className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:text-white"
                  rows={3}
                  maxLength={70}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col justify-end">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded bg-teal-600 px-6 py-2 font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {loading
                      ? isEditMode
                        ? "SAVING..."
                        : "POSTING..."
                      : isEditMode
                        ? "SAVE"
                        : "+ POST"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded bg-gray-700 px-4 py-2 font-bold text-white transition-colors hover:bg-gray-800"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
