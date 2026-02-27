"use client";

/**
 * Age Indicator Component
 *
 * Age badge with clock icon showing time since posted
 * - Real-time updates every minute
 * - Tooltip with exact timestamp
 * - Centralized age calculation utility
 */

import React, { useState, useEffect } from "react";
import { AgeIndicatorProps } from "@/types/loadboard-ui";
import { calculateAge, formatExactTimestamp } from "@/lib/utils/ageCalculation";

export default function AgeIndicator({
  date,
  className = "",
  showIcon = true,
}: AgeIndicatorProps) {
  // State to trigger re-render on age update
  const [, setCurrentTime] = useState(() => Date.now());

  // Real-time updates every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate age using centralized utility
  const ageResult = calculateAge(date);
  const exactTimestamp = formatExactTimestamp(date);

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${ageResult.colorClass} ${className} cursor-help`}
      title={`Posted: ${exactTimestamp}`}
    >
      {showIcon && <span>🕐</span>}
      <span>{ageResult.value}</span>
    </div>
  );
}
