"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface GpsPosition {
  id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  truck: {
    licensePlate: string;
    carrier: {
      name: string;
    };
  };
}

function GpsContent() {
  const searchParams = useSearchParams();
  const truckId = searchParams.get("truck");

  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, [truckId]);

  const fetchPositions = async () => {
    try {
      const params = new URLSearchParams();
      if (truckId) params.set("truckId", truckId);
      params.set("limit", "50");

      const response = await fetch(`/api/gps/positions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error("Failed to fetch GPS positions:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">GPS Tracking</h1>
        <p className="mt-2 text-sm text-gray-600">
          Real-time location tracking for your fleet
        </p>
      </div>

      {/* Map Placeholder */}
      <div className="mb-8 rounded-lg bg-white shadow p-6">
        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p className="mt-2 text-sm font-medium text-gray-900">
              Interactive Map View
            </p>
            <p className="text-xs text-gray-500">
              Map integration (Mapbox/Leaflet) will be added in Phase 2
            </p>
            <p className="mt-4 text-xs text-gray-400">
              For now, view GPS position data in the table below
            </p>
          </div>
        </div>
      </div>

      {/* GPS Position Data */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent GPS Positions
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No GPS data available</p>
            <p className="mt-2 text-sm text-gray-400">
              {truckId
                ? "This truck has not reported any GPS positions yet"
                : "No trucks have GPS tracking enabled"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Speed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positions.map((position) => (
                  <tr key={position.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {position.truck.licensePlate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {position.truck.carrier.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {position.latitude.toFixed(6)},{" "}
                      {position.longitude.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {position.speed ? `${position.speed} km/h` : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(position.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {positions.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {positions.length} GPS position
          {positions.length !== 1 ? "s" : ""}
          {truckId && " for selected truck"}
        </div>
      )}
    </div>
  );
}

export default function GpsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
      <GpsContent />
    </Suspense>
  );
}
