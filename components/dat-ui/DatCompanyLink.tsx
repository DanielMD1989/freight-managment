'use client';

/**
 * DAT Company Link Component
 *
 * Clickable company name that opens company details modal
 * Sprint 14 - DAT-Style UI Transformation
 */

import React from 'react';
import { DatCompanyLinkProps } from '@/types/dat-ui';

export default function DatCompanyLink({
  companyId,
  companyName,
  isMasked = false,
  onClick,
  className = '',
}: DatCompanyLinkProps) {
  /**
   * Get display name
   */
  const getDisplayName = (): string => {
    if (isMasked) {
      // Generate consistent masked name based on companyId
      const hash = companyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const maskedNumber = (hash % 9000) + 1000; // 4-digit number
      return `Company #${maskedNumber}`;
    }
    return companyName;
  };

  const displayName = getDisplayName();

  return (
    <button
      onClick={() => onClick?.(companyId)}
      className={`
        text-blue-600
        hover:text-blue-800
        hover:underline
        font-medium
        transition-colors
        cursor-pointer
        ${className}
      `}
      title={isMasked ? 'Click to view company details' : companyName}
    >
      {displayName}
    </button>
  );
}
