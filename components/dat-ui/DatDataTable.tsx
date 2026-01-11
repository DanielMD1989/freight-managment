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

  // Empty state with professional design
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-16 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No data available</h3>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden ${className}`}>
      {/* Mobile scroll hint */}
      <div className="md:hidden bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-2.5 text-xs text-teal-700 text-center border-b border-teal-100 flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Scroll horizontally to see all columns
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Data table">
        <table className="w-full min-w-full" role="table" aria-label="Data table with sorting and selection">
          {/* Header with gradient */}
          <thead className="bg-gradient-to-r from-slate-50 via-slate-50 to-teal-50/30" role="rowgroup">
            <tr role="row" className="border-b border-slate-200/80">
              {/* Selection checkbox */}
              {selectable && (
                <th className="w-14 px-4 py-4" role="columnheader">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === data.length && data.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded-md border-2 border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:ring-offset-0 cursor-pointer transition-colors"
                      aria-label="Select all rows"
                    />
                  </div>
                </th>
              )}

              {/* Expandable icon column */}
              {expandable && <th className="w-12 px-2" role="columnheader" aria-label="Expand"></th>}

              {/* Column headers */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  role="columnheader"
                  aria-sort={sortColumn === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`
                    px-4 py-4
                    text-left
                    text-[11px]
                    font-bold
                    text-slate-500
                    uppercase
                    tracking-wider
                    whitespace-nowrap
                    ${column.sortable ? 'cursor-pointer hover:text-teal-600 hover:bg-teal-50/50 transition-colors' : ''}
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
                  <div className="flex items-center gap-2">
                    <span className="truncate">{column.label}</span>
                    {column.sortable && (
                      <span className={`flex-shrink-0 transition-colors ${sortColumn === column.key ? 'text-teal-600' : 'text-slate-300'}`} aria-hidden="true">
                        {sortColumn === column.key ? (
                          sortDirection === 'asc' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          )
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}

              {/* Actions column */}
              {actions && actions.length > 0 && (
                <th className="px-4 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100" role="rowgroup">
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
                      group
                      transition-all duration-150
                      ${isExpanded ? 'bg-teal-50 border-l-4 border-l-teal-500' : ''}
                      ${isSelected && !isExpanded ? 'bg-teal-50/70' : ''}
                      ${!isSelected && !isExpanded ? 'hover:bg-slate-50/80' : ''}
                      ${onRowClick || expandable ? 'cursor-default' : ''}
                    `}
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
                            className="h-4 w-4 rounded-md border-2 border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:ring-offset-0 cursor-pointer transition-colors"
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
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          aria-label={isExpanded ? `Collapse row ${rowIndex + 1}` : `Expand row ${rowIndex + 1}`}
                          aria-expanded={isExpanded}
                        >
                          <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    )}

                    {/* Data cells */}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        role="cell"
                        className={`
                          px-4 py-4
                          text-sm
                          text-slate-700
                          ${column.align === 'center' ? 'text-center' : ''}
                          ${column.align === 'right' ? 'text-right' : ''}
                        `}
                      >
                        {renderCell(column, row)}
                      </td>
                    ))}

                    {/* Actions */}
                    {actions && actions.length > 0 && (
                      <td className="px-4 py-4 text-right" role="cell">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {actions.map((action) => {
                            const show = action.show ? action.show(row) : true;
                            if (!show) return null;

                            const actionStyles = {
                              primary: 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-sm',
                              secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
                              destructive: 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-sm',
                            };

                            return (
                              <button
                                key={action.key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(row);
                                }}
                                className={`
                                  inline-flex items-center gap-1.5
                                  px-3 py-1.5
                                  text-xs
                                  font-semibold
                                  rounded-lg
                                  transition-all duration-150
                                  whitespace-nowrap
                                  ${actionStyles[action.variant as keyof typeof actionStyles] || actionStyles.primary}
                                `}
                              >
                                {action.icon && <span className="flex-shrink-0">{action.icon}</span>}
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
                    <tr className="bg-teal-50 border-l-4 border-l-teal-500">
                      <td
                        colSpan={
                          columns.length +
                          (selectable ? 1 : 0) +
                          (expandable ? 1 : 0) +
                          (actions && actions.length > 0 ? 1 : 0)
                        }
                        className="px-6 py-4 border-t border-teal-200"
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
