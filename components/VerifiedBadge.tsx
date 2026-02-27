/**
 * Verified Badge Component
 *
 * Professional verified badge with modern design and animations
 * Design System: Clean & Minimal with Teal accent
 */

import React from "react";

interface VerifiedBadgeProps {
  isVerified: boolean;
  verifiedAt?: Date | null;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export default function VerifiedBadge({
  isVerified,
  verifiedAt,
  size = "md",
  showTooltip = true,
}: VerifiedBadgeProps) {
  if (!isVerified) {
    return null;
  }

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const tooltip = verifiedAt
    ? `Verified by Admin on ${new Date(verifiedAt).toLocaleDateString()}`
    : "Verified by Admin";

  return (
    <div
      className="group relative inline-flex items-center"
      title={showTooltip ? tooltip : undefined}
    >
      <div className="relative">
        <svg
          className={`${sizeClasses[size]} text-teal-500 drop-shadow-sm`}
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Inline Verified Badge with Label
 *
 * Shows verified badge with "Verified" text label in a pill
 */
export function VerifiedBadgeWithLabel({
  isVerified,
  verifiedAt,
  size = "md",
}: VerifiedBadgeProps) {
  if (!isVerified) {
    return null;
  }

  const tooltip = verifiedAt
    ? `Verified on ${new Date(verifiedAt).toLocaleDateString()}`
    : "Admin verified";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/60 bg-gradient-to-r from-teal-50 to-emerald-50 px-2.5 py-1 text-xs font-semibold text-teal-700 shadow-sm"
      title={tooltip}
    >
      <svg
        className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>Verified</span>
    </span>
  );
}
