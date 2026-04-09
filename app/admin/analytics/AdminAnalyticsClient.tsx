"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import DateRangePicker, {
  getDefaultDateRange,
  type DateRangeValue,
} from "@/components/DateRangePicker";

interface AnalyticsData {
  period: string;
  dateRange: { start: string; end: string };
  summary: {
    revenue: {
      platformBalance: number;
      serviceFeeCollected: number;
      shipperFeeCollected: number;
      carrierFeeCollected: number;
      pendingWithdrawals: number;
      transactionsInPeriod: number;
      transactionVolume: number;
    } | null;
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
      byStatus: Record<string, number>;
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

function formatShortDate(dateString: string): string {
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

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "#fff",
    border: "1px solid rgba(6,77,81,0.15)",
    borderRadius: "8px",
    fontSize: "13px",
  },
};

export default function AdminAnalyticsClient() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(
    getDefaultDateRange("30d")
  );
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const response = await fetch(`/api/admin/analytics?${params}`);
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
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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

  const periodLabel = `${formatShortDate(data.dateRange.start)} - ${formatShortDate(data.dateRange.end)}`;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Picker */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#064d51]">
            Platform Analytics
          </h1>
          <p className="mt-1 text-[#064d51]/70">{periodLabel}</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Revenue Stats */}
      {data.summary.revenue && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Platform Revenue"
            value={formatCurrency(data.summary.revenue.platformBalance)}
            subtitle="Total balance"
            icon="$"
            trend="up"
          />
          <StatCard
            title="Service Fees Collected"
            value={formatCurrency(data.summary.revenue.serviceFeeCollected)}
            subtitle={periodLabel}
            icon="#"
            trend="up"
          />
          <StatCard
            title="Active Trips"
            value={data.summary.trips.active}
            subtitle="Currently in transit"
            icon=">"
          />
          <StatCard
            title="Transaction Volume"
            value={formatCurrency(data.summary.revenue.transactionVolume)}
            subtitle={`${data.summary.revenue.transactionsInPeriod} transactions`}
            icon="~"
          />
        </div>
      )}

      {/* Users & Organizations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={data.summary.users.total.toLocaleString()}
          subtitle={`+${data.summary.users.newInPeriod} new`}
          icon="U"
          trend={data.summary.users.newInPeriod > 0 ? "up" : "neutral"}
        />
        <StatCard
          title="Organizations"
          value={data.summary.organizations.total.toLocaleString()}
          subtitle="Registered companies"
          icon="O"
        />
        <StatCard
          title="Open Disputes"
          value={data.summary.disputes.open}
          subtitle={`${data.summary.disputes.resolvedInPeriod} resolved`}
          icon="!"
          trend={data.summary.disputes.open > 0 ? "down" : "neutral"}
        />
        <StatCard
          title="Total Trucks"
          value={data.summary.trucks.total.toLocaleString()}
          subtitle={`${data.summary.trucks.approved} approved, ${data.summary.trucks.pending} pending`}
          icon="T"
        />
      </div>

      {/* Load & Trip Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Loads"
          value={data.summary.loads.total.toLocaleString()}
          subtitle={`+${data.summary.loads.newInPeriod} new`}
          icon="L"
          trend={data.summary.loads.newInPeriod > 0 ? "up" : "neutral"}
        />
        <StatCard
          title="Active Loads"
          value={(
            data.summary.loads.active + data.summary.loads.inProgress
          ).toLocaleString()}
          subtitle={`${data.summary.loads.inProgress} in progress`}
          icon="A"
        />
        <StatCard
          title="Completed Trips"
          value={data.summary.trips.completed.toLocaleString()}
          subtitle="in period"
          icon="C"
          trend="up"
        />
        <StatCard
          title="Cancelled"
          value={data.summary.trips.cancelled.toLocaleString()}
          subtitle="in period"
          icon="X"
          trend={data.summary.trips.cancelled > 0 ? "down" : "neutral"}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Loads Over Time - Line Chart */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            New Loads
          </h3>
          {data.charts.loadsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.charts.loadsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#064d5115" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 12, fill: "#064d51" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#064d51" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={formatShortDate as (label: unknown) => string}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Loads"
                  stroke="#064d51"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#064d51" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-sm text-[#064d51]/40">
              No data available
            </div>
          )}
        </div>

        {/* Revenue Over Time - Area Chart */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            Revenue (Service Fees)
          </h3>
          {data.charts.revenueOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.charts.revenueOverTime}>
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#1e9c99" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1e9c99" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#064d5115" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 12, fill: "#064d51" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#064d51" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={formatShortDate as (label: unknown) => string}
                  formatter={
                    ((value: number) => [
                      formatCurrency(value),
                      "Revenue",
                    ]) as unknown as (value: unknown) => string
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Revenue"
                  stroke="#1e9c99"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-sm text-[#064d51]/40">
              No data available
            </div>
          )}
        </div>

        {/* Load Status Distribution */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            Load Status Distribution
          </h3>
          <StatusDistribution data={data.charts.loadsByStatus} />
        </div>

        {/* Trips Over Time - Bar Chart */}
        <div className="rounded-xl border border-[#064d51]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-[#064d51]">
            Trip Performance
          </h3>
          {data.charts.tripsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.charts.tripsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#064d5115" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 12, fill: "#064d51" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#064d51" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={formatShortDate as (label: unknown) => string}
                />
                <Legend />
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="#064d51"
                  radius={[4, 4, 0, 0]}
                  stackId="trips"
                />
                <Bar
                  dataKey="cancelled"
                  name="Cancelled"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  stackId="trips"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-sm text-[#064d51]/40">
              No data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
