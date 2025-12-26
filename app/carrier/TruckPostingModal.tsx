'use client';

/**
 * Truck Posting Modal Component
 *
 * Modal for creating new truck postings
 * Sprint 14 - Deferred Modal Implementation
 */

import React, { useState } from 'react';
import { DatActionButton, DatCharacterCounter } from '@/components/dat-ui';

interface TruckPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TruckPostingModal({
  isOpen,
  onClose,
  onSuccess,
}: TruckPostingModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentCity: '',
    currentState: '',
    destinationCity: '',
    destinationState: '',
    availableDate: '',
    truckType: 'VAN',
    fullPartial: 'FULL',
    lengthM: '',
    maxWeight: '',
    specialRequirements: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentCity) newErrors.currentCity = 'Current city is required';
    if (!formData.currentState) newErrors.currentState = 'Current state is required';
    if (!formData.truckType) newErrors.truckType = 'Truck type is required';
    if (!formData.contactPhone) newErrors.contactPhone = 'Contact phone is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/truck-postings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lengthM: formData.lengthM ? parseFloat(formData.lengthM) : null,
          maxWeight: formData.maxWeight ? parseFloat(formData.maxWeight) : null,
          status: 'UNPOSTED',
        }),
      });

      if (!response.ok) throw new Error('Failed to create truck posting');

      alert('Truck posting created successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to create truck posting');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-lime-500 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-white">NEW TRUCK POST</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Location */}
            <div className="md:col-span-2 border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currentCity}
                    onChange={(e) => setFormData({ ...formData, currentCity: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.currentCity ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Addis Ababa"
                  />
                  {errors.currentCity && <p className="text-red-500 text-xs mt-1">{errors.currentCity}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State/Region <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currentState}
                    onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.currentState ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Addis Ababa"
                  />
                  {errors.currentState && <p className="text-red-500 text-xs mt-1">{errors.currentState}</p>}
                </div>
              </div>
            </div>

            {/* Destination (Optional) */}
            <div className="md:col-span-2 border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Destination (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.destinationCity}
                    onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Dire Dawa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State/Region</label>
                  <input
                    type="text"
                    value={formData.destinationState}
                    onChange={(e) => setFormData({ ...formData, destinationState: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Dire Dawa"
                  />
                </div>
              </div>
            </div>

            {/* Truck Specifications */}
            <div className="md:col-span-2 border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Truck Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Date
                  </label>
                  <input
                    type="date"
                    value={formData.availableDate}
                    onChange={(e) => setFormData({ ...formData, availableDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Truck Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.truckType}
                    onChange={(e) => setFormData({ ...formData, truckType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="VAN">VAN</option>
                    <option value="FLATBED">FLATBED</option>
                    <option value="REFRIGERATED">REFRIGERATED</option>
                    <option value="TANKER">TANKER</option>
                    <option value="CONTAINER">CONTAINER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full/Partial
                  </label>
                  <select
                    value={formData.fullPartial}
                    onChange={(e) => setFormData({ ...formData, fullPartial: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="FULL">FULL</option>
                    <option value="PARTIAL">PARTIAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length (meters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.lengthM}
                    onChange={(e) => setFormData({ ...formData, lengthM: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 12.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.maxWeight}
                    onChange={(e) => setFormData({ ...formData, maxWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 20000"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="md:col-span-2 border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.contactPhone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="+251-XXX-XXX-XXX"
                  />
                  {errors.contactPhone && <p className="text-red-500 text-xs mt-1">{errors.contactPhone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Special Requirements */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requirements
              </label>
              <DatCharacterCounter
                value={formData.specialRequirements}
                onChange={(value) => setFormData({ ...formData, specialRequirements: value })}
                maxLength={500}
                placeholder="Any special requirements or notes..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <DatActionButton
              variant="primary"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Truck Post'}
            </DatActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
