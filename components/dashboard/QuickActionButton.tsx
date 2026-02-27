"use client";

/**
 * QuickActionButton Component
 *
 * Reusable quick action button for dashboards
 * Sprint 20 - Dashboard Visual Redesign
 */

import React from "react";
import Link from "next/link";

interface QuickActionButtonProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  variant?: "primary" | "secondary" | "outline";
}

export default function QuickActionButton({
  href,
  icon,
  label,
  description,
  variant = "outline",
}: QuickActionButtonProps) {
  const baseStyles =
    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200";

  const variantStyles = {
    primary:
      "bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/25 hover:shadow-lg hover:shadow-primary-500/30",
    secondary:
      "bg-secondary-500 hover:bg-secondary-600 text-white shadow-md shadow-secondary-500/25 hover:shadow-lg hover:shadow-secondary-500/30",
    outline:
      "border hover:border-primary-500/50 dark:hover:border-primary-400/50",
  };

  return (
    <Link
      href={href}
      className={`${baseStyles} ${variantStyles[variant]}`}
      style={
        variant === "outline"
          ? {
              background: "var(--card)",
              borderColor: "var(--border)",
            }
          : undefined
      }
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
          variant === "outline"
            ? "bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 group-hover:bg-primary-500/20"
            : "bg-white/20"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-medium ${
            variant === "outline" ? "" : "text-white"
          }`}
          style={
            variant === "outline" ? { color: "var(--foreground)" } : undefined
          }
        >
          {label}
        </div>
        {description && (
          <div
            className={`text-xs ${
              variant === "outline" ? "" : "text-white/70"
            }`}
            style={
              variant === "outline"
                ? { color: "var(--foreground-muted)" }
                : undefined
            }
          >
            {description}
          </div>
        )}
      </div>
      {variant === "outline" && (
        <svg
          className="h-4 w-4 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-70"
          style={{ color: "var(--foreground-muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      )}
    </Link>
  );
}
