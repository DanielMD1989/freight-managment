"use client";

/**
 * Route History Client Component
 *
 * G-M27-3: Added GoogleMap with route polyline above stats table.
 * Fetches GET /api/gps/history?loadId= and displays map + route stats + coordinate table.
 * Blueprint v1.2: Shipper route replay after trip COMPLETED.
 */

import { useEffect, useState } from "react";
import GoogleMap, { type MapRoute } from "@/components/GoogleMap";

interface GpsPoint {
  id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

interface RouteStats {
  totalDistanceKm: number;
  totalTimeHours: number;
  avgSpeedKmh: number;
  startTime: string | null;
  endTime: string | null;
}

interface HistoryData {
  positions: GpsPoint[];
  count: number;
  stats: RouteStats;
}

interface RouteHistoryClientProps {
  loadId: string;
}

export default function RouteHistoryClient({
  loadId,
}: RouteHistoryClientProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/gps/history?loadId=${loadId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error ?? "Failed to load route history. Please try again."
          );
        }
        return res.json() as Promise<HistoryData>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [loadId]);

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
        <span>Loading route history…</span>
      </div>
    );
  }

  if (data.count === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-gray-600">
          No GPS positions were recorded for this trip.
        </p>
      </div>
    );
  }

  // Build route for GoogleMap — first point is origin, last is destination,
  // middle points are waypoints for polyline rendering
  const routeForMap: MapRoute[] = [];
  if (data.positions.length >= 2) {
    const first = data.positions[0];
    const last = data.positions[data.positions.length - 1];
    const waypoints = data.positions.slice(1, -1).map((p) => ({
      lat: p.lat,
      lng: p.lng,
    }));
    routeForMap.push({
      id: `route-history-${loadId}`,
      origin: { lat: first.lat, lng: first.lng },
      destination: { lat: last.lat, lng: last.lng },
      waypoints,
      color: "#0ea5e9",
    });
  }

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "N/A";
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Route Map */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Route Map</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <GoogleMap
            routes={routeForMap}
            height="400px"
            autoFitBounds={true}
            refreshInterval={0}
          />
        </div>
      </div>

      {/* Route Statistics */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Trip Statistics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {data.stats.totalDistanceKm.toFixed(1)}
            </div>
            <div className="text-sm text-blue-600">km traveled</div>
          </div>
          <div className="rounded-lg bg-indigo-50 p-4 text-center">
            <div className="text-2xl font-bold text-indigo-700">
              {data.stats.totalTimeHours.toFixed(1)}
            </div>
            <div className="text-sm text-indigo-600">hours</div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">
              {data.stats.avgSpeedKmh.toFixed(0)}
            </div>
            <div className="text-sm text-emerald-600">avg km/h</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">
              {data.count}
            </div>
            <div className="text-sm text-amber-600">GPS points</div>
          </div>
        </div>
        <div className="mt-3 flex gap-6 text-sm text-gray-500">
          <span>Start: {formatDateTime(data.stats.startTime)}</span>
          <span>End: {formatDateTime(data.stats.endTime)}</span>
        </div>
      </div>

      {/* Coordinate List (route replay) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Route Points
        </h2>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  #
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Time
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Lat
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Lng
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  Speed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.positions.map((pos, i) => (
                <tr key={pos.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {new Date(pos.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {pos.lat.toFixed(5)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {pos.lng.toFixed(5)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {pos.speed != null ? `${pos.speed.toFixed(0)} km/h` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
