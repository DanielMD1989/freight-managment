"use client";

/**
 * Public GPS Tracking Page
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
 *
 * Public page accessible via unique tracking URL
 * Shows live map, load details, ETA, and status
 */

import React, { useEffect, useState } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import { checkGpsFreshness } from "@/lib/gpsUtils";

// Dynamically import GpsMap to avoid SSR issues with Leaflet
const GpsMap = dynamic(() => import("@/components/GpsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
    </div>
  ),
});

interface LoadData {
  id: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  originLat?: number;
  originLon?: number;
  destinationLat?: number;
  destinationLon?: number;
  shipper?: {
    name: string;
  };
  assignedTruck?: {
    licensePlate: string;
    gpsStatus?: string;
    gpsLastSeenAt?: string;
  };
}

interface TrackingData {
  enabled: boolean;
  startedAt: string | null;
  signalStatus: "active" | "weak" | "lost";
  lastUpdate: string | null;
}

export default function TrackingPage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const resolvedParams = use(params);

  const [load, setLoad] = useState<LoadData | null>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch load data by tracking URL
   */
  useEffect(() => {
    const fetchTrackingData = async () => {
      try {
        // First, get load ID from tracking URL
        const response = await fetch(
          `/api/tracking/${resolvedParams.trackingId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Tracking link not found or expired");
          } else if (response.status === 403) {
            setError("Access denied");
          } else {
            setError("Failed to load tracking data");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setLoad(data.load);
        setTracking(data.tracking);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch tracking data:", err);
        setError("Failed to load tracking data");
        setLoading(false);
      }
    };

    fetchTrackingData();
  }, [resolvedParams.trackingId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-b-4 border-cyan-500"></div>
          <p className="text-lg text-gray-600">
            Loading tracking information...
          </p>
        </div>
      </div>
    );
  }

  if (error || !load || !tracking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-6xl">⚠️</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">
            Tracking Not Available
          </h1>
          <p className="mb-4 text-gray-600">{error}</p>
          <p className="text-sm text-gray-500">
            This tracking link may have expired or been disabled.
          </p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> =
      {
        ASSIGNED: {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Assigned",
        },
        IN_TRANSIT: {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "In Transit",
        },
        DELIVERED: {
          bg: "bg-gray-100",
          text: "text-gray-800",
          label: "Delivered",
        },
      };

    const badge = badges[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };

    return (
      <span
        className={`rounded-full px-3 py-1 text-sm font-semibold ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  };

  const getSignalBadge = (signal: string) => {
    const badges: Record<
      string,
      { bg: string; text: string; icon: string; label: string }
    > = {
      active: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: "🟢",
        label: "Signal Active",
      },
      weak: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        icon: "🟡",
        label: "Weak Signal",
      },
      lost: {
        bg: "bg-red-100",
        text: "text-red-800",
        icon: "🔴",
        label: "Signal Lost",
      },
    };

    const badge = badges[signal] || badges.lost;

    return (
      <span
        className={`rounded-full px-3 py-1 text-sm font-semibold ${badge.bg} ${badge.text}`}
      >
        {badge.icon} {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                GPS Live Tracking
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {load.pickupCity} → {load.deliveryCity}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(load.status)}
              {getSignalBadge(tracking.signalStatus)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Map - 2/3 width */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg bg-white shadow-lg">
              <div className="h-[600px]">
                <GpsMap
                  loadId={load.id}
                  pickupLocation={
                    load.originLat && load.originLon
                      ? {
                          lat: load.originLat,
                          lng: load.originLon,
                          name: load.pickupCity,
                        }
                      : undefined
                  }
                  deliveryLocation={
                    load.destinationLat && load.destinationLon
                      ? {
                          lat: load.destinationLat,
                          lng: load.destinationLon,
                          name: load.deliveryCity,
                        }
                      : undefined
                  }
                  autoUpdate={true}
                  updateInterval={15000}
                />
              </div>
            </div>
          </div>

          {/* Details Sidebar - 1/3 width */}
          <div className="space-y-6">
            {/* Load Details */}
            <div className="rounded-lg bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                Load Details
              </h2>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Truck Type</p>
                  <p className="font-semibold">
                    {load.truckType.replace("_", " ")}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">License Plate</p>
                  <p className="font-semibold">
                    {load.assignedTruck?.licensePlate || "N/A"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="font-semibold">
                    {load.weight.toLocaleString()} kg
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Pickup Date</p>
                  <p className="font-semibold">
                    {new Date(load.pickupDate).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Delivery Date</p>
                  <p className="font-semibold">
                    {new Date(load.deliveryDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* GPS Status */}
            <div className="rounded-lg bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                GPS Status
              </h2>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Tracking Status</p>
                  <p className="font-semibold">
                    {tracking.enabled ? "✓ Active" : "✗ Inactive"}
                  </p>
                </div>

                {tracking.lastUpdate && (
                  <div>
                    <p className="text-xs text-gray-500">Last Update</p>
                    <p className="font-semibold">
                      {checkGpsFreshness(new Date(tracking.lastUpdate))}
                    </p>
                  </div>
                )}

                {tracking.startedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Tracking Started</p>
                    <p className="font-semibold">
                      {new Date(tracking.startedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Info Notice */}
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm text-cyan-800">
                <strong>ℹ️ Live Tracking</strong>
                <br />
                This page updates automatically every 15 seconds. GPS positions
                are accurate to within 10-50 meters.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Powered by GPS Live Tracking • Updates every 15 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
