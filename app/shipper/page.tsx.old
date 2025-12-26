/**
 * Shipper Dashboard Page
 *
 * Main dashboard for shippers showing load statistics and activity
 * Sprint 11 - Story 11.1: Shipper Dashboard
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface DashboardStats {
  totalLoads: number;
  activeLoads: number;
  completedLoads: number;
  cancelledLoads: number;
  loadsByStatus: Array<{ status: string; count: number }>;
  wallet: {
    balance: number;
    currency: string;
  };
  pendingMatches: number;
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
    const response = await fetch(`${baseUrl}/api/shipper/dashboard`, {
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
  href,
}: {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm mt-1 text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
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
              {item.count}
            </span>
          </div>
        ))}
        {stats.loadsByStatus.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No loads posted yet
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Shipper Dashboard Page
 */
export default async function ShipperDashboard() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Fetch dashboard statistics
  const stats = await getDashboardStats();

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Your shipment overview</p>
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
          Welcome back! Here's your shipment overview.
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Loads"
          value={stats.totalLoads.toLocaleString()}
          icon="📦"
          subtitle="All time"
          href="/shipper/loads"
        />
        <StatCard
          title="Active Loads"
          value={stats.activeLoads.toLocaleString()}
          icon="🚚"
          subtitle="Currently in progress"
          href="/shipper/loads?status=active"
        />
        <StatCard
          title="Completed"
          value={stats.completedLoads.toLocaleString()}
          icon="✅"
          subtitle="Successfully delivered"
          href="/shipper/loads?status=completed"
        />
        <StatCard
          title="Wallet Balance"
          value={formatCurrency(stats.wallet.balance)}
          icon="💰"
          subtitle={stats.wallet.currency}
          href="/shipper/wallet"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Pending Matches"
          value={stats.pendingMatches}
          icon="🔍"
          subtitle="Posted loads awaiting carriers"
          href="/shipper/matches"
        />
        <StatCard
          title="Recent Loads"
          value={stats.recentLoads}
          icon="📅"
          subtitle="Posted in last 7 days"
        />
        <StatCard
          title="Cancelled"
          value={stats.cancelledLoads}
          icon="❌"
          subtitle="Cancelled loads"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Load Status Breakdown */}
        <LoadStatusCard stats={stats} />

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Link
              href="/shipper/loads/create"
              className="block px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-blue-900">
                    Post New Load
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    Create a new shipment posting
                  </p>
                </div>
                <span className="text-blue-600">→</span>
              </div>
            </Link>
            <Link
              href="/shipper/loads"
              className="block px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-purple-900">
                    View All Loads
                  </span>
                  <p className="text-xs text-purple-700 mt-1">
                    Manage your shipments
                  </p>
                </div>
                <span className="text-purple-600">→</span>
              </div>
            </Link>
            <Link
              href="/shipper/matches"
              className="block px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-green-900">
                    View Truck Matches
                  </span>
                  <p className="text-xs text-green-700 mt-1">
                    Find carriers for your loads
                  </p>
                </div>
                <span className="text-green-600">→</span>
              </div>
            </Link>
            <Link
              href="/shipper/documents"
              className="block px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    Upload Documents
                  </span>
                  <p className="text-xs text-gray-700 mt-1">
                    Manage company documents
                  </p>
                </div>
                <span className="text-gray-600">→</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      {stats.totalLoads === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Getting Started
          </h3>
          <p className="text-blue-800 mb-4">
            Welcome to the Freight Platform! Here's how to get started:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>
              <Link href="/shipper/documents" className="underline font-medium">
                Upload your company documents
              </Link>{' '}
              for verification
            </li>
            <li>
              <Link
                href="/shipper/loads/create"
                className="underline font-medium"
              >
                Post your first load
              </Link>{' '}
              with pickup and delivery details
            </li>
            <li>
              Review truck matches and select the best carrier for your shipment
            </li>
            <li>Track your shipment in real-time until delivery</li>
          </ol>
        </div>
      )}
    </div>
  );
}
