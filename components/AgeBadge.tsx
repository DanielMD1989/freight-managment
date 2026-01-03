/**
 * Age Badge Component
 *
 * Displays post age with FRESH/NEW badges and relative time
 * Sprint 15 - Story 15.10: Age Calculation
 */

'use client';

import { useEffect, useState } from 'react';
import { calculatePostAge, getAgeBadgeProps, getAgeTooltip } from '@/lib/ageCalculation';

interface AgeBadgeProps {
  createdAt: string | Date;
  showBadge?: boolean;
  showAge?: boolean;
  liveUpdate?: boolean;
  className?: string;
}

export default function AgeBadge({
  createdAt,
  showBadge = true,
  showAge = true,
  liveUpdate = false,
  className = '',
}: AgeBadgeProps) {
  const [age, setAge] = useState(() => calculatePostAge(createdAt));

  // Live countdown - update age every minute if enabled
  useEffect(() => {
    if (!liveUpdate) return;

    const interval = setInterval(() => {
      setAge(calculatePostAge(createdAt));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [createdAt, liveUpdate]);

  const badgeProps = getAgeBadgeProps(age.badge);
  const tooltip = getAgeTooltip(createdAt);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title={tooltip}>
      {/* Badge (FRESH/NEW) */}
      {showBadge && badgeProps && (
        <span
          className={`px-2 py-0.5 text-xs font-bold rounded border ${badgeProps.className}`}
        >
          {badgeProps.text}
        </span>
      )}

      {/* Relative Time */}
      {showAge && (
        <span className={`text-sm font-medium ${age.colorClass}`}>
          {age.displayText}
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for table cells
 */
export function AgeBadgeCompact({ createdAt }: { createdAt: string | Date }) {
  return (
    <AgeBadge
      createdAt={createdAt}
      showBadge={true}
      showAge={true}
      className="text-xs"
    />
  );
}

/**
 * Badge only version
 */
export function AgeBadgeOnly({ createdAt }: { createdAt: string | Date }) {
  return (
    <AgeBadge
      createdAt={createdAt}
      showBadge={true}
      showAge={false}
    />
  );
}

/**
 * Time only version with color coding
 */
export function AgeTimeOnly({ createdAt }: { createdAt: string | Date }) {
  return (
    <AgeBadge
      createdAt={createdAt}
      showBadge={false}
      showAge={true}
    />
  );
}
