/**
 * Platform Operations Dashboard
 *
 * Comprehensive operations dashboard for platform management
 * Sprint 13 - Story 13.2: Platform Ops Dashboard
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';

/**
 * Fetch operational statistics
 */
async function getOperationalStats() {
  try {
    const [
      totalLoads,
      activeLoads,
      totalTrucks,
      activeTrucks,
      pendingDocuments,
      activeDisputes,
      recentLoads,
      trucksWithGPS,
    ] = await Promise.all([
      // Total loads
      db.load.count(),

      // Active loads (in transit or assigned)
      db.load.count({
        where: {
          status: {
            in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'],
          },
        },
      }),

      // Total trucks
      db.truck.count(),

      // Active trucks
      db.truck.count({
        where: {
          status: {
            in: ['ACTIVE', 'IN_TRANSIT'],
          },
        },
      }),

      // Pending documents
      db.document.count({
        where: {
          verificationStatus: 'PENDING',
        },
      }),

      // Active disputes (you'd need a Dispute model for this)
      0, // Placeholder

      // Recent loads (last 24 hours)
      db.load.count({
        where: {
          postedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Trucks with GPS
      db.truck.count({
        where: {
          gpsDeviceId: {
            not: null,
          },
        },
      }),
    ]);

    return {
      totalLoads,
      activeLoads,
      totalTrucks,
      activeTrucks,
      pendingDocuments,
      activeDisputes,
      recentLoads,
      trucksWithGPS,
    };
  } catch (error) {
    console.error('Error fetching operational stats:', error);
    return {
      totalLoads: 0,
      activeLoads: 0,
      totalTrucks: 0,
      activeTrucks: 0,
      pendingDocuments: 0,
      activeDisputes: 0,
      recentLoads: 0,
      trucksWithGPS: 0,
    };
  }
}

/**
 * Fetch active loads for dispatch board
 */
async function getDispatchBoard() {
  try {
    const loads = await db.load.findMany({
      where: {
        status: {
          in: ['POSTED', 'ASSIGNED', 'IN_TRANSIT'],
        },
      },
      include: {
        pickupCityLocation: {
          select: {
            name: true,
          },
        },
        deliveryCityLocation: {
          select: {
            name: true,
          },
        },
        shipper: {
          select: {
            name: true,
          },
        },
        assignedTruck: {
          select: {
            licensePlate: true,
            carrier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        pickupDate: 'asc',
      },
      take: 20,
    });

    return loads;
  } catch (error) {
    console.error('Error fetching dispatch board:', error);
    return [];
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    POSTED: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-yellow-100 text-yellow-800',
    IN_TRANSIT: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Platform Ops Dashboard Page
 */
export default async function OpsDashboardPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/ops');
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== 'PLATFORM_OPS' && session.role !== 'ADMIN')
  ) {
    redirect('/unauthorized');
  }

  // Fetch data
  const stats = await getOperationalStats();
  const dispatchBoard = await getDispatchBoard();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Platform Operations
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage dispatch, documents, and operations
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{session.email}</span>
              <span className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                {session.role}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {/* Operational Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Active Loads</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.activeLoads}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              of {stats.totalLoads} total
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Active Trucks</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.activeTrucks}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              of {stats.totalTrucks} total
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Pending Docs</div>
            <div className="text-3xl font-bold text-yellow-600">
              {stats.pendingDocuments}
            </div>
            <div className="text-xs text-gray-500 mt-1">Need review</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">GPS Tracked</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.trucksWithGPS}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.totalTrucks > 0
                ? Math.round((stats.trucksWithGPS / stats.totalTrucks) * 100)
                : 0}
              % coverage
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/admin/documents"
              className="flex flex-col items-center justify-center p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2">📄</span>
              <span className="text-sm font-medium text-gray-900">
                Verify Docs
              </span>
              {stats.pendingDocuments > 0 && (
                <span className="mt-1 px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {stats.pendingDocuments}
                </span>
              )}
            </Link>

            <Link
              href="/admin/gps"
              className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2">🗺️</span>
              <span className="text-sm font-medium text-gray-900">
                GPS Tracking
              </span>
            </Link>

            <Link
              href="/admin/organizations"
              className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2">🏢</span>
              <span className="text-sm font-medium text-gray-900">
                Organizations
              </span>
            </Link>

            <Link
              href="/admin/users"
              className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <span className="text-3xl mb-2">👥</span>
              <span className="text-sm font-medium text-gray-900">Users</span>
            </Link>
          </div>
        </div>

        {/* Dispatch Board */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Dispatch Board ({dispatchBoard.length})
            </h2>
          </div>

          {dispatchBoard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pickup
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipper
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Truck
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dispatchBoard.map((load) => (
                    <tr key={load.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            load.status
                          )}`}
                        >
                          {load.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {load.pickupCityLocation?.name || load.pickupCity} →{' '}
                          {load.deliveryCityLocation?.name || load.deliveryCity}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(load.pickupDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {load.shipper?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {load.assignedTruck ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {load.assignedTruck.licensePlate}
                            </div>
                            <div className="text-xs text-gray-500">
                              {load.assignedTruck.carrier?.name}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">
                            Unassigned
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/admin/loads/${load.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Active Dispatches
              </h3>
              <p className="text-gray-600">All loads are currently cleared</p>
            </div>
          )}
        </div>

        {/* System Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin"
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">Admin Panel</div>
              <div className="text-sm text-gray-600">Full system access</div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>

          <Link
            href="/admin/loads"
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">All Loads</div>
              <div className="text-sm text-gray-600">
                {stats.totalLoads} total
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>

          <Link
            href="/admin/trucks"
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">All Trucks</div>
              <div className="text-sm text-gray-600">
                {stats.totalTrucks} total
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
