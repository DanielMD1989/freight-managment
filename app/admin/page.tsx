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
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p
            className={`text-sm mt-1 ${
              trend ? trendColors[trend] : 'text-gray-500'
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
    POSTED: 'bg-blue-100 text-blue-800',
    MATCHED: 'bg-purple-100 text-purple-800',
    IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Loads by Status
      </h3>
      <div className="space-y-3">
        {stats.loadsByStatus.map((item) => (
          <div key={item.status} className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[item.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {item.status.replace(/_/g, ' ')}
            </span>
            <span className="text-lg font-semibold text-gray-900">
              {item._count}
            </span>
          </div>
        ))}
        {stats.loadsByStatus.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Platform overview and key metrics
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <a
              href="/admin/users"
              className="block px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-900">Manage Users</span>
                <span className="text-blue-600">→</span>
              </div>
            </a>
            <a
              href="/admin/verification"
              className="block px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-purple-900">
                  Document Verification
                </span>
                <span className="text-purple-600">→</span>
              </div>
            </a>
            <a
              href="/admin/organizations"
              className="block px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-green-900">
                  Organizations
                </span>
                <span className="text-green-600">→</span>
              </div>
            </a>
            <a
              href="/admin/audit-logs"
              className="block px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">Audit Logs</span>
                <span className="text-gray-600">→</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">API Status: Operational</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">
              Database: Connected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">
              Matching Engine: Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
