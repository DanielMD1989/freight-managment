/**
 * Quick Assignment Modal
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * Simple modal for dispatcher to quickly assign loads to trucks
 */

'use client';

import { useState, useEffect } from 'react';

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadId: string;
  loadDetails: {
    pickupCity: string;
    deliveryCity: string;
    truckType: string;
    weight: number;
  };
  onAssignSuccess: () => void;
}

interface AvailableTruck {
  id: string;
  licensePlate: string;
  truckType: string;
  carrier: {
    name: string;
  };
  originCity: {
    name: string;
  };
  matchScore?: number;
}

export default function QuickAssignModal({
  isOpen,
  onClose,
  loadId,
  loadDetails,
  onAssignSuccess,
}: QuickAssignModalProps) {
  const [trucks, setTrucks] = useState<AvailableTruck[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch matching trucks when modal opens
  useEffect(() => {
    if (isOpen && loadId) {
      fetchMatchingTrucks();
    }
  }, [isOpen, loadId]);

  const fetchMatchingTrucks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/loads/${loadId}/matching-trucks?minScore=0&limit=20`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trucks');
      }

      const data = await response.json();
      setTrucks(data.matches?.map((m: any) => ({
        id: m.truckPosting.id,
        licensePlate: m.truckPosting.truck.licensePlate,
        truckType: m.truckPosting.truck.truckType,
        carrier: m.truckPosting.truck.carrier,
        originCity: m.truckPosting.truck.currentCity,
        matchScore: m.matchScore,
      })) || []);
    } catch (err: any) {
      console.error('Error fetching trucks:', err);
      setError(err.message || 'Failed to fetch trucks');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTruckId) {
      setError('Please select a truck');
      return;
    }

    setAssigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/loads/${loadId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          truckPostingId: selectedTruckId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign load');
      }

      // Success
      onAssignSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error assigning load:', err);
      setError(err.message || 'Failed to assign load');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Quick Assign Load
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {/* Load Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Load Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Route:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {loadDetails.pickupCity} → {loadDetails.deliveryCity}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Truck Type:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {loadDetails.truckType}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Weight:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {loadDetails.weight?.toLocaleString()} kg
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Truck Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Truck to Assign
              </label>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading trucks...</p>
                </div>
              ) : trucks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No matching trucks found. Try posting a truck or adjusting the load details.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {trucks.map((truck) => (
                    <label
                      key={truck.id}
                      className={`flex items-center p-4 border-b border-gray-200 last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                        selectedTruckId === truck.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="truck"
                        value={truck.id}
                        checked={selectedTruckId === truck.id}
                        onChange={(e) => setSelectedTruckId(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {truck.licensePlate}
                            </div>
                            <div className="text-sm text-gray-600">
                              {truck.truckType} • {truck.carrier.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Current Location: {truck.originCity?.name || 'N/A'}
                            </div>
                          </div>
                          {truck.matchScore !== undefined && (
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                truck.matchScore >= 80 ? 'text-green-600' :
                                truck.matchScore >= 60 ? 'text-blue-600' :
                                truck.matchScore >= 40 ? 'text-yellow-600' :
                                'text-gray-600'
                              }`}>
                                {Math.round(truck.matchScore)}%
                              </div>
                              <div className="text-xs text-gray-500">Match</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={assigning}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={assigning || !selectedTruckId || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? 'Assigning...' : 'Assign Load'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
