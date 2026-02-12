'use client';

/**
 * Edit Search Modal Component
 *
 * Modal for editing saved searches (name and criteria)
 * Load Board UI Component Library
 */

import React, { useState, useEffect } from 'react';
import { SavedSearch, SavedSearchCriteria, SavedSearchType } from '@/types/loadboard-ui';

interface EditSearchModalProps {
  search: SavedSearch | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: { name?: string; criteria?: SavedSearchCriteria }) => Promise<void>;
  cities?: { name: string; region?: string }[];
  type: SavedSearchType;
}

const TRUCK_TYPES = [
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'REFRIGERATED', label: 'Refrigerated' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'DRY_VAN', label: 'Dry Van' },
  { value: 'LOWBOY', label: 'Lowboy' },
  { value: 'DUMP_TRUCK', label: 'Dump Truck' },
  { value: 'BOX_TRUCK', label: 'Box Truck' },
];

export default function EditSearchModal({
  search,
  isOpen,
  onClose,
  onSave,
  cities = [],
  type,
}: EditSearchModalProps) {
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState<SavedSearchCriteria>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when search changes
  useEffect(() => {
    if (search) {
      setName(search.name);
      setCriteria(search.criteria || {});
      setError(null);
    }
  }, [search]);

  if (!isOpen || !search) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Search name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(search.id, { name: name.trim(), criteria });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateCriteria = (key: string, value: any) => {
    setCriteria((prev) => ({
      ...prev,
      [key]: value === '' ? undefined : value,
    }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#064d51]/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#064d51]/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#064d51]">Edit Saved Search</h2>
            <button
              onClick={onClose}
              className="text-[#064d51]/50 hover:text-[#064d51]"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-sm text-rose-800">{error}</p>
            </div>
          )}

          {/* Search Name */}
          <div>
            <label className="block text-sm font-medium text-[#064d51] mb-2">
              Search Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              placeholder="Enter search name..."
            />
          </div>

          {/* Search Criteria Section */}
          <div className="border-t border-[#064d51]/10 pt-6">
            <h3 className="text-lg font-semibold text-[#064d51] mb-4">Search Criteria</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Origin */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Origin
                </label>
                <select
                  value={criteria.origin || ''}
                  onChange={(e) => updateCriteria('origin', e.target.value)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                >
                  <option value="">Any origin</option>
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}{city.region ? ` (${city.region})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Destination
                </label>
                <select
                  value={criteria.destination || ''}
                  onChange={(e) => updateCriteria('destination', e.target.value)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                >
                  <option value="">Any destination</option>
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}{city.region ? ` (${city.region})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Truck Type */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Truck Type
                </label>
                <select
                  value={Array.isArray(criteria.truckType) ? criteria.truckType[0] || '' : criteria.truckType || ''}
                  onChange={(e) => updateCriteria('truckType', e.target.value ? [e.target.value] : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                >
                  <option value="">Any type</option>
                  {TRUCK_TYPES.map((truckType) => (
                    <option key={truckType.value} value={truckType.value}>
                      {truckType.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Full/Partial */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Load Type
                </label>
                <select
                  value={criteria.fullPartial || ''}
                  onChange={(e) => updateCriteria('fullPartial', e.target.value)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                >
                  <option value="">Any load type</option>
                  <option value="FULL">Full Truckload</option>
                  <option value="PARTIAL">Partial Load</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>

              {/* Min Weight */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Min Weight (kg)
                </label>
                <input
                  type="number"
                  value={criteria.minWeight || ''}
                  onChange={(e) => updateCriteria('minWeight', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Max Weight */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Max Weight (kg)
                </label>
                <input
                  type="number"
                  value={criteria.maxWeight || ''}
                  onChange={(e) => updateCriteria('maxWeight', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                  placeholder="No limit"
                  min="0"
                />
              </div>

              {/* Min Rate */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Min Rate (ETB)
                </label>
                <input
                  type="number"
                  value={criteria.minRate || ''}
                  onChange={(e) => updateCriteria('minRate', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Max Rate */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Max Rate (ETB)
                </label>
                <input
                  type="number"
                  value={criteria.maxRate || ''}
                  onChange={(e) => updateCriteria('maxRate', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                  placeholder="No limit"
                  min="0"
                />
              </div>

              {/* Age Hours (for LOADS) */}
              {type === 'LOADS' && (
                <div>
                  <label className="block text-sm font-medium text-[#064d51] mb-2">
                    Max Age (hours)
                  </label>
                  <input
                    type="number"
                    value={criteria.ageHours || ''}
                    onChange={(e) => updateCriteria('ageHours', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                    placeholder="Any age"
                    min="1"
                  />
                </div>
              )}

              {/* Min Trip Distance */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Min Distance (km)
                </label>
                <input
                  type="number"
                  value={criteria.minTripKm || ''}
                  onChange={(e) => updateCriteria('minTripKm', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Max Trip Distance */}
              <div>
                <label className="block text-sm font-medium text-[#064d51] mb-2">
                  Max Distance (km)
                </label>
                <input
                  type="number"
                  value={criteria.maxTripKm || ''}
                  onChange={(e) => updateCriteria('maxTripKm', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                  placeholder="No limit"
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#064d51]/10 bg-[#f0fdfa]">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-[#064d51]/20 rounded-lg text-[#064d51] hover:bg-[#064d51]/5 disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#064d51] text-white rounded-lg hover:bg-[#053d40] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
