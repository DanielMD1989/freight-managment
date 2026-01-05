'use client';

/**
 * Google Maps Component
 *
 * MAP + GPS Implementation - Phase 1
 *
 * Features:
 * - Google Maps integration (replacing Leaflet)
 * - Live truck tracking
 * - Fleet overview
 * - Route visualization
 * - Role-based data filtering
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

// Types for map data
export interface MapMarker {
  id: string;
  type: 'truck' | 'pickup' | 'delivery' | 'load';
  position: { lat: number; lng: number };
  title: string;
  status?: 'active' | 'available' | 'offline' | 'in_transit';
  info?: {
    label?: string;
    description?: string;
    speed?: number;
    heading?: number;
    timestamp?: Date;
    tripId?: string;
    loadId?: string;
    truckId?: string;
    plateNumber?: string;
  };
}

export interface MapRoute {
  id: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
  color?: string;
  tripId?: string;
}

export interface GoogleMapProps {
  markers?: MapMarker[];
  routes?: MapRoute[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  showTraffic?: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (position: { lat: number; lng: number }) => void;
  autoFitBounds?: boolean;
  selectedMarkerId?: string;
  refreshInterval?: number; // Auto-refresh in ms (0 to disable)
  onRefresh?: () => void;
}

// Marker icons by type
const markerIcons: Record<string, { url: string; scaledSize: { width: number; height: number } }> = {
  truck_active: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" fill="#10B981" opacity="0.2"></rect>
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="#10B981" opacity="0.2"></polygon>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5" fill="#10B981"></circle>
        <circle cx="18.5" cy="18.5" r="2.5" fill="#10B981"></circle>
      </svg>
    `),
    scaledSize: { width: 40, height: 40 },
  },
  truck_available: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" fill="#3B82F6" opacity="0.2"></rect>
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="#3B82F6" opacity="0.2"></polygon>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5" fill="#3B82F6"></circle>
        <circle cx="18.5" cy="18.5" r="2.5" fill="#3B82F6"></circle>
      </svg>
    `),
    scaledSize: { width: 40, height: 40 },
  },
  truck_offline: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" fill="#6B7280" opacity="0.2"></rect>
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="#6B7280" opacity="0.2"></polygon>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5" fill="#6B7280"></circle>
        <circle cx="18.5" cy="18.5" r="2.5" fill="#6B7280"></circle>
      </svg>
    `),
    scaledSize: { width: 40, height: 40 },
  },
  truck_in_transit: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" fill="#F59E0B" opacity="0.2"></rect>
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="#F59E0B" opacity="0.2"></polygon>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5" fill="#F59E0B"></circle>
        <circle cx="18.5" cy="18.5" r="2.5" fill="#F59E0B"></circle>
      </svg>
    `),
    scaledSize: { width: 40, height: 40 },
  },
  pickup: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10B981">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `),
    scaledSize: { width: 32, height: 32 },
  },
  delivery: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#EF4444">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `),
    scaledSize: { width: 32, height: 32 },
  },
  load: {
    url: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#8B5CF6">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `),
    scaledSize: { width: 32, height: 32 },
  },
};

// Default center: Addis Ababa, Ethiopia
const DEFAULT_CENTER = { lat: 9.005401, lng: 38.763611 };
const DEFAULT_ZOOM = 7;

export default function GoogleMap({
  markers = [],
  routes = [],
  center,
  zoom = DEFAULT_ZOOM,
  height = '500px',
  showTraffic = false,
  onMarkerClick,
  onMapClick,
  autoFitBounds = true,
  selectedMarkerId,
  refreshInterval = 0,
  onRefresh,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
          setError('Google Maps API key not configured');
          setIsLoading(false);
          return;
        }

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        });

        await loader.load();

        if (!mapRef.current) return;

        const mapCenter = center || DEFAULT_CENTER;

        googleMapRef.current = new google.maps.Map(mapRef.current, {
          center: mapCenter,
          zoom,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        // Create info window
        infoWindowRef.current = new google.maps.InfoWindow();

        // Add click listener
        if (onMapClick) {
          googleMapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load Google Maps:', err);
        setError('Failed to load map');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      // Cleanup
      markersRef.current.forEach((marker) => marker.setMap(null));
      polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    };
  }, []);

  // Update traffic layer
  useEffect(() => {
    if (!googleMapRef.current) return;

    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(googleMapRef.current);
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
    }
  }, [showTraffic]);

  // Get marker icon based on type and status
  const getMarkerIcon = useCallback((marker: MapMarker): google.maps.Icon => {
    let iconKey = marker.type;
    if (marker.type === 'truck' && marker.status) {
      iconKey = `truck_${marker.status}`;
    }

    const iconConfig = markerIcons[iconKey] || markerIcons.truck_available;

    return {
      url: iconConfig.url,
      scaledSize: new google.maps.Size(iconConfig.scaledSize.width, iconConfig.scaledSize.height),
      anchor: new google.maps.Point(iconConfig.scaledSize.width / 2, iconConfig.scaledSize.height / 2),
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!googleMapRef.current || isLoading) return;

    const map = googleMapRef.current;
    const currentMarkerIds = new Set(markers.map((m) => m.id));

    // Remove markers that no longer exist
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    markers.forEach((markerData) => {
      let marker = markersRef.current.get(markerData.id);

      if (marker) {
        // Update existing marker
        marker.setPosition(markerData.position);
        marker.setIcon(getMarkerIcon(markerData));
        marker.setTitle(markerData.title);
      } else {
        // Create new marker
        marker = new google.maps.Marker({
          position: markerData.position,
          map,
          title: markerData.title,
          icon: getMarkerIcon(markerData),
          animation: markerData.id === selectedMarkerId ? google.maps.Animation.BOUNCE : undefined,
        });

        // Add click listener
        marker.addListener('click', () => {
          if (infoWindowRef.current && marker) {
            const content = `
              <div style="padding: 8px; max-width: 250px;">
                <h3 style="margin: 0 0 8px; font-weight: 600; color: #1F2937;">${markerData.title}</h3>
                ${markerData.info?.description ? `<p style="margin: 0 0 4px; color: #6B7280; font-size: 14px;">${markerData.info.description}</p>` : ''}
                ${markerData.info?.plateNumber ? `<p style="margin: 0 0 4px; color: #374151; font-size: 14px;"><strong>Plate:</strong> ${markerData.info.plateNumber}</p>` : ''}
                ${markerData.info?.speed !== undefined ? `<p style="margin: 0 0 4px; color: #374151; font-size: 14px;"><strong>Speed:</strong> ${Math.round(markerData.info.speed)} km/h</p>` : ''}
                ${markerData.info?.timestamp ? `<p style="margin: 0; color: #9CA3AF; font-size: 12px;">Updated: ${new Date(markerData.info.timestamp).toLocaleTimeString()}</p>` : ''}
                ${markerData.status ? `<span style="display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${markerData.status === 'active' || markerData.status === 'in_transit' ? '#10B981' : markerData.status === 'available' ? '#3B82F6' : '#6B7280'}; color: white;">${markerData.status.replace('_', ' ').toUpperCase()}</span>` : ''}
              </div>
            `;
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
          }

          if (onMarkerClick) {
            onMarkerClick(markerData);
          }
        });

        markersRef.current.set(markerData.id, marker);
      }

      // Update animation for selected marker
      if (marker) {
        marker.setAnimation(
          markerData.id === selectedMarkerId ? google.maps.Animation.BOUNCE : null
        );
      }
    });

    // Auto-fit bounds
    if (autoFitBounds && markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend(m.position));

      // Add routes to bounds
      routes.forEach((route) => {
        bounds.extend(route.origin);
        bounds.extend(route.destination);
        route.waypoints?.forEach((wp) => bounds.extend(wp));
      });

      map.fitBounds(bounds);

      // Don't zoom in too far for single marker
      const listener = google.maps.event.addListener(map, 'idle', () => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }

    setLastUpdate(new Date());
  }, [markers, selectedMarkerId, isLoading, autoFitBounds, getMarkerIcon, onMarkerClick]);

  // Update routes/polylines
  useEffect(() => {
    if (!googleMapRef.current || isLoading) return;

    const map = googleMapRef.current;
    const currentRouteIds = new Set(routes.map((r) => r.id));

    // Remove routes that no longer exist
    polylinesRef.current.forEach((polyline, id) => {
      if (!currentRouteIds.has(id)) {
        polyline.setMap(null);
        polylinesRef.current.delete(id);
      }
    });

    // Add or update routes
    routes.forEach((route) => {
      let polyline = polylinesRef.current.get(route.id);

      const path = [
        route.origin,
        ...(route.waypoints || []),
        route.destination,
      ];

      if (polyline) {
        // Update existing polyline
        polyline.setPath(path);
      } else {
        // Create new polyline
        polyline = new google.maps.Polyline({
          path,
          map,
          strokeColor: route.color || '#3B82F6',
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });

        polylinesRef.current.set(route.id, polyline);
      }
    });
  }, [routes, isLoading]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0 || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, onRefresh]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <p className="text-gray-500 text-sm">
            Please check that NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Status overlay */}
      <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {markers.length} marker{markers.length !== 1 ? 's' : ''} |
            Updated {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 px-4 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600 dark:text-gray-300">Active / In Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600 dark:text-gray-300">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600 dark:text-gray-300">On Trip</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-gray-600 dark:text-gray-300">Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
