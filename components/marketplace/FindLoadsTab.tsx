/**
 * Find Loads Tab Component
 *
 * Load marketplace for carriers to browse available loads.
 *
 * Features:
 * - Load listing grid
 * - Live filtering
 * - Search functionality
 *
 * Sprint 8 - Story 8.7: Single-Page Experience
 */

"use client";

import { useState, useEffect } from "react";

export default function FindLoadsTab() {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    originCity: "",
    destinationCity: "",
    minWeight: "",
    maxWeight: "",
  });

  // Fetch loads on mount
  useEffect(() => {
    fetchLoads();
  }, []);

  const fetchLoads = async () => {
    setLoading(true);
    try {
      // TODO: Integrate with actual loads API
      // const response = await fetch('/api/loads?status=POSTED');
      // const data = await response.json();
      setLoads([]);
    } catch (error) {
      console.error("Error fetching loads:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Filter Loads
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
          <input
            type="number"
            placeholder="Min weight (kg)..."
            value={filters.minWeight}
            onChange={(e) =>
              setFilters({ ...filters, minWeight: e.target.value })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max weight (kg)..."
            value={filters.maxWeight}
            onChange={(e) =>
              setFilters({ ...filters, maxWeight: e.target.value })
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Loads Grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Available Loads
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Loading loads...</p>
          </div>
        ) : loads.length === 0 ? (
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No loads found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or check back later
            </p>
            <div className="mt-4">
              <a
                href="/dashboard/loads/search"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Use dedicated load search page →
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loads.map((load) => (
              <div
                key={load.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="text-sm text-gray-900">{load.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
