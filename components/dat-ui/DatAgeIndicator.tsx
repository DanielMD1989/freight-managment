'use client';

/**
 * DAT Age Indicator Component
 *
 * Age badge with clock icon showing time since posted
 * Sprint 15 - Story 15.10: Age Calculation & Display
 * - Real-time updates every minute
 * - Tooltip with exact timestamp
 * - Centralized age calculation utility
 */

import React, { useState, useEffect } from 'react';
import { DatAgeIndicatorProps } from '@/types/dat-ui';
import { calculateAge, formatExactTimestamp } from '@/lib/utils/ageCalculation';

export default function DatAgeIndicator({
  date,
  className = '',
  showIcon = true,
}: DatAgeIndicatorProps) {
  // State to trigger re-render on age update
  const [currentTime, setCurrentTime] = useState(Date.now());

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
      className={`
        inline-flex items-center gap-1
        px-2 py-1
        rounded-md
        border
        text-xs font-medium
        ${ageResult.colorClass}
        ${className}
        cursor-help
      `}
      title={`Posted: ${exactTimestamp}`}
    >
      {showIcon && <span>🕐</span>}
      <span>{ageResult.value}</span>
    </div>
  );
}
