/**
 * Truck Booking Modal
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 * Task 16.15.2: Direct Booking Button
 *
 * Modal for shippers to request a specific truck for their load
 */

'use client';

import { useState, useEffect } from 'react';
import { getCSRFToken } from '@/lib/csrfFetch';

interface Load {
  id: string;
  referenceNumber: string;
  status: string;
  pickupCityName: string;
  deliveryCityName: string;
  weight: number;
  truckType: string;
  pickupDate: string;
  offeredRate?: number;
}

interface TruckPosting {
  id: string;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier: {
    name: string;
    isVerified?: boolean;
  };
  originCity: {
    name: string;
  };
  destinationCity?: {
    name: string;
  } | null;
  availableFrom: string;
  availableTo?: string;
  contactName?: string;
  contactPhone?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  truckPosting: TruckPosting | null;
  onRequestSent?: (truckId: string) => void;
}

export default function TruckBookingModal({ isOpen, onClose, truckPosting, onRequestSent }: Props) {
  const [loads, setLoads] = useState<Load[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState<string>('');
  const [offeredRate, setOfferedRate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [expiryHours, setExpiryHours] = useState<string>('24');
  const [loading, setLoading] = useState(false);
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch shipper's posted loads
  useEffect(() => {
    if (isOpen) {
      fetchLoads();
      setError(null);
      setSuccess(false);
      setSelectedLoadId('');
      setOfferedRate('');
      setNotes('');
    }
  }, [isOpen]);

  const fetchLoads = async () => {
    setLoadingLoads(true);
    try {
      // Include myLoads=true to only fetch loads belonging to the current user's organization
      const response = await fetch('/api/loads?status=POSTED,SEARCHING,OFFERED&myLoads=true&limit=100');
      if (response.ok) {
        const data = await response.json();
        setLoads(data.loads || []);
      }
    } catch (err) {
      console.error('Failed to fetch loads:', err);
    } finally {
      setLoadingLoads(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoadId || !truckPosting) return;

    setLoading(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        throw new Error('Failed to get security token. Please try again.');
      }

      const response = await fetch('/api/truck-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          loadId: selectedLoadId,
          truckId: truckPosting.truck.id,
          notes: notes || undefined,
          offeredRate: offeredRate ? parseFloat(offeredRate) : undefined,
          expiryHours: parseInt(expiryHours, 10),
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create booking request');
      }

      setSuccess(true);
      // Notify parent that request was sent for this truck
      if (onRequestSent && truckPosting?.truck?.id) {
        onRequestSent(truckPosting.truck.id);
      }
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !truckPosting) return null;

  const selectedLoad = loads.find((l) => l.id === selectedLoadId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#064d51]/15 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#064d51] dark:text-white">
              Request Truck
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Truck Info */}
        <div className="px-6 py-4 bg-[#1e9c99]/10 dark:bg-blue-900/20 border-b border-[#064d51]/15 dark:border-slate-700">
          <h3 className="text-sm font-medium text-[#064d51] dark:text-blue-200 mb-2">
            Selected Truck
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Plate:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {truckPosting.truck?.licensePlate || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Type:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {truckPosting.truck?.truckType || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Capacity:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {truckPosting.truck?.capacity?.toLocaleString() || 'N/A'} kg
              </span>
            </div>
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Carrier:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {truckPosting.carrier?.name || 'Unknown'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-[#064d51]/60 dark:text-gray-400">Route:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {truckPosting.originCity?.name || 'N/A'}
                {truckPosting.destinationCity?.name
                  ? ` → ${truckPosting.destinationCity.name}`
                  : ' (Anywhere)'}
              </span>
            </div>
          </div>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#064d51] dark:text-white mb-2">
              Request Sent!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              The carrier will be notified of your request.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Load Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Load *
              </label>
              {loadingLoads ? (
                <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ) : loads.length === 0 ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    You don't have any posted loads. Please post a load first.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedLoadId}
                  onChange={(e) => setSelectedLoadId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-700 dark:text-white"
                >
                  <option value="">Select a load...</option>
                  {loads.map((load) => (
                    <option key={load.id} value={load.id}>
                      {load.referenceNumber || load.id.slice(-8)} -{' '}
                      {load.pickupCityName} → {load.deliveryCityName} ({load.weight} kg,{' '}
                      {load.truckType})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Load Details */}
            {selectedLoad && (
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Load Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[#064d51]/60">Route:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {selectedLoad.pickupCityName} → {selectedLoad.deliveryCityName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#064d51]/60">Pickup:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {new Date(selectedLoad.pickupDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#064d51]/60">Weight:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {selectedLoad.weight.toLocaleString()} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-[#064d51]/60">Type:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {selectedLoad.truckType}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Offered Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Offered Rate (ETB)
              </label>
              <input
                type="number"
                value={offeredRate}
                onChange={(e) => setOfferedRate(e.target.value)}
                min="0"
                step="0.01"
                placeholder={selectedLoad?.offeredRate?.toString() || 'Optional'}
                className="w-full px-3 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-700 dark:text-white"
              />
              <p className="text-xs text-[#064d51]/60 mt-1">
                Leave empty to let carrier propose a rate
              </p>
            </div>

            {/* Request Expiry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Request Valid For
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="w-full px-3 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-700 dark:text-white"
              >
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special instructions or requirements..."
                className="w-full px-3 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-700 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#064d51]/15 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedLoadId || loads.length === 0}
                className="px-4 py-2 bg-[#1e9c99] text-white rounded-lg hover:bg-[#064d51] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
