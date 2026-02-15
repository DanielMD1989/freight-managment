"use client";

import { useState, useEffect } from "react";

type TimePeriod = "day" | "week" | "month" | "year";

interface AnalyticsData {
  period: TimePeriod;
  dateRange: { start: string; end: string };
  summary: {
    revenue: {
      platformBalance: number;
      serviceFeeCollected: number;
      pendingWithdrawals: number;
      transactionsInPeriod: number;
      transactionVolume: number;
    };
    trucks: {
      total: number;
      approved: number;
      pending: number;
      newInPeriod: number;
    };
    loads: {
      total: number;
      active: number;
      inProgress: number;
      delivered: number;
      completed: number;
      cancelled: number;
      byStatus: {
        draft: number;
        posted: number;
        searching: number;
        offered: number;
        assigned: number;
        pickupPending: number;
        inTransit: number;
        delivered: number;
        completed: number;
        exception: number;
        cancelled: number;
        expired: number;
        unposted: number;
      };
      newInPeriod: number;
    };
    trips: {
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      byStatus: Record<string, number>;
    };
    users: {
      total: number;
      newInPeriod: number;
    };
    organizations: {
      total: number;
    };
    disputes: {
      open: number;
      resolvedInPeriod: number;
    };
  };
  charts: {
    loadsOverTime: Array<{ date: string; count: number }>;
    revenueOverTime: Array<{ date: string; total: number }>;
    tripsOverTime: Array<{
      date: string;
      completed: number;
      cancelled: number;
    }>;
    loadsByStatus: Array<{ status: string; count: number }>;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-500",
  };

