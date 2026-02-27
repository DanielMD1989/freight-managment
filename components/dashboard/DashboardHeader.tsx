/**
 * Dashboard Header Component
 *
 * Sprint 20 - Story 20.1: Code Refactoring
 * Extracted from duplicate implementations across dashboards
 *
 * Shows welcome message with user name and current date
 */

"use client";

import React from "react";
import { getTimeGreeting, getTodayFormatted } from "@/lib/formatters";

interface DashboardHeaderProps {
  userName?: string;
  userEmail?: string;
  subtitle?: string;
}

export default function DashboardHeader({
  userName,
  userEmail,
  subtitle,
}: DashboardHeaderProps) {
  const greeting = getTimeGreeting();
  const today = getTodayFormatted();

  // Extract first name from full name or email
  const firstName = userName
    ? userName.split(" ")[0]
    : userEmail
      ? userEmail.split("@")[0]
      : "there";

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight lg:text-[28px]"
            style={{ color: "var(--foreground)" }}
          >
            {greeting}, {firstName}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--foreground-muted)" }}
          >
            {subtitle || today}
          </p>
        </div>
      </div>
    </div>
  );
}
