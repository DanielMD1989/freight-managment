/**
 * Carrier Dashboard Page
 *
 * Main dashboard for carrier portal showing fleet statistics
 * Sprint 12 - Story 12.1: Carrier Dashboard
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/**
 * Fetch dashboard statistics
 */
async function getDashboardData(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/carrier/dashboard`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch dashboard data:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return null;
  }
}

/**
 * Carrier Dashboard Page
 */
export default async function CarrierDashboardPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Fetch dashboard data
  const dashboardData = await getDashboardData(sessionCookie.value);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Carrier Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage your fleet and track your deliveries
        </p>
      </div>

      {!dashboardData ? (
        /* Error State - No Organization or API Failed */
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Organization Setup Required
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            To access carrier features, you need to set up your organization profile.
            Please complete your organization setup or contact support if you believe
            this is an error.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard/organization/setup"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Setup Organization
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      ) : dashboardData.totalTrucks === 0 ? (
        /* Getting Started - No Trucks */
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🚛</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to Your Carrier Portal
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Get started by adding your first truck to your fleet. Once you have
            trucks registered, you can post their availability, find matching
            loads, and start earning.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/carrier/trucks/add"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Add Your First Truck
            </Link>
            <Link
              href="/carrier/documents"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Upload Documents
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Trucks */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">
                  Total Trucks
                </div>
                <span className="text-2xl">🚛</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {dashboardData?.totalTrucks || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">In your fleet</div>
            </div>

            {/* Active Trucks */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">
                  Active Trucks
                </div>
                <span className="text-2xl">✅</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {dashboardData?.activeTrucks || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Available or in transit
              </div>
            </div>

            {/* Active Postings */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">
                  Active Postings
                </div>
                <span className="text-2xl">📍</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {dashboardData?.activePostings || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Currently available
              </div>
            </div>

            {/* Completed Deliveries */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">
                  Completed Deliveries
                </div>
                <span className="text-2xl">📦</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {dashboardData?.completedDeliveries || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">All time</div>
            </div>
          </div>

          {/* Revenue and Wallet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Total Revenue */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Total Revenue</div>
              <div className="text-4xl font-bold mb-1">
                {formatCurrency(dashboardData?.totalRevenue || 0)}
              </div>
              <div className="text-xs opacity-75">From completed deliveries</div>
            </div>

            {/* Wallet Balance */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Wallet Balance</div>
              <div className="text-4xl font-bold mb-1">
                {formatCurrency(Number(dashboardData?.wallet?.balance || 0))}
              </div>
              <div className="text-xs opacity-75">
                {dashboardData?.wallet?.currency || 'ETB'}
              </div>
              <div className="mt-4">
                <Link
                  href="/carrier/wallet"
                  className="text-sm font-medium underline hover:opacity-80"
                >
                  View Wallet →
                </Link>
              </div>
            </div>
          </div>

          {/* Fleet Status Breakdown */}
          {dashboardData?.trucksByStatus &&
            dashboardData?.trucksByStatus?.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Fleet Status
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {dashboardData?.trucksByStatus?.map(
                    (item: { status: string; count: number }) => (
                      <div key={item.status} className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">
                          {item.count}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.status.replace(/_/g, ' ')}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/carrier/trucks/add"
                className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <span className="text-2xl">➕</span>
                <div>
                  <div className="font-medium text-gray-900">Add Truck</div>
                  <div className="text-sm text-gray-600">
                    Register a new vehicle
                  </div>
                </div>
              </Link>

              <Link
                href="/carrier/postings"
                className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <span className="text-2xl">📍</span>
                <div>
                  <div className="font-medium text-gray-900">Post Truck</div>
                  <div className="text-sm text-gray-600">
                    Make truck available
                  </div>
                </div>
              </Link>

              <Link
                href="/carrier/matches"
                className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <span className="text-2xl">📦</span>
                <div>
                  <div className="font-medium text-gray-900">Find Loads</div>
                  <div className="text-sm text-gray-600">View matching loads</div>
                </div>
              </Link>

              <Link
                href="/carrier/trucks"
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="text-2xl">🚛</span>
                <div>
                  <div className="font-medium text-gray-900">Manage Fleet</div>
                  <div className="text-sm text-gray-600">View all trucks</div>
                </div>
              </Link>

              <Link
                href="/carrier/gps"
                className="flex items-center gap-3 p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
              >
                <span className="text-2xl">🗺️</span>
                <div>
                  <div className="font-medium text-gray-900">GPS Tracking</div>
                  <div className="text-sm text-gray-600">Track locations</div>
                </div>
              </Link>

              <Link
                href="/carrier/documents"
                className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                <span className="text-2xl">📄</span>
                <div>
                  <div className="font-medium text-gray-900">Documents</div>
                  <div className="text-sm text-gray-600">Upload & verify</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          {dashboardData?.recentPostings > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                Recent Activity
              </h3>
              <p className="text-sm text-blue-800">
                You have posted {dashboardData.recentPostings} truck
                {dashboardData.recentPostings === 1 ? '' : 's'} in the last 7
                days.{' '}
                <Link
                  href="/carrier/postings"
                  className="font-medium underline"
                >
                  View all postings
                </Link>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
