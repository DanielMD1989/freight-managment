'use client';

/**
 * Truck Search Modal Component
 *
 * Modal for creating and saving truck searches
 * Sprint 14 - Deferred Modal Implementation
 */

import React, { useState } from 'react';
import { ActionButton } from '@/components/loadboard-ui';
import { ETHIOPIAN_LOCATIONS } from '@/lib/constants/ethiopian-locations';
import { getCSRFToken } from '@/lib/csrfFetch';

interface TruckSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (searchId: string) => void;
}

export default function TruckSearchModal({
  isOpen,
  onClose,
  onSuccess,
}: TruckSearchModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    origin: '',
    destination: '',
    truckType: '',
    ageHours: 72,
    dhOriginMin: 0,
    dhOriginMax: 100,
    dhDestMin: 0,
    dhDestMax: 100,
    minLength: 0,
    maxLength: 20,
    minWeight: 0,
    maxWeight: 40000,
    fullPartial: '',
    availableFrom: '',
    availableTo: '',
    showVerifiedOnly: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = 'Search name is required';
    if (!formData.origin && !formData.destination && !formData.truckType) {
      newErrors.general = 'At least one search criterion is required (origin, destination, or truck type)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Build search criteria
      const criteria: any = {};
      if (formData.origin) criteria.origin = formData.origin;
      if (formData.destination) criteria.destination = formData.destination;
      if (formData.truckType) criteria.truckType = formData.truckType;
      if (formData.ageHours) criteria.ageHours = formData.ageHours;
      if (formData.dhOriginMin || formData.dhOriginMax) {
        criteria.dhOrigin = { min: formData.dhOriginMin, max: formData.dhOriginMax };
      }
      if (formData.dhDestMin || formData.dhDestMax) {
        criteria.dhDest = { min: formData.dhDestMin, max: formData.dhDestMax };
      }
      if (formData.minLength || formData.maxLength) {
        criteria.length = { min: formData.minLength, max: formData.maxLength };
      }
      if (formData.minWeight || formData.maxWeight) {
        criteria.weight = { min: formData.minWeight, max: formData.maxWeight };
      }
      if (formData.fullPartial) criteria.fullPartial = formData.fullPartial;
      if (formData.availableFrom) criteria.availableFrom = formData.availableFrom;
      if (formData.availableTo) criteria.availableTo = formData.availableTo;
      if (formData.showVerifiedOnly) criteria.verifiedOnly = true;

      // Save search
      const csrfToken = await getCSRFToken();
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({
          name: formData.name,
          type: 'TRUCKS',
          criteria,
        }),
      });

      if (!response.ok) throw new Error('Failed to create search');

      const { search } = await response.json();
      alert('Truck search created successfully!');
      onSuccess(search.id);
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to create search');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#1e9c99] px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-white">NEW TRUCK SEARCH</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Search Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#064d51]/80 mb-1">
                Search Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.name ? 'border-red-500' : 'border-[#064d51]/20'
                }`}
                placeholder="e.g., Addis to Dire Dawa - Flatbed"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Location */}
            <div className="md:col-span-2 border-b border-[#064d51]/15 pb-4">
              <h3 className="text-lg font-semibold text-[#064d51] mb-4">Location Criteria</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Origin</label>
                  <select
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  >
                    <option value="">Any</option>
                    {ETHIOPIAN_LOCATIONS.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Destination</label>
                  <select
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  >
                    <option value="">Any</option>
                    {ETHIOPIAN_LOCATIONS.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Truck Specifications */}
            <div className="md:col-span-2 border-b border-[#064d51]/15 pb-4">
              <h3 className="text-lg font-semibold text-[#064d51] mb-4">Truck Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Truck Type</label>
                  <select
                    value={formData.truckType}
                    onChange={(e) => setFormData({ ...formData, truckType: e.target.value })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  >
                    <option value="">Any</option>
                    <option value="Reefer">Reefer</option>
                    <option value="Van">Van</option>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Container">Container</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Full/Partial</label>
                  <select
                    value={formData.fullPartial}
                    onChange={(e) => setFormData({ ...formData, fullPartial: e.target.value })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  >
                    <option value="">Any</option>
                    <option value="FULL">FULL</option>
                    <option value="PARTIAL">PARTIAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Max Age (hours)</label>
                  <input
                    type="number"
                    value={formData.ageHours}
                    onChange={(e) => setFormData({ ...formData, ageHours: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                    min="0"
                    max="168"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Min Length (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.minLength}
                    onChange={(e) => setFormData({ ...formData, minLength: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Max Length (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.maxLength}
                    onChange={(e) => setFormData({ ...formData, maxLength: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Min Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.minWeight}
                    onChange={(e) => setFormData({ ...formData, minWeight: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Max Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.maxWeight}
                    onChange={(e) => setFormData({ ...formData, maxWeight: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Deadhead Distances */}
            <div className="md:col-span-2 border-b border-[#064d51]/15 pb-4">
              <h3 className="text-lg font-semibold text-[#064d51] mb-4">Deadhead Distances (km)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">DH-Origin Min</label>
                  <input
                    type="number"
                    value={formData.dhOriginMin}
                    onChange={(e) => setFormData({ ...formData, dhOriginMin: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">DH-Origin Max</label>
                  <input
                    type="number"
                    value={formData.dhOriginMax}
                    onChange={(e) => setFormData({ ...formData, dhOriginMax: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">DH-Dest Min</label>
                  <input
                    type="number"
                    value={formData.dhDestMin}
                    onChange={(e) => setFormData({ ...formData, dhDestMin: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">DH-Dest Max</label>
                  <input
                    type="number"
                    value={formData.dhDestMax}
                    onChange={(e) => setFormData({ ...formData, dhDestMax: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="md:col-span-2 border-b border-[#064d51]/15 pb-4">
              <h3 className="text-lg font-semibold text-[#064d51] mb-4">Availability</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Available From</label>
                  <input
                    type="date"
                    value={formData.availableFrom}
                    onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51]/80 mb-1">Available To</label>
                  <input
                    type="date"
                    value={formData.availableTo}
                    onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Company Filters */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-[#064d51] mb-4">Company Filters</h3>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="verifiedOnly"
                  checked={formData.showVerifiedOnly}
                  onChange={(e) => setFormData({ ...formData, showVerifiedOnly: e.target.checked })}
                  className="h-4 w-4 rounded border-[#064d51]/20 text-[#1e9c99]"
                />
                <label htmlFor="verifiedOnly" className="ml-2 text-sm text-[#064d51]/80">
                  Show verified companies only
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end mt-6 pt-6 border-t border-[#064d51]/15">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-[#064d51]/20 rounded-md text-[#064d51]/80 hover:bg-[#f0fdfa]"
              disabled={loading}
            >
              Cancel
            </button>
            <ActionButton
              variant="primary"
              onClick={() => {
                const form = document.querySelector('form');
                if (form) {
                  const event = new Event('submit', { cancelable: true, bubbles: true });
                  form.dispatchEvent(event);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Search'}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
