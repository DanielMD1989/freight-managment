"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  currentLocation?: string;
  availabilityStatus: string;
  gpsDeviceId?: string;
  carrier: {
    name: string;
    verificationType?: string;
  };
}

export default function TruckSearchPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    truckType: "",
    availabilityStatus: "AVAILABLE",
  });

  const truckTypes = [
    "FLATBED",
    "REFRIGERATED",
    "TANKER",
    "CONTAINER",
    "DRY_VAN",
    "LOWBOY",
    "DUMP_TRUCK",
  ];

  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.truckType) params.set("truckType", filters.truckType);
      if (filters.availabilityStatus)
        params.set("availabilityStatus", filters.availabilityStatus);

      const response = await fetch(`/api/trucks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTrucks(data.trucks || []);
      }
    } catch (error) {
      console.error("Failed to fetch trucks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrucks();
  };

  const clearFilters = () => {
    setFilters({
      truckType: "",
      availabilityStatus: "AVAILABLE",
    });
    setTimeout(() => fetchTrucks(), 0);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Find Trucks</h1>
        <p className="mt-2 text-sm text-gray-600">
          Search for available trucks for your loads
        </p>
      </div>

      {/* Search Filters */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Truck Type
              </label>
              <select
                value={filters.truckType}
                onChange={(e) =>
                  setFilters({ ...filters, truckType: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {truckTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Availability
              </label>
              <select
                value={filters.availabilityStatus}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    availabilityStatus: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="AVAILABLE">Available</option>
                <option value="IN_USE">In Use</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Search
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : trucks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No trucks found matching your criteria</p>
          <p className="mt-2 text-sm text-gray-400">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-700">
              Found <span className="font-semibold">{trucks.length}</span>{" "}
              trucks
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {trucks.map((truck) => (
              <div
                key={truck.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {truck.licensePlate}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {truck.truckType.replace(/_/g, " ")}
                  </p>
                </div>

                <dl className="space-y-2 text-sm mb-4">
                  <div>
                    <dt className="text-gray-500">Carrier</dt>
                    <dd className="font-medium text-gray-900 flex items-center space-x-2">
                      <span>{truck.carrier.name}</span>
                      {truck.carrier.verificationType === "VERIFIED" && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          ✓ Verified
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Capacity</dt>
                    <dd className="font-medium text-gray-900">
                      {truck.capacity.toLocaleString()} kg
                    </dd>
                  </div>
                  {truck.currentLocation && (
                    <div>
                      <dt className="text-gray-500">Location</dt>
                      <dd className="font-medium text-gray-900">
                        {truck.currentLocation}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          truck.availabilityStatus === "AVAILABLE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {truck.availabilityStatus}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">GPS Tracking</dt>
                    <dd className="font-medium text-gray-900">
                      {truck.gpsDeviceId ? (
                        <span className="text-green-600">✓ Enabled</span>
                      ) : (
                        <span className="text-gray-400">Not available</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="pt-4 border-t border-gray-200">
                  <button
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    onClick={() =>
                      alert(
                        "Direct booking coming soon. For now, contact the carrier directly or use the dispatch system."
                      )
                    }
                  >
                    Contact Carrier
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
