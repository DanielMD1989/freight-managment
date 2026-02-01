"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ServiceFeeMetrics {
  summary: {
    totalFeesCollected: number;
    totalFeesReserved: number;
    totalFeesRefunded: number;
    totalLoadsWithFees: number;
    averageFeePerLoad: number;
  };
  byStatus: {
    status: string;
    count: number;
    totalAmount: number;
  }[];
  byCorridor: {
    corridorId: string;
    corridorName: string;
    loadCount: number;
    totalFees: number;
    averageFee: number;
  }[];
  recentTransactions: {
    loadId: string;
    pickupCity: string;
    deliveryCity: string;
    serviceFee: number;
    status: string;
    date: string;
  }[];
}

export default function ServiceFeeDashboard() {
  const [metrics, setMetrics] = useState<ServiceFeeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/service-fees/metrics?range=${dateRange}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DEDUCTED":
        return "bg-green-100 text-green-800";
      case "RESERVED":
        return "bg-yellow-100 text-yellow-800";
      case "REFUNDED":
        return "bg-blue-100 text-blue-800";
      case "WAIVED":
        return "bg-gray-100 text-gray-800";
      case "PENDING":
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading metrics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Fee Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor service fee collection and corridor performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Link
            href="/admin/corridors"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Manage Corridors
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <dt className="text-sm font-medium text-gray-500">Total Collected</dt>
          <dd className="mt-2 text-3xl font-semibold text-green-600">
            {metrics ? formatCurrency(metrics.summary.totalFeesCollected) : "-"}
          </dd>
          <p className="mt-1 text-xs text-gray-500">Service fees deducted to platform</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <dt className="text-sm font-medium text-gray-500">Currently Reserved</dt>
          <dd className="mt-2 text-3xl font-semibold text-yellow-600">
            {metrics ? formatCurrency(metrics.summary.totalFeesReserved) : "-"}
          </dd>
          <p className="mt-1 text-xs text-gray-500">Reserved for active loads</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <dt className="text-sm font-medium text-gray-500">Total Refunded</dt>
          <dd className="mt-2 text-3xl font-semibold text-blue-600">
            {metrics ? formatCurrency(metrics.summary.totalFeesRefunded) : "-"}
          </dd>
          <p className="mt-1 text-xs text-gray-500">Returned on cancellations</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <dt className="text-sm font-medium text-gray-500">Average Fee/Load</dt>
          <dd className="mt-2 text-3xl font-semibold text-gray-900">
            {metrics ? formatCurrency(metrics.summary.averageFeePerLoad) : "-"}
          </dd>
          <p className="mt-1 text-xs text-gray-500">
            From {metrics?.summary.totalLoadsWithFees || 0} loads
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fee Status Distribution</h3>
          {metrics?.byStatus && metrics.byStatus.length > 0 ? (
            <div className="space-y-3">
              {metrics.byStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="text-sm text-gray-600">{item.count} loads</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(item.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>

        {/* Top Corridors */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Corridors by Revenue</h3>
          {metrics?.byCorridor && metrics.byCorridor.length > 0 ? (
            <div className="space-y-3">
              {metrics.byCorridor.slice(0, 5).map((corridor) => (
                <div key={corridor.corridorId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{corridor.corridorName}</p>
                    <p className="text-xs text-gray-500">{corridor.loadCount} loads</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(corridor.totalFees)}
                    </p>
                    <p className="text-xs text-gray-500">
                      avg {formatCurrency(corridor.averageFee)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No corridor data available</p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Service Fee Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Load
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics?.recentTransactions && metrics.recentTransactions.length > 0 ? (
                metrics.recentTransactions.map((tx) => (
                  <tr key={tx.loadId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/shipper/loads/${tx.loadId}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {tx.loadId.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tx.pickupCity} → {tx.deliveryCity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(tx.serviceFee)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
