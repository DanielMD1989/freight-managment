"use client";

/**
 * Edit Load Form Component
 *
 * Single-page form for editing an existing load
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

const TRUCK_TYPES = [
  { value: "FLATBED", label: "Flatbed", icon: "🚛" },
  { value: "REFRIGERATED", label: "Refrigerated", icon: "❄️" },
  { value: "TANKER", label: "Tanker", icon: "🛢️" },
  { value: "CONTAINER", label: "Container", icon: "📦" },
  { value: "DRY_VAN", label: "Dry Van", icon: "🚚" },
  { value: "LOWBOY", label: "Lowboy", icon: "🔧" },
  { value: "DUMP_TRUCK", label: "Dump Truck", icon: "🏗️" },
  { value: "BOX_TRUCK", label: "Box Truck", icon: "📤" },
];

const ETHIOPIAN_CITIES = [
  "Addis Ababa",
  "Dire Dawa",
  "Mekelle",
  "Gondar",
  "Bahir Dar",
  "Hawassa",
  "Awasa",
  "Jimma",
  "Jijiga",
  "Shashamane",
  "Bishoftu",
  "Arba Minch",
  "Hosaena",
  "Harar",
  "Dilla",
  "Nekemte",
  "Debre Birhan",
  "Asella",
  "Debre Markos",
  "Kombolcha",
  "Debre Tabor",
  "Adigrat",
  "Woldiya",
  "Sodo",
  "Gambela",
];

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  pickupDate: string;
  deliveryDate?: string | null;
  truckType: string;
  weight: number;
  fullPartial: string;
  cargoDescription?: string | null;
  specialInstructions?: string | null;
  isFragile?: boolean;
  requiresRefrigeration?: boolean;
  bookMode?: string;
  isAnonymous?: boolean;
  shipperContactName?: string | null;
  shipperContactPhone?: string | null;
  status: string;
}

interface EditLoadFormProps {
  load: Load;
}

export default function EditLoadForm({ load }: EditLoadFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    pickupCity: load.pickupCity || "",
    deliveryCity: load.deliveryCity || "",
    pickupAddress: load.pickupAddress || "",
    deliveryAddress: load.deliveryAddress || "",
    pickupDate: load.pickupDate
      ? new Date(load.pickupDate).toISOString().split("T")[0]
      : "",
    deliveryDate: load.deliveryDate
      ? new Date(load.deliveryDate).toISOString().split("T")[0]
      : "",
    truckType: load.truckType || "FLATBED",
    weight: load.weight?.toString() || "",
    fullPartial: load.fullPartial || "FULL",
    cargoDescription: load.cargoDescription || "",
    specialInstructions: load.specialInstructions || "",
    isFragile: load.isFragile || false,
    requiresRefrigeration: load.requiresRefrigeration || false,
    bookMode: load.bookMode || "REQUEST",
    isAnonymous: load.isAnonymous || false,
    shipperContactName: load.shipperContactName || "",
    shipperContactPhone: load.shipperContactPhone || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateForm = (): boolean => {
    if (!formData.pickupCity || !formData.deliveryCity) {
      setError("Pickup and delivery cities are required");
      return false;
    }
    if (!formData.pickupDate) {
      setError("Pickup date is required");
      return false;
    }
    if (
      formData.deliveryDate &&
      new Date(formData.deliveryDate) <= new Date(formData.pickupDate)
    ) {
      setError("Delivery date must be after pickup date");
      return false;
    }
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      setError("Valid weight is required");
      return false;
    }
    if (!formData.cargoDescription || formData.cargoDescription.length < 5) {
      setError("Cargo description must be at least 5 characters");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError("");

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setError("Failed to get CSRF token. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const updateData: Record<string, unknown> = {
        pickupCity: formData.pickupCity,
        deliveryCity: formData.deliveryCity,
        pickupAddress: formData.pickupAddress || null,
        deliveryAddress: formData.deliveryAddress || null,
        pickupDate: formData.pickupDate,
        deliveryDate: formData.deliveryDate || null,
        truckType: formData.truckType,
        weight: parseFloat(formData.weight),
        fullPartial: formData.fullPartial,
        cargoDescription: formData.cargoDescription || null,
        specialInstructions: formData.specialInstructions || null,
        bookMode: formData.bookMode,
        shipperContactName: formData.shipperContactName || null,
        shipperContactPhone: formData.shipperContactPhone || null,
      };

      const response = await fetch(`/api/loads/${load.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(updateData),
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Load updated successfully!");
        router.push(`/shipper/loads/${load.id}`);
        router.refresh();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to update load";
        setError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error updating load:", error);
      const errorMessage = "Failed to update load. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--card)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="space-y-6 p-4">
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        {/* Route Section */}
        <div>
          <h3
            className="mb-3 text-sm font-semibold tracking-wide uppercase"
            style={{ color: "var(--foreground)" }}
          >
            Route
          </h3>
          <div
            className="flex items-center gap-4 rounded-lg p-4"
            style={{ background: "var(--bg-tinted)" }}
          >
            <div className="flex-1">
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Pickup City
              </label>
              <select
                value={formData.pickupCity}
                onChange={(e) => updateField("pickupCity", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              >
                <option value="">Select origin...</option>
                {ETHIOPIAN_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-center pt-4">
              <svg
                className="h-6 w-6"
                style={{ color: "var(--primary-500)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </div>
            <div className="flex-1">
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Delivery City
              </label>
              <select
                value={formData.deliveryCity}
                onChange={(e) => updateField("deliveryCity", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              >
                <option value="">Select destination...</option>
                {ETHIOPIAN_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Pickup Date
              </label>
              <input
                type="date"
                value={formData.pickupDate}
                onChange={(e) => updateField("pickupDate", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Delivery Date
              </label>
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => updateField("deliveryDate", e.target.value)}
                min={formData.pickupDate || undefined}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Addresses */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Pickup Address <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.pickupAddress}
                onChange={(e) => updateField("pickupAddress", e.target.value)}
                placeholder="Specific location..."
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Delivery Address <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.deliveryAddress}
                onChange={(e) => updateField("deliveryAddress", e.target.value)}
                placeholder="Specific location..."
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Cargo Section */}
        <div>
          <h3
            className="mb-3 text-sm font-semibold tracking-wide uppercase"
            style={{ color: "var(--foreground)" }}
          >
            Cargo
          </h3>

          {/* Truck Type Grid */}
          <div>
            <label
              className="mb-2 block text-[10px] font-semibold tracking-wide uppercase"
              style={{ color: "var(--foreground-muted)" }}
            >
              Truck Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TRUCK_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateField("truckType", type.value)}
                  className={`rounded-lg border p-2 text-center transition-all ${
                    formData.truckType === type.value
                      ? "ring-2 ring-teal-500"
                      : "hover:border-teal-300"
                  }`}
                  style={{
                    background:
                      formData.truckType === type.value
                        ? "var(--bg-tinted)"
                        : "var(--card)",
                    borderColor:
                      formData.truckType === type.value
                        ? "var(--primary-500)"
                        : "var(--border)",
                  }}
                >
                  <div className="text-lg">{type.icon}</div>
                  <div
                    className="mt-0.5 text-[10px] font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {type.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Weight & Load Type */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Weight (kg)
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => updateField("weight", e.target.value)}
                min="0"
                placeholder="e.g. 5000"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--foreground-muted)" }}
              >
                Load Type
              </label>
              <div className="flex gap-2">
                {[
                  { value: "FULL", label: "Full" },
                  { value: "PARTIAL", label: "Partial" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("fullPartial", opt.value)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                      formData.fullPartial === opt.value
                        ? "ring-2 ring-teal-500"
                        : ""
                    }`}
                    style={{
                      background:
                        formData.fullPartial === opt.value
                          ? "var(--primary-500)"
                          : "var(--card)",
                      color:
                        formData.fullPartial === opt.value
                          ? "white"
                          : "var(--foreground)",
                      borderColor:
                        formData.fullPartial === opt.value
                          ? "var(--primary-500)"
                          : "var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cargo Description */}
          <div className="mt-3">
            <label
              className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
              style={{ color: "var(--foreground-muted)" }}
            >
              Cargo Description
            </label>
            <textarea
              value={formData.cargoDescription}
              onChange={(e) => updateField("cargoDescription", e.target.value)}
              rows={2}
              placeholder="Describe your cargo..."
              className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Special Requirements */}
          <div className="mt-3 flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <input
                type="checkbox"
                checked={formData.isFragile}
                onChange={(e) => updateField("isFragile", e.target.checked)}
                className="h-4 w-4 rounded accent-teal-600"
              />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>
                Fragile
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <input
                type="checkbox"
                checked={formData.requiresRefrigeration}
                onChange={(e) =>
                  updateField("requiresRefrigeration", e.target.checked)
                }
                className="h-4 w-4 rounded accent-teal-600"
              />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>
                Refrigerated
              </span>
            </label>
          </div>
        </div>

        {/* Options Section */}
        <div>
          <h3
            className="mb-3 text-sm font-semibold tracking-wide uppercase"
            style={{ color: "var(--foreground)" }}
          >
            Options
          </h3>

          {/* Booking Mode */}
          <div>
            <label
              className="mb-2 block text-[10px] font-semibold tracking-wide uppercase"
              style={{ color: "var(--foreground-muted)" }}
            >
              Booking Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "REQUEST",
                  label: "Request",
                  desc: "Review bids first",
                },
                {
                  value: "INSTANT",
                  label: "Instant",
                  desc: "First come, first served",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField("bookMode", opt.value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    formData.bookMode === opt.value
                      ? "ring-2 ring-teal-500"
                      : ""
                  }`}
                  style={{
                    background:
                      formData.bookMode === opt.value
                        ? "var(--bg-tinted)"
                        : "var(--card)",
                    borderColor:
                      formData.bookMode === opt.value
                        ? "var(--primary-500)"
                        : "var(--border)",
                  }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {opt.label}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <input
              type="checkbox"
              checked={formData.isAnonymous}
              onChange={(e) => updateField("isAnonymous", e.target.checked)}
              className="h-4 w-4 rounded accent-teal-600"
            />
            <span className="text-sm" style={{ color: "var(--foreground)" }}>
              Post anonymously
            </span>
          </label>

          {/* Contact */}
          {!formData.isAnonymous && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.shipperContactName}
                  onChange={(e) =>
                    updateField("shipperContactName", e.target.value)
                  }
                  placeholder="Your name"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.shipperContactPhone}
                  onChange={(e) =>
                    updateField("shipperContactPhone", e.target.value)
                  }
                  placeholder="+251..."
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div className="mt-3">
            <label
              className="mb-1 block text-[10px] font-semibold tracking-wide uppercase"
              style={{ color: "var(--foreground-muted)" }}
            >
              Special Instructions{" "}
              <span className="font-normal">(optional)</span>
            </label>
            <textarea
              value={formData.specialInstructions}
              onChange={(e) =>
                updateField("specialInstructions", e.target.value)
              }
              rows={2}
              placeholder="Any special notes..."
              className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div
        className="flex justify-between px-4 py-3"
        style={{
          background: "var(--bg-tinted)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
          style={{
            borderColor: "var(--border)",
            color: "var(--foreground)",
            background: "var(--card)",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg px-5 py-2 text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: "var(--primary-500)", color: "white" }}
        >
          {isSubmitting ? "Saving..." : "Update Load"}
        </button>
      </div>
    </form>
  );
}
