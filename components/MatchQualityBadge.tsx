/**
 * Match Quality Badge Component
 *
 * Displays match quality score with visual indicator and tooltip
 * Sprint 15 - Story 15.8: Match Calculation
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
  // Determine quality level
  const getQualityLevel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800 border-green-300' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (score >= 40) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { label: 'Poor', color: 'bg-gray-100 text-gray-800 border-gray-300' };
  };

  const quality = getQualityLevel(score);

  // Build tooltip content
  const tooltipContent = reasons.length > 0
    ? `Match Score: ${score}/100\n\nWhy this match?\n${reasons.join('\n')}`
    : `Match Score: ${score}/100`;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title={tooltipContent}>
      <span className={`px-2 py-1 text-xs font-bold rounded border ${quality.color}`}>
        {quality.label}
      </span>
      <span className="text-sm font-medium text-gray-700">
        {score}%
      </span>
    </div>
  );
}

/**
 * Compact version for table cells
 */
export function MatchQualityCompact({ score }: { score: number }) {
  const getColorClass = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <span className={`text-sm font-bold ${getColorClass(score)}`}>
      {score}%
    </span>
  );
}

/**
 * Match reason tooltip component
 */
export function MatchReasonTooltip({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;

  return (
    <div className="text-xs text-gray-600">
      <div className="font-semibold mb-1">Why this match?</div>
      <ul className="list-disc list-inside space-y-0.5">
        {reasons.map((reason, index) => (
          <li key={index}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
