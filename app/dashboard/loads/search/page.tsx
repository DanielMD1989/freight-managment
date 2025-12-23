"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Load {
  id: string;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  rate: number;
  weight?: number;
  isAnonymous: boolean;
  shipper?: {
    name: string;
    verificationType?: string;
  };
  cargoDescription: string;
}

export default function LoadSearchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    truckType: "",
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
    fetchLoads();
  }, []);

  const fetchLoads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("status", "POSTED");
      if (filters.origin) params.set("origin", filters.origin);
      if (filters.destination) params.set("destination", filters.destination);
      if (filters.truckType) params.set("truckType", filters.truckType);

      const response = await fetch(`/api/loads?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLoads(data.loads || []);
      }
    } catch (error) {
      console.error("Failed to fetch loads:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLoads();
  };

  const clearFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      truckType: "",
    });
    setTimeout(() => fetchLoads(), 0);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Find Loads</h1>
        <p className="mt-2 text-sm text-gray-600">
          Search for available freight loads to transport
        </p>
      </div>

      {/* Search Filters */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Origin
              </label>
              <input
                type="text"
                value={filters.origin}
                onChange={(e) =>
                  setFilters({ ...filters, origin: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="City name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Destination
              </label>
              <input
                type="text"
                value={filters.destination}
                onChange={(e) =>
                  setFilters({ ...filters, destination: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="City name"
              />
            </div>
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
      ) : loads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No loads found matching your criteria</p>
          <p className="mt-2 text-sm text-gray-400">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Found <span className="font-semibold">{loads.length}</span> loads
            </p>
          </div>

          <div className="space-y-4">
            {loads.map((load) => (
              <div
                key={load.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {load.origin} → {load.destination}
                      </h3>
                      {!load.isAnonymous && load.shipper && (
                        <div className="mt-1 flex items-center space-x-2">
                          <p className="text-sm text-gray-600">
                            {load.shipper.name}
                          </p>
                          {load.shipper.verificationType === "VERIFIED" && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                      )}
                      {load.isAnonymous && (
                        <p className="mt-1 text-sm text-gray-500">
                          Anonymous Shipper
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Pickup Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(load.pickupDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Delivery Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(load.deliveryDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Truck Type</p>
                        <p className="text-sm font-medium text-gray-900">
                          {load.truckType.replace(/_/g, " ")}
                        </p>
                      </div>
                      {load.weight && (
                        <div>
                          <p className="text-xs text-gray-500">Weight</p>
                          <p className="text-sm font-medium text-gray-900">
                            {load.weight.toLocaleString()} kg
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Rate</p>
                        <p className="text-lg font-bold text-blue-600">
                          ETB {load.rate.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Cargo</p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {load.cargoDescription}
                      </p>
                    </div>
                  </div>

                  <div className="ml-6 flex flex-col space-y-2">
                    <Link
                      href={`/dashboard/loads/${load.id}`}
                      className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/dashboard/loads/${load.id}?action=accept`}
                      className="rounded-md border border-blue-600 px-4 py-2 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Accept Load
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
