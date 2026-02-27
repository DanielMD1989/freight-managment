/**
 * Status Update Modal
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * Quick modal for dispatcher to update load status
 */

"use client";

import { useState } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadId: string;
  currentStatus: string;
  loadDetails: {
    pickupCity: string;
    deliveryCity: string;
  };
  onUpdateSuccess: () => void;
}

// Status colors from StatusBadge.tsx (source of truth)
const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft", color: "bg-slate-500/10 text-slate-600" },
  { value: "POSTED", label: "Posted", color: "bg-blue-500/10 text-blue-600" },
  {
    value: "ASSIGNED",
    label: "Assigned",
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    value: "IN_TRANSIT",
    label: "In Transit",
    color: "bg-indigo-500/10 text-indigo-600",
  },
  {
    value: "DELIVERED",
    label: "Delivered",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
    color: "bg-rose-500/10 text-rose-600",
  },
];

export default function StatusUpdateModal({
  isOpen,
  onClose,
  loadId,
  currentStatus,
  loadDetails,
  onUpdateSuccess,
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      setError("Please select a different status");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${loadId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      // Success
      onUpdateSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Error updating status:", err);
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="bg-opacity-50 fixed inset-0 bg-black transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-[#064d51]/15 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#064d51]">
                Update Load Status
              </h3>
              <button
                onClick={onClose}
                className="text-[#064d51]/50 hover:text-[#064d51]"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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

          {/* Body */}
          <div className="px-6 py-4">
            {/* Load Details */}
            <div className="mb-6 rounded-lg bg-[#f0fdfa] p-4">
              <h4 className="mb-2 text-sm font-medium text-[#064d51]/80">
                Load
              </h4>
              <div className="text-sm">
                <span className="font-medium text-[#064d51]">
                  {loadDetails.pickupCity} → {loadDetails.deliveryCity}
                </span>
              </div>
            </div>

            {/* Current Status */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[#064d51]/80">
                Current Status
              </label>
              <div className="flex items-center">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                    STATUS_OPTIONS.find((s) => s.value === currentStatus)?.color
                  }`}
                >
                  {STATUS_OPTIONS.find((s) => s.value === currentStatus)
                    ?.label || currentStatus}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* New Status Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#064d51]/80">
                New Status
              </label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <label
                    key={status.value}
                    className={`flex cursor-pointer items-center rounded-lg border p-3 hover:bg-[#f0fdfa] ${
                      selectedStatus === status.value
                        ? "border-[#1e9c99] bg-[#1e9c99]/10"
                        : "border-[#064d51]/15"
                    } ${
                      status.value === currentStatus
                        ? "cursor-not-allowed opacity-50"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={status.value}
                      checked={selectedStatus === status.value}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      disabled={status.value === currentStatus}
                      className="mr-3 accent-[#1e9c99]"
                    />
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Warning for certain status changes */}
            {selectedStatus === "CANCELLED" &&
              currentStatus !== "CANCELLED" && (
                <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Cancelling this load may affect
                    completion rates and trust scores.
                  </p>
                </div>
              )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-[#064d51]/15 px-6 py-4">
            <button
              onClick={onClose}
              disabled={updating}
              className="rounded-md border border-[#064d51]/20 px-4 py-2 text-[#064d51]/80 hover:bg-[#f0fdfa] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updating || selectedStatus === currentStatus}
              className="rounded-md bg-[#1e9c99] px-4 py-2 text-white hover:bg-[#064d51] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updating ? "Updating..." : "Update Status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
