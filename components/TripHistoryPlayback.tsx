/**
 * Trip History Playback Component
 *
 * MAP + GPS Implementation - Phase 4
 *
 * Features:
 * - Replay historical trip routes on map
 * - Animated truck movement along route
 * - Playback controls (play, pause, speed)
 * - Timeline scrubber
 * - Timestamp display at each position
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface GpsPosition {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

interface TripData {
  id: string;
  loadId?: string;
  truckPlate: string;
  carrierName: string;
  shipperName?: string;
  pickupLocation: { lat: number; lng: number; address: string };
  deliveryLocation: { lat: number; lng: number; address: string };
  startedAt: string;
  completedAt: string;
  positions: GpsPosition[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
}

interface TripHistoryPlaybackProps {
  tripId: string;
  height?: string;
  onClose?: () => void;
}

type PlaybackSpeed = 1 | 2 | 5 | 10;

export default function TripHistoryPlayback({
  tripId,
  height = "500px",
  onClose,
}: TripHistoryPlaybackProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const truckMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const progressPolylineRef = useRef<google.maps.Polyline | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const deliveryMarkerRef = useRef<google.maps.Marker | null>(null);
  const animationRef = useRef<number | null>(null);

  const [tripData, setTripData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [currentPosition, setCurrentPosition] = useState<GpsPosition | null>(
    null
  );

  // Fetch trip history data
  useEffect(() => {
    const fetchTripHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/gps/history?loadId=${tripId}&includeRoute=true`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch trip history");
        }

        const data = await response.json();

        if (!data.positions || data.positions.length === 0) {
          setError("No GPS history available for this trip");
          return;
        }

        setTripData({
          id: tripId,
          loadId: data.loadId,
          truckPlate: data.truckPlate || "Unknown",
          carrierName: data.carrierName || "Unknown Carrier",
          shipperName: data.shipperName,
          pickupLocation: data.pickupLocation || {
            lat: data.positions[0].lat,
            lng: data.positions[0].lng,
            address: "Pickup",
          },
          deliveryLocation: data.deliveryLocation || {
            lat: data.positions[data.positions.length - 1].lat,
            lng: data.positions[data.positions.length - 1].lng,
            address: "Delivery",
          },
          startedAt: data.startedAt || data.positions[0].timestamp,
          completedAt:
            data.completedAt ||
            data.positions[data.positions.length - 1].timestamp,
          positions: data.positions,
          totalDistanceKm: data.totalDistanceKm || 0,
          totalDurationMinutes: data.totalDurationMinutes || 0,
        });

        setCurrentPosition(data.positions[0]);
      } catch (err) {
        console.error("Error fetching trip history:", err);
        setError("Failed to load trip history");
      } finally {
        setLoading(false);
      }
    };

    fetchTripHistory();
  }, [tripId]);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
          setError("Google Maps API key not configured");
          return;
        }

        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["geometry"],
        });

        await loader.load();

        if (!mapRef.current) return;

        googleMapRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 9.005401, lng: 38.763611 },
          zoom: 7,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        setMapReady(true);
      } catch (err) {
        console.error("Failed to load Google Maps:", err);
        setError("Failed to load map");
      }
    };

    initMap();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Setup map markers and route when data and map are ready
  useEffect(() => {
    if (!mapReady || !tripData || !googleMapRef.current) return;

    const map = googleMapRef.current;
    const positions = tripData.positions;

    // Create route polyline (full route in gray)
    const routePath = positions.map((p) => ({ lat: p.lat, lng: p.lng }));

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
    routePolylineRef.current = new google.maps.Polyline({
      path: routePath,
      map,
      strokeColor: "#9CA3AF",
      strokeOpacity: 0.6,
      strokeWeight: 4,
    });

    // Create progress polyline (traveled route in blue)
    if (progressPolylineRef.current) {
      progressPolylineRef.current.setMap(null);
    }
    progressPolylineRef.current = new google.maps.Polyline({
      path: [],
      map,
      strokeColor: "#2563EB",
      strokeOpacity: 1,
      strokeWeight: 5,
    });

    // Create pickup marker
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null);
    }
    pickupMarkerRef.current = new google.maps.Marker({
      position: tripData.pickupLocation,
      map,
      title: "Pickup: " + tripData.pickupLocation.address,
      icon: {
        url:
          "data:image/svg+xml;base64," +
          btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10B981">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
      },
    });

    // Create delivery marker
    if (deliveryMarkerRef.current) {
      deliveryMarkerRef.current.setMap(null);
    }
    deliveryMarkerRef.current = new google.maps.Marker({
      position: tripData.deliveryLocation,
      map,
      title: "Delivery: " + tripData.deliveryLocation.address,
      icon: {
        url:
          "data:image/svg+xml;base64," +
          btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#EF4444">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
      },
    });

    // Create truck marker
    if (truckMarkerRef.current) {
      truckMarkerRef.current.setMap(null);
    }
    truckMarkerRef.current = new google.maps.Marker({
      position: positions[0],
      map,
      title: tripData.truckPlate,
      icon: {
        url:
          "data:image/svg+xml;base64," +
          btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
            <rect x="1" y="3" width="15" height="13" fill="#2563EB" opacity="0.3"></rect>
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="#2563EB" opacity="0.3"></polygon>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5" fill="#2563EB"></circle>
            <circle cx="18.5" cy="18.5" r="2.5" fill="#2563EB"></circle>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20),
      },
    });

    // Fit bounds to show entire route
    const bounds = new google.maps.LatLngBounds();
    routePath.forEach((p) => bounds.extend(p));
    bounds.extend(tripData.pickupLocation);
    bounds.extend(tripData.deliveryLocation);
    map.fitBounds(bounds);
  }, [mapReady, tripData]);

  // Update map position during playback
  useEffect(() => {
    if (!tripData || !truckMarkerRef.current || !progressPolylineRef.current)
      return;

    const positions = tripData.positions;
    const currentPos = positions[currentIndex];

    if (currentPos) {
      // Update truck marker position
      truckMarkerRef.current.setPosition({
        lat: currentPos.lat,
        lng: currentPos.lng,
      });

      // Update progress polyline
      const progressPath = positions
        .slice(0, currentIndex + 1)
        .map((p) => ({ lat: p.lat, lng: p.lng }));
      progressPolylineRef.current.setPath(progressPath);

      setCurrentPosition(currentPos);
    }
  }, [currentIndex, tripData]);

  // Animation loop
  const animate = useCallback(() => {
    if (!tripData || !isPlaying) return;

    const positions = tripData.positions;

    setCurrentIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;

      if (nextIndex >= positions.length) {
        setIsPlaying(false);
        return positions.length - 1;
      }

      return nextIndex;
    });

    // Schedule next frame based on playback speed
    const baseDelay = 200; // Base delay in ms
    const delay = baseDelay / playbackSpeed;

    animationRef.current = window.setTimeout(() => {
      if (isPlaying) {
        animate();
      }
    }, delay) as unknown as number;
  }, [tripData, isPlaying, playbackSpeed]);

  // Start/stop animation
  useEffect(() => {
    if (isPlaying) {
      animate();
    } else if (animationRef.current) {
      clearTimeout(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isPlaying, animate]);

  // Playback controls
  const handlePlay = () => {
    if (tripData && currentIndex >= tripData.positions.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentIndex(parseInt(e.target.value, 10));
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-[#f0fdfa] dark:bg-slate-800"
        style={{ height }}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#1e9c99]"></div>
          <p className="text-[#064d51]/70 dark:text-gray-300">
            Loading trip history...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-[#f0fdfa] dark:bg-slate-800"
        style={{ height }}
      >
        <div className="text-center">
          <p className="mb-4 text-red-500">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg bg-[#064d51]/10 px-4 py-2 text-sm font-medium text-[#064d51]/80 hover:bg-[#064d51]/20"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!tripData) return null;

  const progress =
    tripData.positions.length > 1
      ? (currentIndex / (tripData.positions.length - 1)) * 100
      : 0;

  return (
    <div className="overflow-hidden rounded-lg border border-[#064d51]/15 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="border-b border-[#064d51]/15 p-4 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#064d51] dark:text-white">
              Trip Playback: {tripData.truckPlate}
            </h3>
            <p className="text-sm text-[#064d51]/60 dark:text-gray-400">
              {tripData.carrierName} •{" "}
              {formatDuration(tripData.totalDurationMinutes)} •{" "}
              {tripData.totalDistanceKm.toFixed(1)} km
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#064d51]/50 hover:text-[#064d51] dark:hover:text-gray-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: `calc(${height} - 180px)` }} />

      {/* Playback Controls */}
      <div className="space-y-4 p-4">
        {/* Timeline Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={tripData.positions.length - 1}
            value={currentIndex}
            onChange={handleSliderChange}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#064d51]/10 accent-[#1e9c99]"
          />
          <div className="flex justify-between text-xs text-[#064d51]/60 dark:text-gray-400">
            <span>{formatTime(tripData.startedAt)}</span>
            <span>{formatTime(tripData.completedAt)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Reset */}
            <button
              onClick={handleReset}
              className="rounded-lg p-2 text-[#064d51]/70 hover:bg-[#f0fdfa] dark:text-gray-300 dark:hover:bg-slate-700"
              title="Reset"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="rounded-full bg-[#1e9c99] p-3 text-white hover:bg-[#064d51]"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Speed selector */}
            <div className="ml-2 flex items-center gap-1">
              {([1, 2, 5, 10] as PlaybackSpeed[]).map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    playbackSpeed === speed
                      ? "bg-[#1e9c99] text-white"
                      : "bg-[#064d51]/10 text-[#064d51]/80 hover:bg-[#064d51]/20 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Current position info */}
          <div className="text-right">
            {currentPosition && (
              <>
                <div className="text-sm font-medium text-[#064d51] dark:text-white">
                  {formatTime(currentPosition.timestamp)}
                </div>
                <div className="text-xs text-[#064d51]/60 dark:text-gray-400">
                  {currentPosition.speed !== undefined &&
                    `${Math.round(currentPosition.speed)} km/h • `}
                  {Math.round(progress)}% complete
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
