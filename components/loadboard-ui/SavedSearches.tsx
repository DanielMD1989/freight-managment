'use client';

/**
 * Saved Searches Component
 *
 * Saved searches panel (stacked, selectable with dark gray highlight)
 * Load Board UI Component Library
 */

import React from 'react';
import { SavedSearchesProps } from '@/types/loadboard-ui';

export default function SavedSearches({
  searches,
  activeSearchId,
  onSelect,
  onDelete,
  onEdit,
  type,
}: SavedSearchesProps) {
  /**
   * Format criteria for display
   */
  const formatCriteria = (criteria: any): string => {
    const parts: string[] = [];

    if (criteria.origin) parts.push(`From: ${criteria.origin}`);
    if (criteria.destination) parts.push(`To: ${criteria.destination}`);
    if (criteria.truckType) {
      // Handle both array and string types
      const truckTypeDisplay = Array.isArray(criteria.truckType)
        ? criteria.truckType.join(', ')
        : criteria.truckType;
      if (truckTypeDisplay) {
        parts.push(`Type: ${truckTypeDisplay}`);
      }
    }
    if (criteria.minWeight || criteria.maxWeight) {
      parts.push(`Weight: ${criteria.minWeight || 0}-${criteria.maxWeight || '∞'} kg`);
    }

    return parts.join(' | ') || 'No filters';
  };

  // Empty state
  if (searches.length === 0) {
    return (
      <div className="bg-[#f0fdfa] border border-[#064d51]/15 rounded-lg p-8 text-center">
        <div className="text-[#064d51]/50 text-4xl mb-2">🔍</div>
        <p className="text-[#064d51]/70 text-sm">No saved searches yet</p>
        <p className="text-[#064d51]/60 text-xs mt-1">
          Create a search to save it for later
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {searches.map((search) => {
        const isActive = activeSearchId === search.id;

        return (
          <div
            key={search.id}
            onClick={() => onSelect(search.id)}
            className={`
              p-4
              rounded-lg
              border
              cursor-pointer
              transition-all
              ${
                isActive
                  ? 'bg-[#064d51] text-white border-[#064d51] shadow-md'
                  : 'bg-white text-[#064d51] border-[#064d51]/15 hover:border-[#064d51]/30 hover:shadow-sm'
              }
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4
                  className={`
                    text-sm font-semibold
                    ${isActive ? 'text-white' : 'text-[#064d51]'}
                  `}
                >
                  {search.name}
                </h4>
                <p
                  className={`
                    text-xs mt-1
                    ${isActive ? 'text-[#1e9c99]' : 'text-[#064d51]/70'}
                  `}
                >
                  {formatCriteria(search.criteria)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(search.id);
                  }}
                  className={`
                    p-1.5
                    rounded
                    text-xs
                    transition-colors
                    ${
                      isActive
                        ? 'hover:bg-[#1e9c99]/30 text-[#1e9c99]'
                        : 'hover:bg-[#1e9c99]/10 text-[#064d51]/70'
                    }
                  `}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(search.id);
                  }}
                  className={`
                    p-1.5
                    rounded
                    text-xs
                    transition-colors
                    ${
                      isActive
                        ? 'hover:bg-red-600 text-[#1e9c99]'
                        : 'hover:bg-red-50 text-red-600'
                    }
                  `}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`
                text-xs
                ${isActive ? 'text-[#1e9c99]/70' : 'text-[#064d51]/60'}
              `}
            >
              Updated {new Date(search.updatedAt).toLocaleDateString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
