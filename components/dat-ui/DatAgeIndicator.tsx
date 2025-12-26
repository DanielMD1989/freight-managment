'use client';

/**
 * DAT Age Indicator Component
 *
 * Age badge with clock icon showing time since posted
 * Sprint 14 - DAT-Style UI Transformation
 */

import React from 'react';
import { DatAgeIndicatorProps } from '@/types/dat-ui';

export default function DatAgeIndicator({
  date,
  className = '',
  showIcon = true,
}: DatAgeIndicatorProps) {
  /**
   * Calculate age from date
   */
  const calculateAge = (): { value: string; colorClass: string } => {
    const now = new Date();
    const posted = new Date(date);
    const diffMs = now.getTime() - posted.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    let value: string;
    let colorClass: string;

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      value = `${diffMinutes}m`;
      colorClass = 'bg-green-100 text-green-700 border-green-300'; // Very fresh
    } else if (diffHours < 24) {
      value = `${diffHours}h`;
      colorClass = 'bg-green-100 text-green-700 border-green-300'; // Fresh
    } else if (diffDays === 1) {
      value = '1d';
      colorClass = 'bg-blue-100 text-blue-700 border-blue-300'; // 1 day
    } else if (diffDays < 3) {
      value = `${diffDays}d`;
      colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-300'; // 2-3 days
    } else if (diffDays < 7) {
      value = `${diffDays}d`;
      colorClass = 'bg-orange-100 text-orange-700 border-orange-300'; // 3-7 days
    } else if (diffDays < 30) {
      value = `${diffDays}d`;
      colorClass = 'bg-red-100 text-red-700 border-red-300'; // 1+ weeks
    } else {
      const diffMonths = Math.floor(diffDays / 30);
      value = `${diffMonths}mo`;
      colorClass = 'bg-red-100 text-red-700 border-red-300'; // Months old
    }

    return { value, colorClass };
  };

  const { value, colorClass } = calculateAge();

  return (
    <div
      className={`
        inline-flex items-center gap-1
        px-2 py-1
        rounded-md
        border
        text-xs font-medium
        ${colorClass}
        ${className}
      `}
    >
      {showIcon && <span>🕐</span>}
      <span>{value}</span>
    </div>
  );
}
