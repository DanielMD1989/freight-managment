'use client';

/**
 * Filter Panel Component
 *
 * Professional filter panel with modern inputs, toggles, and clean design
 * Load Board UI Component Library
 */

import React, { useState } from 'react';
import { FilterPanelProps, Filter } from '@/types/loadboard-ui';

export default function FilterPanel({
  title,
  filters,
  values,
  onChange,
  onReset,
}: FilterPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSections(newCollapsed);
  };

  const renderFilter = (filter: Filter) => {
    const value = values[filter.key];

    switch (filter.type) {
      case 'slider':
        return (
          <div className="pt-1">
            <input
              type="range"
              min={filter.min}
              max={filter.max}
              step={filter.step || 1}
              value={value || filter.min}
              onChange={(e) => onChange(filter.key, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md
                         [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
              <span>{filter.min}{filter.unit}</span>
              <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                {value || filter.min}{filter.unit}
              </span>
              <span>{filter.max}{filter.unit}</span>
            </div>
          </div>
        );

      case 'range-slider':
        const rangeValue = value || { min: filter.min, max: filter.max };
        return (
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Min</label>
                <span className="text-xs font-semibold text-slate-700">{rangeValue.min}{filter.unit}</span>
              </div>
              <input
                type="range"
                min={filter.min}
                max={filter.max}
                step={filter.step || 1}
                value={rangeValue.min}
                onChange={(e) =>
                  onChange(filter.key, { ...rangeValue, min: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Max</label>
                <span className="text-xs font-semibold text-slate-700">{rangeValue.max}{filter.unit}</span>
              </div>
              <input
                type="range"
                min={filter.min}
                max={filter.max}
                step={filter.step || 1}
                value={rangeValue.max}
                onChange={(e) =>
                  onChange(filter.key, { ...rangeValue, max: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="relative">
            <select
              value={value || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg
                         appearance-none cursor-pointer transition-all
                         focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500
                         hover:border-slate-300"
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        );

      case 'date-picker':
        return (
          <input
            type="date"
            value={value || ''}
            min={filter.minDate?.toISOString().split('T')[0]}
            max={filter.maxDate?.toISOString().split('T')[0]}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg
                       transition-all cursor-pointer
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500
                       hover:border-slate-300"
          />
        );

      case 'toggle':
        return (
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
              {value ? 'Enabled' : 'Disabled'}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => onChange(filter.key, e.target.checked)}
                className="sr-only peer"
              />
              <div className={`
                w-11 h-6 rounded-full transition-all duration-200
                ${value
                  ? 'bg-gradient-to-r from-teal-600 to-teal-500 shadow-inner'
                  : 'bg-slate-200'
                }
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200
                  ${value ? 'left-[22px]' : 'left-0.5'}
                `} />
              </div>
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
            className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg
                       placeholder:text-slate-400 transition-all
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500
                       hover:border-slate-300"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h3>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-semibold text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
        >
          Reset All
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-1">
        {filters.map((filter) => {
          const isCollapsed = collapsedSections.has(filter.key);

          return (
            <div key={filter.key} className="border-b border-slate-100 last:border-0">
              {/* Filter Label */}
              <button
                onClick={() => toggleSection(filter.key)}
                className="w-full flex items-center justify-between py-3 text-left group"
              >
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider group-hover:text-slate-800 transition-colors">
                  {filter.label}
                </span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Filter Control */}
              {!isCollapsed && (
                <div className="pb-4 animate-in slide-in-from-top-1 duration-200">
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
