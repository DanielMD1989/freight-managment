/**
 * Match Quality Badge Component
 *
 * Professional match quality indicator with modern design
 * Design System: Clean & Minimal with Teal accent
 */

'use client';

interface MatchQualityBadgeProps {
  score: number;
  reasons?: string[];
  className?: string;
}

export default function MatchQualityBadge({
  score,
  reasons = [],
  className = '',
}: MatchQualityBadgeProps) {
  // Determine quality level with professional colors
  const getQualityLevel = (score: number) => {
    if (score >= 80) return {
      label: 'Excellent',
      bgClass: 'bg-gradient-to-r from-emerald-50 to-teal-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
    if (score >= 60) return {
      label: 'Good',
      bgClass: 'bg-gradient-to-r from-teal-50 to-cyan-50',
      textClass: 'text-teal-700',
      borderClass: 'border-teal-200',
      dotClass: 'bg-teal-500',
    };
    if (score >= 40) return {
      label: 'Fair',
      bgClass: 'bg-gradient-to-r from-amber-50 to-yellow-50',
      textClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      dotClass: 'bg-amber-500',
    };
    return {
      label: 'Poor',
      bgClass: 'bg-gradient-to-r from-slate-50 to-slate-100',
      textClass: 'text-slate-600',
      borderClass: 'border-slate-200',
      dotClass: 'bg-slate-400',
    };
  };

  const quality = getQualityLevel(score);

  // Build tooltip content
  const tooltipContent = reasons.length > 0
    ? `Match Score: ${score}/100\n\nWhy this match?\n${reasons.join('\n')}`
    : `Match Score: ${score}/100`;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`} title={tooltipContent}>
      <span className={`
        inline-flex items-center gap-1.5 px-2.5 py-1
        text-xs font-bold rounded-lg border
        ${quality.bgClass} ${quality.textClass} ${quality.borderClass}
      `}>
        <span className={`w-1.5 h-1.5 rounded-full ${quality.dotClass}`} />
        {quality.label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${quality.textClass}`}>
        {score}%
      </span>
    </div>
  );
}

/**
 * Compact version for table cells - shows score as circular indicator
 */
export function MatchQualityCompact({ score }: { score: number }) {
  const getStyles = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-teal-600 bg-teal-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-slate-500 bg-slate-50';
  };

  return (
    <span className={`
      inline-flex items-center justify-center
      w-10 h-6 rounded-md text-xs font-bold tabular-nums
      ${getStyles(score)}
    `}>
      {score}%
    </span>
  );
}

/**
 * Match Score Ring - Visual circular indicator
 */
export function MatchScoreRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (score: number) => {
    if (score >= 80) return '#10b981'; // emerald-500
    if (score >= 60) return '#14b8a6'; // teal-500
    if (score >= 40) return '#f59e0b'; // amber-500
    return '#94a3b8'; // slate-400
  };

  const sizeMap = { sm: 32, md: 44, lg: 56 };
  const strokeWidth = size === 'sm' ? 3 : 4;
  const diameter = sizeMap[size];
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={diameter} height={diameter} className="-rotate-90">
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className={`absolute text-xs font-bold ${score >= 60 ? 'text-slate-700' : 'text-slate-500'}`}>
        {score}
      </span>
    </div>
  );
}

/**
 * Match reason tooltip component
 */
export function MatchReasonTooltip({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;

  return (
    <div className="text-xs">
      <div className="font-bold text-slate-700 mb-2">Why this match?</div>
      <ul className="space-y-1">
        {reasons.map((reason, index) => (
          <li key={index} className="flex items-start gap-2 text-slate-600">
            <svg className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
