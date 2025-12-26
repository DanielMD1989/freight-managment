'use client';

/**
 * Load Posting Modal Component
 *
 * Modal for creating new load posts with DAT-style interface
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState } from 'react';
import { DatActionButton, DatCharacterCounter } from '@/components/dat-ui';

interface LoadPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
}

export default function LoadPostingModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: LoadPostingModalProps) {
  const [formData, setFormData] = useState({
    pickupCity: '',
    pickupAddress: '',
    pickupDate: '',
    pickupDockHours: '',
    deliveryCity: '',
    deliveryAddress: '',
    deliveryDate: '',
    deliveryDockHours: '',
    truckType: 'DRY_VAN',
    fullPartial: 'FULL',
    weight: '',
    lengthM: '',
    cargoDescription: '',
    rate: '',
    currency: 'ETB',
    specialInstructions: '',
    safetyNotes: '',
    bookMode: 'PLATFORM',
    isFragile: false,
    requiresRefrigeration: false,
    appointmentRequired: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Handle input change
   */
  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    // Clear error
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  /**
   * Validate form
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.pickupCity) newErrors.pickupCity = 'Origin city is required';
    if (!formData.deliveryCity) newErrors.deliveryCity = 'Destination city is required';
    if (!formData.pickupDate) newErrors.pickupDate = 'Pickup date is required';
    if (!formData.deliveryDate) newErrors.deliveryDate = 'Delivery date is required';
    if (!formData.truckType) newErrors.truckType = 'Truck type is required';
    if (!formData.rate) newErrors.rate = 'Offer rate is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          lengthM: formData.lengthM ? parseFloat(formData.lengthM) : null,
          rate: parseFloat(formData.rate),
          status: 'UNPOSTED', // Start as UNPOSTED
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create load');
      }

      alert('Load created successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Create load error:', error);
      alert(error.message || 'Failed to create load');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold">NEW LOAD POST</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white text-2xl leading-none"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Pickup Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Pickup Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origin City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pickupCity}
                    onChange={(e) => handleChange('pickupCity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Addis Ababa"
                  />
                  {errors.pickupCity && (
                    <p className="text-red-500 text-xs mt-1">{errors.pickupCity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Address
                  </label>
                  <input
                    type="text"
                    value={formData.pickupAddress}
                    onChange={(e) => handleChange('pickupAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.pickupDate}
                    onChange={(e) => handleChange('pickupDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.pickupDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.pickupDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dock Hours
                  </label>
                  <input
                    type="text"
                    value={formData.pickupDockHours}
                    onChange={(e) => handleChange('pickupDockHours', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 8AM-5PM"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.deliveryCity}
                    onChange={(e) => handleChange('deliveryCity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Dire Dawa"
                  />
                  {errors.deliveryCity && (
                    <p className="text-red-500 text-xs mt-1">{errors.deliveryCity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Address
                  </label>
                  <input
                    type="text"
                    value={formData.deliveryAddress}
                    onChange={(e) => handleChange('deliveryAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => handleChange('deliveryDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.deliveryDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.deliveryDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dock Hours
                  </label>
                  <input
                    type="text"
                    value={formData.deliveryDockHours}
                    onChange={(e) => handleChange('deliveryDockHours', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 8AM-5PM"
                  />
                </div>
              </div>
            </div>

            {/* Load Specifications */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Load Specifications</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Truck Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.truckType}
                    onChange={(e) => handleChange('truckType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="DRY_VAN">Dry Van</option>
                    <option value="FLATBED">Flatbed</option>
                    <option value="REFRIGERATED">Refrigerated</option>
                    <option value="TANKER">Tanker</option>
                    <option value="CONTAINER">Container</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full/Partial
                  </label>
                  <select
                    value={formData.fullPartial}
                    onChange={(e) => handleChange('fullPartial', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="FULL">Full Load</option>
                    <option value="PARTIAL">Partial Load</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 5000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.lengthM}
                    onChange={(e) => handleChange('lengthM', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 12.5"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo Description
                  </label>
                  <input
                    type="text"
                    value={formData.cargoDescription}
                    onChange={(e) => handleChange('cargoDescription', e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="What are you shipping?"
                  />
                  <DatCharacterCounter value={formData.cargoDescription} maxLength={100} />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Offer Rate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.rate}
                    onChange={(e) => handleChange('rate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 15000"
                  />
                  {errors.rate && (
                    <p className="text-red-500 text-xs mt-1">{errors.rate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ETB">Ethiopian Birr (ETB)</option>
                    <option value="USD">US Dollar (USD)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Instructions
                  </label>
                  <textarea
                    value={formData.specialInstructions}
                    onChange={(e) => handleChange('specialInstructions', e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special handling or delivery instructions..."
                  />
                  <DatCharacterCounter value={formData.specialInstructions} maxLength={500} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Safety Notes
                  </label>
                  <textarea
                    value={formData.safetyNotes}
                    onChange={(e) => handleChange('safetyNotes', e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Safety considerations or hazardous materials info..."
                  />
                  <DatCharacterCounter value={formData.safetyNotes} maxLength={500} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFragile}
                      onChange={(e) => handleChange('isFragile', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Fragile Cargo</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresRefrigeration}
                      onChange={(e) => handleChange('requiresRefrigeration', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Refrigerated</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.appointmentRequired}
                      onChange={(e) => handleChange('appointmentRequired', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Appointment Required</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Method
                  </label>
                  <select
                    value={formData.bookMode}
                    onChange={(e) => handleChange('bookMode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PLATFORM">Platform Booking</option>
                    <option value="DIRECT">Direct Contact</option>
                    <option value="CALLBACK">Request Callback</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <DatActionButton
              variant="primary"
              size="md"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'CREATE LOAD'}
            </DatActionButton>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
