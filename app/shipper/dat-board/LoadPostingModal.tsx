'use client';

/**
 * Load Posting Modal - Exact copy of inline new load form
 * Used for both creating new loads and editing existing loads
 */

import React, { useState, useEffect } from 'react';
import { ETHIOPIAN_LOCATIONS } from '@/lib/constants/ethiopian-locations';

interface LoadPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  load?: any; // Optional load for editing
}

export default function LoadPostingModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  load,
}: LoadPostingModalProps) {
  const isEditMode = !!load;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    pickupDate: '',
    pickupCity: '',
    deliveryCity: '',
    pickupDockHours: '',
    truckType: 'Reefer',
    fullPartial: 'Full',
    lengthM: '',
    weight: '',
    shipperContactPhone: '',
    cargoDescription: '',
    specialInstructions: '',
  });

  // Populate form when editing
  useEffect(() => {
    if (load) {
      setFormData({
        pickupDate: load.pickupDate ? new Date(load.pickupDate).toISOString().split('T')[0] : '',
        pickupCity: load.pickupCity || '',
        deliveryCity: load.deliveryCity || '',
        pickupDockHours: load.pickupDockHours || '',
        truckType: load.truckType || 'Reefer',
        fullPartial: load.fullPartial || 'Full',
        lengthM: load.lengthM?.toString() || '',
        weight: load.weight?.toString() || '',
        shipperContactPhone: load.shipperContactPhone || '',
        cargoDescription: load.cargoDescription || '',
        specialInstructions: load.specialInstructions || '',
      });
    }
  }, [load]);

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.pickupCity || !formData.deliveryCity || !formData.pickupDate || !formData.truckType) {
      alert('Please fill in all required fields: Origin, Destination, Pickup Date, and Truck Type');
      return;
    }

    setLoading(true);
    try {
      const url = isEditMode ? `/api/loads/${load.id}` : '/api/loads';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lengthM: formData.lengthM ? parseFloat(formData.lengthM) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          ...(!isEditMode && { status: 'POSTED', deliveryDate: formData.pickupDate }), // Default values for new loads
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEditMode ? 'update' : 'create'} load`);
      }

      alert(`Load ${isEditMode ? 'updated' : 'posted'} successfully!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(`${isEditMode ? 'Update' : 'Create'} load error:`, error);
      alert(error.message || `Failed to ${isEditMode ? 'update' : 'create'} load`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-200 px-6 py-4 border-b border-gray-300 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditMode ? 'EDIT LOAD' : 'NEW LOAD POST'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form - Exact copy of inline new load form */}
        <form onSubmit={handleSubmit}>
          <div className="border-b border-gray-400 p-4" style={{ backgroundColor: '#2B2727' }}>
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
                <label className="block text-xs text-white mb-1">Pickup *</label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => handleChange('pickupDate', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Origin *</label>
                <select
                  value={formData.pickupCity}
                  onChange={(e) => handleChange('pickupCity', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  required
                >
                  <option value="">Select City</option>
                  {ETHIOPIAN_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Destination *</label>
                <select
                  value={formData.deliveryCity}
                  onChange={(e) => handleChange('deliveryCity', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  required
                >
                  <option value="">Select City</option>
                  {ETHIOPIAN_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Dock Hours</label>
                <input
                  type="text"
                  value={formData.pickupDockHours}
                  onChange={(e) => handleChange('pickupDockHours', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  placeholder="9am-5pm"
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Truck *</label>
                <select
                  value={formData.truckType}
                  onChange={(e) => handleChange('truckType', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  required
                >
                  <option>Reefer</option>
                  <option>Van</option>
                  <option>Flatbed</option>
                  <option>Container</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white mb-1">F/P</label>
                <select
                  value={formData.fullPartial}
                  onChange={(e) => handleChange('fullPartial', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                >
                  <option>Full</option>
                  <option>Partial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Length</label>
                <input
                  type="number"
                  value={formData.lengthM}
                  onChange={(e) => handleChange('lengthM', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  placeholder="53"
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Weight</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  placeholder="45000"
                />
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Contact</label>
                <input
                  type="tel"
                  value={formData.shipperContactPhone}
                  onChange={(e) => handleChange('shipperContactPhone', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-400 rounded"
                  placeholder="+251-9xx"
                />
              </div>
            </div>

            {/* Bottom Section: Commodity, Comments, and Actions */}
            <div className="grid grid-cols-3 gap-4">
              {/* Commodity */}
              <div>
                <label className="block text-xs text-white mb-1">
                  Commodity <span className="text-gray-400">({formData.cargoDescription.length}/100 max char)</span>
                </label>
                <textarea
                  value={formData.cargoDescription}
                  onChange={(e) => handleChange('cargoDescription', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-400 rounded resize-none"
                  rows={3}
                  maxLength={100}
                  placeholder="e.g. Steel Coils, Electronics..."
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs text-white mb-1">
                  Comments <span className="text-gray-400">({formData.specialInstructions.length}/70 max char)</span>
                </label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) => handleChange('specialInstructions', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-400 rounded resize-none"
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
                    className="flex-1 px-6 py-2 bg-cyan-400 text-white font-medium rounded hover:bg-cyan-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? (isEditMode ? 'SAVING...' : 'POSTING...')
                      : (isEditMode ? 'SAVE' : '+ POST')
                    }
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
