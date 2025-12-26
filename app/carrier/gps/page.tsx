/**
 * GPS Tracking Page
 *
 * Track truck locations via GPS devices
 * Sprint 12 - Story 12.5: GPS Tracking
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

interface TruckWithGPS {
  id: string;
  licensePlate: string;
  truckType: string;
  isAvailable: boolean;
  currentCity: string | null;
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

/**
 * Fetch trucks with GPS devices
 */
async function getTrucksWithGPS(
  organizationId: string
): Promise<TruckWithGPS[]> {
  try {
    const trucks = await db.truck.findMany({
      where: {
        carrierId: organizationId,
      },
      select: {
        id: true,
        licensePlate: true,
        truckType: true,
        isAvailable: true,
        currentCity: true,
        gpsDevice: {
          select: {
            id: true,
            imei: true,
            status: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: {
        licensePlate: 'asc',
      },
    });

    return trucks as TruckWithGPS[];
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return [];
  }
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getLastSeenStatus(lastSeenAt: string): {
  color: string;
  text: string;
} {
  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const minutesAgo = (now.getTime() - lastSeen.getTime()) / (1000 * 60);

  if (minutesAgo < 10) {
    return { color: 'text-green-600', text: 'Active' };
  } else if (minutesAgo < 60) {
    return { color: 'text-yellow-600', text: `${Math.round(minutesAgo)}m ago` };
  } else if (minutesAgo < 1440) {
    return {
      color: 'text-orange-600',
      text: `${Math.round(minutesAgo / 60)}h ago`,
    };
  } else {
    return {
      color: 'text-red-600',
      text: `${Math.round(minutesAgo / 1440)}d ago`,
    };
  }
}

/**
 * GPS Tracking Page
 */
export default async function GPSTrackingPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier/gps');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  // Fetch trucks
  const trucks = await getTrucksWithGPS(session.organizationId);
  const trucksWithGPS = trucks.filter((truck) => truck.gpsDevice !== null);
  const trucksWithoutGPS = trucks.filter((truck) => truck.gpsDevice === null);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">GPS Tracking</h1>
        <p className="text-gray-600 mt-2">
          Monitor your fleet in real-time with GPS tracking
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Trucks</div>
          <div className="text-3xl font-bold text-gray-900">{trucks.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">GPS Enabled</div>
          <div className="text-3xl font-bold text-green-600">
            {trucksWithGPS.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">No GPS</div>
          <div className="text-3xl font-bold text-gray-600">
            {trucksWithoutGPS.length}
          </div>
        </div>
      </div>

      {/* Trucks with GPS */}
      {trucksWithGPS.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Tracked Trucks ({trucksWithGPS.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {trucksWithGPS.map((truck) => {
              const lastSeenStatus = truck.gpsDevice
                ? getLastSeenStatus(truck.gpsDevice.lastSeenAt)
                : null;

              return (
                <div key={truck.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {truck.licensePlate}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {truck.truckType.replace(/_/g, ' ')}
                      </div>
                    </div>
                    {lastSeenStatus && (
                      <div className={`text-sm font-medium ${lastSeenStatus.color}`}>
                        {lastSeenStatus.text}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">GPS Device</div>
                      <div className="text-sm font-medium text-gray-900">
                        {truck.gpsDevice?.imei}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="text-sm font-medium text-gray-900">
                        {truck.gpsDevice?.status}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Last Location</div>
                      <div className="text-sm font-medium text-gray-900">
                        {truck.currentCity || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {truck.gpsDevice && (
                    <div className="text-xs text-gray-500">
                      Last update: {formatDateTime(truck.gpsDevice.lastSeenAt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trucks without GPS */}
      {trucksWithoutGPS.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Trucks Without GPS ({trucksWithoutGPS.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {trucksWithoutGPS.map((truck) => (
              <div key={truck.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {truck.licensePlate}
                    </h3>
                    <div className="text-sm text-gray-600">
                      {truck.truckType.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">No GPS device assigned</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Trucks */}
      {trucks.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Trucks Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Add trucks to your fleet to start tracking them with GPS.
          </p>
          <a
            href="/carrier/trucks/add"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add Your First Truck
          </a>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          About GPS Tracking
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              GPS devices must be installed and activated on your trucks
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Location updates are received every 5-10 minutes when the truck
              is moving
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Battery level is reported for devices with this capability
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Contact support to register new GPS devices or troubleshoot
              connectivity
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
