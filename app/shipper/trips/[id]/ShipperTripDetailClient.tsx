/**
 * Shipper Trip Detail Client Component
 *
 * Displays trip details for shipper with:
 * - Trip progress and status
 * - Carrier/truck information
 * - Live map for IN_TRANSIT
 * - Route history for completed trips
 * - POD document viewer
 * - Event timeline
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';
import TripHistoryPlayback from '@/components/TripHistoryPlayback';
import { useGpsRealtime } from '@/hooks/useGpsRealtime';
import { csrfFetch } from '@/lib/csrfFetch';

interface TripPod {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  notes: string | null;
  uploadedAt: string;
}

interface Trip {
  id: string;
  loadId: string;
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
  specialInstructions: string | null;
  trackingEnabled: boolean;
  trackingUrl: string | null;
  tripProgressPercent: number | null;
  remainingDistanceKm: number | null;
  estimatedTripKm: number | null;
  assignedAt: string | null;
  completedAt: string | null;
  podUrl: string | null;
  podSubmitted: boolean;
  podVerified: boolean;
  // New fields for delivery confirmation
  shipperConfirmed: boolean;
  receiverName: string | null;
  receiverPhone: string | null;
  deliveryNotes: string | null;
  cancelReason: string | null;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
    phone: string | null;
  } | null;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
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
  // New: POD documents array
  podDocuments?: TripPod[];
}

interface Props {
  trip: Trip;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  ASSIGNED: { label: 'Assigned', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  PICKUP_PENDING: { label: 'Pickup Pending', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  DELIVERED: { label: 'Delivered - Confirm Receipt', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

const EVENT_ICONS: Record<string, string> = {
  CREATED: '📝',
  POSTED: '📢',
  ASSIGNED: '🤝',
  PICKUP_STARTED: '📍',
  PICKED_UP: '📦',
  IN_TRANSIT: '🚚',
  DELIVERED: '✅',
  COMPLETED: '🎉',
  POD_UPLOADED: '📄',
};

export default function ShipperTripDetailClient({ trip: initialTrip }: Props) {
  const router = useRouter();
  const [trip, setTrip] = useState(initialTrip);
  const [showHistoryPlayback, setShowHistoryPlayback] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tripProgress, setTripProgress] = useState({
    percent: trip.tripProgressPercent || 0,
    remainingKm: trip.remainingDistanceKm,
  });
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationNotes, setConfirmationNotes] = useState('');
  const [podDocuments, setPodDocuments] = useState<TripPod[]>(initialTrip.podDocuments || []);

  const statusConfig = STATUS_CONFIG[trip.status] || STATUS_CONFIG.ASSIGNED;
  const isActiveTrip = trip.status === 'IN_TRANSIT';
  const isCompletedTrip = trip.status === 'DELIVERED' || trip.status === 'COMPLETED';
  const isCancelledTrip = trip.status === 'CANCELLED';
  const hasPod = podDocuments.length > 0 || trip.podSubmitted;
  const needsConfirmation = trip.status === 'DELIVERED' && hasPod && !trip.shipperConfirmed;

  // Fetch POD documents on mount
  useEffect(() => {
    if (trip.status === 'DELIVERED' || trip.status === 'COMPLETED') {
      fetchPodDocuments();
    }
  }, [trip.id, trip.status]);

  const fetchPodDocuments = async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/pod`);
      if (response.ok) {
        const data = await response.json();
        setPodDocuments(data.pods || []);
      }
    } catch (error) {
      console.error('Failed to fetch POD documents:', error);
    }
  };

  const handleConfirmDelivery = async () => {
    setConfirmingDelivery(true);
    setError(null);

    try {
      const response = await csrfFetch(`/api/trips/${trip.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: confirmationNotes || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm delivery');
      }

      // Update local state
      setTrip((prev) => ({ ...prev, shipperConfirmed: true, status: 'COMPLETED' }));
      setShowConfirmModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirmingDelivery(false);
    }
  };

  // Real-time GPS tracking for active trips
  const { isConnected, positions } = useGpsRealtime({
    autoConnect: isActiveTrip,
    onPositionUpdate: (position) => {
      if (trip.truck && position.truckId === trip.truck.id) {
        setCurrentLocation({ lat: position.lat, lng: position.lng });
      }
    },
  });

  // Fetch initial location and progress for active trips
  useEffect(() => {
    if (isActiveTrip) {
      fetchTripProgress();
      const interval = setInterval(fetchTripProgress, 30000);
      return () => clearInterval(interval);
    }
  }, [isActiveTrip, trip.id]);

  const fetchTripProgress = async () => {
    try {
      const response = await fetch(`/api/loads/${trip.id}/progress`);
      if (response.ok) {
        const data = await response.json();
        setTripProgress({
          percent: data.progress?.percent || 0,
          remainingKm: data.progress?.remainingKm || null,
        });
        if (data.progress?.currentLocation) {
          setCurrentLocation(data.progress.currentLocation);
        }
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Build map markers
  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Pickup marker
    markers.push({
      id: 'pickup',
      position: { lat: 9.03, lng: 38.74 }, // Default Addis Ababa - would use actual coords
      title: `Pickup: ${trip.pickupCity}`,
      type: 'pickup',
    });

    // Delivery marker
    markers.push({
      id: 'delivery',
      position: { lat: 9.31, lng: 42.12 }, // Default Harar - would use actual coords
      title: `Delivery: ${trip.deliveryCity}`,
      type: 'delivery',
    });

    // Current truck location (if tracking)
    if (isActiveTrip && currentLocation) {
      markers.push({
        id: 'truck',
        position: currentLocation,
        title: `${trip.truck?.licensePlate || 'Truck'} - In Transit`,
        type: 'truck',
        status: 'in_transit',
      });
    }

    return markers;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/shipper/trips"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Trips
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{trip.referenceNumber}</h1>
          <p className="text-slate-500 mt-1">
            {trip.pickupCity} → {trip.deliveryCity}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          {isActiveTrip && (
            <Link
              href={`/shipper/map?loadId=${trip.id}`}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Track Live
            </Link>
          )}
          {isCompletedTrip && (
            <button
              onClick={() => setShowHistoryPlayback(true)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Route
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Cancelled Trip Alert */}
      {isCancelledTrip && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">Trip Cancelled</h3>
              {trip.cancelReason && (
                <p className="text-red-700 mt-1">Reason: {trip.cancelReason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Alert */}
      {needsConfirmation && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-purple-800">Confirm Delivery Receipt</h3>
              <p className="text-purple-700 mt-1">
                The carrier has delivered your shipment and uploaded Proof of Delivery. Please review and confirm to complete this trip.
              </p>

              {/* Receiver Info */}
              {(trip.receiverName || trip.receiverPhone) && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-800">Delivery Received By:</p>
                  {trip.receiverName && <p className="text-sm text-purple-700">{trip.receiverName}</p>}
                  {trip.receiverPhone && <p className="text-sm text-purple-700">{trip.receiverPhone}</p>}
                  {trip.deliveryNotes && (
                    <p className="text-sm text-purple-600 mt-1">Notes: {trip.deliveryNotes}</p>
                  )}
                </div>
              )}

              {/* POD Documents List */}
              {podDocuments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-purple-800">POD Documents ({podDocuments.length}):</p>
                  {podDocuments.map((pod) => (
                    <a
                      key={pod.id}
                      href={pod.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-purple-700">{pod.fileName}</span>
                      {pod.notes && <span className="text-xs text-purple-500">({pod.notes})</span>}
                    </a>
                  ))}
                </div>
              )}

              {/* Legacy POD link */}
              {podDocuments.length === 0 && trip.podUrl && (
                <a
                  href={trip.podUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View POD Document
                </a>
              )}

              <div className="mt-4">
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm Delivery
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar (for active trips) */}
      {isActiveTrip && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Trip Progress</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-sm text-slate-500">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${tripProgress.percent}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{trip.pickupCity}</span>
            <span className="font-medium text-teal-600">{tripProgress.percent}% Complete</span>
            <span className="text-slate-500">{trip.deliveryCity}</span>
          </div>
          {tripProgress.remainingKm && (
            <p className="text-center text-sm text-slate-500 mt-2">
              {tripProgress.remainingKm.toFixed(1)} km remaining
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map (for active trips) */}
          {isActiveTrip && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Live Tracking</h3>
                <Link
                  href={`/shipper/map?loadId=${trip.id}`}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Full Screen →
                </Link>
              </div>
              <GoogleMap
                markers={buildMarkers()}
                height="300px"
                autoFitBounds={true}
              />
            </div>
          )}

          {/* Route Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Route Details</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Pickup */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span className="font-medium text-slate-700">Pickup</span>
                </div>
                <p className="text-slate-800 font-semibold">{trip.pickupCity}</p>
                {trip.pickupAddress && (
                  <p className="text-sm text-slate-500">{trip.pickupAddress}</p>
                )}
                <p className="text-sm text-slate-500 mt-1">
                  {formatDate(trip.pickupDate)}
                </p>
                {trip.pickupDockHours && (
                  <p className="text-xs text-slate-400">Hours: {trip.pickupDockHours}</p>
                )}
              </div>

              {/* Delivery */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-rose-500 rounded-full" />
                  <span className="font-medium text-slate-700">Delivery</span>
                </div>
                <p className="text-slate-800 font-semibold">{trip.deliveryCity}</p>
                {trip.deliveryAddress && (
                  <p className="text-sm text-slate-500">{trip.deliveryAddress}</p>
                )}
                {trip.deliveryDate && (
                  <p className="text-sm text-slate-500 mt-1">
                    {formatDate(trip.deliveryDate)}
                  </p>
                )}
                {trip.deliveryDockHours && (
                  <p className="text-xs text-slate-400">Hours: {trip.deliveryDockHours}</p>
                )}
              </div>
            </div>
          </div>

          {/* Load Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Load Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Weight</p>
                <p className="font-semibold text-slate-800">{trip.weight.toLocaleString()} kg</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Truck Type</p>
                <p className="font-semibold text-slate-800">{trip.truckType.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Rate</p>
                <p className="font-semibold text-teal-600">{formatCurrency(trip.rate)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Distance</p>
                <p className="font-semibold text-slate-800">
                  {trip.estimatedTripKm ? `${trip.estimatedTripKm} km` : '-'}
                </p>
              </div>
            </div>
            {trip.cargoDescription && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500 mb-1">Cargo Description</p>
                <p className="text-slate-700">{trip.cargoDescription}</p>
              </div>
            )}
            {trip.specialInstructions && (
              <div className="mt-3">
                <p className="text-sm text-slate-500 mb-1">Special Instructions</p>
                <p className="text-slate-700">{trip.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Documents (POD) */}
          {trip.documents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Documents</h3>
              <div className="space-y-3">
                {trip.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{doc.documentType}</p>
                        <p className="text-sm text-slate-500">{doc.fileName}</p>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Carrier Info */}
          {trip.carrier && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Carrier</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🚛</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    {trip.carrier.name}
                    {trip.carrier.isVerified && (
                      <span className="ml-1 text-emerald-500">✓</span>
                    )}
                  </p>
                  {trip.carrier.phone && (
                    <a
                      href={`tel:${trip.carrier.phone}`}
                      className="text-sm text-teal-600 hover:underline"
                    >
                      {trip.carrier.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Truck Info */}
          {trip.truck && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Truck</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">License Plate</p>
                  <p className="font-semibold text-slate-800">{trip.truck.licensePlate}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <p className="font-semibold text-slate-800">{trip.truck.truckType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Capacity</p>
                  <p className="font-semibold text-slate-800">{trip.truck.capacity.toLocaleString()} kg</p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Timeline</h3>
            {trip.events.length > 0 ? (
              <div className="space-y-4">
                {trip.events.slice(0, 10).map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-lg">{EVENT_ICONS[event.eventType] || '📌'}</span>
                      {index < trip.events.length - 1 && (
                        <div className="w-0.5 h-full bg-slate-200 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">
                        {event.eventType.replace(/_/g, ' ')}
                      </p>
                      {event.description && (
                        <p className="text-sm text-slate-500">{event.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(event.createdAt)} at {formatTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No events recorded yet.</p>
            )}
          </div>

          {/* Key Dates */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Key Dates</h3>
            <div className="space-y-3">
              {trip.assignedAt && (
                <div>
                  <p className="text-sm text-slate-500">Assigned</p>
                  <p className="font-medium text-slate-800">{formatDate(trip.assignedAt)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500">Pickup Date</p>
                <p className="font-medium text-slate-800">{formatDate(trip.pickupDate)}</p>
              </div>
              {trip.deliveryDate && (
                <div>
                  <p className="text-sm text-slate-500">Delivery Date</p>
                  <p className="font-medium text-slate-800">{formatDate(trip.deliveryDate)}</p>
                </div>
              )}
              {trip.completedAt && (
                <div>
                  <p className="text-sm text-slate-500">Completed</p>
                  <p className="font-medium text-emerald-600">{formatDate(trip.completedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Playback Modal */}
      {showHistoryPlayback && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-emerald-50/30">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Route History</h2>
                <p className="text-sm text-slate-500">
                  {trip.pickupCity} → {trip.deliveryCity}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryPlayback(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <TripHistoryPlayback
                tripId={trip.id}
                onClose={() => setShowHistoryPlayback(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Confirm Delivery</h2>
              <p className="text-sm text-slate-500">
                Confirming will complete the trip and release payment to the carrier.
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmation Notes (optional)
                </label>
                <textarea
                  value={confirmationNotes}
                  onChange={(e) => setConfirmationNotes(e.target.value)}
                  placeholder="Any notes about the delivery..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelivery}
                  disabled={confirmingDelivery}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {confirmingDelivery ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm & Complete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
