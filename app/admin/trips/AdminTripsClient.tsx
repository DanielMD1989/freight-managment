"use client";

/**
 * Admin Trips Client Component
 *
 * Interactive table with filtering for all platform trips
 * Includes financial summary at top
 */

import { useState, useEffect } from "react";
import Link from "next/link";

type TripStatus =
  | "ALL"
  | "ASSIGNED"
  | "PICKUP_PENDING"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

interface Trip {
  id: string;
  status: string;
  shipperServiceFee: number | null;
  carrierServiceFee: number | null;
  createdAt: string;
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    shipper: {
      id: string;
      name: string;
    } | null;
  } | null;
  carrier: {
    id: string;
    name: string;
  } | null;
  truck: {
    id: string;
    licensePlate: string;
  } | null;
}

interface TripSummary {
  totalTrips: number;
  totalServiceFees: number;
  activeTrips: number;
}

const STATUS_TABS: { key: TripStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "PICKUP_PENDING", label: "Pickup Pending" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PICKUP_PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IN_TRANSIT:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  DELIVERED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function AdminTripsClient() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TripStatus>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<TripSummary>({
    totalTrips: 0,
    totalServiceFees: 0,
    activeTrips: 0,
  });

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (activeStatus !== "ALL") {
        params.append("status", activeStatus);
      }

      const response = await fetch(`/api/trips?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalCount(data.pagination?.total || 0);

        // Calculate summary from response or use provided summary
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error("Failed to fetch trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch("/api/trips/summary");
      if (response.ok) {
        const data = await response.json();
        setSummary({
          totalTrips: data.totalTrips || 0,
          totalServiceFees: data.totalServiceFees || 0,
          activeTrips: data.activeTrips || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch trip summary:", error);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [activeStatus, page]);

  useEffect(() => {
    fetchSummary();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalFee = (trip: Trip) => {
    const shipper = trip.shipperServiceFee || 0;
    const carrier = trip.carrierServiceFee || 0;
    return shipper + carrier;
  };

  return (
    <div className="space-y-4">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
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
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Trips
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {summary.totalTrips.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600">
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Service Fees
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(summary.totalServiceFees)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Active Trips
              </p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {summary.activeTrips.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200/60 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveStatus(tab.key);
              setPage(1);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeStatus === tab.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {totalCount} trips found
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Trip ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Load Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Shipper
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Carrier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Truck
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Service Fee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No trips found
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/trips/${trip.id}`}
                        className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {trip.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {trip.load
                        ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {trip.load?.shipper?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {trip.carrier?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {trip.truck?.licensePlate || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[trip.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {trip.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {formatCurrency(calculateTotalFee(trip))}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(trip.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
