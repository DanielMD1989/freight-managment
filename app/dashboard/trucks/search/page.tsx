"use client";

import { useEffect, useState } from "react";

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

const TruckSmallIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
  </svg>
);

const VerifiedIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const GpsIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const WeightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

export default function TruckSearchPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    truckType: "",
    availabilityStatus: "AVAILABLE",
  });

  const truckTypes = [
    { value: "FLATBED", label: "Flatbed", icon: "🚛" },
    { value: "REFRIGERATED", label: "Refrigerated", icon: "❄️" },
    { value: "TANKER", label: "Tanker", icon: "🛢️" },
    { value: "CONTAINER", label: "Container", icon: "📦" },
    { value: "DRY_VAN", label: "Dry Van", icon: "🚐" },
    { value: "LOWBOY", label: "Lowboy", icon: "🚜" },
    { value: "DUMP_TRUCK", label: "Dump Truck", icon: "🚚" },
  ];

  const availabilityOptions = [
    { value: "", label: "All Status" },
    { value: "AVAILABLE", label: "Available" },
    { value: "IN_USE", label: "In Use" },
    { value: "MAINTENANCE", label: "Maintenance" },
  ];

  // Count active filters
  const activeFilterCount = [filters.truckType, filters.availabilityStatus !== "AVAILABLE" ? filters.availabilityStatus : ""].filter(v => v !== "").length;

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

  const formatTruckType = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-[var(--success-100)] text-[var(--success-700)] border-[var(--success-200)]";
      case "IN_USE":
        return "bg-[var(--primary-100)] text-[var(--primary-700)] border-[var(--primary-200)]";
      case "MAINTENANCE":
        return "bg-[var(--warning-100)] text-[var(--warning-700)] border-[var(--warning-200)]";
      default:
        return "bg-[var(--neutral-100)] text-[var(--neutral-600)] border-[var(--neutral-200)]";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-[var(--success-500)]";
      case "IN_USE":
        return "bg-[var(--primary-500)]";
      case "MAINTENANCE":
        return "bg-[var(--warning-500)]";
      default:
        return "bg-[var(--neutral-400)]";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--neutral-900)]">Find Trucks</h1>
          <p className="mt-1 text-sm text-[var(--neutral-500)]">
            Search for available trucks for your loads
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
                  Reset to default
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSearch} className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Truck Type */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Truck Type
                </label>
                <select
                  value={filters.truckType}
                  onChange={(e) => setFilters({ ...filters, truckType: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors appearance-none cursor-pointer"
                >
                  <option value="">All Types</option>
                  {truckTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Availability */}
              <div>
                <label className="block text-sm font-medium text-[var(--neutral-700)] mb-1.5">
                  Availability
                </label>
                <select
                  value={filters.availabilityStatus}
                  onChange={(e) => setFilters({ ...filters, availabilityStatus: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-900)] focus:border-[var(--primary-500)] focus:ring-2 focus:ring-[var(--primary-100)] transition-colors appearance-none cursor-pointer"
                >
                  {availabilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[var(--primary-700)] to-[var(--primary-600)] text-white shadow-sm hover:from-[var(--primary-800)] hover:to-[var(--primary-700)] transition-all"
                >
                  <SearchIcon />
                  Search Trucks
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--neutral-600)]">
          Found <span className="font-semibold text-[var(--neutral-900)]">{trucks.length}</span> trucks
        </p>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[var(--border)]">
          <div className="loading-spinner loading-spinner-lg mb-4"></div>
          <p className="text-[var(--neutral-500)] font-medium">Searching for trucks...</p>
        </div>
      ) : trucks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[var(--border)]">
          <div className="text-[var(--neutral-300)] mb-4">
            <TruckIcon />
          </div>
          <h3 className="text-lg font-semibold text-[var(--neutral-700)] mb-2">No trucks found</h3>
          <p className="text-sm text-[var(--neutral-500)] mb-6">Try adjusting your filters or search criteria</p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary-50)] text-[var(--primary-700)] hover:bg-[var(--primary-100)] transition-colors"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.map((truck) => (
            <div
              key={truck.id}
              className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden hover:shadow-md hover:border-[var(--primary-200)] transition-all group"
            >
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--neutral-50)] to-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[var(--primary-100)] flex items-center justify-center text-[var(--primary-600)] group-hover:bg-[var(--primary-200)] transition-colors">
                      <TruckSmallIcon />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[var(--neutral-900)]">
                        {truck.licensePlate}
                      </h3>
                      <p className="text-sm text-[var(--neutral-500)]">
                        {formatTruckType(truck.truckType)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(truck.availabilityStatus)}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(truck.availabilityStatus)}`}></span>
                    {truck.availabilityStatus.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-5 py-4 space-y-3">
                {/* Carrier */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--neutral-500)] uppercase tracking-wide">Carrier</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--neutral-900)]">{truck.carrier.name}</span>
                    {truck.carrier.verificationType === "VERIFIED" && (
                      <span className="text-[var(--success-500)]" title="Verified Carrier">
                        <VerifiedIcon />
                      </span>
                    )}
                  </div>
                </div>

                {/* Capacity */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--neutral-500)] uppercase tracking-wide flex items-center gap-1.5">
                    <WeightIcon />
                    Capacity
                  </span>
                  <span className="text-sm font-semibold text-[var(--neutral-900)]">
                    {truck.capacity.toLocaleString()} kg
                  </span>
                </div>

                {/* Location */}
                {truck.currentLocation && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--neutral-500)] uppercase tracking-wide flex items-center gap-1.5">
                      <LocationIcon />
                      Location
                    </span>
                    <span className="text-sm text-[var(--neutral-700)]">
                      {truck.currentLocation}
                    </span>
                  </div>
                )}

                {/* GPS */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--neutral-500)] uppercase tracking-wide flex items-center gap-1.5">
                    <GpsIcon />
                    GPS Tracking
                  </span>
                  {truck.gpsDeviceId ? (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--success-600)]">
                      <span className="w-2 h-2 rounded-full bg-[var(--success-500)] animate-pulse"></span>
                      Active
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--neutral-400)]">Not available</span>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-4 border-t border-[var(--border)] bg-[var(--neutral-50)]">
                <button
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[var(--primary-700)] to-[var(--primary-600)] text-white shadow-sm hover:from-[var(--primary-800)] hover:to-[var(--primary-700)] transition-all"
                  onClick={() =>
                    alert(
                      "Direct booking coming soon. For now, contact the carrier directly or use the dispatch system."
                    )
                  }
                >
                  <PhoneIcon />
                  Contact Carrier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
