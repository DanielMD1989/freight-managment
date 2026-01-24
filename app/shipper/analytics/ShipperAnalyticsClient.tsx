'use client';

import { useState, useEffect } from 'react';

type TimePeriod = 'day' | 'week' | 'month' | 'year';

interface AnalyticsData {
  period: TimePeriod;
  dateRange: { start: string; end: string };
  summary: {
    loads: {
      total: number;
      posted: number;
      assigned: number;
      inTransit: number;
      delivered: number;
      cancelled: number;
      newInPeriod: number;
      deliveredInPeriod: number;
      cancelledInPeriod: number;
    };
    financial: {
      walletBalance: number;
      currency: string;
      totalServiceFees: number;
      serviceFeesInPeriod: number;
      totalLoadValue: number;
      avgLoadValue: number;
      loadValueInPeriod: number;
    };
    matches: {
      totalProposals: number;
      proposalsInPeriod: number;
    };
    rates: {
      completionRate: number;
      cancellationRate: number;
    };
  };
  charts: {
    loadsOverTime: Array<{ date: string; count: number }>;
    deliveriesOverTime: Array<{ date: string; count: number }>;
    spendingOverTime: Array<{ date: string; total: number }>;
    loadsByStatus: Array<{ status: string; count: number }>;
  };
}

function formatCurrency(amount: number, currency: string = 'ETB'): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: currency,
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</h3>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{value}</p>
      {subtitle && (
        <p className={`text-sm mt-1 ${trend ? trendColors[trend] : 'text-slate-500 dark:text-slate-400'}`}>
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
    blue: 'bg-teal-600',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-rose-500',
    teal: 'bg-teal-700',
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

function RateGauge({ rate, label, color }: { rate: number; label: string; color: string }) {
  const colorClasses: Record<string, { bg: string; text: string; fill: string }> = {
    green: { bg: 'bg-emerald-50', text: 'text-emerald-700', fill: 'bg-emerald-500' },
    red: { bg: 'bg-rose-50', text: 'text-rose-700', fill: 'bg-rose-500' },
    blue: { bg: 'bg-teal-50 dark:bg-slate-800', text: 'text-slate-800 dark:text-white', fill: 'bg-teal-600' },
    teal: { bg: 'bg-teal-50 dark:bg-slate-800', text: 'text-slate-800 dark:text-white', fill: 'bg-teal-600' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`${colors.bg} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-medium ${colors.text}`}>{label}</span>
        <span className={`text-2xl font-bold ${colors.text}`}>{rate.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-white/50 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colors.fill}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusDistribution({ data }: { data: Array<{ status: string; count: number }> }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const statusColors: Record<string, string> = {
    POSTED: 'bg-teal-600',
    ASSIGNED: 'bg-indigo-500',
    IN_TRANSIT: 'bg-amber-500',
    DELIVERED: 'bg-emerald-500',
    COMPLETED: 'bg-teal-700',
    CANCELLED: 'bg-rose-500',
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
              <span className="text-slate-600 dark:text-slate-400">{statusLabels[item.status] || item.status}</span>
              <span className="font-medium text-slate-800 dark:text-white">{item.count}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
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

export default function ShipperAnalyticsClient() {
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/shipper/analytics?period=${period}`);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
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

  const currency = data.summary.financial.currency || 'ETB';

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                period === p
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'bg-white text-slate-800 dark:text-white hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Wallet Balance"
          value={formatCurrency(data.summary.financial.walletBalance, currency)}
          subtitle="Available balance"
          icon="💰"
        />
        <StatCard
          title="Total Load Value"
          value={formatCurrency(data.summary.financial.totalLoadValue, currency)}
          subtitle={`Avg: ${formatCurrency(data.summary.financial.avgLoadValue, currency)}`}
          icon="📊"
        />
        <StatCard
          title="Service Fees Paid"
          value={formatCurrency(data.summary.financial.totalServiceFees, currency)}
          subtitle={`${formatCurrency(data.summary.financial.serviceFeesInPeriod, currency)} ${periodLabels[period].toLowerCase()}`}
          icon="📈"
        />
        <StatCard
          title="Load Value"
          value={formatCurrency(data.summary.financial.loadValueInPeriod, currency)}
          subtitle={periodLabels[period].toLowerCase()}
          icon="💳"
        />
      </div>

      {/* Load Stats */}
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
          title="Delivered"
          value={data.summary.loads.delivered.toLocaleString()}
          subtitle={`+${data.summary.loads.deliveredInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="✅"
          trend="up"
        />
        <StatCard
          title="Match Proposals"
          value={data.summary.matches.totalProposals.toLocaleString()}
          subtitle={`+${data.summary.matches.proposalsInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="🤝"
        />
      </div>

      {/* Performance Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RateGauge
          rate={data.summary.rates.completionRate}
          label="Completion Rate"
          color="green"
        />
        <RateGauge
          rate={data.summary.rates.cancellationRate}
          label="Cancellation Rate"
          color="red"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loads Over Time */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Loads Posted</h3>
          <MiniBarChart data={data.charts.loadsOverTime} valueKey="count" color="teal" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            {data.charts.loadsOverTime.length > 0
              ? `${formatDate(data.charts.loadsOverTime[0].date)} - ${formatDate(data.charts.loadsOverTime[data.charts.loadsOverTime.length - 1].date)}`
              : 'No data'}
          </p>
        </div>

        {/* Deliveries Over Time */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Deliveries Completed</h3>
          <MiniBarChart data={data.charts.deliveriesOverTime} valueKey="count" color="green" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            Total: {data.summary.loads.deliveredInPeriod} {periodLabels[period].toLowerCase()}
          </p>
        </div>

        {/* Load Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Load Status Distribution</h3>
          <StatusDistribution data={data.charts.loadsByStatus} />
        </div>

        {/* Spending Over Time */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Service Fee Spending</h3>
          <MiniBarChart data={data.charts.spendingOverTime} valueKey="total" color="yellow" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            Total: {formatCurrency(data.summary.financial.serviceFeesInPeriod, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
