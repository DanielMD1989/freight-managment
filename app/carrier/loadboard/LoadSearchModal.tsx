"use client";

/**
 * Load Search Modal Component
 *
 * Modal for creating and saving load searches
 * Sprint 14 - Deferred Modal Implementation
 */

import React, { useState } from "react";
import { ActionButton } from "@/components/loadboard-ui";
import { getCSRFToken } from "@/lib/csrfFetch";

interface LoadSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (searchId: string) => void;
}

export default function LoadSearchModal({
  isOpen,
  onClose,
  onSuccess,
}: LoadSearchModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    origin: "",
    destination: "",
    truckType: "",
    loadType: "",
    ageHours: 72,
    minWeight: 0,
    maxWeight: 40000,
    minLength: 0,
    minRate: 0,
    pickupDate: "",
    showVerifiedOnly: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "Search name is required";
    if (
      !formData.origin &&
      !formData.destination &&
      !formData.truckType &&
      !formData.loadType
    ) {
      newErrors.general = "At least one search criterion is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Build search criteria
      const criteria: Record<
        string,
        string | number | boolean | { min: number; max: number }
      > = {};
      if (formData.origin) criteria.origin = formData.origin;
      if (formData.destination) criteria.destination = formData.destination;
      if (formData.truckType) criteria.truckType = formData.truckType;
      if (formData.loadType) criteria.loadType = formData.loadType;
      if (formData.ageHours) criteria.ageHours = formData.ageHours;
      if (formData.minWeight || formData.maxWeight) {
        criteria.weight = { min: formData.minWeight, max: formData.maxWeight };
      }
      if (formData.minLength) criteria.minLength = formData.minLength;
      if (formData.minRate) criteria.minRate = formData.minRate;
      if (formData.pickupDate) criteria.pickupDate = formData.pickupDate;
      if (formData.showVerifiedOnly) criteria.verifiedOnly = true;

      // Save search
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          name: formData.name,
          type: "LOADS",
          criteria,
        }),
      });

      if (!response.ok) throw new Error("Failed to create search");

      const { search } = await response.json();
      alert("Load search created successfully!");
      onSuccess(search.id);
      onClose();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Failed to create search");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-lg bg-[#1e9c99] px-6 py-4">
          <h2 className="text-xl font-bold text-white">NEW LOAD SEARCH</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-white hover:text-gray-200"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {errors.general && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Search Name */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                Search Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={`w-full rounded-md border px-3 py-2 ${
                  errors.name ? "border-red-500" : "border-[#064d51]/20"
                }`}
                placeholder="e.g., Addis to Dire Dawa - High Value Cargo"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Location */}
            <div className="border-b border-[#064d51]/15 pb-4 md:col-span-2">
              <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
                Location Criteria
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Origin
                  </label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) =>
                      setFormData({ ...formData, origin: e.target.value })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    placeholder="e.g., Addis Ababa"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Destination
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) =>
                      setFormData({ ...formData, destination: e.target.value })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    placeholder="e.g., Dire Dawa"
                  />
                </div>
              </div>
            </div>

            {/* Load Specifications */}
            <div className="border-b border-[#064d51]/15 pb-4 md:col-span-2">
              <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
                Load Specifications
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Truck Type
                  </label>
                  <select
                    value={formData.truckType}
                    onChange={(e) =>
                      setFormData({ ...formData, truckType: e.target.value })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                  >
                    <option value="">Any</option>
                    <option value="VAN">VAN</option>
                    <option value="FLATBED">FLATBED</option>
                    <option value="REFRIGERATED">REFRIGERATED</option>
                    <option value="TANKER">TANKER</option>
                    <option value="CONTAINER">CONTAINER</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Load Type
                  </label>
                  <select
                    value={formData.loadType}
                    onChange={(e) =>
                      setFormData({ ...formData, loadType: e.target.value })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                  >
                    <option value="">Any</option>
                    <option value="FULL">FULL</option>
                    <option value="PARTIAL">PARTIAL</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Max Age (hours)
                  </label>
                  <input
                    type="number"
                    value={formData.ageHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ageHours: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    min="0"
                    max="168"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Min Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.minWeight}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minWeight: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Max Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.maxWeight}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxWeight: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    placeholder="40000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Min Length (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.minLength}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minLength: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Timing */}
            <div className="border-b border-[#064d51]/15 pb-4 md:col-span-2">
              <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
                Pricing & Timing
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Min Rate (ETB)
                  </label>
                  <input
                    type="number"
                    value={formData.minRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minRate: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]/80">
                    Pickup Date
                  </label>
                  <input
                    type="date"
                    value={formData.pickupDate}
                    onChange={(e) =>
                      setFormData({ ...formData, pickupDate: e.target.value })
                    }
                    className="w-full rounded-md border border-[#064d51]/20 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Company Filters */}
            <div className="md:col-span-2">
              <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
                Company Filters
              </h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="verifiedOnly"
                  checked={formData.showVerifiedOnly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      showVerifiedOnly: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-[#064d51]/20 text-[#1e9c99]"
                />
                <label
                  htmlFor="verifiedOnly"
                  className="ml-2 text-sm text-[#064d51]/80"
                >
                  Show verified companies only
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-4 border-t border-[#064d51]/15 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#064d51]/20 px-6 py-2 text-[#064d51]/80 hover:bg-[#f0fdfa]"
              disabled={loading}
            >
              Cancel
            </button>
            <ActionButton
              variant="primary"
              onClick={() => {
                const form = document.querySelector("form");
                if (form) {
                  form.requestSubmit();
                }
              }}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Search"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
