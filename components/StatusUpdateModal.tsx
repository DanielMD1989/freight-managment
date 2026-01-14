/**
 * Status Update Modal
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * Quick modal for dispatcher to update load status
 */

'use client';

import { useState } from 'react';
import { getCSRFToken } from '@/lib/csrfFetch';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadId: string;
  currentStatus: string;
  loadDetails: {
    pickupCity: string;
    deliveryCity: string;
  };
  onUpdateSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-[#064d51]/10 text-[#064d51]' },
  { value: 'POSTED', label: 'Posted', color: 'bg-green-100 text-green-800' },
  { value: 'ASSIGNED', label: 'Assigned', color: 'bg-[#1e9c99]/10 text-[#1e9c99]' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-purple-100 text-purple-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-[#064d51]/10 text-[#064d51]' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export default function StatusUpdateModal({
  isOpen,
  onClose,
  loadId,
  currentStatus,
  loadDetails,
  onUpdateSuccess,
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      setError('Please select a different status');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${loadId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      // Success
      onUpdateSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating status:', err);
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#064d51]/15">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#064d51]">
                Update Load Status
              </h3>
              <button
                onClick={onClose}
                className="text-[#064d51]/50 hover:text-[#064d51]"
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
            <div className="mb-6 p-4 bg-[#f0fdfa] rounded-lg">
              <h4 className="text-sm font-medium text-[#064d51]/80 mb-2">Load</h4>
              <div className="text-sm">
                <span className="font-medium text-[#064d51]">
                  {loadDetails.pickupCity} → {loadDetails.deliveryCity}
                </span>
              </div>
            </div>

            {/* Current Status */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#064d51]/80 mb-2">
                Current Status
              </label>
              <div className="flex items-center">
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    STATUS_OPTIONS.find((s) => s.value === currentStatus)?.color
                  }`}
                >
                  {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label || currentStatus}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* New Status Selection */}
            <div>
              <label className="block text-sm font-medium text-[#064d51]/80 mb-2">
                New Status
              </label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <label
                    key={status.value}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-[#f0fdfa] ${
                      selectedStatus === status.value
                        ? 'border-[#1e9c99] bg-[#1e9c99]/10'
                        : 'border-[#064d51]/15'
                    } ${
                      status.value === currentStatus ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={status.value}
                      checked={selectedStatus === status.value}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      disabled={status.value === currentStatus}
                      className="mr-3 accent-[#1e9c99]"
                    />
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Warning for certain status changes */}
            {selectedStatus === 'CANCELLED' && currentStatus !== 'CANCELLED' && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> Cancelling this load may affect completion rates and trust scores.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#064d51]/15 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={updating}
              className="px-4 py-2 border border-[#064d51]/20 text-[#064d51]/80 rounded-md hover:bg-[#f0fdfa] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updating || selectedStatus === currentStatus}
              className="px-4 py-2 bg-[#1e9c99] text-white rounded-md hover:bg-[#064d51] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
