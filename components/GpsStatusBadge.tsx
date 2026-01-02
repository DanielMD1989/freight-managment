/**
 * GPS Status Badge Component
 *
 * Sprint 16 - Story 16.5: Trust & Reliability Features
 *
 * Displays GPS status indicator with color coding:
 * - GREEN: Last seen < 5 minutes ago (Active)
 * - YELLOW: Last seen 5-30 minutes ago (Stale)
 * - RED: Last seen > 30 minutes ago (Offline)
 * - GRAY: No GPS data
 */

import React from 'react';
import { getGpsStatusIndicator } from '@/lib/gpsUtils';

interface GpsStatusBadgeProps {
  lastSeenAt: Date | null;
  imei?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function GpsStatusBadge({
  lastSeenAt,
  imei,
  size = 'md',
  showLabel = true,
}: GpsStatusBadgeProps) {
  const status = getGpsStatusIndicator(lastSeenAt);

  const colorClasses = {
    GREEN: 'bg-green-100 text-green-800 border-green-300',
    YELLOW: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    RED: 'bg-red-100 text-red-800 border-red-300',
    GRAY: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const dotColorClasses = {
    GREEN: 'bg-green-500',
    YELLOW: 'bg-yellow-500',
    RED: 'bg-red-500',
    GRAY: 'bg-gray-400',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  // Show icon only version if no label
  if (!showLabel) {
    return (
      <span
        className={`inline-flex items-center justify-center ${sizeClasses[size]} ${colorClasses[status.color]} border rounded-full`}
        title={status.label}
      >
        <span className={`${dotSizeClasses[size]} ${dotColorClasses[status.color]} rounded-full ${status.color === 'GREEN' ? 'animate-pulse' : ''}`}></span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} ${colorClasses[status.color]} border rounded-full font-medium`}
      title={imei ? `IMEI: ${imei}` : undefined}
    >
      <span className={`${dotSizeClasses[size]} ${dotColorClasses[status.color]} rounded-full ${status.color === 'GREEN' ? 'animate-pulse' : ''}`}></span>
      <span>{status.label}</span>
    </span>
  );
}

/**
 * GPS Status Badge with Icon
 *
 * Shows GPS status with location pin icon
 */
export function GpsStatusBadgeWithIcon({
  lastSeenAt,
  imei,
  size = 'md',
}: Omit<GpsStatusBadgeProps, 'showLabel'>) {
  const status = getGpsStatusIndicator(lastSeenAt);

  const colorClasses = {
    GREEN: 'text-green-600',
    YELLOW: 'text-yellow-600',
    RED: 'text-red-600',
    GRAY: 'text-gray-400',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="inline-flex items-center gap-1" title={imei ? `IMEI: ${imei}` : 'No GPS'}>
      <svg
        className={`${iconSizeClasses[size]} ${colorClasses[status.color]}`}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
          clipRule="evenodd"
        />
      </svg>
      <span className={`${textSizeClasses[size]} ${colorClasses[status.color]} font-medium`}>
        {status.label}
      </span>
    </div>
  );
}

/**
 * GPS Equipped Badge
 *
 * Simple badge indicating truck has GPS
 */
export function GpsEquippedBadge({ hasGps }: { hasGps: boolean }) {
  if (!hasGps) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
      <svg
        className="w-3 h-3"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
          clipRule="evenodd"
        />
      </svg>
      <span>GPS-equipped</span>
    </span>
  );
}
