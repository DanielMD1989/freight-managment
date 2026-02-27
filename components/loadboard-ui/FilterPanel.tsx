"use client";

/**
 * Filter Panel Component
 *
 * Professional filter panel with modern inputs, toggles, and clean design
 * Load Board UI Component Library
 */

import React, { useState } from "react";
import { FilterPanelProps, Filter } from "@/types/loadboard-ui";

export default function FilterPanel({
  title,
  filters,
  values,
  onChange,
  onReset,
}: FilterPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

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
      case "slider":
        return (
          <div className="pt-1">
            <input
              type="range"
              min={filter.min}
              max={filter.max}
              step={filter.step || 1}
              value={value || filter.min}
              onChange={(e) => onChange(filter.key, parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600 dark:bg-slate-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <div className="mt-1.5 flex justify-between text-[10px] font-medium text-slate-400">
              <span>
                {filter.min}
                {filter.unit}
              </span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-600 dark:bg-teal-900/40 dark:text-teal-400">
                {value || filter.min}
                {filter.unit}
              </span>
              <span>
                {filter.max}
                {filter.unit}
              </span>
            </div>
          </div>
        );

      case "range-slider":
        const rangeValue = value || { min: filter.min, max: filter.max };
        return (
          <div className="space-y-3 pt-1">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  Min
                </label>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {rangeValue.min}
                  {filter.unit}
                </span>
              </div>
              <input
                type="range"
                min={filter.min}
                max={filter.max}
                step={filter.step || 1}
                value={rangeValue.min}
                onChange={(e) =>
                  onChange(filter.key, {
                    ...rangeValue,
                    min: parseFloat(e.target.value),
                  })
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600 dark:bg-slate-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  Max
                </label>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {rangeValue.max}
                  {filter.unit}
                </span>
              </div>
              <input
                type="range"
                min={filter.min}
                max={filter.max}
                step={filter.step || 1}
                value={rangeValue.max}
                onChange={(e) =>
                  onChange(filter.key, {
                    ...rangeValue,
                    max: parseFloat(e.target.value),
                  })
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600 dark:bg-slate-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
          </div>
        );

      case "select":
        return (
          <div className="relative">
            <select
              value={value || ""}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-all hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        );

      case "date-picker":
        return (
          <input
            type="date"
            value={value || ""}
            min={filter.minDate?.toISOString().split("T")[0]}
            max={filter.maxDate?.toISOString().split("T")[0]}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-all hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
          />
        );

      case "toggle":
        return (
          <label className="group flex cursor-pointer items-center justify-between">
            <span className="text-sm text-slate-600 transition-colors group-hover:text-slate-800 dark:text-slate-300 dark:group-hover:text-slate-100">
              {value ? "Enabled" : "Disabled"}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => onChange(filter.key, e.target.checked)}
                className="peer sr-only"
              />
              <div
                className={`h-6 w-11 rounded-full transition-all duration-200 ${
                  value
                    ? "bg-gradient-to-r from-teal-600 to-teal-500 shadow-inner"
                    : "bg-slate-200 dark:bg-slate-600"
                } `}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${value ? "left-[22px]" : "left-0.5"} `}
                />
              </div>
            </div>
          </label>
        );

      case "text":
        return (
          <input
            type="text"
            value={value || ""}
            placeholder={filter.placeholder}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-teal-50/30 px-5 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-teal-900/20">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-teal-500 shadow-sm">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-bold tracking-wide text-slate-800 uppercase dark:text-slate-100">
            {title}
          </h3>
        </div>
        <button
          onClick={onReset}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/40 dark:hover:text-teal-300"
        >
          Reset All
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-1 p-4">
        {filters.map((filter) => {
          const isCollapsed = collapsedSections.has(filter.key);

          return (
            <div
              key={filter.key}
              className="border-b border-slate-100 last:border-0 dark:border-slate-700"
            >
              {/* Filter Label */}
              <button
                onClick={() => toggleSection(filter.key)}
                className="group flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-xs font-semibold tracking-wider text-slate-600 uppercase transition-colors group-hover:text-slate-800 dark:text-slate-300 dark:group-hover:text-slate-100">
                  {filter.label}
                </span>
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Filter Control */}
              {!isCollapsed && (
                <div className="animate-in slide-in-from-top-1 pb-4 duration-200">
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
