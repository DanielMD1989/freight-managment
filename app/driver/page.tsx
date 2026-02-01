/**
 * Driver Dashboard Page
 *
 * Mobile-first dashboard for drivers to view assigned loads and routes
 * Sprint 13 - Story 13.1: Driver Dashboard
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';

interface AssignedLoad {
  id: string;
  status: string;
  pickupDate: string;
  deliveryDate: string;
  cargoDescription: string;
  weight: number;
  pickupCity: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  deliveryCity: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  shipper: {
    name: string;
  };
}

/**
 * Fetch driver's assigned truck and loads
 */
async function getDriverData(userId: string): Promise<{
  truck: any | null;
  loads: AssignedLoad[];
}> {
  try {
    // Find user's assigned truck (drivers might be linked to a specific truck)
    // For now, we'll find trucks where the driver might be assigned via organization
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
      },
    });

    // Get loads assigned to trucks in the driver's organization
    const loads = await db.load.findMany({
      where: {
        status: {
          in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'],
        },
        assignedTruckId: {
          not: null,
        },
        assignedTruck: user?.organizationId
          ? {
              carrierId: user.organizationId,
            }
          : undefined,
      },
      include: {
        pickupLocation: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        deliveryLocation: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        shipper: {
          select: {
            name: true,
          },
        },
        assignedTruck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
          },
        },
      },
      orderBy: {
        pickupDate: 'asc',
      },
      take: 10,
    });

    // Get the truck if any
    const truck = loads.length > 0 ? loads[0].assignedTruck : null;

    const formattedLoads = loads.map((load) => ({
      id: load.id,
      status: load.status,
      pickupDate: load.pickupDate.toISOString(),
      deliveryDate: load.deliveryDate.toISOString(),
      cargoDescription: load.cargoDescription,
      weight: Number(load.weight),
      pickupCity: load.pickupLocation
        ? {
            name: load.pickupLocation.name,
            latitude: Number(load.pickupLocation.latitude),
            longitude: Number(load.pickupLocation.longitude),
          }
        : null,
      deliveryCity: load.deliveryLocation
        ? {
            name: load.deliveryLocation.name,
            latitude: Number(load.deliveryLocation.latitude),
            longitude: Number(load.deliveryLocation.longitude),
          }
        : null,
      pickupAddress: load.pickupAddress,
      deliveryAddress: load.deliveryAddress,
      shipper: {
        name: load.shipper?.name || 'Unknown',
      },
    }));

    return {
      truck,
      loads: formattedLoads,
    };
  } catch (error) {
    console.error('Error fetching driver data:', error);
    return { truck: null, loads: [] };
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ASSIGNED: 'bg-blue-100 text-blue-800',
    IN_TRANSIT: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Driver Dashboard Page
 */
export default async function DriverDashboardPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/driver');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'DRIVER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Fetch driver data
  const { truck, loads } = await getDriverData(session.userId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-First Header */}
      <header className="bg-blue-600 text-white sticky top-0 z-10 shadow-md">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold">Driver App</h1>
            <span className="text-sm bg-blue-700 px-3 py-1 rounded-full">
              {session.email}
            </span>
          </div>
          {truck && (
            <div className="text-sm">
              <span className="opacity-90">Truck: </span>
              <span className="font-semibold">
                {truck.licensePlate} ({truck.truckType.replace(/_/g, ' ')})
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => alert('GPS Navigation coming soon!')}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md active:bg-gray-50"
          >
            <span className="text-3xl mb-2">🗺️</span>
            <span className="text-sm font-medium text-gray-900">Navigation</span>
          </button>

          <button
            onClick={() => alert('Incident Report coming soon!')}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md active:bg-gray-50"
          >
            <span className="text-3xl mb-2">⚠️</span>
            <span className="text-sm font-medium text-gray-900">Report Issue</span>
          </button>
        </div>

        {/* Current Load Status */}
        {loads.length > 0 && loads[0].status === 'IN_TRANSIT' && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🚛</span>
              <h2 className="text-lg font-bold text-green-900">In Transit</h2>
            </div>
            <div className="text-sm text-green-800">
              <div className="font-semibold mb-1">
                {loads[0].pickupCity?.name} → {loads[0].deliveryCity?.name}
              </div>
              <div>Delivery: {formatDate(loads[0].deliveryDate)}</div>
            </div>
            <button
              onClick={() =>
                alert(
                  `Navigate to: ${loads[0].deliveryAddress || loads[0].deliveryCity?.name}`
                )
              }
              className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg font-medium active:bg-green-700"
            >
              Navigate to Delivery
            </button>
          </div>
        )}

        {/* Assigned Loads */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            My Loads ({loads.length})
          </h2>

          {loads.length > 0 ? (
            <div className="space-y-3">
              {loads.map((load) => (
                <div
                  key={load.id}
                  className="bg-white rounded-lg shadow-md p-4 active:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          load.status
                        )}`}
                      >
                        {load.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="text-blue-600">📍</span>
                      <span>{load.pickupCity?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-5 text-xs text-gray-500">
                      {formatDate(load.pickupDate)}
                    </div>

                    <div className="my-2 ml-5 border-l-2 border-gray-300 h-4"></div>

                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="text-red-600">📍</span>
                      <span>{load.deliveryCity?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-5 text-xs text-gray-500">
                      {formatDate(load.deliveryDate)}
                    </div>
                  </div>

                  {/* Cargo Info */}
                  <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                    <div className="text-gray-600">Cargo</div>
                    <div className="font-medium text-gray-900">
                      {load.cargoDescription}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {load.weight.toLocaleString()} kg • {load.shipper.name}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {load.pickupCity && (
                      <button
                        onClick={() =>
                          alert(
                            `Navigate to: ${load.pickupAddress || load.pickupCity?.name || 'Unknown'}`
                          )
                        }
                        className="py-2 px-3 text-sm bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700"
                      >
                        Go to Pickup
                      </button>
                    )}
                    {load.deliveryCity && (
                      <button
                        onClick={() =>
                          alert(
                            `Navigate to: ${load.deliveryAddress || load.deliveryCity?.name || 'Unknown'}`
                          )
                        }
                        className="py-2 px-3 text-sm bg-green-600 text-white rounded-lg font-medium active:bg-green-700"
                      >
                        Go to Delivery
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* No Loads */
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="text-5xl mb-3">📦</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Assigned Loads
              </h3>
              <p className="text-sm text-gray-600">
                Check back later for new load assignments
              </p>
            </div>
          )}
        </div>

        {/* Help & Support */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm">
            Need Help?
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <button
              onClick={() => alert('Calling dispatch: +251-911-XXXXX')}
              className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700"
            >
              📞 Call Dispatch
            </button>
            <Link
              href="/"
              className="block w-full py-2 bg-white text-blue-600 border border-blue-600 rounded-lg font-medium text-center active:bg-blue-50"
            >
              🏠 Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
