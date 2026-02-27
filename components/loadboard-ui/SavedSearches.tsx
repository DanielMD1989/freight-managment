"use client";

/**
 * Saved Searches Component
 *
 * Saved searches panel (stacked, selectable with dark gray highlight)
 * Load Board UI Component Library
 */

import React from "react";
import { SavedSearchesProps } from "@/types/loadboard-ui";

export default function SavedSearches({
  searches,
  activeSearchId,
  onSelect,
  onDelete,
  onEdit,
}: SavedSearchesProps) {
  /**
   * Format criteria for display
   */
  const formatCriteria = (criteria: Record<string, unknown>): string => {
    const parts: string[] = [];

    if (criteria.origin) parts.push(`From: ${criteria.origin}`);
    if (criteria.destination) parts.push(`To: ${criteria.destination}`);
    if (criteria.truckType) {
      // Handle both array and string types
      const truckTypeDisplay = Array.isArray(criteria.truckType)
        ? criteria.truckType.join(", ")
        : criteria.truckType;
      if (truckTypeDisplay) {
        parts.push(`Type: ${truckTypeDisplay}`);
      }
    }
    if (criteria.minWeight || criteria.maxWeight) {
      parts.push(
        `Weight: ${criteria.minWeight || 0}-${criteria.maxWeight || "∞"} kg`
      );
    }

    return parts.join(" | ") || "No filters";
  };

  // Empty state
  if (searches.length === 0) {
    return (
      <div className="rounded-lg border border-[#064d51]/15 bg-[#f0fdfa] p-8 text-center">
        <div className="mb-2 text-4xl text-[#064d51]/50">🔍</div>
        <p className="text-sm text-[#064d51]/70">No saved searches yet</p>
        <p className="mt-1 text-xs text-[#064d51]/60">
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
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              isActive
                ? "border-[#064d51] bg-[#064d51] text-white shadow-md"
                : "border-[#064d51]/15 bg-white text-[#064d51] hover:border-[#064d51]/30 hover:shadow-sm"
            } `}
          >
            {/* Header */}
            <div className="mb-2 flex items-start justify-between">
              <div className="flex-1">
                <h4
                  className={`text-sm font-semibold ${isActive ? "text-white" : "text-[#064d51]"} `}
                >
                  {search.name}
                </h4>
                <p
                  className={`mt-1 text-xs ${isActive ? "text-[#1e9c99]" : "text-[#064d51]/70"} `}
                >
                  {formatCriteria(search.criteria)}
                </p>
              </div>

              {/* Actions */}
              <div className="ml-2 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(search.id);
                  }}
                  className={`rounded p-1.5 text-xs transition-colors ${
                    isActive
                      ? "text-[#1e9c99] hover:bg-[#1e9c99]/30"
                      : "text-[#064d51]/70 hover:bg-[#1e9c99]/10"
                  } `}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(search.id);
                  }}
                  className={`rounded p-1.5 text-xs transition-colors ${
                    isActive
                      ? "text-[#1e9c99] hover:bg-red-600"
                      : "text-red-600 hover:bg-red-50"
                  } `}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`text-xs ${isActive ? "text-[#1e9c99]/70" : "text-[#064d51]/60"} `}
            >
              Updated {new Date(search.updatedAt).toLocaleDateString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
