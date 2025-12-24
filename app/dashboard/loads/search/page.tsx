"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAge } from "@/lib/loadUtils";

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  rate: number;
  status: string;
  weight?: number;
  isAnonymous: boolean;
  createdAt: string;
  postedAt?: string;
  ageMinutes?: number;
  tripKm?: number;
  dhToOriginKm?: number;
  dhAfterDeliveryKm?: number;
  fullPartial?: string;
  bookMode?: string;
  lengthM?: number;
  casesCount?: number;
  dtpReference?: string;
  factorRating?: string;
  rpmEtbPerKm?: number;
  trpmEtbPerKm?: number;
  pickupDockHours?: string;
  deliveryDockHours?: string;
  appointmentRequired?: boolean;
  shipper?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function LoadSearchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    pickupCity: "",
    deliveryCity: "",
    truckType: "",
    fullPartial: "",
    bookMode: "",
    tripKmMin: "",
    tripKmMax: "",
    rateMin: "",
    rateMax: "",
  });

  // Sorting
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchLoads();
  }, [pagination.page, sortBy, sortOrder]);

  const fetchLoads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      // Pagination
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      // Sorting
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      // Filters
      if (filters.pickupCity) params.set("pickupCity", filters.pickupCity);
      if (filters.deliveryCity) params.set("deliveryCity", filters.deliveryCity);
      if (filters.truckType) params.set("truckType", filters.truckType);
      if (filters.fullPartial) params.set("fullPartial", filters.fullPartial);
      if (filters.bookMode) params.set("bookMode", filters.bookMode);
      if (filters.tripKmMin) params.set("tripKmMin", filters.tripKmMin);
      if (filters.tripKmMax) params.set("tripKmMax", filters.tripKmMax);
      if (filters.rateMin) params.set("rateMin", filters.rateMin);
      if (filters.rateMax) params.set("rateMax", filters.rateMax);

      const response = await fetch(`/api/loads?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLoads(data.loads || []);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch loads:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New column, default to descending
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleFilter = () => {
    setPagination({ ...pagination, page: 1 });
    fetchLoads();
  };

  const clearFilters = () => {
    setFilters({
      pickupCity: "",
      deliveryCity: "",
      truckType: "",
      fullPartial: "",
      bookMode: "",
      tripKmMin: "",
      tripKmMax: "",
      rateMin: "",
      rateMax: "",
    });
    setPagination({ ...pagination, page: 1 });
    setTimeout(() => fetchLoads(), 0);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-gray-400">⇅</span>;
    }
    return (
      <span className="ml-1">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Find Loads</h1>
        <p className="mt-2 text-sm text-gray-600">
          Browse and filter available loads in the marketplace
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Origin City
            </label>
            <input
              type="text"
              value={filters.pickupCity}
              onChange={(e) =>
                setFilters({ ...filters, pickupCity: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Addis Ababa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination City
            </label>
            <input
              type="text"
              value={filters.deliveryCity}
              onChange={(e) =>
                setFilters({ ...filters, deliveryCity: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Dire Dawa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Truck Type
            </label>
            <select
              value={filters.truckType}
              onChange={(e) =>
                setFilters({ ...filters, truckType: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="FLATBED">Flatbed</option>
              <option value="REFRIGERATED">Refrigerated</option>
              <option value="TANKER">Tanker</option>
              <option value="CONTAINER">Container</option>
              <option value="DRY_VAN">Dry Van</option>
              <option value="LOWBOY">Lowboy</option>
              <option value="DUMP_TRUCK">Dump Truck</option>
              <option value="BOX_TRUCK">Box Truck</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Load Type
            </label>
            <select
              value={filters.fullPartial}
              onChange={(e) =>
                setFilters({ ...filters, fullPartial: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="FULL">Full Load</option>
              <option value="PARTIAL">Partial Load</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Book Mode
            </label>
            <select
              value={filters.bookMode}
              onChange={(e) =>
                setFilters({ ...filters, bookMode: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="REQUEST">Request</option>
              <option value="INSTANT">Instant Book</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trip Distance (km)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={filters.tripKmMin}
                onChange={(e) =>
                  setFilters({ ...filters, tripKmMin: e.target.value })
                }
                className="w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min"
              />
              <input
                type="number"
                value={filters.tripKmMax}
                onChange={(e) =>
                  setFilters({ ...filters, tripKmMax: e.target.value })
                }
                className="w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Max"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rate (ETB)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={filters.rateMin}
                onChange={(e) =>
                  setFilters({ ...filters, rateMin: e.target.value })
                }
                className="w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min"
              />
              <input
                type="number"
                value={filters.rateMax}
                onChange={(e) =>
                  setFilters({ ...filters, rateMax: e.target.value })
                }
                className="w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Max"
              />
            </div>
          </div>

          <div className="flex items-end">
            <div className="flex space-x-2 w-full">
              <button
                onClick={handleFilter}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {loads.length} of {pagination.total} loads
        </div>
      </div>

      {/* DAT-Style Grid */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Loading loads...</p>
        </div>
      ) : loads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-2">No loads found</p>
          <p className="text-sm text-gray-400">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort("age")}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Age <SortIcon column="age" />
                  </th>
                  <th
                    onClick={() => handleSort("pickupDate")}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Pickup <SortIcon column="pickupDate" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    F/P
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DH-O
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Origin
                  </th>
                  <th
                    onClick={() => handleSort("tripKm")}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Trip <SortIcon column="tripKm" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DH-D
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Length
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Weight
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cs
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DTP
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Factor
                  </th>
                  <th
                    onClick={() => handleSort("rate")}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Rate <SortIcon column="rate" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Book
                  </th>
                  <th
                    onClick={() => handleSort("rpm")}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    RPM <SortIcon column="rpm" />
                  </th>
                  <th
                    onClick={() => handleSort("trpm")}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    tRPM <SortIcon column="trpm" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loads.map((load) => (
                  <tr key={load.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.ageMinutes !== undefined
                        ? formatAge(load.ageMinutes)
                        : "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(load.pickupDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.truckType.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.fullPartial || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.dhToOriginKm || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {load.pickupCity}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.tripKm || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {load.deliveryCity}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.dhAfterDeliveryKm || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-1">
                        <span>{load.shipper?.name || "—"}</span>
                        {load.shipper?.isVerified && (
                          <span className="text-green-600" title="Verified">
                            ✓
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.lengthM ? `${load.lengthM}m` : "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.weight ? `${load.weight}kg` : "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.casesCount || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.dtpReference || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.factorRating || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {load.rate.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                          load.bookMode === "INSTANT"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {load.bookMode || "REQ"}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.rpmEtbPerKm || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {load.trpmEtbPerKm || "—"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/dashboard/loads/${load.id}`}
                        className="text-blue-600 hover:text-blue-500 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
                  disabled={pagination.page === pagination.pages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page{" "}
                    <span className="font-medium">{pagination.page}</span> of{" "}
                    <span className="font-medium">{pagination.pages}</span>{" "}
                    ({pagination.total} total loads)
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() =>
                        setPagination({
                          ...pagination,
                          page: pagination.page - 1,
                        })
                      }
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setPagination({
                          ...pagination,
                          page: pagination.page + 1,
                        })
                      }
                      disabled={pagination.page === pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
