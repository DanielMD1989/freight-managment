/**
 * Age Calculation Utilities
 *
 * Calculate posting age with color coding for freshness indicators
 * Sprint 15 - Story 15.10: Age Calculation and Display
 */

export interface AgeResult {
  value: string;
  colorClass: string;
  hours: number;
  minutes: number;
}

/**
 * Calculate age from a date with color-coded freshness
 *
 * Color scheme:
 * - Green: < 24 hours (fresh)
 * - Blue: 1 day
 * - Yellow: 2-3 days (getting old)
 * - Orange: 3-7 days (stale)
 * - Red: > 7 days (very stale)
 */
export function calculateAge(date: Date | string): AgeResult {
  const now = new Date();
  const posted = new Date(date);
  const diffMs = now.getTime() - posted.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let value: string;
  let colorClass: string;

  // Handle future dates
  if (diffMs < 0) {
    value = 'Scheduled';
    colorClass = 'bg-purple-100 text-purple-700 border-purple-300';
  } else if (diffHours < 1) {
    value = `${diffMinutes}m`;
    colorClass = 'bg-green-100 text-green-700 border-green-300'; // Very fresh
  } else if (diffHours < 24) {
    value = `${diffHours}h`;
    colorClass = 'bg-green-100 text-green-700 border-green-300'; // Fresh (< 24h)
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

  return {
    value,
    colorClass,
    hours: diffHours,
    minutes: diffMinutes,
  };
}

/**
 * Format exact timestamp for tooltip display
 */
export function formatExactTimestamp(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
