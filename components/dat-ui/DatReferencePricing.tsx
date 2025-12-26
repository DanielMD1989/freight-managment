'use client';

/**
 * DAT Reference Pricing Component
 *
 * Display market reference rates (TriHaul, Broker Spot) in cyan text
 * Sprint 14 - DAT-Style UI Transformation
 */

import React from 'react';
import { DatReferencePricingProps } from '@/types/dat-ui';

export default function DatReferencePricing({
  trihaulRate,
  brokerSpotRate,
  loading = false,
  className = '',
}: DatReferencePricingProps) {
  /**
   * Format currency
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return 'N/A';
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
  if (!trihaulRate && !brokerSpotRate) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>
        <span>No reference pricing available</span>
      </div>
    );
  }

  return (
    <div className={`text-sm font-medium text-cyan-600 ${className}`}>
      {trihaulRate && (
        <span className="mr-4">
          Best TriHaul: <span className="font-semibold">{formatCurrency(trihaulRate)}</span>
        </span>
      )}
      {brokerSpotRate && (
        <span>
          Broker Spot: <span className="font-semibold">{formatCurrency(brokerSpotRate)}</span>
        </span>
      )}
    </div>
  );
}
