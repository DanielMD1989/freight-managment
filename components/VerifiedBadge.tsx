/**
 * Verified Badge Component
 *
 * Sprint 16 - Story 16.5: Trust & Reliability Features
 *
 * Displays a checkmark badge for admin-verified organizations
 */

import React from 'react';

interface VerifiedBadgeProps {
  isVerified: boolean;
  verifiedAt?: Date | null;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export default function VerifiedBadge({
  isVerified,
  verifiedAt,
  size = 'md',
  showTooltip = true,
}: VerifiedBadgeProps) {
  if (!isVerified) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-6 h-6 text-base',
  };

  const tooltip = verifiedAt
    ? `Verified by Admin on ${new Date(verifiedAt).toLocaleDateString()}`
    : 'Verified by Admin';

  return (
    <div className="inline-flex items-center" title={showTooltip ? tooltip : undefined}>
      <svg
        className={`${sizeClasses[size]} text-blue-600`}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

/**
 * Inline Verified Badge with Label
 *
 * Shows verified badge with "Verified" text label
 */
export function VerifiedBadgeWithLabel({
  isVerified,
  verifiedAt,
  size = 'md',
}: VerifiedBadgeProps) {
  if (!isVerified) {
    return null;
  }

  const tooltip = verifiedAt
    ? `Verified on ${new Date(verifiedAt).toLocaleDateString()}`
    : 'Admin verified';

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
      title={tooltip}
    >
      <svg
        className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>Verified</span>
    </span>
  );
}
