/**
 * Reference Pricing Badge Component
 *
 * Displays market rate comparison and pricing guidance
 * Sprint 15 - Story 15.9: Reference Pricing
 */

'use client';

interface ReferencePricingBadgeProps {
  actualRate: number;
  marketRate?: number;
  className?: string;
}

export default function ReferencePricingBadge({
  actualRate,
  marketRate,
  className = '',
}: ReferencePricingBadgeProps) {
  if (!marketRate) {
    return (
      <span className={`text-sm text-[#064d51]/70 ${className}`}>
        {actualRate.toLocaleString()} ETB
      </span>
    );
  }

  const variance = ((actualRate - marketRate) / marketRate) * 100;
  const isAboveMarket = variance > 5;
  const isBelowMarket = variance < -5;
  const isAtMarket = !isAboveMarket && !isBelowMarket;

  const getVarianceColor = () => {
    if (isAboveMarket) return 'text-red-600';
    if (isBelowMarket) return 'text-green-600';
    return 'text-[#064d51]/70';
  };

  const getVarianceText = () => {
    if (isAboveMarket) return `+${variance.toFixed(1)}% above market`;
    if (isBelowMarket) return `${variance.toFixed(1)}% below market`;
    return 'at market rate';
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-sm font-bold text-[#064d51]">
        {actualRate.toLocaleString()} ETB
      </span>

      {/* Market Rate Badge */}
      <span
        className={`px-2 py-0.5 text-xs font-semibold rounded ${
          isAtMarket
            ? 'bg-green-100 text-green-800'
            : isAboveMarket
            ? 'bg-red-100 text-red-800'
            : 'bg-[#1e9c99]/10 text-[#1e9c99]'
        }`}
        title={`Market rate: ${marketRate.toLocaleString()} ETB`}
      >
        {isAtMarket ? 'MARKET RATE' : getVarianceText()}
      </span>
    </div>
  );
}

/**
 * Compact version showing just the variance indicator
 */
export function PricingVarianceIndicator({
  actualRate,
  marketRate,
}: {
  actualRate: number;
  marketRate: number;
}) {
  const variance = ((actualRate - marketRate) / marketRate) * 100;

  if (Math.abs(variance) < 5) {
    return <span className="text-xs text-green-600">✓ Market Rate</span>;
  }

  return (
    <span className={`text-xs font-semibold ${variance > 0 ? 'text-red-600' : 'text-[#1e9c99]'}`}>
      {variance > 0 ? '↑' : '↓'} {Math.abs(variance).toFixed(0)}%
    </span>
  );
}
