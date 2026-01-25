/**
 * Admin Dashboard Page
 *
 * Sprint 20 - Dashboard Visual Redesign
 * Clean, minimal, well-proportioned design
 *
 * Stats: Users, Organizations, Loads, Trucks, Revenue, Escrow, Withdrawals, Disputes
 * Quick Actions: Manage Users, Verification, Organizations, Audit Logs
 * Sections: Load Status, Quick Actions, System Status
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  StatCard,
  QuickActionLink,
  PackageIcon,
  TruckIcon,
  CurrencyIcon,
  ClockIcon,
  AlertIcon,
  UsersIcon,
  BuildingIcon,
  LockIcon,
  CheckIcon,
} from '@/components/dashboard';
import { formatCurrency } from '@/lib/formatters';

/**
 * Dashboard Statistics Interface
 */
interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalLoads: number;
  totalTrucks: number;
  activeLoads: number;
  totalRevenue: { balance: number };
  escrowBalance: { balance: number };
  pendingWithdrawals: number;
  openDisputes: number;
  loadsByStatus: Array<{ status: string; _count: number }>;
  recentUsers: number;
  recentLoads: number;
}

/**
 * Fetch dashboard statistics from API
 */
async function getDashboardStats(): Promise<DashboardStats | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch dashboard stats:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }
}


/**
 * Load Status Breakdown
 */
function LoadStatusCard({ stats }: { stats: DashboardStats }) {
  const statusStyles: Record<string, string> = {
    POSTED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    MATCHED: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    ASSIGNED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    IN_TRANSIT: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    DELIVERED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    COMPLETED: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          Loads by Status
        </h3>
      </div>
      <div className="p-6 space-y-3">
        {stats.loadsByStatus.map((item) => (
          <div key={item.status} className="flex items-center justify-between">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                statusStyles[item.status] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.status.replace(/_/g, ' ')}
            </span>
            <span
              className="text-lg font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {item._count}
            </span>
          </div>
        ))}
        {stats.loadsByStatus.length === 0 && (
          <p
            className="text-sm text-center py-4"
            style={{ color: 'var(--foreground-muted)' }}
          >
            No loads yet
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Admin Dashboard Page
 */
export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  const stats = await getDashboardStats();

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const adminName = session.firstName || session.email?.split('@')[0] || 'Admin';

  if (!stats) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-8">
            <h1
              className="text-2xl lg:text-[28px] font-bold tracking-tight"
              style={{ color: 'var(--foreground)' }}
            >
              Dashboard
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {today}
            </p>
          </div>
          <div
            className="rounded-xl border p-4"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--error-500)',
            }}
          >
            <p style={{ color: 'var(--error-500)' }}>
              Failed to load dashboard statistics. Please try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-2xl lg:text-[28px] font-bold tracking-tight"
            style={{ color: 'var(--foreground)' }}
          >
            Welcome back, {adminName}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {today} - Platform overview and key metrics
          </p>
        </div>

        {/* Key Metrics Grid - 4 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5 mb-6">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={<UsersIcon />}
            color="primary"
            trend={{ value: `${stats.recentUsers} this week`, positive: true }}
          />
          <StatCard
            title="Organizations"
            value={stats.totalOrganizations.toLocaleString()}
            icon={<BuildingIcon />}
            color="secondary"
            subtitle="Active companies"
          />
          <StatCard
            title="Total Loads"
            value={stats.totalLoads.toLocaleString()}
            icon={<PackageIcon />}
            color="accent"
            subtitle={`${stats.activeLoads} active`}
          />
          <StatCard
            title="Total Trucks"
            value={stats.totalTrucks.toLocaleString()}
            icon={<TruckIcon />}
            color="success"
            subtitle="Registered vehicles"
          />
        </div>

        {/* Financial Metrics - 4 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5 mb-8">
          <StatCard
            title="Platform Revenue"
            value={formatCurrency(stats.totalRevenue.balance)}
            icon={<CurrencyIcon />}
            color="success"
            trend={{ value: 'Total earnings', positive: true }}
          />
          <StatCard
            title="Escrow Balance"
            value={formatCurrency(stats.escrowBalance.balance)}
            icon={<LockIcon />}
            color="secondary"
            subtitle="Held in escrow"
          />
          <StatCard
            title="Pending Withdrawals"
            value={stats.pendingWithdrawals}
            icon={<ClockIcon />}
            color="warning"
            subtitle="Awaiting approval"
          />
          <StatCard
            title="Open Disputes"
            value={stats.openDisputes}
            icon={<AlertIcon />}
            color="error"
            subtitle="Require attention"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Load Status Breakdown */}
          <LoadStatusCard stats={stats} />

          {/* Quick Actions */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Quick Actions
              </h3>
            </div>
            <div className="p-4 space-y-2">
              <QuickActionLink
                href="/admin/users"
                label="Manage Users"
                description="View and manage platform users"
                color="primary"
              />
              <QuickActionLink
                href="/admin/verification"
                label="Document Verification"
                description="Review pending verifications"
                color="secondary"
              />
              <QuickActionLink
                href="/admin/organizations"
                label="Organizations"
                description="Manage carrier and shipper orgs"
                color="success"
              />
              <QuickActionLink
                href="/admin/audit-logs"
                label="Audit Logs"
                description="View system activity logs"
                color="accent"
              />
            </div>
          </div>
        </div>

        {/* System Status */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h3
              className="text-base font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              System Status
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  API Status: Operational
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Database: Connected
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Matching Engine: Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Sections Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Pending Approvals */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Pending Approvals
              </h3>
              <Link
                href="/admin/verification"
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--primary-500)' }}
              >
                View All
              </Link>
            </div>
            <div className="p-4">
              {stats.pendingWithdrawals > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tinted)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                        <ClockIcon />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Withdrawals</p>
                        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Awaiting approval</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {stats.pendingWithdrawals}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                    <CheckIcon />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No pending approvals</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Recent Activity
              </h3>
              <Link
                href="/admin/audit-logs"
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--primary-500)' }}
              >
                View Logs
              </Link>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-primary-500" />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {stats.recentUsers} new users this week
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                      User registrations
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-accent-500" />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {stats.recentLoads} new loads this week
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                      Load postings
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-emerald-500" />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {stats.totalOrganizations} active organizations
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                      Carriers & Shippers
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Overview */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Platform Overview
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* User Growth */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>User Growth</span>
                  <span className="text-xs font-medium text-emerald-500">+{stats.recentUsers} this week</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tinted)' }}>
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${Math.min((stats.recentUsers / Math.max(stats.totalUsers, 1)) * 100 * 10, 100)}%` }}
                  />
                </div>
              </div>

              {/* Load Activity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Load Activity</span>
                  <span className="text-xs font-medium text-accent-500">{stats.activeLoads} active</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tinted)' }}>
                  <div
                    className="h-full rounded-full bg-accent-500"
                    style={{ width: `${Math.min((stats.activeLoads / Math.max(stats.totalLoads, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Revenue */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Revenue</span>
                  <span className="text-xs font-medium text-emerald-500">{formatCurrency(stats.totalRevenue.balance)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tinted)' }}>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: '75%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
