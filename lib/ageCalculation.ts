/**
 * Age Calculation Utility
 *
 * Provides functions for calculating and displaying post age with badges
 * Sprint 15 - Story 15.10: Age Calculation
 */

export interface PostAge {
  ageInHours: number;
  ageInDays: number;
  displayText: string;
  badge: 'FRESH' | 'NEW' | null;
  colorClass: string;
}

/**
 * Calculate post age and return display information
 *
 * @param createdAt - ISO date string when post was created
 * @returns PostAge object with badge, color, and display text
 */
export function calculatePostAge(createdAt: string | Date): PostAge {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();

  const ageInMinutes = Math.floor(diffMs / (1000 * 60));
  const ageInHours = Math.floor(diffMs / (1000 * 60 * 60));
  const ageInDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let displayText: string;
  let badge: 'FRESH' | 'NEW' | null = null;
  let colorClass: string;

  // Determine badge
  if (ageInHours < 2) {
    badge = 'FRESH';
  } else if (ageInHours < 24) {
    badge = 'NEW';
  }

  // Determine color class (green -> yellow -> red)
  if (ageInDays < 1) {
    colorClass = 'text-green-600'; // Fresh today
  } else if (ageInDays < 3) {
    colorClass = 'text-yellow-600'; // 1-2 days old
  } else {
    colorClass = 'text-red-600'; // 3+ days old
  }

  // Determine display text (relative time)
  if (ageInMinutes < 60) {
    displayText = `${ageInMinutes}m ago`;
  } else if (ageInHours < 24) {
    displayText = `${ageInHours}h ago`;
  } else if (ageInDays < 30) {
    displayText = `${ageInDays}d ago`;
  } else {
    const ageInMonths = Math.floor(ageInDays / 30);
    displayText = `${ageInMonths}mo ago`;
  }

  return {
    ageInHours,
    ageInDays,
    displayText,
    badge,
    colorClass,
  };
}

/**
 * Get badge component props for React rendering
 */
export function getAgeBadgeProps(badge: 'FRESH' | 'NEW' | null) {
  if (!badge) return null;

  const badgeConfig = {
    FRESH: {
      text: 'FRESH',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    NEW: {
      text: 'NEW',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
    },
  };

  return badgeConfig[badge];
}

/**
 * Format age for tooltip display
 */
export function getAgeTooltip(createdAt: string | Date): string {
  const created = new Date(createdAt);
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(created);

  return `Posted on ${formatted}`;
}

/**
 * Check if post should be highlighted as fresh/new
 */
export function shouldHighlight(createdAt: string | Date): boolean {
  const age = calculatePostAge(createdAt);
  return age.ageInHours < 24;
}
