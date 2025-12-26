'use client';

/**
 * DAT Data Table Component
 *
 * Reusable data-dense table with expandable rows, sorting, inline editing, and selection
 * Sprint 14 - DAT-Style UI Transformation
 *
 * FEATURES:
 * - Expandable rows (click to show details)
 * - Sortable columns
 * - Row selection (checkbox)
 * - Inline actions
 * - Responsive (horizontal scroll on mobile)
 * - Loading states
 * - Empty states
 */

import React, { useState } from 'react';
import { DatDataTableProps, DatColumn } from '@/types/dat-ui';

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
   * Toggle row expansion
   */
  const toggleRowExpansion = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  /**
   * Toggle row selection
   */
  const toggleRowSelection = (rowId: string) => {
    if (!onSelectionChange) return;

    const newSelected = selectedRows.includes(rowId)
      ? selectedRows.filter((id) => id !== rowId)
      : [...selectedRows, rowId];

    onSelectionChange(newSelected);
  };

  /**
   * Toggle select all
   */
  const toggleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row) => row[rowKey]));
    }
  };

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
   * Get sorted data
   */
  const getSortedData = () => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
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
  };

  const sortedData = getSortedData();

  /**
   * Render cell value
   */
  const renderCell = (column: DatColumn, row: T) => {
    if (column.render) {
      return column.render(row[column.key], row);
    }
    return row[column.key]?.toString() || '';
  };

  /**
   * Get row ID
   */
  const getRowId = (row: T): string => {
    return row[rowKey];
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 border-t border-gray-200"></div>
          ))}
        </div>
      </div>
    );
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
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Selection checkbox */}
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
              )}

              {/* Expandable icon column */}
              {expandable && <th className="w-12"></th>}

              {/* Column headers */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-4 py-3
                    text-left
                    text-xs
                    font-semibold
                    text-gray-600
                    uppercase
                    tracking-wider
                    ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
                    ${column.align === 'center' ? 'text-center' : ''}
                    ${column.align === 'right' ? 'text-right' : ''}
                  `}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-blue-600">
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
          <tbody className="divide-y divide-gray-200">
            {sortedData.map((row, rowIndex) => {
              const rowId = getRowId(row);
              const isExpanded = expandedRows.has(rowId);
              const isSelected = selectedRows.includes(rowId);

              return (
                <React.Fragment key={rowId}>
                  {/* Main Row */}
                  <tr
                    className={`
                      hover:bg-gray-50
                      transition-colors
                      ${isSelected ? 'bg-blue-50' : ''}
                      ${onRowClick ? 'cursor-pointer' : ''}
                    `}
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {/* Selection checkbox */}
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRowSelection(rowId);
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}

                    {/* Expand/collapse icon */}
                    {expandable && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(rowId);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                    )}

                    {/* Data cells */}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`
                          px-4 py-3
                          text-sm
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
                      <td className="px-4 py-3 text-right">
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
                                  px-3 py-1.5
                                  text-sm
                                  font-medium
                                  rounded-md
                                  transition-colors
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
                                {action.icon && <span className="mr-1">{action.icon}</span>}
                                {action.label}
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
                        className="bg-gray-700 px-4 py-4"
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
