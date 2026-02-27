"use client";

/**
 * Truck Posting Modal - Matching design of LoadPostingModal
 * Used for creating new truck postings
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState } from "react";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { getCSRFToken } from "@/lib/csrfFetch";

interface CarrierUser {
  userId: string;
  email: string;
  role: "CARRIER" | "ADMIN" | "SUPER_ADMIN";
  organizationId: string | null;
  firstName?: string;
  lastName?: string;
}

interface EthiopianCity {
  id: string;
  name: string;
  nameEthiopic?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

interface TruckPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: CarrierUser;
  ethiopianCities: EthiopianCity[];
}

export default function TruckPostingModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  ethiopianCities,
}: TruckPostingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    availableFrom: "",
    availableTo: "",
    owner: "",
    origin: "",
    destination: "",
    truckType: "DRY_VAN",
    fullPartial: "FULL",
    lengthM: "",
    weight: "",
    refId: "",
    contactPhone: "",
    comments1: "",
    comments2: "",
  });

  const handleChange = (
    field: string,
    value: string | boolean | { lat: number; lng: number } | null
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (
      !formData.origin ||
      !formData.availableFrom ||
      !formData.truckType ||
      !formData.contactPhone
    ) {
      setError(
        "Please fill in all required fields: Origin, Available Date, Truck Type, and Contact Phone"
      );
      return;
    }

    // Validate date range if both dates provided
    if (formData.availableTo && formData.availableFrom > formData.availableTo) {
      setError("Available To date must be after Available From date");
      return;
    }

    setLoading(true);
    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setError("Failed to get security token. Please refresh and try again.");
        setLoading(false);
        return;
      }

      // Find first truck from user's organization
      const trucksResponse = await fetch(
        `/api/trucks?organizationId=${user.organizationId}&limit=1`
      );
      const trucksData = await trucksResponse.json();
      const userTruck = trucksData.trucks?.[0];

      if (!userTruck) {
        setError(
          "No truck found for your organization. Please add a truck first."
        );
        setLoading(false);
        return;
      }

      // Look up EthiopianLocation IDs from city names
      const originCity = ethiopianCities.find(
        (c: EthiopianCity) =>
          c.name?.toLowerCase() === formData.origin.toLowerCase()
      );
      const destinationCity = formData.destination
        ? ethiopianCities.find(
            (c: EthiopianCity) =>
              c.name?.toLowerCase() === formData.destination.toLowerCase()
          )
        : null;

      if (!originCity) {
        setError(
          "Origin city not found in Ethiopian locations. Please select a valid city from the suggestions."
        );
        setLoading(false);
        return;
      }

      // Convert date to ISO datetime format (API expects datetime, not just date)
      const availableFromISO = new Date(
        formData.availableFrom + "T00:00:00"
      ).toISOString();
      const availableToISO = formData.availableTo
        ? new Date(formData.availableTo + "T23:59:59").toISOString()
        : null;

      const response = await fetch("/api/truck-postings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          truckId: userTruck.id,
          originCityId: originCity.id,
          destinationCityId: destinationCity?.id || null,
          availableFrom: availableFromISO,
          availableTo: availableToISO,
          fullPartial: formData.fullPartial,
          availableLength: formData.lengthM
            ? parseFloat(formData.lengthM)
            : null,
          availableWeight: formData.weight ? parseFloat(formData.weight) : null,
          ownerName: formData.owner || null,
          contactName: user.firstName + " " + user.lastName,
          contactPhone: formData.contactPhone,
          notes: (formData.comments1 + " " + formData.comments2).trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create truck posting");
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Create truck posting error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create truck posting"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#064d51]/20 bg-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-[#064d51]">NEW TRUCK POST</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-[#064d51]/60 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Form - Matching LoadPostingModal design */}
        <form onSubmit={handleSubmit}>
          {/* Error Display */}
          {error && (
            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div
            className="border-b border-[#064d51]/30 p-4"
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
                  Avail From *
                </label>
                <input
                  type="date"
                  value={formData.availableFrom}
                  onChange={(e) =>
                    handleChange("availableFrom", e.target.value)
                  }
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Owner</label>
                <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => handleChange("owner", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  placeholder="Owner name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Origin *
                </label>
                <PlacesAutocomplete
                  value={formData.origin}
                  onChange={(value, place) => {
                    handleChange("origin", value);
                    if (place?.coordinates) {
                      handleChange("originCoordinates", place.coordinates);
                    }
                  }}
                  placeholder="Search city..."
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  countryRestriction={["ET", "DJ"]}
                  types={["(cities)"]}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Destination
                </label>
                <PlacesAutocomplete
                  value={formData.destination}
                  onChange={(value, place) => {
                    handleChange("destination", value);
                    if (place?.coordinates) {
                      handleChange("destinationCoordinates", place.coordinates);
                    }
                  }}
                  placeholder="Anywhere"
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  countryRestriction={["ET", "DJ"]}
                  types={["(cities)"]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Truck *</label>
                <select
                  value={formData.truckType}
                  onChange={(e) => handleChange("truckType", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  required
                >
                  <option value="DRY_VAN">Van</option>
                  <option value="FLATBED">Flatbed</option>
                  <option value="REFRIGERATED">Reefer</option>
                  <option value="TANKER">Tanker</option>
                  <option value="CONTAINER">Container</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">F/P</label>
                <select
                  value={formData.fullPartial}
                  onChange={(e) => handleChange("fullPartial", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                >
                  <option value="FULL">Full</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Length</label>
                <input
                  type="number"
                  value={formData.lengthM}
                  onChange={(e) => handleChange("lengthM", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  placeholder="40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">Weight</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleChange("weight", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  placeholder="40000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white">
                  Contact *
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-2 py-1 text-xs text-[#064d51]"
                  placeholder="+251-9xx-xxx-xxx"
                  required
                />
              </div>
            </div>

            {/* Bottom Section: Ref ID, Comments, and Actions */}
            <div className="grid grid-cols-3 gap-4">
              {/* Ref ID */}
              <div>
                <label className="mb-1 block text-xs text-white">
                  Ref ID <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.refId}
                  onChange={(e) => handleChange("refId", e.target.value)}
                  className="w-full rounded border border-[#064d51]/30 bg-white px-3 py-2 text-[#064d51]"
                  placeholder="e.g. TRK-001"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="mb-1 block text-xs text-white">
                  Comments{" "}
                  <span className="text-gray-400">
                    ({formData.comments1.length}/70 max char)
                  </span>
                </label>
                <textarea
                  value={formData.comments1}
                  onChange={(e) => handleChange("comments1", e.target.value)}
                  className="w-full resize-none rounded border border-[#064d51]/30 bg-white px-3 py-2 text-[#064d51]"
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
                    className="flex-1 rounded bg-[#1e9c99] px-6 py-2 font-medium text-white transition-colors hover:bg-[#064d51] disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {loading ? "POSTING..." : "+ POST"}
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
