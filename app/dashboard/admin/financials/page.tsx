"use client";

import { useEffect, useState } from "react";

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalLoads: number;
  totalTrucks: number;
  totalRevenue: number;
  activeTrips: number;
  loadsByStatus: Record<string, number>;
}

export default function AdminFinancialsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12">Failed to load dashboard</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Financial Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor platform finances and revenue
        </p>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-md bg-green-100 p-3">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Revenue
                </dt>
                <dd className="text-2xl font-bold text-gray-900">
                  ETB {stats.totalRevenue.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-md bg-yellow-100 p-3">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Active Trips
                </dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {stats.activeTrips.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-md bg-blue-100 p-3">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Active Loads
                </dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {stats.totalLoads.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Load Status Breakdown */}
      <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Load Status Breakdown
          </h2>
          <div className="space-y-3">
            {Object.entries(stats.loadsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      status === "POSTED"
                        ? "bg-blue-100 text-blue-800"
                        : status === "ASSIGNED"
                        ? "bg-yellow-100 text-yellow-800"
                        : status === "IN_TRANSIT"
                        ? "bg-purple-100 text-purple-800"
                        : status === "DELIVERED"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Platform Overview
          </h2>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-600">Total Users</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {stats.totalUsers}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-600">Total Organizations</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {stats.totalOrganizations}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-600">Total Trucks</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {stats.totalTrucks}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-600">Total Loads</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {stats.totalLoads}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Financial Insights */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Financial Insights
        </h2>
        <div className="rounded-md bg-blue-50 p-4">
          <p className="text-sm text-blue-700">
            <strong>Platform Health:</strong> There are{" "}
            {stats.activeTrips.toLocaleString()} active trips in progress. Total
            revenue generated is ETB {stats.totalRevenue.toLocaleString()}.
          </p>
        </div>
        <div className="mt-4 rounded-md bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> For detailed transaction history and ledger
            audit tools, additional reporting features will be available in Phase
            2.
          </p>
        </div>
      </div>
    </div>
  );
}
