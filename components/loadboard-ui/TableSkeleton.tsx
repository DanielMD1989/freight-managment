/**
 * Table Skeleton Component
 *
 * Loading skeleton for data tables
 * Load Board UI Component Library
 */

import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export default function TableSkeleton({ rows = 5, columns = 8 }: TableSkeletonProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#064d51]/15 overflow-hidden">
      {/* Table Header Skeleton */}
      <div className="bg-[#f0fdfa] border-b border-[#064d51]/15">
        <div className="grid gap-4 px-6 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={`header-${i}`} className="h-4 bg-[#064d51]/10 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Table Body Skeleton */}
      <div className="divide-y divide-[#064d51]/10">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-4 px-6 py-4 hover:bg-[#f0fdfa]"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className={`h-4 bg-[#064d51]/10 rounded animate-pulse`}
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
