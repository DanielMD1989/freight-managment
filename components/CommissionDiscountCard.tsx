/**
 * Commission Discount Incentive Card
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Displays commission discounts based on completion rate
 */

'use client';

import { useEffect, useState } from 'react';

interface DiscountTier {
  minCompletionRate: number;
  discount: number;
  label: string;
  color: string;
}

const DISCOUNT_TIERS: DiscountTier[] = [
  {
    minCompletionRate: 95,
    discount: 15,
    label: 'Platinum',
    color: 'from-purple-600 to-purple-800',
  },
  {
    minCompletionRate: 90,
    discount: 10,
    label: 'Gold',
    color: 'from-yellow-500 to-yellow-700',
  },
  {
    minCompletionRate: 80,
    discount: 5,
    label: 'Silver',
    color: 'from-gray-400 to-gray-600',
  },
  {
    minCompletionRate: 0,
    discount: 0,
    label: 'Standard',
    color: 'from-gray-300 to-gray-500',
  },
];

interface CommissionDiscountCardProps {
  completionRate: number;
  className?: string;
}

export default function CommissionDiscountCard({
  completionRate,
  className = '',
}: CommissionDiscountCardProps) {
  const [currentTier, setCurrentTier] = useState<DiscountTier | null>(null);
  const [nextTier, setNextTier] = useState<DiscountTier | null>(null);

  useEffect(() => {
    // Find current tier
    const tier = DISCOUNT_TIERS.find(
      (t) => completionRate >= t.minCompletionRate
    );
    setCurrentTier(tier || DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1]);

    // Find next tier
    const current = tier || DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
    const currentIndex = DISCOUNT_TIERS.findIndex((t) => t === current);
    if (currentIndex > 0) {
      setNextTier(DISCOUNT_TIERS[currentIndex - 1]);
    }
  }, [completionRate]);

  if (!currentTier) return null;

  const progressToNext = nextTier
    ? ((completionRate - currentTier.minCompletionRate) /
        (nextTier.minCompletionRate - currentTier.minCompletionRate)) *
      100
    : 100;

  return (
    <div className={`bg-white rounded-lg shadow border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${currentTier.color} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">
              Commission Discount
            </h3>
            <p className="text-white/90 text-sm mt-1">
              {currentTier.label} Tier
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-white">
              {currentTier.discount}%
            </div>
            <p className="text-white/90 text-xs">OFF</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Current Status */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Your Completion Rate
            </span>
            <span className="text-lg font-bold text-gray-900">
              {completionRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`bg-gradient-to-r ${currentTier.color} h-3 rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(completionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Save {currentTier.discount}% on all commissions
              </p>
              <p className="text-xs text-gray-500">
                Applied automatically to every load
              </p>
            </div>
          </div>

          {currentTier.discount > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                <strong>You're saving money!</strong> On a 10,000 ETB load with
                5% commission, you save{' '}
                <strong>
                  {((10000 * 0.05 * currentTier.discount) / 100).toFixed(0)} ETB
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* Next Tier Progress */}
        {nextTier && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Next Tier: {nextTier.label}
                </h4>
                <p className="text-xs text-gray-500">
                  {nextTier.discount}% discount
                </p>
              </div>
              <span className="text-sm font-medium text-blue-600">
                {nextTier.minCompletionRate - completionRate >= 0
                  ? `${(nextTier.minCompletionRate - completionRate).toFixed(1)}% to go`
                  : 'Achieved!'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-700 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressToNext, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Complete more loads to unlock the next discount tier
            </p>
          </div>
        )}

        {/* All Tiers */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            All Discount Tiers
          </h4>
          <div className="space-y-2">
            {DISCOUNT_TIERS.slice(0, -1).map((tier) => {
              const isAchieved = completionRate >= tier.minCompletionRate;
              const isCurrent = tier === currentTier;

              return (
                <div
                  key={tier.label}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-300'
                      : isAchieved
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isAchieved ? (
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isCurrent ? 'text-blue-900' : 'text-gray-900'
                        }`}
                      >
                        {tier.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tier.minCompletionRate}%+ completion
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-right ${
                      isCurrent ? 'text-blue-900' : 'text-gray-900'
                    }`}
                  >
                    <p className="text-lg font-bold">{tier.discount}%</p>
                    <p className="text-xs text-gray-500">discount</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        {completionRate < 95 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white">
            <p className="font-semibold mb-1">Keep completing loads!</p>
            <p className="text-sm text-blue-100">
              Every load you complete through the platform increases your
              completion rate and unlocks higher discount tiers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Commission Discount Badge
 *
 * Small badge showing current discount for dashboards
 */
export function CommissionDiscountBadge({
  completionRate,
}: {
  completionRate: number;
}) {
  const tier = DISCOUNT_TIERS.find((t) => completionRate >= t.minCompletionRate);
  const currentTier = tier || DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];

  if (currentTier.discount === 0) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${currentTier.color} rounded-full`}
    >
      <svg
        className="w-4 h-4 text-white"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-white font-semibold text-sm">
        {currentTier.discount}% OFF
      </span>
      <span className="text-white/80 text-xs">{currentTier.label}</span>
    </div>
  );
}
