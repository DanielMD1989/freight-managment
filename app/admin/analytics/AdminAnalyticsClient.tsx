'use client';

import { useState, useEffect } from 'react';

type TimePeriod = 'day' | 'week' | 'month' | 'year';

interface AnalyticsData {
  period: TimePeriod;
  dateRange: { start: string; end: string };
  summary: {
    revenue: {
      platformBalance: number;
      escrowBalance: number;
      serviceFeeCollected: number;
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
      posted: number;
      assigned: number;
      inTransit: number;
      delivered: number;
      cancelled: number;
      newInPeriod: number;
    };
    trips: {
      completed: number;
      inTransit: number;
      cancelled: number;
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
    tripsOverTime: Array<{ date: string; completed: number; cancelled: number }>;
    loadsByStatus: Array<{ status: string; count: number }>;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <div className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && (
        <p className={`text-sm mt-1 ${trend ? trendColors[trend] : 'text-gray-500'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function MiniBarChart({
  data,
  valueKey,
  color = 'blue',
}: {
  data: Array<{ date: string; [key: string]: string | number }>;
  valueKey: string;
  color?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => Number(d[valueKey]) || 0));
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="h-32 flex items-end gap-1">
      {data.slice(-14).map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div
            key={index}
            className="flex-1 flex flex-col items-center"
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

function StatusDistribution({ data }: { data: Array<{ status: string; count: number }> }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const statusColors: Record<string, string> = {
    POSTED: 'bg-blue-500',
    ASSIGNED: 'bg-purple-500',
    IN_TRANSIT: 'bg-yellow-500',
    DELIVERED: 'bg-green-500',
    COMPLETED: 'bg-gray-500',
    CANCELLED: 'bg-red-500',
  };

  const statusLabels: Record<string, string> = {
    POSTED: 'Posted',
    ASSIGNED: 'Assigned',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const percentage = total > 0 ? (item.count / total) * 100 : 0;
        return (
          <div key={item.status}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{statusLabels[item.status] || item.status}</span>
              <span className="font-medium">{item.count}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${statusColors[item.status] || 'bg-gray-500'}`}
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
  const [period, setPeriod] = useState<TimePeriod>('month');
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
          throw new Error('Failed to fetch analytics');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [period]);

  const periodLabels: Record<TimePeriod, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600 mt-1">
            {periodLabels[period]} &bull;{' '}
            {new Date(data.dateRange.start).toLocaleDateString()} -{' '}
            {new Date(data.dateRange.end).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Escrow Balance"
          value={formatCurrency(data.summary.revenue.escrowBalance)}
          subtitle="Held for settlement"
          icon="🔒"
        />
        <StatCard
          title="Transaction Volume"
          value={formatCurrency(data.summary.revenue.transactionVolume)}
          subtitle={`${data.summary.revenue.transactionsInPeriod} transactions`}
          icon="💳"
        />
      </div>

      {/* Users & Organizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data.summary.users.total.toLocaleString()}
          subtitle={`+${data.summary.users.newInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="👥"
          trend={data.summary.users.newInPeriod > 0 ? 'up' : 'neutral'}
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
          trend={data.summary.disputes.open > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          title="Total Trucks"
          value={data.summary.trucks.total.toLocaleString()}
          subtitle={`${data.summary.trucks.approved} approved, ${data.summary.trucks.pending} pending`}
          icon="🚛"
        />
      </div>

      {/* Load & Trip Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Loads"
          value={data.summary.loads.total.toLocaleString()}
          subtitle={`+${data.summary.loads.newInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="📦"
          trend={data.summary.loads.newInPeriod > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          title="Active Loads"
          value={(data.summary.loads.posted + data.summary.loads.assigned + data.summary.loads.inTransit).toLocaleString()}
          subtitle={`${data.summary.loads.inTransit} in transit`}
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
          trend={data.summary.trips.cancelled > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loads Over Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Loads</h3>
          <MiniBarChart data={data.charts.loadsOverTime} valueKey="count" color="blue" />
          <p className="text-sm text-gray-500 mt-2 text-center">
            {data.charts.loadsOverTime.length > 0
              ? `${formatDate(data.charts.loadsOverTime[0].date)} - ${formatDate(data.charts.loadsOverTime[data.charts.loadsOverTime.length - 1].date)}`
              : 'No data'}
          </p>
        </div>

        {/* Revenue Over Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue (Service Fees)</h3>
          <MiniBarChart data={data.charts.revenueOverTime} valueKey="total" color="green" />
          <p className="text-sm text-gray-500 mt-2 text-center">
            Total: {formatCurrency(data.summary.revenue.serviceFeeCollected)}
          </p>
        </div>

        {/* Load Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Status Distribution</h3>
          <StatusDistribution data={data.charts.loadsByStatus} />
        </div>

        {/* Trips Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="font-medium text-green-900">Completed</span>
              </div>
              <span className="text-xl font-bold text-green-900">
                {data.summary.trips.completed}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span className="font-medium text-yellow-900">In Transit</span>
              </div>
              <span className="text-xl font-bold text-yellow-900">
                {data.summary.trips.inTransit}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="font-medium text-red-900">Cancelled</span>
              </div>
              <span className="text-xl font-bold text-red-900">
                {data.summary.trips.cancelled}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
