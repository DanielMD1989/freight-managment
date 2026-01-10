/**
 * Admin Dashboard Page
 *
 * Main dashboard for platform administrators showing key metrics
 * Sprint 10 - Story 10.1: Admin Dashboard & Layout
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
      cache: 'no-store', // Always get fresh data
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
 * Format currency for Ethiopian Birr
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Stat Card Component
 */
function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
}: {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-[var(--success-600)]',
    down: 'text-[var(--error-600)]',
    neutral: 'text-[var(--foreground-muted)]',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[var(--foreground-muted)]">{title}</h3>
        <div className="w-10 h-10 rounded-lg bg-[var(--primary-50)] flex items-center justify-center text-xl">
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-[var(--foreground)]">{value}</p>
        {subtitle && (
          <p
            className={`text-sm mt-1 ${
              trend ? trendColors[trend] : 'text-[var(--foreground-muted)]'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Load Status Card Component
 */
function LoadStatusCard({ stats }: { stats: DashboardStats }) {
  const statusColors: Record<string, string> = {
    POSTED: 'bg-[var(--primary-100)] text-[var(--primary-700)]',
    MATCHED: 'bg-[var(--secondary-100)] text-[var(--secondary-700)]',
    IN_TRANSIT: 'bg-[var(--warning-100)] text-[var(--warning-700)]',
    DELIVERED: 'bg-[var(--success-100)] text-[var(--success-700)]',
    COMPLETED: 'bg-[var(--neutral-100)] text-[var(--neutral-700)]',
    CANCELLED: 'bg-[var(--error-100)] text-[var(--error-700)]',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        Loads by Status
      </h3>
      <div className="space-y-3">
        {stats.loadsByStatus.map((item) => (
          <div key={item.status} className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[item.status] || 'bg-[var(--neutral-100)] text-[var(--neutral-700)]'
              }`}
            >
              {item.status.replace(/_/g, ' ')}
            </span>
            <span className="text-lg font-semibold text-[var(--foreground)]">
              {item._count}
            </span>
          </div>
        ))}
        {stats.loadsByStatus.length === 0 && (
          <p className="text-sm text-[var(--foreground-muted)] text-center py-4">
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
  // Verify authentication (redundant with layout, but good practice)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Fetch dashboard statistics
  const stats = await getDashboardStats();

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Dashboard</h1>
          <p className="text-[var(--foreground-muted)] mt-2">
            Platform overview and key metrics
          </p>
        </div>
        <div className="bg-[var(--error-50)] border border-[var(--error-200)] rounded-xl p-4">
          <p className="text-[var(--error-700)]">
            Failed to load dashboard statistics. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Dashboard</h1>
        <p className="text-[var(--foreground-muted)] mt-2">
          Welcome back! Here's what's happening on the platform.
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon="👥"
          subtitle={`+${stats.recentUsers} this week`}
          trend="up"
        />
        <StatCard
          title="Organizations"
          value={stats.totalOrganizations.toLocaleString()}
          icon="🏢"
          subtitle="Active companies"
        />
        <StatCard
          title="Total Loads"
          value={stats.totalLoads.toLocaleString()}
          icon="📦"
          subtitle={`${stats.activeLoads} active`}
          trend={stats.activeLoads > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          title="Total Trucks"
          value={stats.totalTrucks.toLocaleString()}
          icon="🚛"
          subtitle="Registered vehicles"
        />
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Platform Revenue"
          value={formatCurrency(stats.totalRevenue.balance)}
          icon="💰"
          subtitle="Total earnings"
          trend="up"
        />
        <StatCard
          title="Escrow Balance"
          value={formatCurrency(stats.escrowBalance.balance)}
          icon="🔒"
          subtitle="Held in escrow"
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats.pendingWithdrawals}
          icon="⏳"
          subtitle="Awaiting approval"
          trend={stats.pendingWithdrawals > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          title="Open Disputes"
          value={stats.openDisputes}
          icon="⚠️"
          subtitle="Require attention"
          trend={stats.openDisputes > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Load Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <LoadStatusCard stats={stats} />

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <a
              href="/admin/users"
              className="block px-4 py-3 bg-[var(--primary-50)] hover:bg-[var(--primary-100)] rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--primary-700)]">Manage Users</span>
                <span className="text-[var(--primary-600)]">→</span>
              </div>
            </a>
            <a
              href="/admin/verification"
              className="block px-4 py-3 bg-[var(--secondary-50)] hover:bg-[var(--secondary-100)] rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--secondary-700)]">
                  Document Verification
                </span>
                <span className="text-[var(--secondary-600)]">→</span>
              </div>
            </a>
            <a
              href="/admin/organizations"
              className="block px-4 py-3 bg-[var(--success-50)] hover:bg-[var(--success-100)] rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--success-700)]">
                  Organizations
                </span>
                <span className="text-[var(--success-600)]">→</span>
              </div>
            </a>
            <a
              href="/admin/audit-logs"
              className="block px-4 py-3 bg-[var(--neutral-50)] hover:bg-[var(--neutral-100)] rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--foreground)]">Audit Logs</span>
                <span className="text-[var(--foreground-muted)]">→</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          System Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[var(--success-500)] rounded-full animate-pulse"></div>
            <span className="text-sm text-[var(--foreground-secondary)]">API Status: Operational</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[var(--success-500)] rounded-full animate-pulse"></div>
            <span className="text-sm text-[var(--foreground-secondary)]">
              Database: Connected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[var(--success-500)] rounded-full animate-pulse"></div>
            <span className="text-sm text-[var(--foreground-secondary)]">
              Matching Engine: Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
