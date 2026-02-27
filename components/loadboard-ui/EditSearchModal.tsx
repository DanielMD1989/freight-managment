"use client";

/**
 * Edit Search Modal Component
 *
 * Modal for editing saved searches (name and criteria)
 * Load Board UI Component Library
 */

import React, { useState, useEffect } from "react";
import {
  SavedSearch,
  SavedSearchCriteria,
  SavedSearchType,
} from "@/types/loadboard-ui";

interface EditSearchModalProps {
  search: SavedSearch | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    updates: { name?: string; criteria?: SavedSearchCriteria }
  ) => Promise<void>;
  cities?: { name: string; region?: string }[];
  type: SavedSearchType;
}

const TRUCK_TYPES = [
  { value: "FLATBED", label: "Flatbed" },
  { value: "REFRIGERATED", label: "Refrigerated" },
  { value: "TANKER", label: "Tanker" },
  { value: "CONTAINER", label: "Container" },
  { value: "DRY_VAN", label: "Dry Van" },
  { value: "LOWBOY", label: "Lowboy" },
  { value: "DUMP_TRUCK", label: "Dump Truck" },
  { value: "BOX_TRUCK", label: "Box Truck" },
];

export default function EditSearchModal({
  search,
  isOpen,
  onClose,
  onSave,
  cities = [],
  type,
}: EditSearchModalProps) {
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<SavedSearchCriteria>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when search changes
  useEffect(() => {
    if (search) {
      setName(search.name);
      setCriteria(search.criteria || {});
      setError(null);
    }
  }, [search]);

  if (!isOpen || !search) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Search name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(search.id, { name: name.trim(), criteria });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  type CriteriaValue = string | number | boolean | string[] | undefined;
  const updateCriteria = (key: string, value: CriteriaValue) => {
    setCriteria((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : value,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#064d51]/10 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#064d51]/10 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#064d51]">
              Edit Saved Search
            </h2>
            <button
              onClick={onClose}
              className="text-[#064d51]/50 hover:text-[#064d51]"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="space-y-6 p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-rose-800">{error}</p>
            </div>
          )}

          {/* Search Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#064d51]">
              Search Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
              placeholder="Enter search name..."
            />
          </div>

          {/* Search Criteria Section */}
          <div className="border-t border-[#064d51]/10 pt-6">
            <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
              Search Criteria
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Origin */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Origin
                </label>
                <select
                  value={criteria.origin || ""}
                  onChange={(e) => updateCriteria("origin", e.target.value)}
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                >
                  <option value="">Any origin</option>
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                      {city.region ? ` (${city.region})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Destination
                </label>
                <select
                  value={criteria.destination || ""}
                  onChange={(e) =>
                    updateCriteria("destination", e.target.value)
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                >
                  <option value="">Any destination</option>
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                      {city.region ? ` (${city.region})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Truck Type */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Truck Type
                </label>
                <select
                  value={
                    Array.isArray(criteria.truckType)
                      ? criteria.truckType[0] || ""
                      : criteria.truckType || ""
                  }
                  onChange={(e) =>
                    updateCriteria(
                      "truckType",
                      e.target.value ? [e.target.value] : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                >
                  <option value="">Any type</option>
                  {TRUCK_TYPES.map((truckType) => (
                    <option key={truckType.value} value={truckType.value}>
                      {truckType.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Full/Partial */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Load Type
                </label>
                <select
                  value={criteria.fullPartial || ""}
                  onChange={(e) =>
                    updateCriteria("fullPartial", e.target.value)
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                >
                  <option value="">Any load type</option>
                  <option value="FULL">Full Truckload</option>
                  <option value="PARTIAL">Partial Load</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>

              {/* Min Weight */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Min Weight (kg)
                </label>
                <input
                  type="number"
                  value={criteria.minWeight || ""}
                  onChange={(e) =>
                    updateCriteria(
                      "minWeight",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Max Weight */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Max Weight (kg)
                </label>
                <input
                  type="number"
                  value={criteria.maxWeight || ""}
                  onChange={(e) =>
                    updateCriteria(
                      "maxWeight",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                  placeholder="No limit"
                  min="0"
                />
              </div>

              {/* Min Rate */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Min Rate (ETB)
                </label>
                <input
                  type="number"
                  value={criteria.minRate || ""}
                  onChange={(e) =>
                    updateCriteria(
                      "minRate",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Max Rate */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Max Rate (ETB)
                </label>
                <input
                  type="number"
                  value={criteria.maxRate || ""}
                  onChange={(e) =>
                    updateCriteria(
                      "maxRate",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                  placeholder="No limit"
                  min="0"
                />
              </div>

              {/* Age Hours (for LOADS) */}
              {type === "LOADS" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#064d51]">
                    Max Age (hours)
                  </label>
                  <input
                    type="number"
                    value={criteria.ageHours || ""}
                    onChange={(e) =>
                      updateCriteria(
                        "ageHours",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                    placeholder="Any age"
                    min="1"
                  />
                </div>
              )}

              {/* Min Trip Distance */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Min Distance (km)
                </label>
                <input
                  type="number"
                  value={criteria.minTripKm || ""}
                  onChange={(e) =>
                    updateCriteria(
                      "minTripKm",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Max Trip Distance */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#064d51]">
                  Max Distance (km)
                </label>
                <input
                  type="number"
                  value={criteria.maxTripKm || ""}
                  onChange={(e) =>
                    updateCriteria(
                      "maxTripKm",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-[#064d51]/20 px-4 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                  placeholder="No limit"
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#064d51]/10 bg-[#f0fdfa] p-6">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[#064d51]/20 px-4 py-2 font-medium text-[#064d51] hover:bg-[#064d51]/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#064d51] px-4 py-2 font-medium text-white hover:bg-[#053d40] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
