/**
 * Platform Metrics Dashboard Client Component
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.8: Platform Metrics Dashboard
 *
 * Comprehensive platform health and performance metrics
 */

'use client';

import { useEffect, useState } from 'react';

interface PlatformMetrics {
  timestamp: string;
  metrics: {
    users: {
      total: number;
      active: number;
      activeRate: number;
    };
    organizations: {
      total: number;
      verified: number;
      verificationRate: number;
      carriers: number;
      shippers: number;
    };
    loads: {
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      completionRate: number;
      cancellationRate: number;
      byStatus: Array<{ status: string; count: number }>;
    };
    trucks: {
      total: number;
      active: number;
    };
    financial: {
      totalRevenue: number;
      pendingSettlements: number;
      paidSettlements: number;
    };
    activity: {
      recentLogins: number;
      recentLoads: number;
      topEvents: Array<{ eventType: string; count: number }>;
    };
    trust: {
      flaggedOrganizations: number;
      disputes: number;
      bypassAttempts: number;
    };
  };
}

export default function PlatformMetricsClient() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/platform-metrics');

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setLastRefresh(new Date());
      } else {
        console.error('Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">Loading platform metrics...</p>
      </div>
    );
  }

  const { metrics: m } = metrics;

  return (
    <div className="space-y-6">
      {/* Refresh Header */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {/* User & Organization Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          User & Organization Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {m.users.total.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {m.users.activeRate.toFixed(1)}% active
                </p>
              </div>
              <svg
                className="w-12 h-12 text-blue-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Organizations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {m.organizations.total.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {m.organizations.verificationRate.toFixed(1)}% verified
                </p>
              </div>
              <svg
                className="w-12 h-12 text-purple-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Carriers</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {m.organizations.carriers.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((m.organizations.carriers / m.organizations.total) * 100).toFixed(1)}% of total
            </p>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Shippers</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {m.organizations.shippers.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((m.organizations.shippers / m.organizations.total) * 100).toFixed(1)}% of total
            </p>
          </div>
        </div>
      </div>

      {/* Load & Truck Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Load & Truck Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Loads</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {m.loads.total.toLocaleString()}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-green-600">
                {m.loads.completionRate.toFixed(1)}% completed
              </span>
              <span className="text-xs text-red-600">
                {m.loads.cancellationRate.toFixed(1)}% cancelled
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Active Loads</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {m.loads.active.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              In transit or assigned
            </p>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Completed Loads</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {m.loads.completed.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Successfully delivered
            </p>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Trucks</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {m.trucks.total.toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {m.trucks.active} available
            </p>
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Financial Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <p className="text-sm opacity-90">Total Platform Revenue</p>
            <p className="text-4xl font-bold mt-2">
              {m.financial.totalRevenue.toLocaleString()} ETB
            </p>
            <p className="text-xs opacity-75 mt-1">
              From {m.financial.paidSettlements} completed settlements
            </p>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Pending Settlements</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {m.financial.pendingSettlements.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Awaiting processing
            </p>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Paid Settlements</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {m.financial.paidSettlements.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Successfully processed
            </p>
          </div>
        </div>
      </div>

      {/* Activity Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity (Last 7 Days)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">User Logins</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {m.activity.recentLogins.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">New Loads</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {m.activity.recentLoads.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-3">Top Events</p>
            <div className="space-y-2">
              {m.activity.topEvents.map((event, index) => (
                <div
                  key={event.eventType}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-700">{event.eventType}</span>
                  <span className="font-bold text-gray-900">
                    {event.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Safety Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Trust & Safety Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow border border-red-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Flagged Organizations</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {m.trust.flaggedOrganizations}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Require review
                </p>
              </div>
              <svg
                className="w-12 h-12 text-red-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-orange-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Disputes</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {m.trust.disputes}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Platform-wide
                </p>
              </div>
              <svg
                className="w-12 h-12 text-orange-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-yellow-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bypass Attempts</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  {m.trust.bypassAttempts}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Detected violations
                </p>
              </div>
              <svg
                className="w-12 h-12 text-yellow-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Load Status Breakdown */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Load Status Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {m.loads.byStatus.map((item) => (
            <div key={item.status} className="text-center">
              <p className="text-xs text-gray-600 uppercase">{item.status}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {item.count.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">
                {((item.count / m.loads.total) * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
