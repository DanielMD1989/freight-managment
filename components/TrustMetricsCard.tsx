/**
 * Trust Metrics Card Component
 *
 * Professional trust score display with modern design
 * Design System: Clean & Minimal with Teal accent
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

    const completionScore = completionRate * 0.4;
    const cancellationScore = (100 - cancellationRate) * 0.3;
    const disputeScore = (100 - disputeRate) * 0.2;
    const verifiedScore = isVerified ? 10 : 0;

    const trustScore = completionScore + cancellationScore + disputeScore + verifiedScore;
    return Math.round(trustScore * 100) / 100;
  };

  const trustScore = calculateTrustScore();

  // Determine trust level and styling
  const getTrustLevel = (score: number) => {
    if (score >= 90) return {
      label: 'Excellent',
      color: 'text-emerald-600',
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
      border: 'border-emerald-200',
      ringColor: '#10b981'
    };
    if (score >= 75) return {
      label: 'Very Good',
      color: 'text-teal-600',
      bg: 'bg-gradient-to-br from-teal-50 to-cyan-50',
      border: 'border-teal-200',
      ringColor: '#14b8a6'
    };
    if (score >= 60) return {
      label: 'Good',
      color: 'text-amber-600',
      bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
      border: 'border-amber-200',
      ringColor: '#f59e0b'
    };
    if (score >= 40) return {
      label: 'Fair',
      color: 'text-orange-600',
      bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
      border: 'border-orange-200',
      ringColor: '#f97316'
    };
    return {
      label: 'Needs Improvement',
      color: 'text-rose-600',
      bg: 'bg-gradient-to-br from-rose-50 to-red-50',
      border: 'border-rose-200',
      ringColor: '#f43f5e'
    };
  };

  const trustLevel = getTrustLevel(trustScore);

  const getMetricColor = (value: number, isInverse: boolean = false) => {
    if (isInverse) {
      if (value <= 5) return 'text-emerald-600';
      if (value <= 15) return 'text-amber-600';
      return 'text-rose-600';
    } else {
      if (value >= 90) return 'text-emerald-600';
      if (value >= 75) return 'text-amber-600';
      return 'text-rose-600';
    }
  };

  // Circular progress for trust score
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (trustScore / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-5 ${trustLevel.bg} border-b ${trustLevel.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Trust Score</h3>
              {organization.isVerified && (
                <div className="flex items-center gap-1 mt-0.5">
                  <VerifiedBadge
                    isVerified={organization.isVerified}
                    verifiedAt={organization.verifiedAt ? new Date(organization.verifiedAt) : null}
                    size="sm"
                  />
                  <span className="text-xs text-teal-600 font-medium">Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Circular Score */}
          <div className="relative">
            <svg width="80" height="80" className="-rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke={trustLevel.ringColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={(2 * Math.PI * 34) - (trustScore / 100) * (2 * Math.PI * 34)}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${trustLevel.color}`}>{Math.round(trustScore)}</span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase">{trustLevel.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      {showDetails && (
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Completion Rate */}
            <div className="text-center p-4 rounded-xl bg-slate-50/50">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <svg className={`w-5 h-5 ${getMetricColor(organization.completionRate || 0)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(organization.completionRate || 0)}`}>
                {organization.completionRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">Completion</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {organization.totalLoadsCompleted.toLocaleString()} loads
              </div>
            </div>

            {/* Cancellation Rate */}
            <div className="text-center p-4 rounded-xl bg-slate-50/50">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <svg className={`w-5 h-5 ${getMetricColor(organization.cancellationRate || 0, true)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(organization.cancellationRate || 0, true)}`}>
                {organization.cancellationRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">Cancellation</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {organization.totalLoadsCancelled.toLocaleString()} cancelled
              </div>
            </div>

            {/* Dispute Rate */}
            <div className="text-center p-4 rounded-xl bg-slate-50/50">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <svg className={`w-5 h-5 ${getMetricColor(organization.disputeRate || 0, true)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(organization.disputeRate || 0, true)}`}>
                {organization.disputeRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">Disputes</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {organization.totalDisputes.toLocaleString()} disputes
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Score Breakdown
            </h4>
            <div className="space-y-3">
              {[
                { label: 'Completion Rate', weight: '40%', value: ((organization.completionRate || 0) * 0.4).toFixed(1) },
                { label: 'Low Cancellation', weight: '30%', value: ((100 - (organization.cancellationRate || 0)) * 0.3).toFixed(1) },
                { label: 'Low Disputes', weight: '20%', value: ((100 - (organization.disputeRate || 0)) * 0.2).toFixed(1) },
                { label: 'Verified Status', weight: '10%', value: organization.isVerified ? '10.0' : '0.0' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">
                    {item.label} <span className="text-slate-400">({item.weight})</span>
                  </span>
                  <span className="font-semibold text-slate-800">{item.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-700">Total Trust Score</span>
                <span className={`text-lg font-bold ${trustLevel.color}`}>{trustScore.toFixed(1)}</span>
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
 */
export function TrustBadge({
  trustScore,
  size = 'md',
}: {
  trustScore: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const getTrustLevel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', styles: 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200' };
    if (score >= 75) return { label: 'Very Good', styles: 'bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 border-teal-200' };
    if (score >= 60) return { label: 'Good', styles: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200' };
    if (score >= 40) return { label: 'Fair', styles: 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-orange-200' };
    return { label: 'Poor', styles: 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-200' };
  };

  const trustLevel = getTrustLevel(trustScore);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span className={`inline-flex items-center ${sizeClasses[size]} ${trustLevel.styles} border rounded-full font-semibold shadow-sm`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      <span>{trustScore.toFixed(0)} {trustLevel.label}</span>
    </span>
  );
}
