"use client";

/**
 * Rate Analysis Component
 *
 * Rate analysis panel for carrier load search showing rate per mile/trip
 * Load Board UI Component Library
 */

import React from "react";
import { RateAnalysisProps } from "@/types/loadboard-ui";

export default function RateAnalysis({
  rateType = "SHIPPER-TO-CARRIER SPOT",
  ratePerMile,
  ratePerTrip,
  totalMiles,
  averageSpeed,
  ageHours,
  onRateBias,
  onEdit,
  onDelete,
  className = "",
}: RateAnalysisProps) {
  /**
   * Format currency
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "N/A";
    return `$${amount.toFixed(2)}`;
  };

  /**
   * Format large currency (for per trip)
   */
  const formatLargeCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "N/A";
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    return parts.length > 0 ? `incl. ${parts.join(" ")}` : "";
  };

  const metadata = getMetadata();

  return (
    <div
      className={`rounded-lg border border-[#1e9c99]/20 bg-gradient-to-br from-[#f0fdfa] to-[#1e9c99]/10 p-6 ${className}`}
    >
      {/* Header with Badge */}
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-[#1e9c99] px-3 py-1 text-xs font-semibold text-white">
          {rateType}
        </span>
        <div className="flex gap-2">
          {onRateBias && (
            <button
              onClick={onRateBias}
              className="text-xs font-medium text-[#1e9c99] hover:text-[#064d51]"
            >
              Rate Bias
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-xs font-medium text-[#1e9c99] hover:text-[#064d51]"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-xs font-medium text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Rate Display */}
      <div className="mb-4 grid grid-cols-2 gap-6">
        {/* Rate per Mile */}
        <div>
          <div className="mb-1 text-sm text-[#064d51]/70">Rate per Mile</div>
          <div className="text-4xl font-bold text-[#1e9c99]">
            {formatCurrency(ratePerMile)}
          </div>
          <div className="mt-1 text-xs text-[#064d51]/60">per mile</div>
        </div>

        {/* Rate per Trip */}
        <div>
          <div className="mb-1 text-sm text-[#064d51]/70">Rate per Trip</div>
          <div className="text-2xl font-bold text-[#064d51]">
            {formatLargeCurrency(ratePerTrip)}
          </div>
          <div className="mt-1 text-xs text-[#064d51]/60">
            {totalMiles ? `${totalMiles} miles total` : "total trip"}
          </div>
        </div>
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="mb-4 text-xs text-[#064d51]/70 italic">{metadata}</div>
      )}

      {/* Analysis Links */}
      <div className="border-t border-[#1e9c99]/20 pt-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <button className="text-[#1e9c99] hover:text-[#064d51] hover:underline">
            📊 Utilizes Trip
          </button>
          <button className="text-[#1e9c99] hover:text-[#064d51] hover:underline">
            🔥 Hot Analysis
          </button>
          <button className="text-[#1e9c99] hover:text-[#064d51] hover:underline">
            🗺️ Route Builder
          </button>
        </div>
      </div>

      {/* Calculation Details */}
      {ratePerMile && ratePerTrip && totalMiles && (
        <div className="mt-4 border-t border-[#1e9c99]/20 pt-4">
          <details className="text-xs text-[#064d51]/70">
            <summary className="cursor-pointer font-medium hover:text-[#064d51]">
              Calculation Details
            </summary>
            <div className="mt-2 space-y-1 pl-4">
              <div>Rate per Mile: {formatCurrency(ratePerMile)}</div>
              <div>Total Miles: {totalMiles} miles</div>
              <div>
                Rate per Trip: {formatCurrency(ratePerMile)} × {totalMiles} ={" "}
                {formatLargeCurrency(ratePerTrip)}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
