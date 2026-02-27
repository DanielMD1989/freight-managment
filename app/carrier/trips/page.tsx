/**
 * Carrier Trips Page
 *
 * Manages active trips - Ready to Start and In Progress
 *
 * Features:
 * - Tabs: Ready to Start | Active Trips
 * - Trip actions: Start Trip, Confirm Pickup, End Trip
 * - Live tracking for in-transit trips
 *
 * Completed trips are in /carrier/trip-history
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { csrfFetch } from "@/lib/csrfFetch";

interface Trip {
  id: string;
  loadId: string;
  referenceNumber: string;
  status: string;
  truck: {
    id: string;
    licensePlate: string;
    truckType?: string;
    capacity?: number;
  } | null;
  load?: {
    id: string;
    pickupCity?: string;
    deliveryCity?: string;
    podSubmitted?: boolean;
    podVerified?: boolean;
  };
  pickupCity: string;
  deliveryCity: string;
  pickupDate?: string;
  deliveryDate?: string;
  startedAt?: string;
  completedAt?: string;
  shipper?: {
    id: string;
    name: string;
  };
  carrier?: {
    id: string;
    name: string;
  };
  distance?: number | null;
  weight?: number | null;
  truckType?: string;
  rate?: number | null;
  trackingUrl?: string;
  trackingEnabled?: boolean;
}

type TabType = "approved" | "active";

const TAB_CONFIG = {
  approved: {
    label: "Ready to Start",
    statuses: ["ASSIGNED"],
    emptyMessage:
      "No approved loads waiting to start. When shippers approve your load requests, they will appear here.",
  },
  active: {
    label: "Active Trips",
    statuses: ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED"],
    emptyMessage:
      "No active trips. Start a trip from Ready to Start to see it here.",
  },
};

export default function CarrierTripsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabType) || "approved";

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, [activeTab]);

  useEffect(() => {
    const tab = searchParams.get("tab") as TabType;
    if (tab && TAB_CONFIG[tab]) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      const statuses = TAB_CONFIG[activeTab].statuses;
      const params = new URLSearchParams();
      params.set("status", statuses.join(","));

      const response = await fetch(`/api/trips?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }

      const data = await response.json();
      // The /api/trips endpoint now returns properly formatted trips
      const fetchedTrips = (data.trips || []).map((trip: Trip) => ({
        ...trip,
        // Ensure pickupCity/deliveryCity are at top level
        pickupCity: trip.pickupCity || trip.load?.pickupCity || "Unknown",
        deliveryCity: trip.deliveryCity || trip.load?.deliveryCity || "Unknown",
      }));
      setTrips(fetchedTrips);
    } catch (err) {
      console.error("Error fetching trips:", err);
      setError("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (tripId: string, newStatus: string) => {
    setActionLoading(tripId);
    setError(null);

    try {
      // Use the Trip API for status changes
      const response = await csrfFetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      // Refresh trips after status change
      await fetchTrips();

      // If trip moved to a different tab, switch to that tab
      if (newStatus === "PICKUP_PENDING" || newStatus === "IN_TRANSIT") {
        setActiveTab("active");
        router.push("/carrier/trips?tab=active");
      } else if (newStatus === "DELIVERED") {
        // Delivered trips go to trip history
        router.push("/carrier/trip-history");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/carrier/trips?tab=${tab}`);
  };

  const handleViewDetails = (tripId: string, loadId?: string) => {
    // Navigate to trip detail page - pass loadId for backward compatibility
    router.push(`/carrier/trips/${loadId || tripId}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string, trip?: Trip) => {
    // For DELIVERED status, check POD sub-states
    if (status === "DELIVERED" && trip) {
      const podSubmitted = trip.load?.podSubmitted ?? false;
      const podVerified = trip.load?.podVerified ?? false;

      if (podVerified) {
        return (
          <span className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            POD Verified
          </span>
        );
      }
      if (podSubmitted) {
        return (
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            POD Submitted
          </span>
        );
      }
    }

    const statusConfig: Record<string, { classes: string; label: string }> = {
      ASSIGNED: {
        classes: "bg-teal-50 text-teal-700 border border-teal-200",
        label: "Ready to Start",
      },
      PICKUP_PENDING: {
        classes: "bg-amber-50 text-amber-700 border border-amber-200",
        label: "Pickup Pending",
      },
      IN_TRANSIT: {
        classes: "bg-indigo-50 text-indigo-700 border border-indigo-200",
        label: "In Transit",
      },
      DELIVERED: {
        classes: "bg-purple-50 text-purple-700 border border-purple-200",
        label: "POD Required",
      },
      COMPLETED: {
        classes: "bg-slate-50 text-slate-600 border border-slate-200",
        label: "Completed",
      },
    };

    const config = statusConfig[status] || {
      classes: "bg-slate-50 text-slate-600 border border-slate-200",
      label: status,
    };

    return (
      <span
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${config.classes}`}
      >
        {config.label}
      </span>
    );
  };

  const getActionButton = (trip: Trip) => {
    const isLoading = actionLoading === trip.id;

    switch (trip.status) {
      case "ASSIGNED":
        return (
          <button
            onClick={() => handleStatusChange(trip.id, "PICKUP_PENDING")}
            disabled={isLoading}
            className="rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-teal-700 hover:to-teal-600 disabled:opacity-50"
          >
            {isLoading ? "Starting..." : "Start Trip"}
          </button>
        );
      case "PICKUP_PENDING":
        return (
          <button
            onClick={() => handleStatusChange(trip.id, "IN_TRANSIT")}
            disabled={isLoading}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50"
          >
            {isLoading ? "Confirming..." : "Confirm Pickup"}
          </button>
        );
      case "IN_TRANSIT":
        return (
          <div className="flex gap-2">
            <button
              onClick={() =>
                (window.location.href = `/carrier/map?tripId=${trip.id}`)
              }
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100"
            >
              Track Live
            </button>
            <button
              onClick={() => handleStatusChange(trip.id, "DELIVERED")}
              disabled={isLoading}
              className="rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-amber-700 hover:to-amber-600 disabled:opacity-50"
            >
              {isLoading ? "Ending..." : "Mark Delivered"}
            </button>
          </div>
        );
      case "DELIVERED": {
        const podSubmitted = trip.load?.podSubmitted ?? false;
        const podVerified = trip.load?.podVerified ?? false;

        if (podVerified) {
          return (
            <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
              Verified
            </span>
          );
        }
        if (podSubmitted) {
          return (
            <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
              Awaiting Verification
            </span>
          );
        }
        return (
          <button
            onClick={() =>
              router.push(`/carrier/trips/${trip.loadId}?uploadPod=true`)
            }
            className="rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-purple-700 hover:to-purple-600"
          >
            Upload POD
          </button>
        );
      }
      default:
        return null;
    }
  };

  // Calculate counts for each tab
  const [allTrips, setAllTrips] = useState<Trip[]>([]);

  useEffect(() => {
    const fetchAllCounts = async () => {
      try {
        // Fetch trips for counts (ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED)
        const response = await fetch(
          "/api/trips?status=ASSIGNED,PICKUP_PENDING,IN_TRANSIT,DELIVERED"
        );
        if (response.ok) {
          const data = await response.json();
          const fetchedTrips = (data.trips || []).map((trip: Trip) => ({
            ...trip,
            pickupCity: trip.pickupCity || trip.load?.pickupCity || "Unknown",
            deliveryCity:
              trip.deliveryCity || trip.load?.deliveryCity || "Unknown",
          }));
          setAllTrips(fetchedTrips);
        }
      } catch (err) {
        console.error("Error fetching counts:", err);
      }
    };
    fetchAllCounts();
  }, []);

  const tabCounts = {
    approved: allTrips.filter((t) =>
      TAB_CONFIG.approved.statuses.includes(t.status)
    ).length,
    active: allTrips.filter((t) =>
      TAB_CONFIG.active.statuses.includes(t.status)
    ).length,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-md shadow-teal-500/25">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Trips</h1>
            <p className="text-sm text-slate-500">
              Manage your load assignments and active deliveries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/carrier/trip-history"
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Trip History
          </Link>
          <button
            onClick={fetchTrips}
            className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-600 transition-colors hover:bg-teal-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="inline-flex gap-1 rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm">
        {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab === "approved" ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            )}
            {TAB_CONFIG[tab].label}
            {tabCounts[tab] > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === tab ? "bg-white/20" : "bg-slate-100"
                }`}
              >
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Trips Table */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-gray-200 dark:bg-slate-700"
            ></div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <svg
              className="h-8 w-8 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {activeTab === "approved" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              )}
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-800">
            {activeTab === "approved" ? "No Loads Ready" : "No Active Trips"}
          </h3>
          <p className="mx-auto max-w-md text-slate-500">
            {TAB_CONFIG[activeTab].emptyMessage}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-teal-600 to-teal-500">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-white uppercase">
                  Load
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-white uppercase">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-white uppercase">
                  Truck
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-white uppercase">
                  Dates
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-white uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-white uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trips.map((trip) => (
                <tr
                  key={trip.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => handleViewDetails(trip.id, trip.loadId)}
                >
                  <td className="px-4 py-4">
                    <div className="text-sm font-semibold text-slate-800">
                      {trip.referenceNumber}
                    </div>
                    {trip.shipper && (
                      <div className="text-xs text-slate-500">
                        {trip.shipper.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-800">
                        {trip.pickupCity}
                      </span>
                      <svg
                        className="h-4 w-4 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                      <span className="font-medium text-slate-800">
                        {trip.deliveryCity}
                      </span>
                    </div>
                    {trip.distance && (
                      <div className="mt-0.5 text-xs text-slate-400">
                        {trip.distance} km
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-slate-700">
                      {trip.truck?.licensePlate || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-slate-700">
                      {formatDate(trip.pickupDate)}
                    </div>
                    <div className="text-xs text-slate-400">
                      to {formatDate(trip.deliveryDate)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(trip.status, trip)}
                  </td>
                  <td
                    className="px-4 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-2">
                      {getActionButton(trip)}
                      <button
                        onClick={() => handleViewDetails(trip.id, trip.loadId)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
