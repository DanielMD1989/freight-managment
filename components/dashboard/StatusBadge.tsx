/**
 * Status Badge Component
 *
 * Sprint 20 - Story 20.1: Code Refactoring
 * Extracted from duplicate implementations across dashboards
 */

import React from "react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusStyles: Record<string, string> = {
  // Load statuses
  DRAFT: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  POSTED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  MATCHED: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  ACCEPTED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ASSIGNED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PICKUP_PENDING: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  PICKED_UP: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  IN_TRANSIT: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  DELIVERED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CANCELLED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  EXPIRED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",

  // Request statuses
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  APPROVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",

  // Truck statuses
  AVAILABLE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ON_JOB: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  MAINTENANCE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  INACTIVE: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const sizeClasses =
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  const style = statusStyles[status] || statusStyles.PENDING;
  const displayText = status.replace(/_/g, " ");

  return (
    <span className={`${sizeClasses} rounded-full font-medium ${style}`}>
      {displayText}
    </span>
  );
}
