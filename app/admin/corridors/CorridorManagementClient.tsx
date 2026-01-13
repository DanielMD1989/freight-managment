'use client';

/**
 * Corridor Management Client Component
 *
 * Service Fee Implementation - Task 3: Admin UI
 *
 * CRUD operations for corridor pricing with separate shipper/carrier rates
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface Corridor {
  id: string;
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: number;
  direction: 'ONE_WAY' | 'ROUND_TRIP' | 'BIDIRECTIONAL';
  isActive: boolean;
  createdAt: string;
  loadsCount: number;
  // Shipper pricing
  shipperPricePerKm: number;
  shipperPromoFlag: boolean;
  shipperPromoPct: number | null;
  // Carrier pricing
  carrierPricePerKm: number;
  carrierPromoFlag: boolean;
  carrierPromoPct: number | null;
  // Fee preview
  feePreview: {
    shipper: { baseFee: number; discount: number; finalFee: number };
    carrier: { baseFee: number; discount: number; finalFee: number };
    totalPlatformFee: number;
  };
  // Legacy
  pricePerKm: number;
  promoFlag: boolean;
  promoDiscountPct: number | null;
}

interface CorridorFormData {
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: string;
  direction: 'ONE_WAY' | 'ROUND_TRIP' | 'BIDIRECTIONAL';
  // Shipper pricing
  shipperPricePerKm: string;
  shipperPromoFlag: boolean;
  shipperPromoPct: string;
  // Carrier pricing
  carrierPricePerKm: string;
  carrierPromoFlag: boolean;
  carrierPromoPct: string;
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
  direction: 'ONE_WAY',
  shipperPricePerKm: '2.50',
  shipperPromoFlag: false,
  shipperPromoPct: '',
  carrierPricePerKm: '1.50',
  carrierPromoFlag: false,
  carrierPromoPct: '',
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

  // Calculate preview fee for a single party
  const calculatePartyFee = (pricePerKm: string, promoFlag: boolean, promoPct: string) => {
    const distance = parseFloat(formData.distanceKm) || 0;
    const price = parseFloat(pricePerKm) || 0;
    const baseFee = distance * price;
    const discount = promoFlag && promoPct
      ? baseFee * (parseFloat(promoPct) / 100)
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
      direction: corridor.direction,
      shipperPricePerKm: corridor.shipperPricePerKm.toString(),
      shipperPromoFlag: corridor.shipperPromoFlag,
      shipperPromoPct: corridor.shipperPromoPct?.toString() || '',
      carrierPricePerKm: corridor.carrierPricePerKm.toString(),
      carrierPromoFlag: corridor.carrierPromoFlag,
      carrierPromoPct: corridor.carrierPromoPct?.toString() || '',
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
        direction: formData.direction,
        // Shipper pricing
        shipperPricePerKm: parseFloat(formData.shipperPricePerKm),
        shipperPromoFlag: formData.shipperPromoFlag,
        shipperPromoPct: formData.shipperPromoPct ? parseFloat(formData.shipperPromoPct) : null,
        // Carrier pricing
        carrierPricePerKm: parseFloat(formData.carrierPricePerKm),
        carrierPromoFlag: formData.carrierPromoFlag,
        carrierPromoPct: formData.carrierPromoPct ? parseFloat(formData.carrierPromoPct) : null,
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

  const shipperPreview = calculatePartyFee(formData.shipperPricePerKm, formData.shipperPromoFlag, formData.shipperPromoPct);
  const carrierPreview = calculatePartyFee(formData.carrierPricePerKm, formData.carrierPromoFlag, formData.carrierPromoPct);
  const totalPlatformFee = (parseFloat(shipperPreview.finalFee) + parseFloat(carrierPreview.finalFee)).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-[#064d51]/10 p-4">
          <p className="text-sm text-[#064d51]/70">Total Corridors</p>
          <p className="text-2xl font-bold text-[#064d51]">{corridors.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-[#064d51]/10 p-4">
          <p className="text-sm text-[#064d51]/70">Active</p>
          <p className="text-2xl font-bold text-[#1e9c99]">{corridors.filter(c => c.isActive).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-[#064d51]/10 p-4">
          <p className="text-sm text-[#064d51]/70">With Promo</p>
          <p className="text-2xl font-bold text-blue-600">{corridors.filter(c => c.shipperPromoFlag || c.carrierPromoFlag).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-[#064d51]/10 p-4">
          <p className="text-sm text-[#064d51]/70">Total Loads</p>
          <p className="text-2xl font-bold text-purple-600">{corridors.reduce((sum, c) => sum + c.loadsCount, 0)}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-[#1e9c99] text-white rounded-lg hover:bg-[#178784] font-medium"
        >
          + Add Corridor
        </button>
      </div>

      {/* Corridors Table */}
      <div className="bg-white rounded-lg shadow border border-[#064d51]/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#064d51]/60">Loading corridors...</div>
        ) : corridors.length === 0 ? (
          <div className="p-8 text-center text-[#064d51]/60">
            No corridors found. Create your first corridor to start charging service fees.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#064d51]/10">
              <thead className="bg-[#f0fdfa]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">Corridor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">Distance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">Shipper Fee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">Carrier Fee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">Total Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#064d51]/70 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#064d51]/10">
                {corridors.map((corridor) => (
                  <tr key={corridor.id} className="hover:bg-[#f0fdfa]/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#064d51]">{corridor.name}</div>
                      <div className="text-sm text-[#064d51]/60">
                        {corridor.originRegion} → {corridor.destinationRegion}
                      </div>
                      <div className="text-xs text-[#064d51]/50 mt-1">
                        {DIRECTION_LABELS[corridor.direction]} | {corridor.loadsCount} loads
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#064d51]">
                      {corridor.distanceKm.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#064d51]">
                        {corridor.feePreview.shipper.finalFee.toLocaleString()} ETB
                      </div>
                      <div className="text-xs text-[#064d51]/60">
                        {corridor.shipperPricePerKm.toFixed(2)} ETB/km
                      </div>
                      {corridor.shipperPromoFlag && corridor.shipperPromoPct && (
                        <div className="text-xs text-green-600">
                          -{corridor.shipperPromoPct}% promo
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#064d51]">
                        {corridor.feePreview.carrier.finalFee.toLocaleString()} ETB
                      </div>
                      <div className="text-xs text-[#064d51]/60">
                        {corridor.carrierPricePerKm.toFixed(2)} ETB/km
                      </div>
                      {corridor.carrierPromoFlag && corridor.carrierPromoPct && (
                        <div className="text-xs text-green-600">
                          -{corridor.carrierPromoPct}% promo
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#1e9c99]">
                        {corridor.feePreview.totalPlatformFee.toLocaleString()} ETB
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        corridor.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {corridor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(corridor)}
                          className="px-3 py-1 text-sm bg-[#1e9c99]/10 text-[#1e9c99] rounded hover:bg-[#1e9c99]/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(corridor)}
                          className={`px-3 py-1 text-sm rounded ${
                            corridor.isActive
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
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
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#064d51]/10">
              <h2 className="text-xl font-bold text-[#064d51]">
                {editingCorridor ? 'Edit Corridor' : 'Create Corridor'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Route */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51] mb-1">
                    Origin Region *
                  </label>
                  <select
                    name="originRegion"
                    value={formData.originRegion}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                  >
                    <option value="">Select origin...</option>
                    {ETHIOPIAN_REGIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51] mb-1">
                    Destination Region *
                  </label>
                  <select
                    name="destinationRegion"
                    value={formData.destinationRegion}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                  >
                    <option value="">Select destination...</option>
                    {ETHIOPIAN_REGIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name & Direction & Distance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#064d51] mb-1">
                    Corridor Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Addis Ababa - Dire Dawa"
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51] mb-1">
                    Direction *
                  </label>
                  <select
                    name="direction"
                    value={formData.direction}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                  >
                    <option value="ONE_WAY">One Way</option>
                    <option value="ROUND_TRIP">Round Trip</option>
                    <option value="BIDIRECTIONAL">Bidirectional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#064d51] mb-1">
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
                    className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                  />
                </div>
              </div>

              {/* Shipper Pricing */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-[#064d51] flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded flex items-center justify-center text-xs">S</span>
                  Shipper Service Fee
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#064d51] mb-1">
                      Price per KM (ETB) *
                    </label>
                    <input
                      type="number"
                      name="shipperPricePerKm"
                      value={formData.shipperPricePerKm}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g., 2.50"
                      className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                    />
                  </div>
                  <div className="flex items-center gap-3 md:col-span-2">
                    <input
                      type="checkbox"
                      id="shipperPromoFlag"
                      name="shipperPromoFlag"
                      checked={formData.shipperPromoFlag}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#1e9c99] border-[#064d51]/30 rounded"
                    />
                    <label htmlFor="shipperPromoFlag" className="text-sm font-medium text-[#064d51]">
                      Promo discount
                    </label>
                    {formData.shipperPromoFlag && (
                      <input
                        type="number"
                        name="shipperPromoPct"
                        value={formData.shipperPromoPct}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="%"
                        className="w-20 px-2 py-1 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51] text-sm"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Carrier Pricing */}
              <div className="bg-purple-50 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-[#064d51] flex items-center gap-2">
                  <span className="w-6 h-6 bg-purple-500 text-white rounded flex items-center justify-center text-xs">C</span>
                  Carrier Service Fee
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#064d51] mb-1">
                      Price per KM (ETB) *
                    </label>
                    <input
                      type="number"
                      name="carrierPricePerKm"
                      value={formData.carrierPricePerKm}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g., 1.50"
                      className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51]"
                    />
                  </div>
                  <div className="flex items-center gap-3 md:col-span-2">
                    <input
                      type="checkbox"
                      id="carrierPromoFlag"
                      name="carrierPromoFlag"
                      checked={formData.carrierPromoFlag}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#1e9c99] border-[#064d51]/30 rounded"
                    />
                    <label htmlFor="carrierPromoFlag" className="text-sm font-medium text-[#064d51]">
                      Promo discount
                    </label>
                    {formData.carrierPromoFlag && (
                      <input
                        type="number"
                        name="carrierPromoPct"
                        value={formData.carrierPromoPct}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="%"
                        className="w-20 px-2 py-1 border border-[#064d51]/20 rounded-lg bg-white text-[#064d51] text-sm"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-[#1e9c99] border-[#064d51]/30 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-[#064d51]">
                  Corridor is active
                </label>
              </div>

              {/* Fee Preview */}
              {formData.distanceKm && (formData.shipperPricePerKm || formData.carrierPricePerKm) && (
                <div className="bg-[#f0fdfa] rounded-lg p-4 border border-[#1e9c99]/20">
                  <h3 className="font-medium text-[#064d51] mb-3">Service Fee Preview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Shipper Fee */}
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="text-xs text-blue-600 font-medium mb-1">Shipper Fee</div>
                      <div className="text-lg font-bold text-[#064d51]">{shipperPreview.finalFee} ETB</div>
                      {formData.shipperPromoFlag && parseFloat(shipperPreview.discount) > 0 && (
                        <div className="text-xs text-green-600">-{shipperPreview.discount} ETB discount</div>
                      )}
                    </div>
                    {/* Carrier Fee */}
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <div className="text-xs text-purple-600 font-medium mb-1">Carrier Fee</div>
                      <div className="text-lg font-bold text-[#064d51]">{carrierPreview.finalFee} ETB</div>
                      {formData.carrierPromoFlag && parseFloat(carrierPreview.discount) > 0 && (
                        <div className="text-xs text-green-600">-{carrierPreview.discount} ETB discount</div>
                      )}
                    </div>
                    {/* Total Platform */}
                    <div className="bg-[#1e9c99]/10 rounded-lg p-3 border border-[#1e9c99]/30">
                      <div className="text-xs text-[#1e9c99] font-medium mb-1">Total Platform Revenue</div>
                      <div className="text-xl font-bold text-[#1e9c99]">{totalPlatformFee} ETB</div>
                      <div className="text-xs text-[#064d51]/60">per trip</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#064d51]/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[#064d51] bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#1e9c99] text-white rounded-lg hover:bg-[#178784] disabled:opacity-50"
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
