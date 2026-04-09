"use client";

/**
 * StatCard Component
 *
 * Reusable stat card for all dashboards
 * Sprint 20 - Dashboard Visual Redesign
 */

import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: "primary" | "secondary" | "accent" | "success" | "warning" | "error";
}

const colorStyles = {
  primary: {
    iconBg: "bg-primary-500/15 dark:bg-primary-500/20",
    iconColor: "text-primary-600 dark:text-primary-400",
    dot: "bg-primary-500",
  },
  secondary: {
    iconBg: "bg-secondary-500/15 dark:bg-secondary-500/20",
    iconColor: "text-secondary-600 dark:text-secondary-400",
    dot: "bg-secondary-500",
  },
  accent: {
    iconBg: "bg-accent-500/15 dark:bg-accent-500/20",
    iconColor: "text-accent-600 dark:text-accent-400",
    dot: "bg-accent-500",
  },
  success: {
    iconBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  warning: {
    iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  error: {
    iconBg: "bg-rose-500/15 dark:bg-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "primary",
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:shadow-md"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header with icon and trend */}
      <div className="mb-4 flex items-start justify-between">
        <div
          className={`h-11 w-11 rounded-xl ${styles.iconBg} ${styles.iconColor} flex items-center justify-center`}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              trend.positive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            {trend.positive ? "+" : ""}
            {trend.value}
          </span>
        )}
      </div>

      {/* Value */}
      <div
        className="mb-1 truncate text-3xl font-bold tracking-tight"
        style={{ color: "var(--foreground)" }}
        title={String(value)}
      >
        {value}
      </div>

      {/* Title */}
      <div
        className="text-sm font-medium"
        style={{ color: "var(--foreground-muted)" }}
      >
        {title}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          className="mt-1 text-xs"
          style={{ color: "var(--foreground-muted)", opacity: 0.7 }}
        >
          {subtitle}
        </div>
      )}

      {/* Decorative dot */}
      <div
        className={`absolute -right-3 -bottom-3 h-24 w-24 rounded-full ${styles.dot} opacity-5`}
      />
    </div>
  );
}
