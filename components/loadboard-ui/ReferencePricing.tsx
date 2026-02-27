"use client";

/**
 * Reference Pricing Component
 *
 * Display market reference rates (TriHaul, Broker Spot) in cyan text
 * Load Board UI Component Library
 */

import React from "react";
import { ReferencePricingProps } from "@/types/loadboard-ui";

export default function ReferencePricing({
  trihaulRate,
  triHaulRate,
  brokerSpotRate,
  loading = false,
  className = "",
}: ReferencePricingProps) {
  // Support both naming conventions
  const effectiveTrihaulRate = trihaulRate ?? triHaulRate;

  /**
   * Format currency
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "N/A";
    return `$${amount.toFixed(2)}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`text-sm text-cyan-600 ${className}`}>
        <span className="animate-pulse">Loading reference pricing...</span>
      </div>
    );
  }

  // No rates available
  if (!effectiveTrihaulRate && !brokerSpotRate) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>
        <span>No reference pricing available</span>
      </div>
    );
  }

  return (
    <div className={`text-sm font-medium text-cyan-600 ${className}`}>
      {effectiveTrihaulRate && (
        <span className="mr-4">
          Best TriHaul:{" "}
          <span className="font-semibold">
            {formatCurrency(effectiveTrihaulRate)}
          </span>
        </span>
      )}
      {brokerSpotRate && (
        <span>
          Broker Spot:{" "}
          <span className="font-semibold">
            {formatCurrency(brokerSpotRate)}
          </span>
        </span>
      )}
    </div>
  );
}
