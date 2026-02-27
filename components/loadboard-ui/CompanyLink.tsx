"use client";

/**
 * Company Link Component
 *
 * Clickable company name that opens company details modal
 */

import React from "react";
import { CompanyLinkProps } from "@/types/loadboard-ui";

export default function CompanyLink({
  companyId,
  companyName,
  isMasked = false,
  onClick,
  className = "",
}: CompanyLinkProps) {
  /**
   * Get display name
   */
  const getDisplayName = (): string => {
    if (isMasked) {
      // Generate consistent masked name based on companyId
      const hash = companyId
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const maskedNumber = (hash % 9000) + 1000; // 4-digit number
      return `Company #${maskedNumber}`;
    }
    return companyName;
  };

  const displayName = getDisplayName();

  return (
    <button
      onClick={() => onClick?.(companyId)}
      className={`cursor-pointer font-medium text-[#1e9c99] transition-colors hover:text-[#064d51] hover:underline ${className} `}
      title={isMasked ? "Click to view company details" : companyName}
    >
      {displayName}
    </button>
  );
}
