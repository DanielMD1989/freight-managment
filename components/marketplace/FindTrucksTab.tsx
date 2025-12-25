/**
 * Find Trucks Tab Component
 *
 * Truck marketplace for shippers to browse available trucks.
 *
 * Features:
 * - Truck posting listing grid
 * - Live filtering
 * - Search functionality
 *
 * Sprint 8 - Story 8.7: Single-Page Experience
 */

"use client";

import { useState, useEffect } from "react";

export default function FindTrucksTab() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    originCity: "",
    destinationCity: "",
    truckType: "",
    availableFrom: "",
  });

  // Fetch truck postings on mount
  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    setLoading(true);
    try {
      // TODO: Integrate with actual truck postings API
      // const response = await fetch('/api/truck-postings?status=ACTIVE');
      // const data = await response.json();
      setTrucks([]);
    } catch (error) {
      console.error("Error fetching trucks:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Filter Trucks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Origin city..."
            value={filters.originCity}
            onChange={(e) =>
              setFilters({ ...filters, originCity: e.target.value })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Destination city..."
            value={filters.destinationCity}
            onChange={(e) =>
              setFilters({ ...filters, destinationCity: e.target.value })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <select
            value={filters.truckType}
            onChange={(e) =>
              setFilters({ ...filters, truckType: e.target.value })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">All truck types</option>
            <option value="FLAT_BED">Flat Bed</option>
            <option value="BOX_TRUCK">Box Truck</option>
            <option value="REFRIGERATED">Refrigerated</option>
            <option value="TANKER">Tanker</option>
          </select>
          <input
            type="date"
            placeholder="Available from..."
            value={filters.availableFrom}
            onChange={(e) =>
              setFilters({ ...filters, availableFrom: e.target.value })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Trucks Grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Available Trucks
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Loading trucks...</p>
          </div>
        ) : trucks.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No trucks found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or check back later
            </p>
            <div className="mt-4">
              <a
                href="/dashboard/trucks/search"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Use dedicated truck search page →
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trucks.map((truck) => (
              <div
                key={truck.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="text-sm text-gray-900">{truck.licensePlate}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
