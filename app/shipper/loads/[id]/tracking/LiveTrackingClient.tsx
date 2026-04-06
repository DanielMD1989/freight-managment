"use client";

/**
 * Live Tracking Client Component
 *
 * Polls GET /api/gps/live?loadId= every 30s to show real-time truck position.
 * Blueprint §11: active trip GPS visibility for Shipper.
 *
 * Stops polling and shows a "trip ended" message when the API returns 403
 * (which happens when the trip transitions to DELIVERED/COMPLETED/CANCELLED
 * mid-view). Without this, polling would continue forever after status change.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

interface GpsPosition {
  lat: number;
  lng: number;
  updatedAt?: string;
  gpsStatus?: string;
}

interface LiveTrackingData {
  loadId: string;
  status: string;
  position: GpsPosition | null;
  truck?: { id: string; plateNumber: string; truckType: string };
}

interface LiveTrackingClientProps {
  loadId: string;
}

const POLL_INTERVAL_MS = 30_000;

export default function LiveTrackingClient({
  loadId,
}: LiveTrackingClientProps) {
  const [data, setData] = useState<LiveTrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripEnded, setTripEnded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchPosition() {
      try {
        const res = await fetch(`/api/gps/live?loadId=${loadId}`);
        if (cancelled) return;
        // 403 indicates trip is no longer in IN_TRANSIT — stop polling and
        // surface a clean "trip ended" state instead of a generic error.
        if (res.status === 403) {
          setTripEnded(true);
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            body.error ?? "Failed to fetch GPS position. Please try again."
          );
          return;
        }
        const json: LiveTrackingData = await res.json();
        setData(json);
        setLastUpdated(new Date());
        setError(null);
      } catch {
        if (!cancelled) setError("Network error. Retrying in 30 seconds.");
      }
    }

    fetchPosition();
    interval = setInterval(fetchPosition, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [loadId]);

  if (tripEnded) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-medium text-emerald-800">Trip ended</p>
        <p className="mt-1 text-sm text-emerald-700">
          Live tracking is no longer available — the trip is no longer in
          transit.
        </p>
        <Link
          href={`/shipper/loads/${loadId}`}
          className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          View load details
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <span>Loading GPS position…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* GPS position display */}
      {data.position ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700">
              GPS Active
            </span>
            {data.position.gpsStatus && (
              <span className="text-xs text-gray-500">
                ({data.position.gpsStatus})
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
            <div>
              <div className="text-sm text-gray-600">Latitude</div>
              <div className="font-mono font-medium">
                {data.position.lat.toFixed(6)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Longitude</div>
              <div className="font-mono font-medium">
                {data.position.lng.toFixed(6)}
              </div>
            </div>
          </div>

          {data.position.updatedAt && (
            <p className="text-xs text-gray-500">
              Position updated:{" "}
              {new Date(data.position.updatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-700">
            No GPS signal currently available. The truck may be offline.
          </p>
        </div>
      )}

      {lastUpdated && (
        <p className="text-xs text-gray-400">
          Last polled: {lastUpdated.toLocaleTimeString()} (updates every 30s)
        </p>
      )}

      <p className="text-xs text-gray-400">
        Live tracking is only available while the trip is in transit.
      </p>
    </div>
  );
}
