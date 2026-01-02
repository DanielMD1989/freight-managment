'use client';

/**
 * GPS Map Component
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
 *
 * Displays live GPS tracking map with:
 * - Truck current position (updates every 10-30 seconds)
 * - Pickup location marker
 * - Delivery location marker
 * - Route line between locations
 * - Auto-centering on truck
 */

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom truck icon
const truckIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00BCD4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5" fill="#00BCD4"></circle>
      <circle cx="18.5" cy="18.5" r="2.5" fill="#00BCD4"></circle>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Pickup marker (green)
const pickupIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10B981">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Delivery marker (red)
const deliveryIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#EF4444">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export interface GpsMapProps {
  loadId: string;
  pickupLocation?: { lat: number; lng: number; name: string };
  deliveryLocation?: { lat: number; lng: number; name: string };
  autoUpdate?: boolean; // Auto-refresh position every 10-30 seconds
  updateInterval?: number; // Update interval in milliseconds (default: 15000 = 15 seconds)
}

interface Position {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
}

/**
 * Map centering component - centers map on truck position
 */
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return null;
}

export default function GpsMap({
  loadId,
  pickupLocation,
  deliveryLocation,
  autoUpdate = true,
  updateInterval = 15000, // 15 seconds default
}: GpsMapProps) {
  const [truckPosition, setTruckPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch current truck position
   */
  const fetchPosition = async () => {
    try {
      const response = await fetch(`/api/loads/${loadId}/live-position`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('No GPS position available');
        } else if (response.status === 400) {
          setError('GPS tracking not enabled');
        } else {
          setError('Failed to fetch position');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.position) {
        setTruckPosition(data.position);
        setLastUpdate(new Date());
        setError(null);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch GPS position:', err);
      setError('Failed to fetch GPS position');
      setLoading(false);
    }
  };

  /**
   * Initial fetch and auto-update setup
   */
  useEffect(() => {
    // Initial fetch
    fetchPosition();

    // Set up auto-update if enabled
    if (autoUpdate) {
      intervalRef.current = setInterval(fetchPosition, updateInterval);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadId, autoUpdate, updateInterval]);

  /**
   * Calculate center point for map
   */
  const getMapCenter = (): [number, number] => {
    if (truckPosition) {
      return [truckPosition.latitude, truckPosition.longitude];
    }

    if (pickupLocation) {
      return [pickupLocation.lat, pickupLocation.lng];
    }

    if (deliveryLocation) {
      return [deliveryLocation.lat, deliveryLocation.lng];
    }

    // Default: Addis Ababa, Ethiopia
    return [9.005401, 38.763611];
  };

  /**
   * Get route polyline points
   */
  const getRoutePoints = (): [number, number][] => {
    const points: [number, number][] = [];

    if (pickupLocation) {
      points.push([pickupLocation.lat, pickupLocation.lng]);
    }

    if (truckPosition) {
      points.push([truckPosition.latitude, truckPosition.longitude]);
    }

    if (deliveryLocation) {
      points.push([deliveryLocation.lat, deliveryLocation.lng]);
    }

    return points;
  };

  const center = getMapCenter();
  const routePoints = getRoutePoints();

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GPS tracking...</p>
        </div>
      </div>
    );
  }

  if (error && !truckPosition) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 mb-2">⚠️ {error}</p>
          <button
            onClick={fetchPosition}
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-center on truck */}
        <MapCenterController center={center} />

        {/* Pickup marker */}
        {pickupLocation && (
          <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-green-600">📍 Pickup Location</strong>
                <p>{pickupLocation.name}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Delivery marker */}
        {deliveryLocation && (
          <Marker position={[deliveryLocation.lat, deliveryLocation.lng]} icon={deliveryIcon}>
            <Popup>
              <div className="text-sm">
                <strong className="text-red-600">📍 Delivery Location</strong>
                <p>{deliveryLocation.name}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Truck marker */}
        {truckPosition && (
          <Marker
            position={[truckPosition.latitude, truckPosition.longitude]}
            icon={truckIcon}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-cyan-600">🚚 Truck Location</strong>
                {truckPosition.speed && (
                  <p>Speed: {Math.round(truckPosition.speed)} km/h</p>
                )}
                <p className="text-xs text-gray-500">
                  Last update: {new Date(truckPosition.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route polyline */}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            color="#00BCD4"
            weight={3}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
      </MapContainer>

      {/* Status overlay */}
      {lastUpdate && (
        <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">
              Updated {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
            </span>
          </div>
        </div>
      )}

      {/* Error notification */}
      {error && truckPosition && (
        <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg">
          <p className="text-sm">⚠️ {error}</p>
        </div>
      )}
    </div>
  );
}
