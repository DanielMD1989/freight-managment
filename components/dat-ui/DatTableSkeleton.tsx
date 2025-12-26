/**
 * DAT Table Skeleton Component
 *
 * Loading skeleton for data tables
 * Sprint 14 - Phase 6: Polish & Optimization
 */

import React from 'react';

interface DatTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export default function DatTableSkeleton({ rows = 5, columns = 8 }: DatTableSkeletonProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Table Header Skeleton */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="grid gap-4 px-6 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={`header-${i}`} className="h-4 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Table Body Skeleton */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-4 px-6 py-4 hover:bg-gray-50"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className={`h-4 bg-gray-200 rounded animate-pulse`}
                style={{
                  animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
                  width: colIndex === 0 ? '60%' : colIndex === columns - 1 ? '40%' : '80%',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
