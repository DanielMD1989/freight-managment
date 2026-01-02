/**
 * GPS Utility Functions
 *
 * Pure utility functions for GPS-related calculations that don't require database access.
 * Safe to use in both client and server components.
 */

/**
 * Check GPS freshness and return human-readable string
 *
 * Returns how long ago the GPS was last seen:
 * - "just now" if < 1 minute
 * - "X min ago" if < 60 minutes
 * - "X hour(s) ago" if < 24 hours
 * - "X day(s) ago" if >= 24 hours
 * - "never" if lastSeenAt is null
 *
 * @param lastSeenAt - Last GPS update timestamp
 * @returns Human-readable freshness string
 */
export function checkGpsFreshness(lastSeenAt: Date | null): string {
  if (!lastSeenAt) {
    return 'never';
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSeenAt.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} min ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  }
}

/**
 * Get GPS signal status based on last seen time
 *
 * @param lastSeenAt - Last GPS update timestamp
 * @returns Signal status: 'active', 'weak', or 'lost'
 */
export function getGpsSignalStatus(
  lastSeenAt: Date | null
): 'active' | 'weak' | 'lost' {
  if (!lastSeenAt) {
    return 'lost';
  }

  const now = new Date();
  const diffMin = Math.floor((now.getTime() - lastSeenAt.getTime()) / (1000 * 60));

  if (diffMin < 5) {
    return 'active';
  } else if (diffMin < 30) {
    return 'weak';
  } else {
    return 'lost';
  }
}

/**
 * Get GPS status indicator based on last seen time
 *
 * - GREEN: Last seen < 5 minutes ago (Active)
 * - YELLOW: Last seen 5-30 minutes ago (Stale)
 * - RED: Last seen > 30 minutes ago (Offline)
 * - GRAY: No GPS data
 *
 * @param lastSeenAt - Last GPS update timestamp
 * @returns Status indicator object
 */
export function getGpsStatusIndicator(lastSeenAt: Date | null): {
  color: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
  label: string;
  minutesAgo: number | null;
} {
  if (!lastSeenAt) {
    return {
      color: 'GRAY',
      label: 'No GPS',
      minutesAgo: null,
    };
  }

  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000 / 60);

  if (minutesAgo < 5) {
    return {
      color: 'GREEN',
      label: 'Active',
      minutesAgo,
    };
  } else if (minutesAgo < 30) {
    return {
      color: 'YELLOW',
      label: 'Stale',
      minutesAgo,
    };
  } else {
    return {
      color: 'RED',
      label: 'Offline',
      minutesAgo,
    };
  }
}
