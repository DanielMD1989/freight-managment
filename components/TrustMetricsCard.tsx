/**
 * Trust Metrics Card Component
 *
 * Sprint 16 - Story 16.5: Trust & Reliability Features
 *
 * Displays trust score and reliability metrics for an organization
 */

'use client';

import VerifiedBadge from './VerifiedBadge';

interface TrustMetricsCardProps {
  organization: {
    id: string;
    name: string;
    isVerified: boolean;
    verifiedAt?: string | null;
    completionRate?: number | null;
    cancellationRate?: number | null;
    disputeRate?: number | null;
    totalLoadsCompleted: number;
    totalLoadsCancelled: number;
    totalDisputes: number;
  };
  showDetails?: boolean;
}

export default function TrustMetricsCard({
  organization,
  showDetails = true,
}: TrustMetricsCardProps) {
  // Calculate trust score (0-100)
  const calculateTrustScore = () => {
    const completionRate = organization.completionRate || 0;
    const cancellationRate = organization.cancellationRate || 0;
    const disputeRate = organization.disputeRate || 0;
    const isVerified = organization.isVerified;

    // Weighted composite:
    // - 40% completion rate
    // - 30% low cancellation rate (100 - cancellationRate)
    // - 20% low dispute rate (100 - disputeRate)
    // - 10% verified status
    const completionScore = completionRate * 0.4;
    const cancellationScore = (100 - cancellationRate) * 0.3;
    const disputeScore = (100 - disputeRate) * 0.2;
    const verifiedScore = isVerified ? 10 : 0;

    const trustScore =
      completionScore + cancellationScore + disputeScore + verifiedScore;

    return Math.round(trustScore * 100) / 100;
  };

  const trustScore = calculateTrustScore();

  // Determine trust level and color
  const getTrustLevel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    if (score >= 75) return { label: 'Very Good', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    if (score >= 60) return { label: 'Good', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    if (score >= 40) return { label: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    return { label: 'Poor', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  };

  const trustLevel = getTrustLevel(trustScore);

  const getMetricColor = (value: number, isInverse: boolean = false) => {
    if (isInverse) {
      // For cancellation/dispute rates (lower is better)
      if (value <= 5) return 'text-green-600';
      if (value <= 15) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      // For completion rate (higher is better)
      if (value >= 90) return 'text-green-600';
      if (value >= 75) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${trustLevel.bg} border-b ${trustLevel.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Trust Score</h3>
            {organization.isVerified && (
              <VerifiedBadge
                isVerified={organization.isVerified}
                verifiedAt={organization.verifiedAt ? new Date(organization.verifiedAt) : null}
                size="md"
              />
            )}
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${trustLevel.color}`}>
              {trustScore}
            </div>
            <div className={`text-sm font-medium ${trustLevel.color}`}>
              {trustLevel.label}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      {showDetails && (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Completion Rate */}
            <div className="text-center">
              <div className="mb-2">
                <svg
                  className={`w-8 h-8 mx-auto ${getMetricColor(
                    organization.completionRate || 0
                  )}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div
                className={`text-3xl font-bold ${getMetricColor(
                  organization.completionRate || 0
                )}`}
              >
                {organization.completionRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Completion Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                {organization.totalLoadsCompleted} completed
              </div>
            </div>

            {/* Cancellation Rate */}
            <div className="text-center">
              <div className="mb-2">
                <svg
                  className={`w-8 h-8 mx-auto ${getMetricColor(
                    organization.cancellationRate || 0,
                    true
                  )}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div
                className={`text-3xl font-bold ${getMetricColor(
                  organization.cancellationRate || 0,
                  true
                )}`}
              >
                {organization.cancellationRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Cancellation Rate
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {organization.totalLoadsCancelled} cancelled
              </div>
            </div>

            {/* Dispute Rate */}
            <div className="text-center">
              <div className="mb-2">
                <svg
                  className={`w-8 h-8 mx-auto ${getMetricColor(
                    organization.disputeRate || 0,
                    true
                  )}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div
                className={`text-3xl font-bold ${getMetricColor(
                  organization.disputeRate || 0,
                  true
                )}`}
              >
                {organization.disputeRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Dispute Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                {organization.totalDisputes} disputes
              </div>
            </div>
          </div>

          {/* Trust Score Breakdown */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Score Breakdown
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Completion Rate (40%):</span>
                <span className="font-medium">
                  {((organization.completionRate || 0) * 0.4).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Low Cancellation (30%):
                </span>
                <span className="font-medium">
                  {(
                    (100 - (organization.cancellationRate || 0)) *
                    0.3
                  ).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Low Disputes (20%):</span>
                <span className="font-medium">
                  {((100 - (organization.disputeRate || 0)) * 0.2).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Verified Status (10%):</span>
                <span className="font-medium">
                  {organization.isVerified ? '10.0' : '0.0'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                <span className="text-gray-900">Total Trust Score:</span>
                <span className={trustLevel.color}>{trustScore.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Trust Badge Component
 *
 * For use in listings and card views
 */
export function TrustBadge({
  trustScore,
  size = 'md',
}: {
  trustScore: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const getTrustLevel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-100 text-green-800 border-green-300' };
    if (score >= 75) return { label: 'Very Good', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (score >= 60) return { label: 'Good', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    if (score >= 40) return { label: 'Fair', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: 'Poor', color: 'bg-red-100 text-red-800 border-red-300' };
  };

  const trustLevel = getTrustLevel(trustScore);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} ${trustLevel.color} border rounded-full font-medium`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>
        {trustScore.toFixed(0)} {trustLevel.label}
      </span>
    </span>
  );
}