  return (
    <div className="rounded-xl border border-[#064d51]/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#064d51]/70">{title}</h3>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#064d51]">{value}</p>
      {subtitle && (
        <p
          className={`mt-1 text-sm ${trend ? trendColors[trend] : "text-[#064d51]/60"}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function MiniBarChart({
  data,
  valueKey,
  color = "blue",
}: {
  data: Array<{ date: string; [key: string]: string | number }>;
  valueKey: string;
  color?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Number(d[valueKey]) || 0));
  const colorClasses: Record<string, string> = {
    blue: "bg-[#1e9c99]",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-rose-500",
    teal: "bg-[#064d51]",
  };

  return (
    <div className="flex h-32 items-end gap-1">
      {data.slice(-14).map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div
            key={index}
            className="flex flex-1 flex-col items-center"
            title={`${formatDate(item.date)}: ${value}`}
          >
            <div
              className={`w-full ${colorClasses[color]} rounded-t transition-all hover:opacity-80`}
              style={{ height: `${Math.max(height, 2)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function StatusDistribution({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const statusColors: Record<string, string> = {
    POSTED: "bg-[#1e9c99]",
    ASSIGNED: "bg-indigo-500",
    IN_TRANSIT: "bg-amber-500",
    DELIVERED: "bg-emerald-500",
    COMPLETED: "bg-[#064d51]",
    CANCELLED: "bg-rose-500",
  };

  const statusLabels: Record<string, string> = {
    POSTED: "Posted",
    ASSIGNED: "Assigned",
    IN_TRANSIT: "In Transit",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const percentage = total > 0 ? (item.count / total) * 100 : 0;
        return (
          <div key={item.status}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[#064d51]/70">
                {statusLabels[item.status] || item.status}
              </span>
              <span className="font-medium text-[#064d51]">{item.count}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#064d51]/10">
              <div
                className={`h-2 rounded-full ${statusColors[item.status] || "bg-gray-500"}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAnalyticsClient() {
  const [period, setPeriod] = useState<TimePeriod>("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/analytics?period=${period}`);
        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [period]);

  const periodLabels: Record<TimePeriod, string> = {
    day: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
  };

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#1e9c99]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#064d51]">
            Platform Analytics
          </h1>
          <p className="mt-1 text-[#064d51]/70">
            {periodLabels[period]} &bull;{" "}
            {new Date(data.dateRange.start).toLocaleDateString()} -{" "}
            {new Date(data.dateRange.end).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          {(["day", "week", "month", "year"] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                period === p
                  ? "bg-[#064d51] text-white shadow-md"
                  : "border border-[#064d51]/20 bg-white text-[#064d51] hover:bg-[#064d51]/10"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Platform Revenue"
          value={formatCurrency(data.summary.revenue.platformBalance)}
          subtitle="Total balance"
          icon="💰"
          trend="up"
        />
        <StatCard
          title="Service Fees Collected"
          value={formatCurrency(data.summary.revenue.serviceFeeCollected)}
          subtitle={`${periodLabels[period].toLowerCase()}`}
          icon="📈"
          trend="up"
        />
        <StatCard
          title="Active Trips"
          value={data.summary.trips.active}
          subtitle="Currently in transit"
          icon="🚚"
        />
        <StatCard
          title="Transaction Volume"
          value={formatCurrency(data.summary.revenue.transactionVolume)}
          subtitle={`${data.summary.revenue.transactionsInPeriod} transactions`}
          icon="💳"
        />
      </div>

      {/* Users & Organizations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={data.summary.users.total.toLocaleString()}
          subtitle={`+${data.summary.users.newInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="👥"
          trend={data.summary.users.newInPeriod > 0 ? "up" : "neutral"}
        />
        <StatCard
          title="Organizations"
          value={data.summary.organizations.total.toLocaleString()}
          subtitle="Registered companies"
          icon="🏢"
        />
        <StatCard
          title="Open Disputes"
          value={data.summary.disputes.open}
          subtitle={`${data.summary.disputes.resolvedInPeriod} resolved ${periodLabels[period].toLowerCase()}`}
          icon="⚠️"
          trend={data.summary.disputes.open > 0 ? "down" : "neutral"}
        />
        <StatCard
          title="Total Trucks"
          value={data.summary.trucks.total.toLocaleString()}
          subtitle={`${data.summary.trucks.approved} approved, ${data.summary.trucks.pending} pending`}
          icon="🚛"
        />
      </div>

      {/* Load & Trip Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Loads"
          value={data.summary.loads.total.toLocaleString()}
          subtitle={`+${data.summary.loads.newInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="📦"
          trend={data.summary.loads.newInPeriod > 0 ? "up" : "neutral"}
        />
        <StatCard
          title="Active Loads"
          value={(
            data.summary.loads.active + data.summary.loads.inProgress
          ).toLocaleString()}
          subtitle={`${data.summary.loads.inProgress} in progress`}
          icon="🚚"
        />
        <StatCard
          title="Completed Trips"
          value={data.summary.trips.completed.toLocaleString()}
          subtitle={`${periodLabels[period].toLowerCase()}`}
          icon="✅"
          trend="up"
        />
        <StatCard
          title="Cancelled"
          value={data.summary.trips.cancelled.toLocaleString()}
          subtitle={`${periodLabels[period].toLowerCase()}`}
          icon="❌"
          trend={data.summary.trips.cancelled > 0 ? "down" : "neutral"}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Loads Over Time */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            New Loads
          </h3>
          <MiniBarChart
            data={data.charts.loadsOverTime}
            valueKey="count"
            color="teal"
          />
          <p className="mt-2 text-center text-sm text-[#064d51]/60">
            {data.charts.loadsOverTime.length > 0
              ? `${formatDate(data.charts.loadsOverTime[0].date)} - ${formatDate(data.charts.loadsOverTime[data.charts.loadsOverTime.length - 1].date)}`
              : "No data"}
          </p>
        </div>

        {/* Revenue Over Time */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            Revenue (Service Fees)
          </h3>
          <MiniBarChart
            data={data.charts.revenueOverTime}
            valueKey="total"
            color="green"
          />
          <p className="mt-2 text-center text-sm text-[#064d51]/60">
            Total: {formatCurrency(data.summary.revenue.serviceFeeCollected)}
          </p>
        </div>

        {/* Load Status Distribution */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            Load Status Distribution
          </h3>
          <StatusDistribution data={data.charts.loadsByStatus} />
        </div>

        {/* Trips Summary */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            Trip Performance
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="font-medium text-emerald-900">Completed</span>
              </div>
              <span className="text-xl font-bold text-emerald-900">
                {data.summary.trips.completed}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-900">In Transit</span>
              </div>
              <span className="text-xl font-bold text-amber-900">
                {data.summary.trips.active}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-rose-50 p-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="font-medium text-rose-900">Cancelled</span>
              </div>
              <span className="text-xl font-bold text-rose-900">
                {data.summary.trips.cancelled}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
