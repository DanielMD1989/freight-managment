"use client";

/**
 * Data Table Component
 *
 * Reusable data-dense table with expandable rows, sorting, inline editing, and selection
 * Load Board UI Component Library
 *
 * FEATURES:
 * - Expandable rows (click to show details)
 * - Sortable columns
 * - Row selection (checkbox)
 * - Inline actions
 * - Responsive card view on mobile
 * - View mode toggle (table/card)
 * - Enhanced loading states with skeleton
 * - Empty states
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { DataTableProps, TableColumn } from "@/types/loadboard-ui";
import TableSkeleton from "./TableSkeleton";

// Extended props for responsive features
interface ExtendedDataTableProps<T> extends DataTableProps<T> {
  // Enable responsive card view on mobile
  responsiveCardView?: boolean;
  // Custom card renderer (optional - uses default if not provided)
  renderCard?: (row: T, index: number) => React.ReactNode;
  // Primary columns to show in card view (defaults to first 4)
  cardPrimaryColumns?: string[];
  // Title column for card header
  cardTitleColumn?: string;
  // Subtitle column for card
  cardSubtitleColumn?: string;
  // Externally controlled expanded row IDs (merged with internal state)
  expandedRowIds?: string[];
}

function ViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: "table" | "card";
  setViewMode: (mode: "table" | "card") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      <button
        onClick={() => setViewMode("table")}
        className={`rounded-md p-2 transition-all ${
          viewMode === "table"
            ? "bg-white text-teal-600 shadow-sm dark:bg-slate-700 dark:text-teal-400"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        } `}
        title="Table view"
        aria-label="Table view"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>
      <button
        onClick={() => setViewMode("card")}
        className={`rounded-md p-2 transition-all ${
          viewMode === "card"
            ? "bg-white text-teal-600 shadow-sm dark:bg-slate-700 dark:text-teal-400"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        } `}
        title="Card view"
        aria-label="Card view"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>
    </div>
  );
}

export default function DataTable<T extends object = Record<string, unknown>>({
  columns,
  data,
  expandable = false,
  renderExpandedRow,
  onRowClick,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  actions,
  loading = false,
  emptyMessage = "No data available",
  className = "",
  rowKey = "id",
  responsiveCardView = true,
  renderCard,
  cardPrimaryColumns,
  cardTitleColumn,
  cardSubtitleColumn,
  expandedRowIds = [],
}: ExtendedDataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Clear expanded rows when data changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedRows(new Set());
  }, [data]);

  // Auto-detect mobile and switch to card view (debounced)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const checkMobile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        if (responsiveCardView && mobile) {
          setViewMode("card");
        } else if (!mobile && viewMode === "card") {
          setViewMode("table");
        }
      }, 100); // Debounce 100ms
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkMobile);
    };
  }, [responsiveCardView, viewMode]);

  /**
   * Toggle row expansion (memoized)
   */
  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(rowId)) {
        newExpanded.delete(rowId);
      } else {
        newExpanded.add(rowId);
      }
      return newExpanded;
    });
  }, []);

  /**
   * Toggle row selection (memoized)
   */
  const toggleRowSelection = useCallback(
    (rowId: string) => {
      if (!onSelectionChange) return;

      const newSelected = selectedRows.includes(rowId)
        ? selectedRows.filter((id) => id !== rowId)
        : [...selectedRows, rowId];

      onSelectionChange(newSelected);
    },
    [selectedRows, onSelectionChange]
  );

  /**
   * Toggle select all (memoized)
   */
  // Helper to safely access object properties by string key
  const getProperty = useCallback((obj: T, key: string): unknown => {
    return (obj as Record<string, unknown>)[key];
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row: T) => String(getProperty(row, rowKey))));
    }
  }, [selectedRows, data, onSelectionChange, rowKey, getProperty]);

  /**
   * Handle column sort
   */
  const handleSort = (column: TableColumn) => {
    if (!column.sortable) return;

    if (sortColumn === column.key) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column.key);
      setSortDirection("asc");
    }
  };

  /**
   * Get sorted data (memoized for performance)
   */
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a: T, b: T) => {
      const aVal = getProperty(a, sortColumn);
      const bVal = getProperty(b, sortColumn);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, getProperty]);

  /**
   * Render cell value
   */
  const renderCell = (column: TableColumn, row: T) => {
    const cellValue = getProperty(row, column.key);
    if (column.render) {
      return column.render(cellValue, row);
    }
    return cellValue !== null && cellValue !== undefined
      ? String(cellValue)
      : "";
  };

  /**
   * Get row ID
   */
  const getRowId = (row: T): string => {
    return String(getProperty(row, rowKey));
  };

  // Loading state with enhanced skeleton
  if (loading) {
    return (
      <TableSkeleton
        rows={8}
        columns={
          columns.length + (selectable ? 1 : 0) + (actions?.length ? 1 : 0)
        }
      />
    );
  }

  // Empty state with professional design
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
          <svg
            className="h-8 w-8 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-200">
          No data available
        </h3>
        <p className="mx-auto max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  /**
   * Get columns for card view (primary columns only)
   */
  const getCardColumns = () => {
    if (cardPrimaryColumns) {
      return columns.filter((col) => cardPrimaryColumns.includes(col.key));
    }
    // Default: first 4 columns excluding ID-like fields
    return columns
      .filter((col) => !col.key.toLowerCase().includes("id"))
      .slice(0, 4);
  };

  /**
   * Render default card view for a row
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderDefaultCard = (row: T, _index?: number) => {
    const rowId = getRowId(row);
    const isSelected = selectedRows.includes(rowId);
    const cardColumns = getCardColumns();

    // Get title from specified column or first text column
    const titleColumn = cardTitleColumn
      ? columns.find((c) => c.key === cardTitleColumn)
      : cardColumns[0];
    const subtitleColumn = cardSubtitleColumn
      ? columns.find((c) => c.key === cardSubtitleColumn)
      : cardColumns[1];

    return (
      <div
        key={rowId}
        className={`rounded-xl border bg-white transition-all duration-150 dark:bg-slate-800 ${
          isSelected
            ? "border-teal-300 ring-2 ring-teal-100 dark:border-teal-600 dark:ring-teal-900"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
        } ${onRowClick ? "cursor-pointer" : ""} `}
        onClick={() => onRowClick && onRowClick(row)}
      >
        {/* Card Header */}
        <div className="border-b border-slate-100 p-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {titleColumn && (
                <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {renderCell(titleColumn, row)}
                </h3>
              )}
              {subtitleColumn && (
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {renderCell(subtitleColumn, row)}
                </p>
              )}
            </div>
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleRowSelection(rowId);
                }}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
            )}
          </div>
        </div>

        {/* Card Body - Key Fields */}
        <div className="space-y-2 p-4">
          {cardColumns.slice(2).map((column) => (
            <div
              key={column.key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {column.label}
              </span>
              <span className="font-medium text-slate-900 dark:text-white">
                {renderCell(column, row)}
              </span>
            </div>
          ))}
        </div>

        {/* Card Actions */}
        {actions && actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 px-4 pt-2 pb-4 dark:border-slate-700">
            {actions.map((action) => {
              const show = action.show ? action.show(row) : true;
              if (!show) return null;

              const actionStyles = {
                primary: "bg-teal-600 hover:bg-teal-700 text-white",
                secondary:
                  "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200",
                destructive: "bg-rose-600 hover:bg-rose-700 text-white",
              };

              return (
                <button
                  key={action.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(row);
                  }}
                  className={`inline-flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${actionStyles[action.variant as keyof typeof actionStyles] || actionStyles.primary} `}
                >
                  {action.icon && <span>{action.icon}</span>}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Card View Rendering
  if (viewMode === "card") {
    return (
      <div className={`${className}`}>
        {/* Header with toggle */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.length} {data.length === 1 ? "item" : "items"}
          </p>
          {responsiveCardView && (
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          )}
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedData.map((row, index) =>
            renderCard ? renderCard(row, index) : renderDefaultCard(row, index)
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {/* Table header with view toggle */}
      {responsiveCardView && (
        <div className="hidden items-center justify-between border-b border-slate-200/60 bg-slate-50/50 px-4 py-3 md:flex dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.length} {data.length === 1 ? "item" : "items"}
          </p>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      )}

      {/* Mobile scroll hint */}
      <div className="flex items-center justify-center gap-2 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-2.5 text-center text-xs text-teal-700 md:hidden dark:border-teal-800 dark:from-teal-900/30 dark:to-cyan-900/30 dark:text-teal-300">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        Scroll horizontally to see all columns
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Data table">
        <table
          className="w-full min-w-full"
          role="table"
          aria-label="Data table with sorting and selection"
        >
          {/* Header with gradient */}
          <thead
            className="bg-gradient-to-r from-slate-50 via-slate-50 to-teal-50/30 dark:from-slate-800 dark:via-slate-800 dark:to-teal-900/20"
            role="rowgroup"
          >
            <tr
              role="row"
              className="border-b border-slate-200/80 dark:border-slate-700"
            >
              {/* Selection checkbox */}
              {selectable && (
                <th className="w-14 px-4 py-4" role="columnheader">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.length === data.length && data.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded-md border-2 border-slate-300 text-teal-600 transition-colors focus:ring-2 focus:ring-teal-500/20 focus:ring-offset-0"
                      aria-label="Select all rows"
                    />
                  </div>
                </th>
              )}

              {/* Expandable icon column */}
              {expandable && (
                <th
                  className="w-12 px-2"
                  role="columnheader"
                  aria-label="Expand"
                ></th>
              )}

              {/* Column headers */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  role="columnheader"
                  aria-sort={
                    sortColumn === column.key
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`px-4 py-4 text-left text-[11px] font-bold tracking-wider whitespace-nowrap text-slate-500 uppercase ${column.sortable ? "cursor-pointer transition-colors hover:bg-teal-50/50 hover:text-teal-600" : ""} ${column.align === "center" ? "text-center" : ""} ${column.align === "right" ? "text-right" : ""} `}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                  {...(column.sortable && {
                    tabIndex: 0,
                    onKeyDown: (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSort(column);
                      }
                    },
                  })}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{column.label}</span>
                    {column.sortable && (
                      <span
                        className={`flex-shrink-0 transition-colors ${sortColumn === column.key ? "text-teal-600" : "text-slate-300"}`}
                        aria-hidden="true"
                      >
                        {sortColumn === column.key ? (
                          sortDirection === "asc" ? (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-4 w-4"
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
                          )
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                            />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}

              {/* Actions column */}
              {actions && actions.length > 0 && (
                <th className="px-4 py-4 text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody
            className="divide-y divide-slate-100 dark:divide-slate-700"
            role="rowgroup"
          >
            {sortedData.map((row, rowIndex) => {
              const rowId = getRowId(row);
              // Check both internal state and externally controlled expansion
              const isExpanded =
                expandedRows.has(rowId) || expandedRowIds.includes(rowId);
              const isSelected = selectedRows.includes(rowId);

              return (
                <React.Fragment key={rowId}>
                  {/* Main Row */}
                  <tr
                    role="row"
                    aria-selected={isSelected}
                    className={`group transition-all duration-150 ${isExpanded ? "border-l-4 border-l-teal-500 bg-teal-50 dark:bg-teal-900/30" : ""} ${isSelected && !isExpanded ? "bg-teal-50/70 dark:bg-teal-900/20" : ""} ${!isSelected && !isExpanded ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/50" : ""} ${onRowClick || expandable ? "cursor-default" : ""} `}
                    onClick={() => {
                      if (onRowClick) onRowClick(row);
                      if (expandable) toggleRowExpansion(rowId);
                    }}
                  >
                    {/* Selection checkbox */}
                    {selectable && (
                      <td className="px-4 py-4" role="cell">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleRowSelection(rowId);
                            }}
                            className="h-4 w-4 cursor-pointer rounded-md border-2 border-slate-300 text-teal-600 transition-colors focus:ring-2 focus:ring-teal-500/20 focus:ring-offset-0"
                            aria-label={`Select row ${rowIndex + 1}`}
                          />
                        </div>
                      </td>
                    )}

                    {/* Expand/collapse icon */}
                    {expandable && (
                      <td className="px-2 py-4 text-center" role="cell">
                        <button
                          onClick={(e) => {
                            if (!onRowClick) {
                              e.stopPropagation();
                              toggleRowExpansion(rowId);
                            }
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-900/50 dark:hover:text-teal-400"
                          aria-label={
                            isExpanded
                              ? `Collapse row ${rowIndex + 1}`
                              : `Expand row ${rowIndex + 1}`
                          }
                          aria-expanded={isExpanded}
                        >
                          <svg
                            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </td>
                    )}

                    {/* Data cells */}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        role="cell"
                        className={`px-4 py-4 text-sm text-slate-700 dark:text-slate-200 ${column.align === "center" ? "text-center" : ""} ${column.align === "right" ? "text-right" : ""} `}
                      >
                        {renderCell(column, row)}
                      </td>
                    ))}

                    {/* Actions */}
                    {actions && actions.length > 0 && (
                      <td className="px-4 py-4 text-right" role="cell">
                        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          {actions.map((action) => {
                            const show = action.show ? action.show(row) : true;
                            if (!show) return null;

                            const actionStyles = {
                              primary:
                                "bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-sm",
                              secondary:
                                "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500",
                              destructive:
                                "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-sm",
                            };

                            return (
                              <button
                                key={action.key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(row);
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 ${actionStyles[action.variant as keyof typeof actionStyles] || actionStyles.primary} `}
                              >
                                {action.icon && (
                                  <span className="flex-shrink-0">
                                    {action.icon}
                                  </span>
                                )}
                                <span>{action.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* Expanded Row */}
                  {expandable && isExpanded && renderExpandedRow && (
                    <tr className="border-l-4 border-l-teal-500 bg-teal-50 dark:bg-teal-900/30">
                      <td
                        colSpan={
                          columns.length +
                          (selectable ? 1 : 0) +
                          (expandable ? 1 : 0) +
                          (actions && actions.length > 0 ? 1 : 0)
                        }
                        className="border-t border-teal-200 px-6 py-4 dark:border-teal-700"
                      >
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
