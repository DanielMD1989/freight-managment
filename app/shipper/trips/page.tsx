/**
 * Shipper Trip History Page
 *
 * View completed and delivered trips only.
 * Active trips (ASSIGNED, PICKUP_PENDING, IN_TRANSIT) are shown in My Loads.
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ShipperTripsClient from './ShipperTripsClient';

interface Trip {
  id: string;
  loadId: string;
  referenceNumber: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  rate: number | null;
  assignedAt: string | null;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
  } | null;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  } | null;
}

interface TripsResponse {
  loads: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Only completed trip statuses - active trips are in My Loads
const TRIP_STATUSES = ['DELIVERED', 'COMPLETED'];

/**
 * Fetch trips from API
 */
async function getTrips(
  page: number = 1,
  status?: string
): Promise<TripsResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      myLoads: 'true',
    });

    // Filter by trip-related statuses
    if (status && status !== 'all') {
      params.append('status', status);
    } else {
      // Default: show all trip statuses
      params.append('status', TRIP_STATUSES.join(','));
    }

    const response = await fetch(`${baseUrl}/api/loads?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch trips:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching trips:', error);
    return null;
  }
}

/**
 * Shipper Trips Page
 */
export default async function ShipperTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/trips');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Get query parameters
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const status = params.status || 'all';

  // Fetch trips
  const data = await getTrips(page, status);

  // Transform loads to trips format
  const trips: Trip[] = (data?.loads || []).map((load: any) => ({
    id: load.id,
    loadId: load.id,
    referenceNumber: `LOAD-${load.id.slice(-8).toUpperCase()}`,
    status: load.status,
    pickupCity: load.pickupCity || 'Unknown',
    deliveryCity: load.deliveryCity || 'Unknown',
    pickupDate: load.pickupDate,
    deliveryDate: load.deliveryDate,
    truckType: load.truckType,
    weight: load.weight,
    rate: load.rate,
    assignedAt: load.assignedAt || load.updatedAt,
    truck: load.assignedTruck ? {
      id: load.assignedTruck.id,
      licensePlate: load.assignedTruck.licensePlate,
      truckType: load.assignedTruck.truckType,
    } : null,
    carrier: load.assignedTruck?.carrier ? {
      id: load.assignedTruck.carrier.id,
      name: load.assignedTruck.carrier.name,
      isVerified: load.assignedTruck.carrier.isVerified || false,
    } : null,
  }));

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#064d51]">Trip History</h1>
          <p className="text-[#064d51]/70 mt-2">View delivered and completed trips</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-rose-800">
            Failed to load trips. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#064d51]">Trip History</h1>
        <p className="text-[#064d51]/70 mt-2">
          View delivered and completed trips ({data.pagination.total} total)
        </p>
      </div>

      {/* Trips Client Component */}
      <ShipperTripsClient
        initialTrips={trips}
        pagination={data.pagination}
        initialStatus={status}
      />
    </div>
  );
}
