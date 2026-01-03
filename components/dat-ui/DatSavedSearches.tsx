'use client';

/**
 * DAT Saved Searches Component
 *
 * Saved searches panel (stacked, selectable with dark gray highlight)
 * Sprint 14 - DAT-Style UI Transformation
 */

import React from 'react';
import { DatSavedSearchesProps } from '@/types/dat-ui';

export default function DatSavedSearches({
  searches,
  activeSearchId,
  onSelect,
  onDelete,
  onEdit,
  type,
}: DatSavedSearchesProps) {
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-gray-400 text-4xl mb-2">🔍</div>
        <p className="text-gray-600 text-sm">No saved searches yet</p>
        <p className="text-gray-500 text-xs mt-1">
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
                  ? 'bg-gray-700 text-white border-gray-700 shadow-md'
                  : 'bg-white text-gray-900 border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4
                  className={`
                    text-sm font-semibold
                    ${isActive ? 'text-white' : 'text-gray-900'}
                  `}
                >
                  {search.name}
                </h4>
                <p
                  className={`
                    text-xs mt-1
                    ${isActive ? 'text-gray-300' : 'text-gray-600'}
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
                        ? 'hover:bg-gray-600 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-600'
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
                        ? 'hover:bg-red-600 text-gray-300'
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
                ${isActive ? 'text-gray-400' : 'text-gray-500'}
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
