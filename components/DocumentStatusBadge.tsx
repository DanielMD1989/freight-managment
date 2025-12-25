/**
 * Document Status Badge Component
 *
 * Displays document verification status with color-coded badges.
 *
 * Statuses:
 * - PENDING: Yellow (awaiting verification)
 * - APPROVED: Green (verified and approved)
 * - REJECTED: Red (rejected with reason)
 * - EXPIRED: Gray (document expired)
 *
 * Sprint 8 - Story 8.5: Document Upload System - Phase 2 UI
 */

"use client";

import { VerificationStatus } from "@prisma/client";

interface DocumentStatusBadgeProps {
  status: VerificationStatus;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: "⏳",
  },
  APPROVED: {
    label: "Approved",
    color: "bg-green-100 text-green-800",
    icon: "✓",
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-800",
    icon: "✗",
  },
  EXPIRED: {
    label: "Expired",
    color: "bg-gray-100 text-gray-800",
    icon: "⚠",
  },
};

export default function DocumentStatusBadge({
  status,
  size = "md",
}: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.color}
        ${sizeClasses[size]}
      `}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
