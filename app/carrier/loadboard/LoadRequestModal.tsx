/**
 * Load Request Modal
 *
 * Phase 2 - Story 16.15: Carrier-Led Load Matching
 *
 * Modal for carriers to request a specific load with one of their trucks
 */

'use client';

import { useState, useEffect } from 'react';
import { csrfFetch } from '@/lib/csrfFetch';

interface Truck {
  id: string;
  plateNumber: string;
  truckType: string;
  capacity: number;
}

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  truckType: string;
  weight: number;
  rate?: number;
  shipper?: {
    id: string;
    name: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  load: Load | null;
  onRequestSent?: (loadId: string) => void;
}

export default function LoadRequestModal({ isOpen, onClose, load, onRequestSent }: Props) {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  // No proposedRate - price negotiation happens outside platform
  const [notes, setNotes] = useState<string>('');
  const [expiryHours, setExpiryHours] = useState<string>('24');
  const [loading, setLoading] = useState(false);
  const [loadingTrucks, setLoadingTrucks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch carrier's trucks
  useEffect(() => {
    if (isOpen) {
      fetchTrucks();
      setError(null);
      setSuccess(false);
      setSelectedTruckId('');
      setNotes('');
    }
  }, [isOpen]);

  const fetchTrucks = async () => {
    setLoadingTrucks(true);
    setError(null);
    try {
      // Fetch trucks with active postings
      const response = await fetch('/api/trucks?approvalStatus=APPROVED&hasActivePosting=true&limit=100');
      if (response.ok) {
        const data = await response.json();
        setTrucks(data.trucks || []);
      } else {
        setError('Failed to load trucks. Please try again.');
      }
    } catch (err) {
      console.error('Failed to fetch trucks:', err);
      setError('Failed to load trucks. Please check your connection.');
    } finally {
      setLoadingTrucks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruckId || !load) return;

    setLoading(true);
    setError(null);

    try {
      const response = await csrfFetch('/api/load-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadId: load.id,
          truckId: selectedTruckId,
          notes: notes || undefined,
          // No proposedRate - price negotiation happens outside platform
          expiresInHours: parseInt(expiryHours, 10),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create load request');
      }

      setSuccess(true);
      // Notify parent that request was sent for this load
      if (onRequestSent && load?.id) {
        onRequestSent(load.id);
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

  if (!isOpen || !load) return null;

  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#064d51]/15 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#064d51] dark:text-white">
              Request Load
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

        {/* Load Info */}
        <div className="px-6 py-4 bg-[#1e9c99]/10 dark:bg-blue-900/20 border-b border-[#064d51]/15 dark:border-slate-700">
          <h3 className="text-sm font-medium text-[#064d51] dark:text-blue-200 mb-2">
            Selected Load
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Route:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {load.pickupCity} → {load.deliveryCity}
              </span>
            </div>
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Pickup:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {new Date(load.pickupDate).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Type:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {load.truckType}
              </span>
            </div>
            <div>
              <span className="text-[#064d51]/60 dark:text-gray-400">Weight:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {load.weight?.toLocaleString()} kg
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-[#064d51]/60 dark:text-gray-400">Shipper:</span>{' '}
              <span className="font-medium text-[#064d51] dark:text-white">
                {load.shipper?.name || 'Anonymous'}
              </span>
            </div>
            {load.rate && (
              <div className="col-span-2">
                <span className="text-[#064d51]/60 dark:text-gray-400">Posted Rate:</span>{' '}
                <span className="font-medium text-green-600 dark:text-green-400">
                  {load.rate.toLocaleString()} ETB
                </span>
              </div>
            )}
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
              The shipper will be notified of your request.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Truck Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Your Truck *
              </label>
              {loadingTrucks ? (
                <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ) : trucks.length === 0 ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    You don't have any trucks with active postings. Please post a truck first.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99] dark:bg-slate-700 dark:text-white"
                >
                  <option value="">Select a truck...</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plateNumber} - {truck.truckType} ({truck.capacity?.toLocaleString()} kg)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Truck Details */}
            {selectedTruck && (
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Truck Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[#064d51]/60">Plate:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {selectedTruck.plateNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#064d51]/60">Type:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {selectedTruck.truckType}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#064d51]/60">Capacity:</span>{' '}
                    <span className="text-[#064d51] dark:text-white">
                      {selectedTruck.capacity?.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Service Fee Info */}
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-200 dark:border-teal-800">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-teal-800 dark:text-teal-200">Price Negotiation</h4>
                  <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                    You will negotiate the freight rate directly with the shipper after your request is approved.
                    The platform only charges a service fee based on distance.
                  </p>
                </div>
              </div>
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
                placeholder="Any additional information for the shipper..."
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
                disabled={loading || !selectedTruckId || trucks.length === 0}
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
