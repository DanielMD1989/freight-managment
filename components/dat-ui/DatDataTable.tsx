'use client';

/**
 * DAT Data Table Component
 *
 * Reusable data-dense table with expandable rows, sorting, inline editing, and selection
 * Sprint 14 - DAT-Style UI Transformation (Phase 6: Enhanced Loading States)
 *
 * FEATURES:
 * - Expandable rows (click to show details)
 * - Sortable columns
 * - Row selection (checkbox)
 * - Inline actions
 * - Responsive (horizontal scroll on mobile)
 * - Enhanced loading states with skeleton
 * - Empty states
 */

import React, { useState, useMemo, useCallback } from 'react';
import { DatDataTableProps, DatColumn } from '@/types/dat-ui';
import DatTableSkeleton from './DatTableSkeleton';

export default function DatDataTable<T = any>({
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
  emptyMessage = 'No data available',
  className = '',
  rowKey = 'id',
}: DatDataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
  const toggleRowSelection = useCallback((rowId: string) => {
    if (!onSelectionChange) return;

    const newSelected = selectedRows.includes(rowId)
      ? selectedRows.filter((id) => id !== rowId)
      : [...selectedRows, rowId];

    onSelectionChange(newSelected);
  }, [selectedRows, onSelectionChange]);

  /**
   * Toggle select all (memoized)
   */
  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row: any) => row[rowKey]));
    }
  }, [selectedRows, data, onSelectionChange, rowKey]);

  /**
   * Handle column sort
   */
  const handleSort = (column: DatColumn) => {
    if (!column.sortable) return;

    if (sortColumn === column.key) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column.key);
      setSortDirection('asc');
    }
  };

  /**
   * Get sorted data (memoized for performance)
   */
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a: any, b: any) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  /**
   * Render cell value
   */
  const renderCell = (column: DatColumn, row: T) => {
    if (column.render) {
      return column.render((row as any)[column.key], row);
    }
    return (row as any)[column.key]?.toString() || '';
  };

  /**
   * Get row ID
   */
  const getRowId = (row: T): string => {
    return (row as any)[rowKey];
  };

  // Loading state with enhanced skeleton
  if (loading) {
    return <DatTableSkeleton rows={8} columns={columns.length + (selectable ? 1 : 0) + (actions?.length ? 1 : 0)} />;
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="text-gray-400 text-4xl mb-4">📋</div>
        <p className="text-gray-600 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Mobile scroll hint */}
      <div className="md:hidden bg-gray-100 px-4 py-2 text-xs text-gray-600 text-center border-b border-gray-200">
        ← Scroll horizontally to see all columns →
      </div>

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" role="region" aria-label="Data table">
        <table className="w-full min-w-full" role="table" aria-label="Data table with sorting and selection">
          {/* Header */}
          <thead className="bg-gray-50 border-b border-gray-200" role="rowgroup">
            <tr role="row">
              {/* Selection checkbox */}
              {selectable && (
                <th className="w-12 px-2 sm:px-4 py-2 sm:py-3" role="columnheader">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {/* Expandable icon column */}
              {expandable && <th className="w-12" role="columnheader" aria-label="Expand"></th>}

              {/* Column headers */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  role="columnheader"
                  aria-sort={sortColumn === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`
                    px-2 sm:px-4 py-2 sm:py-3
                    text-left
                    text-xs
                    font-semibold
                    text-gray-600
                    uppercase
                    tracking-wider
                    whitespace-nowrap
                    ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
                    ${column.align === 'center' ? 'text-center' : ''}
                    ${column.align === 'right' ? 'text-right' : ''}
                  `}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                  {...(column.sortable && {
                    tabIndex: 0,
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(column);
                      }
                    }
                  })}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="truncate">{column.label}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-blue-600 flex-shrink-0" aria-hidden="true">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}

              {/* Actions column */}
              {actions && actions.length > 0 && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-200" role="rowgroup">
            {sortedData.map((row, rowIndex) => {
              const rowId = getRowId(row);
              const isExpanded = expandedRows.has(rowId);
              const isSelected = selectedRows.includes(rowId);

              return (
                <React.Fragment key={rowId}>
                  {/* Main Row */}
                  <tr
                    role="row"
                    aria-selected={isSelected}
                    className={`
                      hover:bg-gray-50
                      transition-colors
                      ${isSelected ? 'bg-blue-50' : ''}
                      ${onRowClick || expandable ? 'cursor-pointer' : ''}
                    `}
                    onClick={() => {
                      if (onRowClick) onRowClick(row);
                      if (expandable) toggleRowExpansion(rowId);
                    }}
                  >
                    {/* Selection checkbox */}
                    {selectable && (
                      <td className="px-2 sm:px-4 py-2 sm:py-3" role="cell">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRowSelection(rowId);
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </td>
                    )}

                    {/* Expand/collapse icon */}
                    {expandable && (
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center" role="cell">
                        <button
                          onClick={(e) => {
                            // If parent has onRowClick, don't stop propagation - let it bubble to row
                            if (!onRowClick) {
                              e.stopPropagation();
                              toggleRowExpansion(rowId);
                            }
                            // Otherwise, let the click bubble up to the row's onClick
                          }}
                          className="text-gray-400 hover:text-gray-600"
                          aria-label={isExpanded ? `Collapse row ${rowIndex + 1}` : `Expand row ${rowIndex + 1}`}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                    )}

                    {/* Data cells */}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        role="cell"
                        className={`
                          px-2 sm:px-4 py-2 sm:py-3
                          text-xs sm:text-sm
                          text-gray-900
                          ${column.align === 'center' ? 'text-center' : ''}
                          ${column.align === 'right' ? 'text-right' : ''}
                        `}
                      >
                        {renderCell(column, row)}
                      </td>
                    ))}

                    {/* Actions */}
                    {actions && actions.length > 0 && (
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right" role="cell">
                        <div className="flex gap-2 justify-end">
                          {actions.map((action) => {
                            const show = action.show ? action.show(row) : true;
                            if (!show) return null;

                            return (
                              <button
                                key={action.key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(row);
                                }}
                                className={`
                                  px-2 sm:px-3 py-1 sm:py-1.5
                                  text-xs sm:text-sm
                                  font-medium
                                  rounded-md
                                  transition-colors
                                  whitespace-nowrap
                                  ${
                                    action.variant === 'primary'
                                      ? 'bg-lime-500 hover:bg-lime-600 text-white'
                                      : action.variant === 'secondary'
                                      ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                                      : action.variant === 'destructive'
                                      ? 'bg-red-500 hover:bg-red-600 text-white'
                                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                                  }
                                `}
                              >
                                {action.icon && <span className="mr-0.5 sm:mr-1">{action.icon}</span>}
                                <span className="hidden sm:inline">{action.label}</span>
                                {action.icon && <span className="sm:hidden">{action.icon}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* Expanded Row */}
                  {expandable && isExpanded && renderExpandedRow && (
                    <tr>
                      <td
                        colSpan={
                          columns.length +
                          (selectable ? 1 : 0) +
                          (expandable ? 1 : 0) +
                          (actions && actions.length > 0 ? 1 : 0)
                        }
                        className="px-0"
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
