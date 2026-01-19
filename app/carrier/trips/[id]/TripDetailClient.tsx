/**
 * Trip Detail Client Component
 *
 * Sprint 18 - Story 18.3 & 18.4: Trip management and POD upload
 *
 * Displays trip details with status-based actions
 * Updated to use proper Trip model and /api/trips endpoint
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { csrfFetch } from '@/lib/csrfFetch';

interface Trip {
  id: string; // Trip ID
  loadId: string; // Associated Load ID
  referenceNumber: string;
  status: string;
  weight: number;
  truckType: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  pickupDockHours: string | null;
  deliveryDockHours: string | null;
  rate: number | null;
  cargoDescription: string | null;
  safetyNotes: string | null;
  shipperContactName: string | null;
  shipperContactPhone: string | null;
  trackingEnabled: boolean;
  trackingUrl: string | null;
  tripProgressPercent: number | null;
  remainingDistanceKm: number | null;
  estimatedTripKm: number | null;
  shipper: {
    id: string;
    name: string;
    isVerified?: boolean;
  } | null;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
    carrier: {
      id: string;
      name: string;
    };
  } | null;
  documents: {
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    createdAt: string;
  }[];
  events: {
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
  }[];
  // Trip-specific timestamps
  startedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
}

interface Props {
  trip: Trip;
}

export default function TripDetailClient({ trip: initialTrip }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trip, setTrip] = useState(initialTrip);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPodUpload, setShowPodUpload] = useState(false);
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podNotes, setPodNotes] = useState('');
  const [uploadingPod, setUploadingPod] = useState(false);
  const [uploadedPods, setUploadedPods] = useState<Array<{id: string; fileName: string; fileUrl: string}>>([]);

  // Delivery form state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Auto-open POD upload modal if query param is present
  useEffect(() => {
    if (searchParams.get('uploadPod') === 'true' && trip.status === 'DELIVERED') {
      setShowPodUpload(true);
    }
  }, [searchParams, trip.status]);

  const handleStatusChange = async (newStatus: string, additionalData?: Record<string, string>) => {
    setLoading(true);
    setError(null);

    try {
      // Use the Trip API for status changes
      const response = await csrfFetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...additionalData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Refresh trip data
      router.refresh();
      setTrip((prev) => ({ ...prev, status: newStatus }));

      // Navigate based on new status
      if (newStatus === 'PICKUP_PENDING' || newStatus === 'IN_TRANSIT') {
        router.push('/carrier/trips?tab=active');
      } else if (newStatus === 'DELIVERED') {
        setShowDeliveryModal(false);
        setShowPodUpload(true);
      } else if (newStatus === 'COMPLETED') {
        router.push('/carrier/trips?tab=completed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = () => {
    // Open delivery modal to collect receiver info
    setShowDeliveryModal(true);
  };

  const submitDelivery = async () => {
    await handleStatusChange('DELIVERED', {
      receiverName: receiverName || undefined,
      receiverPhone: receiverPhone || undefined,
      deliveryNotes: deliveryNotes || undefined,
    } as any);
  };

  const handleCancelTrip = async () => {
    if (!cancelReason.trim()) {
      setError('Please provide a reason for cancellation');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await csrfFetch(`/api/trips/${trip.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel trip');
      }

      setShowCancelModal(false);
      router.push('/carrier/trips');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePodUpload = async () => {
    if (!podFile) {
      setError('Please select a POD file to upload');
      return;
    }

    setUploadingPod(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', podFile);
      if (podNotes) {
        formData.append('notes', podNotes);
      }

      // Use the new Trip POD endpoint
      const response = await csrfFetch(`/api/trips/${trip.id}/pod`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload POD');
      }

      const data = await response.json();

      // Add to uploaded PODs list
      setUploadedPods(prev => [...prev, {
        id: data.pod.id,
        fileName: data.pod.fileName,
        fileUrl: data.pod.fileUrl,
      }]);

      // Clear file state but keep modal open for additional uploads
      setPodFile(null);
      setPodNotes('');

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingPod(false);
    }
  };

  const finishPodUpload = () => {
    setShowPodUpload(false);
    setUploadedPods([]);
    router.push('/carrier/trips?tab=active&podUploaded=true');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      ASSIGNED: { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200', label: 'Ready to Start' },
      PICKUP_PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', label: 'Pickup Pending' },
      IN_TRANSIT: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', label: 'In Transit' },
      DELIVERED: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', label: 'POD Required' },
      COMPLETED: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: 'Completed' },
      CANCELLED: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', label: 'Cancelled' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2"
          >
            ← Back to Trips
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {trip.referenceNumber}
            {getStatusBadge(trip.status)}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {trip.pickupCity} → {trip.deliveryCity}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {trip.status === 'ASSIGNED' && (
            <>
              <button
                onClick={() => handleStatusChange('PICKUP_PENDING')}
                disabled={loading}
                className="px-6 py-2 text-white bg-[#1e9c99] rounded-lg hover:bg-[#064d51] disabled:opacity-50 font-medium"
              >
                {loading ? 'Starting...' : 'Start Trip'}
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 font-medium"
              >
                Cancel Trip
              </button>
            </>
          )}
          {trip.status === 'PICKUP_PENDING' && (
            <>
              <button
                onClick={() => handleStatusChange('IN_TRANSIT')}
                disabled={loading}
                className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Confirming...' : 'Confirm Pickup'}
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 font-medium"
              >
                Cancel Trip
              </button>
            </>
          )}
          {trip.status === 'IN_TRANSIT' && (
            <>
              <button
                onClick={() => window.location.href = `/carrier/map?tripId=${trip.id}`}
                className="px-6 py-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 font-medium"
              >
                Track Live
              </button>
              <button
                onClick={handleMarkDelivered}
                disabled={loading}
                className="px-6 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Marking...' : 'Mark Delivered'}
              </button>
            </>
          )}
          {trip.status === 'DELIVERED' && (
            <button
              onClick={() => setShowPodUpload(true)}
              className="px-6 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 font-medium"
            >
              Upload POD
            </button>
          )}
          {trip.status === 'CANCELLED' && (
            <span className="px-6 py-2 text-red-600 bg-red-50 rounded-lg font-medium">
              Trip Cancelled
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* POD Upload Modal */}
      {showPodUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upload Proof of Delivery
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload photos or scans of the signed delivery receipt. You can upload multiple files. The shipper will verify before the trip completes.
            </p>

            {/* Show uploaded PODs */}
            {uploadedPods.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  Uploaded ({uploadedPods.length})
                </p>
                {uploadedPods.map((pod) => (
                  <div key={pod.id} className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                    <span>✓</span> {pod.fileName}
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center mb-4">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setPodFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pod-upload"
              />
              <label
                htmlFor="pod-upload"
                className="cursor-pointer"
              >
                {podFile ? (
                  <div className="text-green-600">
                    <span className="text-2xl">✓</span>
                    <p className="mt-2 font-medium">{podFile.name}</p>
                    <p className="text-sm text-gray-500">Click to change</p>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <span className="text-3xl">📄</span>
                    <p className="mt-2">Click to select POD file</p>
                    <p className="text-sm">Image or PDF</p>
                  </div>
                )}
              </label>
            </div>

            {/* Notes field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={podNotes}
                onChange={(e) => setPodNotes(e.target.value)}
                placeholder="e.g., Signed by warehouse manager"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={finishPodUpload}
                disabled={uploadedPods.length === 0}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {uploadedPods.length > 0 ? 'Done' : 'Cancel'}
              </button>
              <button
                onClick={handlePodUpload}
                disabled={!podFile || uploadingPod}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {uploadingPod ? 'Uploading...' : uploadedPods.length > 0 ? 'Add Another' : 'Upload POD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal - Collect receiver info */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Mark as Delivered
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide delivery details. Receiver information is optional but recommended.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receiver Name
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Name of person who received the delivery"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receiver Phone
                </label>
                <input
                  type="tel"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Delivery Notes
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any notes about the delivery..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={submitDelivery}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? 'Marking...' : 'Mark Delivered'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Trip Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cancel Trip
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to cancel this trip? This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please explain why you are cancelling..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                onClick={handleCancelTrip}
                disabled={loading || !cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Cancelling...' : 'Cancel Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trip Progress (for IN_TRANSIT) */}
          {trip.status === 'IN_TRANSIT' && trip.tripProgressPercent !== null && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Trip Progress
              </h3>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${trip.tripProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-blue-700 dark:text-blue-300">
                <span>{trip.tripProgressPercent}% complete</span>
                {trip.remainingDistanceKm && (
                  <span>{trip.remainingDistanceKm.toFixed(1)} km remaining</span>
                )}
              </div>
            </div>
          )}

          {/* Load Details */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Load Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Weight</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {trip.weight.toLocaleString()} kg
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Truck Type</p>
                <p className="font-medium text-gray-900 dark:text-white">{trip.truckType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pickup Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(trip.pickupDate)}
                </p>
              </div>
              {trip.deliveryDate && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Delivery Date</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(trip.deliveryDate)}
                  </p>
                </div>
              )}
              {trip.rate && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Rate</p>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {trip.rate.toLocaleString()} ETB
                  </p>
                </div>
              )}
              {trip.estimatedTripKm && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Distance</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {trip.estimatedTripKm.toFixed(0)} km
                  </p>
                </div>
              )}
            </div>

            {trip.cargoDescription && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">Cargo Description</p>
                <p className="font-medium text-gray-900 dark:text-white">{trip.cargoDescription}</p>
              </div>
            )}

            {trip.safetyNotes && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Safety Notes
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{trip.safetyNotes}</p>
              </div>
            )}
          </div>

          {/* Pickup & Delivery */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Route Details
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400">A</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{trip.pickupCity}</p>
                  {trip.pickupAddress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{trip.pickupAddress}</p>
                  )}
                  {trip.pickupDockHours && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Dock Hours: {trip.pickupDockHours}
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-4 border-l-2 border-dashed border-gray-300 dark:border-slate-600 h-8" />
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                  <span className="text-red-600 dark:text-red-400">B</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{trip.deliveryCity}</p>
                  {trip.deliveryAddress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{trip.deliveryAddress}</p>
                  )}
                  {trip.deliveryDockHours && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Dock Hours: {trip.deliveryDockHours}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Documents (POD) */}
          {trip.documents.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Documents
              </h2>
              <div className="space-y-2">
                {trip.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{doc.fileName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {doc.documentType} • {formatDateTime(doc.createdAt)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1e9c99] hover:underline text-sm"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shipper Info */}
          {trip.shipper && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Shipper
              </h2>
              <p className="font-medium text-gray-900 dark:text-white">
                {trip.shipper.name}
                {trip.shipper.isVerified && (
                  <span className="ml-1 text-green-600">✓</span>
                )}
              </p>
              {trip.shipperContactName && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Contact: {trip.shipperContactName}
                </p>
              )}
              {trip.shipperContactPhone && (
                <a
                  href={`tel:${trip.shipperContactPhone}`}
                  className="text-sm text-[#1e9c99] hover:underline"
                >
                  {trip.shipperContactPhone}
                </a>
              )}
            </div>
          )}

          {/* Truck Info */}
          {trip.truck && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Your Truck
              </h2>
              <p className="font-medium text-gray-900 dark:text-white">
                {trip.truck.licensePlate}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {trip.truck.truckType} • {trip.truck.capacity.toLocaleString()} kg
              </p>
            </div>
          )}

          {/* Timeline */}
          {trip.events.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Activity
              </h2>
              <div className="space-y-4">
                {trip.events.slice(0, 10).map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative">
                      <div className="w-2 h-2 bg-[#1e9c99] rounded-full mt-2" />
                      {index < trip.events.length - 1 && (
                        <div className="absolute top-4 left-0.5 w-0.5 h-full bg-gray-200 dark:bg-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
