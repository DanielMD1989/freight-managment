'use client';

/**
 * Advanced Search Filters Component
 *
 * Sprint 3 - Story 3.5: Advanced Search
 * Sprint 14 - Story 14.3: Advanced Filter Panels
 *
 * Provides comprehensive filtering for loads and trucks
 */

import { useState, useMemo } from 'react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'range' | 'date-range' | 'text' | 'checkbox';
  options?: FilterOption[];
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
}

interface FilterValue {
  [key: string]: string | string[] | number | [number, number] | [Date, Date] | boolean;
}

interface AdvancedSearchFiltersProps {
  filters: FilterConfig[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  onReset: () => void;
  onApply: () => void;
  savedFilters?: { id: string; name: string; values: FilterValue }[];
  onSaveFilter?: (name: string, values: FilterValue) => void;
  onLoadFilter?: (id: string) => void;
  onDeleteFilter?: (id: string) => void;
}

export default function AdvancedSearchFilters({
  filters,
  values,
  onChange,
  onReset,
  onApply,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
}: AdvancedSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [filterName, setFilterName] = useState('');

  const activeFilterCount = useMemo(() => {
    return Object.entries(values).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'boolean') return value;
      return value !== '' && value !== undefined;
    }).length;
  }, [values]);

  const handleValueChange = (filterId: string, value: FilterValue[string]) => {
    onChange({ ...values, [filterId]: value });
  };

  const handleSaveFilter = () => {
    if (filterName.trim() && onSaveFilter) {
      onSaveFilter(filterName.trim(), values);
      setFilterName('');
      setShowSaveModal(false);
    }
  };

  const renderFilter = (filter: FilterConfig) => {
    const value = values[filter.id];

    switch (filter.type) {
      case 'select':
        return (
          <select
            value={(value as string) || ''}
            onChange={(e) => handleValueChange(filter.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All {filter.label}</option>
            {filter.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} {option.count !== undefined && `(${option.count})`}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
            {filter.options?.map(option => (
              <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleValueChange(filter.id, [...selectedValues, option.value]);
                    } else {
                      handleValueChange(filter.id, selectedValues.filter(v => v !== option.value));
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-gray-400 text-xs">({option.count})</span>
                )}
              </label>
            ))}
          </div>
        );

      case 'range':
        const rangeValue = (value as [number, number]) || [filter.min || 0, filter.max || 100];
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={rangeValue[0]}
                onChange={(e) => handleValueChange(filter.id, [Number(e.target.value), rangeValue[1]])}
                min={filter.min}
                max={filter.max}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Min"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={rangeValue[1]}
                onChange={(e) => handleValueChange(filter.id, [rangeValue[0], Number(e.target.value)])}
                min={filter.min}
                max={filter.max}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Max"
              />
              {filter.unit && <span className="text-gray-500 text-sm">{filter.unit}</span>}
            </div>
          </div>
        );

      case 'date-range':
        const dateValue = (value as [string, string]) || ['', ''];
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateValue[0]}
              onChange={(e) => handleValueChange(filter.id, [e.target.value, dateValue[1]])}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateValue[1]}
              onChange={(e) => handleValueChange(filter.id, [dateValue[0], e.target.value])}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        );

      case 'text':
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleValueChange(filter.id, e.target.value)}
            placeholder={filter.placeholder || `Enter ${filter.label.toLowerCase()}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={(e) => handleValueChange(filter.id, e.target.checked)}
              className="rounded border-gray-300 w-5 h-5"
            />
            <span className="text-sm text-gray-700">{filter.placeholder || 'Enabled'}</span>
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <span className="font-medium">Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount} active
            </span>
          )}
          <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        <div className="flex items-center gap-2">
          {savedFilters.length > 0 && (
            <select
              onChange={(e) => onLoadFilter?.(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
              defaultValue=""
            >
              <option value="" disabled>Load saved filter...</option>
              {savedFilters.map(filter => (
                <option key={filter.id} value={filter.id}>{filter.name}</option>
              ))}
            </select>
          )}
          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter Grid */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filters.map(filter => (
              <div key={filter.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {filter.label}
                </label>
                {renderFilter(filter)}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="flex gap-2">
              {onSaveFilter && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={activeFilterCount === 0}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  Save Filter
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onReset}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Reset
              </button>
              <button
                onClick={onApply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Filter</h3>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Enter filter name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFilter}
                disabled={!filterName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Preset filter configurations for loads
 */
export const LOAD_FILTER_CONFIG: FilterConfig[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multiselect',
    options: [
      { value: 'POSTED', label: 'Posted' },
      { value: 'ASSIGNED', label: 'Assigned' },
      { value: 'IN_TRANSIT', label: 'In Transit' },
      { value: 'DELIVERED', label: 'Delivered' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
  },
  {
    id: 'truckType',
    label: 'Truck Type',
    type: 'multiselect',
    options: [
      { value: 'DRY_VAN', label: 'Dry Van' },
      { value: 'FLATBED', label: 'Flatbed' },
      { value: 'REFRIGERATED', label: 'Refrigerated' },
      { value: 'TANKER', label: 'Tanker' },
      { value: 'CONTAINER', label: 'Container' },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    type: 'range',
    min: 0,
    max: 50000,
    unit: 'kg',
  },
  {
    id: 'pickupDate',
    label: 'Pickup Date',
    type: 'date-range',
  },
  {
    id: 'origin',
    label: 'Origin City',
    type: 'text',
    placeholder: 'Enter origin city...',
  },
  {
    id: 'destination',
    label: 'Destination City',
    type: 'text',
    placeholder: 'Enter destination city...',
  },
  {
    id: 'fullPartial',
    label: 'Load Size',
    type: 'select',
    options: [
      { value: 'FULL', label: 'Full Load' },
      { value: 'PARTIAL', label: 'Partial Load' },
    ],
  },
  {
    id: 'hasRate',
    label: 'Has Rate',
    type: 'checkbox',
    placeholder: 'Only show loads with rates',
  },
];

/**
 * Preset filter configurations for trucks
 */
export const TRUCK_FILTER_CONFIG: FilterConfig[] = [
  {
    id: 'type',
    label: 'Truck Type',
    type: 'multiselect',
    options: [
      { value: 'DRY_VAN', label: 'Dry Van' },
      { value: 'FLATBED', label: 'Flatbed' },
      { value: 'REFRIGERATED', label: 'Refrigerated' },
      { value: 'TANKER', label: 'Tanker' },
      { value: 'CONTAINER', label: 'Container' },
    ],
  },
  {
    id: 'availability',
    label: 'Availability',
    type: 'select',
    options: [
      { value: 'AVAILABLE', label: 'Available' },
      { value: 'BOOKED', label: 'Booked' },
      { value: 'IN_TRANSIT', label: 'In Transit' },
    ],
  },
  {
    id: 'capacity',
    label: 'Capacity',
    type: 'range',
    min: 0,
    max: 50000,
    unit: 'kg',
  },
  {
    id: 'location',
    label: 'Current Location',
    type: 'text',
    placeholder: 'Enter city...',
  },
  {
    id: 'hasGps',
    label: 'GPS Enabled',
    type: 'checkbox',
    placeholder: 'Only show trucks with GPS',
  },
];
