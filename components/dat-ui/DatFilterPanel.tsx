'use client';

/**
 * DAT Filter Panel Component
 *
 * Right sidebar filter panel with sliders, date pickers, toggles, and dropdowns
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState } from 'react';
import { DatFilterPanelProps, DatFilter } from '@/types/dat-ui';

export default function DatFilterPanel({
  title,
  filters,
  values,
  onChange,
  onReset,
}: DatFilterPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  /**
   * Toggle section collapse
   */
  const toggleSection = (key: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSections(newCollapsed);
  };

  /**
   * Render filter based on type
   */
  const renderFilter = (filter: DatFilter) => {
    const value = values[filter.key];

    switch (filter.type) {
      case 'slider':
        return (
          <div>
            <input
              type="range"
              min={filter.min}
              max={filter.max}
              step={filter.step || 1}
              value={value || filter.min}
              onChange={(e) => onChange(filter.key, parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>{filter.min}{filter.unit}</span>
              <span className="font-medium text-gray-900">
                {value || filter.min}{filter.unit}
              </span>
              <span>{filter.max}{filter.unit}</span>
            </div>
          </div>
        );

      case 'range-slider':
        const rangeValue = value || { min: filter.min, max: filter.max };
        return (
          <div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600">Min: {rangeValue.min}{filter.unit}</label>
                <input
                  type="range"
                  min={filter.min}
                  max={filter.max}
                  step={filter.step || 1}
                  value={rangeValue.min}
                  onChange={(e) =>
                    onChange(filter.key, { ...rangeValue, min: parseFloat(e.target.value) })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Max: {rangeValue.max}{filter.unit}</label>
                <input
                  type="range"
                  min={filter.min}
                  max={filter.max}
                  step={filter.step || 1}
                  value={rangeValue.max}
                  onChange={(e) =>
                    onChange(filter.key, { ...rangeValue, max: parseFloat(e.target.value) })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </div>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date-picker':
        return (
          <input
            type="date"
            value={value || ''}
            min={filter.minDate?.toISOString().split('T')[0]}
            max={filter.maxDate?.toISOString().split('T')[0]}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );

      case 'toggle':
        return (
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => onChange(filter.key, e.target.checked)}
                className="sr-only"
              />
              <div
                className={`
                  block w-10 h-6 rounded-full
                  ${value ? 'bg-blue-600' : 'bg-gray-300'}
                `}
              ></div>
              <div
                className={`
                  dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition
                  ${value ? 'transform translate-x-4' : ''}
                `}
              ></div>
            </div>
            <div className="ml-3 text-sm text-gray-700">
              {value ? 'Enabled' : 'Disabled'}
            </div>
          </label>
        );

      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            placeholder={filter.placeholder}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 w-full md:w-80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Reset
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {filters.map((filter) => {
          const isCollapsed = collapsedSections.has(filter.key);

          return (
            <div key={filter.key} className="border-b border-gray-100 pb-4 last:border-0">
              {/* Filter Label */}
              <button
                onClick={() => toggleSection(filter.key)}
                className="w-full flex items-center justify-between mb-2 text-left"
              >
                <span className="text-sm font-medium text-gray-700">{filter.label}</span>
                <span className="text-gray-400">
                  {isCollapsed ? '▶' : '▼'}
                </span>
              </button>

              {/* Filter Control */}
              {!isCollapsed && (
                <div className="mt-2">
                  {renderFilter(filter)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
