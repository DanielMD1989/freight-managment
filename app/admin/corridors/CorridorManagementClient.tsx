'use client';

/**
 * Corridor Management Client Component
 *
 * Service Fee Implementation - Task 3: Admin UI
 *
 * CRUD operations for corridor pricing
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface Corridor {
  id: string;
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: number;
  pricePerKm: number;
  direction: 'ONE_WAY' | 'ROUND_TRIP' | 'BIDIRECTIONAL';
  promoFlag: boolean;
  promoDiscountPct: number | null;
  isActive: boolean;
  createdAt: string;
  loadsCount: number;
  serviceFeePreview: {
    baseFee: number;
    discount: number;
    finalFee: number;
  };
}

interface CorridorFormData {
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: string;
  pricePerKm: string;
  direction: 'ONE_WAY' | 'ROUND_TRIP' | 'BIDIRECTIONAL';
  promoFlag: boolean;
  promoDiscountPct: string;
  isActive: boolean;
}

const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'Southern Nations, Nationalities, and Peoples',
  'Southwest Ethiopia',
  'Tigray',
  'Djibouti',
];

const DIRECTION_LABELS = {
  ONE_WAY: 'One Way',
  ROUND_TRIP: 'Round Trip',
  BIDIRECTIONAL: 'Bidirectional',
};

const initialFormData: CorridorFormData = {
  name: '',
  originRegion: '',
  destinationRegion: '',
  distanceKm: '',
  pricePerKm: '2.50',
  direction: 'ONE_WAY',
  promoFlag: false,
  promoDiscountPct: '',
  isActive: true,
};

export default function CorridorManagementClient() {
  const toast = useToast();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCorridor, setEditingCorridor] = useState<Corridor | null>(null);
  const [formData, setFormData] = useState<CorridorFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Fetch corridors
  const fetchCorridors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterActive === 'active') params.set('isActive', 'true');
      if (filterActive === 'inactive') params.set('isActive', 'false');

      const response = await fetch(`/api/admin/corridors?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch corridors');

      const data = await response.json();
      setCorridors(data.corridors);
    } catch (error) {
      console.error('Error fetching corridors:', error);
      toast.error('Failed to load corridors');
    } finally {
      setLoading(false);
    }
  }, [filterActive, toast]);

  useEffect(() => {
    fetchCorridors();
  }, [fetchCorridors]);

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // Auto-generate name when regions change
  useEffect(() => {
    if (formData.originRegion && formData.destinationRegion && !editingCorridor) {
      setFormData((prev) => ({
        ...prev,
        name: `${formData.originRegion} - ${formData.destinationRegion}`,
      }));
    }
  }, [formData.originRegion, formData.destinationRegion, editingCorridor]);

  // Calculate preview fee
  const calculatePreviewFee = () => {
    const distance = parseFloat(formData.distanceKm) || 0;
    const price = parseFloat(formData.pricePerKm) || 0;
    const baseFee = distance * price;
    const discount = formData.promoFlag && formData.promoDiscountPct
      ? baseFee * (parseFloat(formData.promoDiscountPct) / 100)
      : 0;
    return {
      baseFee: baseFee.toFixed(2),
      discount: discount.toFixed(2),
      finalFee: (baseFee - discount).toFixed(2),
    };
  };

  // Open create modal
  const handleCreate = () => {
    setEditingCorridor(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (corridor: Corridor) => {
    setEditingCorridor(corridor);
    setFormData({
      name: corridor.name,
      originRegion: corridor.originRegion,
      destinationRegion: corridor.destinationRegion,
      distanceKm: corridor.distanceKm.toString(),
      pricePerKm: corridor.pricePerKm.toString(),
      direction: corridor.direction,
      promoFlag: corridor.promoFlag,
      promoDiscountPct: corridor.promoDiscountPct?.toString() || '',
      isActive: corridor.isActive,
    });
    setShowModal(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        originRegion: formData.originRegion,
        destinationRegion: formData.destinationRegion,
        distanceKm: parseFloat(formData.distanceKm),
        pricePerKm: parseFloat(formData.pricePerKm),
        direction: formData.direction,
        promoFlag: formData.promoFlag,
        promoDiscountPct: formData.promoDiscountPct ? parseFloat(formData.promoDiscountPct) : null,
        isActive: formData.isActive,
      };

      const url = editingCorridor
        ? `/api/admin/corridors/${editingCorridor.id}`
        : '/api/admin/corridors';

      const response = await fetch(url, {
        method: editingCorridor ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Operation failed');
      }

      toast.success(editingCorridor ? 'Corridor updated' : 'Corridor created');
      setShowModal(false);
      fetchCorridors();
    } catch (error) {
      console.error('Error saving corridor:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save corridor');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle corridor active status
  const handleToggleActive = async (corridor: Corridor) => {
    try {
      const response = await fetch(`/api/admin/corridors/${corridor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !corridor.isActive }),
      });

      if (!response.ok) throw new Error('Failed to update corridor');

      toast.success(`Corridor ${corridor.isActive ? 'deactivated' : 'activated'}`);
      fetchCorridors();
    } catch (error) {
      console.error('Error toggling corridor:', error);
      toast.error('Failed to update corridor');
    }
  };

  const preview = calculatePreviewFee();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Corridors</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{corridors.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-green-600">{corridors.filter(c => c.isActive).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">With Promo</p>
          <p className="text-2xl font-bold text-blue-600">{corridors.filter(c => c.promoFlag).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Loads</p>
          <p className="text-2xl font-bold text-purple-600">{corridors.reduce((sum, c) => sum + c.loadsCount, 0)}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Corridor
        </button>
      </div>

      {/* Corridors Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading corridors...</div>
        ) : corridors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No corridors found. Create your first corridor to start charging service fees.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Corridor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Distance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rate/KM</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Service Fee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Loads</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {corridors.map((corridor) => (
                  <tr key={corridor.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{corridor.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {corridor.originRegion} → {corridor.destinationRegion}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {corridor.distanceKm.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {corridor.pricePerKm.toFixed(2)} ETB
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {corridor.serviceFeePreview.finalFee.toLocaleString()} ETB
                      </div>
                      {corridor.promoFlag && corridor.promoDiscountPct && (
                        <div className="text-xs text-green-600">
                          -{corridor.promoDiscountPct}% promo
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300">
                        {DIRECTION_LABELS[corridor.direction]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        corridor.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {corridor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {corridor.loadsCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(corridor)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(corridor)}
                          className={`px-3 py-1 text-sm rounded ${
                            corridor.isActive
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                          }`}
                        >
                          {corridor.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingCorridor ? 'Edit Corridor' : 'Create Corridor'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Route */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Origin Region *
                  </label>
                  <select
                    name="originRegion"
                    value={formData.originRegion}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select origin...</option>
                    {ETHIOPIAN_REGIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Destination Region *
                  </label>
                  <select
                    name="destinationRegion"
                    value={formData.destinationRegion}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select destination...</option>
                    {ETHIOPIAN_REGIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name & Direction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Corridor Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Addis Ababa - Dire Dawa"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Direction *
                  </label>
                  <select
                    name="direction"
                    value={formData.direction}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="ONE_WAY">One Way (A → B)</option>
                    <option value="ROUND_TRIP">Round Trip (A → B → A)</option>
                    <option value="BIDIRECTIONAL">Bidirectional (A ↔ B)</option>
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Distance (km) *
                  </label>
                  <input
                    type="number"
                    name="distanceKm"
                    value={formData.distanceKm}
                    onChange={handleInputChange}
                    required
                    min="1"
                    step="0.1"
                    placeholder="e.g., 453"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price per KM (ETB) *
                  </label>
                  <input
                    type="number"
                    name="pricePerKm"
                    value={formData.pricePerKm}
                    onChange={handleInputChange}
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="e.g., 2.50"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Promo */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="promoFlag"
                    name="promoFlag"
                    checked={formData.promoFlag}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="promoFlag" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable promotional discount
                  </label>
                </div>

                {formData.promoFlag && (
                  <div className="ml-7">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Percentage
                    </label>
                    <input
                      type="number"
                      name="promoDiscountPct"
                      value={formData.promoDiscountPct}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="e.g., 10"
                      className="w-32 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                    <span className="ml-2 text-gray-500">%</span>
                  </div>
                )}
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Corridor is active
                </label>
              </div>

              {/* Fee Preview */}
              {formData.distanceKm && formData.pricePerKm && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Service Fee Preview</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Base Fee:</span>
                      <div className="font-medium text-gray-900 dark:text-white">{preview.baseFee} ETB</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Discount:</span>
                      <div className="font-medium text-green-600">-{preview.discount} ETB</div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Final Fee:</span>
                      <div className="font-bold text-blue-600">{preview.finalFee} ETB</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCorridor ? 'Update Corridor' : 'Create Corridor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
