'use client';

import { useState, useEffect } from 'react';

type TimePeriod = 'day' | 'week' | 'month' | 'year';

interface AnalyticsData {
  period: TimePeriod;
  dateRange: { start: string; end: string };
  summary: {
    trucks: {
      total: number;
      approved: number;
      pending: number;
      newInPeriod: number;
    };
    truckPostings: {
      active: number;
      createdInPeriod: number;
    };
    loads: {
      total: number;
      assigned: number;
      inTransit: number;
      delivered: number;
      cancelled: number;
      assignedInPeriod: number;
      completedInPeriod: number;
      cancelledInPeriod: number;
    };
    financial: {
      walletBalance: number;
      currency: string;
      totalEarnings: number;
      earningsInPeriod: number;
    };
    proposals: {
      totalSent: number;
      sentInPeriod: number;
      totalAccepted: number;
      acceptedInPeriod: number;
    };
    rates: {
      proposalAcceptRate: number;
      completionRate: number;
    };
  };
  charts: {
    deliveriesOverTime: Array<{ date: string; count: number }>;
    earningsOverTime: Array<{ date: string; total: number }>;
    proposalsOverTime: Array<{ date: string; sent: number; accepted: number }>;
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
    <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#064d51]/70">{title}</h3>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-[#064d51] mt-2">{value}</p>
      {subtitle && (
        <p className={`text-sm mt-1 ${trend ? trendColors[trend] : 'text-[#064d51]/60'}`}>
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
    blue: 'bg-[#1e9c99]',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-rose-500',
    teal: 'bg-[#064d51]',
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
    blue: { bg: 'bg-[#f0fdfa]', text: 'text-[#064d51]', fill: 'bg-[#1e9c99]' },
    teal: { bg: 'bg-[#f0fdfa]', text: 'text-[#064d51]', fill: 'bg-[#1e9c99]' },
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
    POSTED: 'bg-[#1e9c99]',
    ASSIGNED: 'bg-indigo-500',
    IN_TRANSIT: 'bg-amber-500',
    DELIVERED: 'bg-emerald-500',
    COMPLETED: 'bg-[#064d51]',
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
              <span className="text-[#064d51]/70">{statusLabels[item.status] || item.status}</span>
              <span className="font-medium text-[#064d51]">{item.count}</span>
            </div>
            <div className="w-full bg-[#064d51]/10 rounded-full h-2">
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

export default function CarrierAnalyticsClient() {
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/carrier/analytics?period=${period}`);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e9c99]" />
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
          <h1 className="text-2xl font-bold text-[#064d51]">My Analytics</h1>
          <p className="text-[#064d51]/70 mt-1">
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
                  ? 'bg-[#064d51] text-white shadow-md'
                  : 'bg-white text-[#064d51] hover:bg-[#064d51]/10 border border-[#064d51]/20'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Trucks"
          value={data.summary.trucks.total.toLocaleString()}
          subtitle={`${data.summary.trucks.approved} approved, ${data.summary.trucks.pending} pending`}
          icon="🚛"
        />
        <StatCard
          title="Active Postings"
          value={data.summary.truckPostings.active.toLocaleString()}
          subtitle={`+${data.summary.truckPostings.createdInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="📢"
        />
        <StatCard
          title="New Trucks"
          value={data.summary.trucks.newInPeriod.toLocaleString()}
          subtitle={periodLabels[period].toLowerCase()}
          icon="➕"
          trend={data.summary.trucks.newInPeriod > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          title="Wallet Balance"
          value={formatCurrency(data.summary.financial.walletBalance, currency)}
          subtitle="Available balance"
          icon="💰"
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={formatCurrency(data.summary.financial.totalEarnings, currency)}
          subtitle="All time"
          icon="💵"
          trend="up"
        />
        <StatCard
          title="Earnings"
          value={formatCurrency(data.summary.financial.earningsInPeriod, currency)}
          subtitle={periodLabels[period].toLowerCase()}
          icon="📈"
          trend={data.summary.financial.earningsInPeriod > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          title="Total Loads"
          value={data.summary.loads.total.toLocaleString()}
          subtitle={`${data.summary.loads.assignedInPeriod} assigned ${periodLabels[period].toLowerCase()}`}
          icon="📦"
        />
        <StatCard
          title="Completed"
          value={data.summary.loads.delivered.toLocaleString()}
          subtitle={`+${data.summary.loads.completedInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="✅"
          trend="up"
        />
      </div>

      {/* Proposal Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Proposals Sent"
          value={data.summary.proposals.totalSent.toLocaleString()}
          subtitle={`+${data.summary.proposals.sentInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="📤"
        />
        <StatCard
          title="Accepted"
          value={data.summary.proposals.totalAccepted.toLocaleString()}
          subtitle={`+${data.summary.proposals.acceptedInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="✅"
          trend="up"
        />
        <StatCard
          title="In Transit"
          value={data.summary.loads.inTransit.toLocaleString()}
          subtitle="Active deliveries"
          icon="🚚"
        />
        <StatCard
          title="Cancelled"
          value={data.summary.loads.cancelled.toLocaleString()}
          subtitle={`${data.summary.loads.cancelledInPeriod} ${periodLabels[period].toLowerCase()}`}
          icon="❌"
          trend={data.summary.loads.cancelled > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Performance Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RateGauge
          rate={data.summary.rates.proposalAcceptRate}
          label="Proposal Accept Rate"
          color="blue"
        />
        <RateGauge
          rate={data.summary.rates.completionRate}
          label="Delivery Completion Rate"
          color="green"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deliveries Over Time */}
        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">Deliveries Completed</h3>
          <MiniBarChart data={data.charts.deliveriesOverTime} valueKey="count" color="green" />
          <p className="text-sm text-[#064d51]/60 mt-2 text-center">
            {data.charts.deliveriesOverTime.length > 0
              ? `${formatDate(data.charts.deliveriesOverTime[0].date)} - ${formatDate(data.charts.deliveriesOverTime[data.charts.deliveriesOverTime.length - 1].date)}`
              : 'No data'}
          </p>
        </div>

        {/* Earnings Over Time */}
        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">Earnings</h3>
          <MiniBarChart data={data.charts.earningsOverTime} valueKey="total" color="teal" />
          <p className="text-sm text-[#064d51]/60 mt-2 text-center">
            Total: {formatCurrency(data.summary.financial.earningsInPeriod, currency)}
          </p>
        </div>

        {/* Load Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">Load Status Distribution</h3>
          <StatusDistribution data={data.charts.loadsByStatus} />
        </div>

        {/* Proposals Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h3 className="text-lg font-semibold text-[#064d51] mb-4">Proposal Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#f0fdfa] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[#1e9c99] rounded-full" />
                <span className="font-medium text-[#064d51]">Sent ({periodLabels[period].toLowerCase()})</span>
              </div>
              <span className="text-xl font-bold text-[#064d51]">
                {data.summary.proposals.sentInPeriod}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="font-medium text-emerald-900">Accepted ({periodLabels[period].toLowerCase()})</span>
              </div>
              <span className="text-xl font-bold text-emerald-900">
                {data.summary.proposals.acceptedInPeriod}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#064d51]/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[#064d51] rounded-full" />
                <span className="font-medium text-[#064d51]">Accept Rate</span>
              </div>
              <span className="text-xl font-bold text-[#064d51]">
                {data.summary.rates.proposalAcceptRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
