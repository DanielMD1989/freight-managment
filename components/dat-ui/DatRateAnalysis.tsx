'use client';

/**
 * DAT Rate Analysis Component
 *
 * Rate analysis panel for carrier load search showing rate per mile/trip
 * Sprint 14 - DAT-Style UI Transformation
 */

import React from 'react';
import { DatRateAnalysisProps } from '@/types/dat-ui';
import DatActionButton from './DatActionButton';

export default function DatRateAnalysis({
  rateType = 'SHIPPER-TO-CARRIER SPOT',
  ratePerMile,
  ratePerTrip,
  totalMiles,
  averageSpeed,
  ageHours,
  onRateBias,
  onEdit,
  onDelete,
  className = '',
}: DatRateAnalysisProps) {
  /**
   * Format currency
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return 'N/A';
    return `$${amount.toFixed(2)}`;
  };

  /**
   * Format large currency (for per trip)
   */
  const formatLargeCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return 'N/A';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /**
   * Calculate metadata string
   */
  const getMetadata = (): string => {
    const parts: string[] = [];

    if (ageHours !== undefined) {
      parts.push(`age ${ageHours}h`);
    }

    if (averageSpeed !== undefined) {
      parts.push(`${averageSpeed.toFixed(2)} mph`);
    }

    return parts.length > 0 ? `incl. ${parts.join(' ')}` : '';
  };

  const metadata = getMetadata();

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-200 ${className}`}>
      {/* Header with Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
          {rateType}
        </span>
        <div className="flex gap-2">
          {onRateBias && (
            <button
              onClick={onRateBias}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Rate Bias
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Rate Display */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        {/* Rate per Mile */}
        <div>
          <div className="text-sm text-gray-600 mb-1">Rate per Mile</div>
          <div className="text-4xl font-bold text-blue-600">
            {formatCurrency(ratePerMile)}
          </div>
          <div className="text-xs text-gray-500 mt-1">per mile</div>
        </div>

        {/* Rate per Trip */}
        <div>
          <div className="text-sm text-gray-600 mb-1">Rate per Trip</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatLargeCurrency(ratePerTrip)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {totalMiles ? `${totalMiles} miles total` : 'total trip'}
          </div>
        </div>
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="text-xs text-gray-600 mb-4 italic">
          {metadata}
        </div>
      )}

      {/* Analysis Links */}
      <div className="border-t border-blue-200 pt-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <button className="text-blue-600 hover:text-blue-800 hover:underline">
            📊 Utilizes Trip
          </button>
          <button className="text-blue-600 hover:text-blue-800 hover:underline">
            🔥 Hot Analysis
          </button>
          <button className="text-blue-600 hover:text-blue-800 hover:underline">
            🗺️ Route Builder
          </button>
        </div>
      </div>

      {/* Calculation Details */}
      {ratePerMile && ratePerTrip && totalMiles && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-medium hover:text-gray-800">
              Calculation Details
            </summary>
            <div className="mt-2 space-y-1 pl-4">
              <div>Rate per Mile: {formatCurrency(ratePerMile)}</div>
              <div>Total Miles: {totalMiles} miles</div>
              <div>Rate per Trip: {formatCurrency(ratePerMile)} × {totalMiles} = {formatLargeCurrency(ratePerTrip)}</div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
