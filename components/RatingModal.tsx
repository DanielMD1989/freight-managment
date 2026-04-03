"use client";

/**
 * RatingModal — Submit 1-5 star rating for a trip
 * §12 Ratings & Reviews
 */

import { useState } from "react";
import StarRating from "./StarRating";
import { getCSRFToken } from "@/lib/csrfFetch";
import toast from "react-hot-toast";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  ratedOrgName: string;
  raterLabel: string; // "Rate Carrier" or "Rate Shipper"
  onSuccess: () => void;
}

export default function RatingModal({
  isOpen,
  onClose,
  tripId,
  ratedOrgName,
  raterLabel,
  onSuccess,
}: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (stars === 0) {
      toast.error("Please select a rating (1-5 stars)");
      return;
    }

    setSubmitting(true);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`/api/trips/${tripId}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({
          stars,
          comment: comment.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Rating submitted!");
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to submit rating");
      }
    } catch {
      toast.error("Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">{raterLabel}</h3>
          <p className="mt-0.5 text-sm text-slate-300">{ratedOrgName}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="mb-4 text-center">
            <p
              className="mb-3 text-sm"
              style={{ color: "var(--foreground-muted)" }}
            >
              How was your experience?
            </p>
            <div className="flex justify-center">
              <StarRating value={stars} onChange={setStars} size="lg" />
            </div>
            {stars > 0 && (
              <p
                className="mt-2 text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {stars === 5
                  ? "Excellent!"
                  : stars === 4
                    ? "Great"
                    : stars === 3
                      ? "Good"
                      : stars === 2
                        ? "Fair"
                        : "Poor"}
              </p>
            )}
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-semibold tracking-wide uppercase"
              style={{ color: "var(--foreground-muted)" }}
            >
              Comment{" "}
              <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 300))}
              placeholder="Share your experience..."
              rows={3}
              maxLength={300}
              className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
              style={{
                background: "var(--card)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            />
            <p
              className="mt-1 text-right text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              {comment.length}/300
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || stars === 0}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}
