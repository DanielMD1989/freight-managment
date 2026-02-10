'use client';

/**
 * Truck Posting Modal - Matching design of LoadPostingModal
 * Used for creating new truck postings
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState } from 'react';
import PlacesAutocomplete, { PlaceResult } from '@/components/PlacesAutocomplete';
import { getCSRFToken } from '@/lib/csrfFetch';

interface TruckPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  ethiopianCities: any[];
}

export default function TruckPostingModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  ethiopianCities,
}: TruckPostingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    availableFrom: '',
    availableTo: '',
    owner: '',
    origin: '',
    destination: '',
    truckType: 'DRY_VAN',
    fullPartial: 'FULL',
    lengthM: '',
    weight: '',
    refId: '',
    contactPhone: '',
    comments1: '',
    comments2: '',
  });

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.origin || !formData.availableFrom || !formData.truckType || !formData.contactPhone) {
      setError('Please fill in all required fields: Origin, Available Date, Truck Type, and Contact Phone');
      return;
    }

    setLoading(true);
    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        setError('Failed to get security token. Please refresh and try again.');
        setLoading(false);
        return;
      }

      // Find first truck from user's organization
      const trucksResponse = await fetch(`/api/trucks?organizationId=${user.organizationId}&limit=1`);
      const trucksData = await trucksResponse.json();
      const userTruck = trucksData.trucks?.[0];

      if (!userTruck) {
        setError('No truck found for your organization. Please add a truck first.');
        setLoading(false);
        return;
      }

      // Look up EthiopianLocation IDs from city names
      const originCity = ethiopianCities.find(
        (c: any) => c.name?.toLowerCase() === formData.origin.toLowerCase()
      );
      const destinationCity = formData.destination
        ? ethiopianCities.find(
            (c: any) => c.name?.toLowerCase() === formData.destination.toLowerCase()
          )
        : null;

      if (!originCity) {
        setError('Origin city not found in Ethiopian locations. Please select a valid city from the suggestions.');
        setLoading(false);
        return;
      }

      // Convert date to ISO datetime format (API expects datetime, not just date)
      const availableFromISO = new Date(formData.availableFrom + 'T00:00:00').toISOString();
      const availableToISO = formData.availableTo
        ? new Date(formData.availableTo + 'T23:59:59').toISOString()
        : null;

      const response = await fetch('/api/truck-postings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          truckId: userTruck.id,
          originCityId: originCity.id,
          destinationCityId: destinationCity?.id || null,
          availableFrom: availableFromISO,
          availableTo: availableToISO,
          fullPartial: formData.fullPartial,
          availableLength: formData.lengthM ? parseFloat(formData.lengthM) : null,
          availableWeight: formData.weight ? parseFloat(formData.weight) : null,
          ownerName: formData.owner || null,
          contactName: user.firstName + ' ' + user.lastName,
          contactPhone: formData.contactPhone,
          notes: (formData.comments1 + ' ' + formData.comments2).trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create truck posting');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Create truck posting error:', error);
      setError(error.message || 'Failed to create truck posting');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-200 px-6 py-4 border-b border-[#064d51]/20 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#064d51]">NEW TRUCK POST</h2>
          <button
            onClick={onClose}
            className="text-[#064d51]/60 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form - Matching LoadPostingModal design */}
        <form onSubmit={handleSubmit}>
          {/* Error Display */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}
          <div className="border-b border-[#064d51]/30 p-4" style={{ backgroundColor: '#2B2727' }}>
            {/* Form Fields Row - Grid matching table columns */}
            <div className="grid grid-cols-12 gap-2 mb-4">
              <div className="flex items-center gap-1 pt-5">
                <input type="checkbox" className="w-4 h-4" />
                <span className="text-white text-lg cursor-pointer">☆</span>
              </div>
              {/* Empty columns for Age and Status */}
              <div></div>
              <div></div>
              <div>
                <label className="block text-xs text-white mb-1">Avail From *</label>
                <input
                  type="date"
                  value={formData.availableFrom}
                  onChange={(e) => handleChange('availableFrom', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Owner</label>
                <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => handleChange('owner', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  placeholder="Owner name"
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Origin *</label>
                <PlacesAutocomplete
                  value={formData.origin}
                  onChange={(value, place) => {
                    handleChange('origin', value);
                    if (place?.coordinates) {
                      handleChange('originCoordinates', place.coordinates);
                    }
                  }}
                  placeholder="Search city..."
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  countryRestriction={['ET', 'DJ']}
                  types={['(cities)']}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Destination</label>
                <PlacesAutocomplete
                  value={formData.destination}
                  onChange={(value, place) => {
                    handleChange('destination', value);
                    if (place?.coordinates) {
                      handleChange('destinationCoordinates', place.coordinates);
                    }
                  }}
                  placeholder="Anywhere"
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  countryRestriction={['ET', 'DJ']}
                  types={['(cities)']}
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Truck *</label>
                <select
                  value={formData.truckType}
                  onChange={(e) => handleChange('truckType', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  required
                >
                  <option value="DRY_VAN">Van</option>
                  <option value="FLATBED">Flatbed</option>
                  <option value="REFRIGERATED">Reefer</option>
                  <option value="TANKER">Tanker</option>
                  <option value="CONTAINER">Container</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white mb-1">F/P</label>
                <select
                  value={formData.fullPartial}
                  onChange={(e) => handleChange('fullPartial', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                >
                  <option value="FULL">Full</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Length</label>
                <input
                  type="number"
                  value={formData.lengthM}
                  onChange={(e) => handleChange('lengthM', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  placeholder="40"
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Weight</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  placeholder="40000"
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Contact *</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  placeholder="+251-9xx-xxx-xxx"
                  required
                />
              </div>
            </div>

            {/* Bottom Section: Ref ID, Comments, and Actions */}
            <div className="grid grid-cols-3 gap-4">
              {/* Ref ID */}
              <div>
                <label className="block text-xs text-white mb-1">
                  Ref ID <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.refId}
                  onChange={(e) => handleChange('refId', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-[#064d51] border border-[#064d51]/30 rounded"
                  placeholder="e.g. TRK-001"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs text-white mb-1">
                  Comments <span className="text-gray-400">({formData.comments1.length}/70 max char)</span>
                </label>
                <textarea
                  value={formData.comments1}
                  onChange={(e) => handleChange('comments1', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-[#064d51] border border-[#064d51]/30 rounded resize-none"
                  rows={3}
                  maxLength={70}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col justify-end">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 bg-[#1e9c99] text-white font-medium rounded hover:bg-[#064d51] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'POSTING...' : '+ POST'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
