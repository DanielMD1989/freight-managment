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

// Icons
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const VerifiedIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export default function LoadSearchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
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

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(v => v !== "").length;

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
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
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
    const isActive = sortBy === column;
    return (
      <span className={`inline-flex flex-col ml-1 ${isActive ? 'text-[var(--primary-600)]' : 'text-[var(--neutral-400)]'}`}>
        <ChevronUpIcon />
        <ChevronDownIcon />
      </span>
    );
  };

  const formatTruckType = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--neutral-900)]">Find Loads</h1>
          <p className="mt-1 text-sm text-[var(--neutral-500)]">
            Browse and filter available loads in the marketplace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-white text-[var(--neutral-700)] hover:bg-[var(--neutral-50)] transition-colors"
          >
            <FilterIcon />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-[var(--primary-100)] text-[var(--primary-700)]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--neutral-50)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--neutral-700)] uppercase tracking-wide">
                Search Filters
              </h2>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-[var(--primary-600)] hover:text-[var(--primary-700)] font-medium"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Origin City */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Origin City
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.pickupCity}
                    onChange={(e) => setFilters({ ...filters, pickupCity: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] placeholder-[var(--neutral-400)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors"
                    placeholder="e.g. Addis Ababa"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-400)]">
                    <SearchIcon />
                  </span>
                </div>
              </div>

              {/* Destination City */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Destination City
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.deliveryCity}
                    onChange={(e) => setFilters({ ...filters, deliveryCity: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] placeholder-[var(--neutral-400)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors"
                    placeholder="e.g. Dire Dawa"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-400)]">
                    <SearchIcon />
                  </span>
                </div>
              </div>

              {/* Truck Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Truck Type
                </label>
                <select
                  value={filters.truckType}
                  onChange={(e) => setFilters({ ...filters, truckType: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors appearance-none cursor-pointer"
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

              {/* Load Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Load Type
                </label>
                <select
                  value={filters.fullPartial}
                  onChange={(e) => setFilters({ ...filters, fullPartial: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors appearance-none cursor-pointer"
                >
                  <option value="">All</option>
                  <option value="FULL">Full Load</option>
                  <option value="PARTIAL">Partial Load</option>
                </select>
              </div>

              {/* Book Mode */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Book Mode
                </label>
                <select
                  value={filters.bookMode}
                  onChange={(e) => setFilters({ ...filters, bookMode: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors appearance-none cursor-pointer"
                >
                  <option value="">All</option>
                  <option value="REQUEST">Request</option>
                  <option value="INSTANT">Instant Book</option>
                </select>
              </div>

              {/* Trip Distance */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Trip Distance (km)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.tripKmMin}
                    onChange={(e) => setFilters({ ...filters, tripKmMin: e.target.value })}
                    className="w-1/2 px-3 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] placeholder-[var(--neutral-400)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={filters.tripKmMax}
                    onChange={(e) => setFilters({ ...filters, tripKmMax: e.target.value })}
                    className="w-1/2 px-3 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] placeholder-[var(--neutral-400)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Rate Range */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Rate (ETB)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.rateMin}
                    onChange={(e) => setFilters({ ...filters, rateMin: e.target.value })}
                    className="w-1/2 px-3 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] placeholder-[var(--neutral-400)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={filters.rateMax}
                    onChange={(e) => setFilters({ ...filters, rateMax: e.target.value })}
                    className="w-1/2 px-3 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] placeholder-[var(--neutral-400)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <button
                  onClick={handleFilter}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[var(--primary-700)] to-[var(--primary-600)] text-white shadow-sm hover:from-[var(--primary-800)] hover:to-[var(--primary-700)] transition-all"
                >
                  <SearchIcon />
                  Search Loads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--neutral-600)]">
          Showing <span className="font-semibold text-[var(--neutral-900)]">{loads.length}</span> of{" "}
          <span className="font-semibold text-[var(--neutral-900)]">{pagination.total}</span> loads
        </p>
        <div className="flex items-center gap-2 text-sm text-[var(--neutral-500)]">
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-700)] focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-100)]"
          >
            <option value="createdAt">Date Posted</option>
            <option value="pickupDate">Pickup Date</option>
            <option value="rate">Rate</option>
            <option value="tripKm">Distance</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[var(--border)]">
          <div className="loading-spinner loading-spinner-lg mb-4"></div>
          <p className="text-[var(--neutral-500)] font-medium">Loading loads...</p>
        </div>
      ) : loads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[var(--border)]">
          <div className="text-[var(--neutral-300)] mb-4">
            <TruckIcon />
          </div>
          <h3 className="text-lg font-semibold text-[var(--neutral-700)] mb-2">No loads found</h3>
          <p className="text-sm text-[var(--neutral-500)] mb-6">Try adjusting your filters or search criteria</p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary-50)] text-[var(--primary-700)] hover:bg-[var(--primary-100)] transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--neutral-50)] border-b border-[var(--border)]">
                  <th
                    onClick={() => handleSort("age")}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider cursor-pointer hover:bg-[var(--neutral-100)] transition-colors"
                  >
                    <span className="flex items-center">
                      Age <SortIcon column="age" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("pickupDate")}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider cursor-pointer hover:bg-[var(--neutral-100)] transition-colors"
                  >
                    <span className="flex items-center">
                      Pickup <SortIcon column="pickupDate" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    F/P
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Origin
                  </th>
                  <th
                    onClick={() => handleSort("tripKm")}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider cursor-pointer hover:bg-[var(--neutral-100)] transition-colors"
                  >
                    <span className="flex items-center">
                      Trip <SortIcon column="tripKm" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Weight
                  </th>
                  <th
                    onClick={() => handleSort("rate")}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider cursor-pointer hover:bg-[var(--neutral-100)] transition-colors"
                  >
                    <span className="flex items-center">
                      Rate <SortIcon column="rate" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Book
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--neutral-600)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loads.map((load, index) => (
                  <tr
                    key={load.id}
                    className={`hover:bg-[var(--primary-50)] transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-[var(--neutral-50)]'
                    }`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--neutral-600)]">
                      {load.ageMinutes !== undefined ? formatAge(load.ageMinutes) : "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--neutral-900)]">
                      {new Date(load.pickupDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--neutral-100)] text-[var(--neutral-700)]">
                        {formatTruckType(load.truckType)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--neutral-600)]">
                      {load.fullPartial === "FULL" ? "F" : load.fullPartial === "PARTIAL" ? "P" : "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-medium text-[var(--neutral-900)]">{load.pickupCity}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--neutral-600)]">
                      {load.tripKm ? `${load.tripKm} km` : "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-medium text-[var(--neutral-900)]">{load.deliveryCity}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-[var(--neutral-700)]">{load.shipper?.name || "—"}</span>
                        {load.shipper?.isVerified && (
                          <span className="text-[var(--success-500)]" title="Verified">
                            <VerifiedIcon />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--neutral-600)]">
                      {load.weight ? `${load.weight.toLocaleString()} kg` : "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-bold text-[var(--neutral-900)]">
                        ETB {load.rate.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          load.bookMode === "INSTANT"
                            ? "bg-[var(--success-100)] text-[var(--success-700)]"
                            : "bg-[var(--neutral-100)] text-[var(--neutral-600)]"
                        }`}
                      >
                        {load.bookMode === "INSTANT" ? "Instant" : "Request"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        href={`/dashboard/loads/${load.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--primary-600)] hover:bg-[var(--primary-50)] transition-colors"
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
          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--neutral-50)]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-[var(--neutral-600)]">
                Page <span className="font-semibold text-[var(--neutral-900)]">{pagination.page}</span> of{" "}
                <span className="font-semibold text-[var(--neutral-900)]">{pagination.pages}</span>
                <span className="text-[var(--neutral-400)]"> ({pagination.total} total loads)</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-white text-[var(--neutral-700)] hover:bg-[var(--neutral-50)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.pages}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-white text-[var(--neutral-700)] hover:bg-[var(--neutral-50)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
