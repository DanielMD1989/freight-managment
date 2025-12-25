/**
 * Truck Management Page
 *
 * List and manage carrier's truck fleet
 * Sprint 12 - Story 12.2: Truck Management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TruckManagementClient from './TruckManagementClient';

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume: number | null;
  currentCity: string | null;
  currentRegion: string | null;
  isAvailable: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

/**
 * Fetch trucks
 */
async function getTrucks(
  sessionCookie: string,
  page: number = 1,
  truckType?: string,
  status?: string
): Promise<{ trucks: Truck[]; pagination: any } | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      myTrucks: 'true',
      page: page.toString(),
      limit: '20',
    });

    if (truckType && truckType !== 'all') {
      params.set('truckType', truckType);
    }

    const response = await fetch(`${baseUrl}/api/trucks?${params.toString()}`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch trucks:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return null;
  }
}

/**
 * Truck Management Page
 */
export default async function TrucksPage({
  searchParams,
}: {
  searchParams: { page?: string; truckType?: string; status?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier/trucks');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  // Fetch trucks
  const page = parseInt(searchParams.page || '1');
  const truckType = searchParams.truckType;
  const status = searchParams.status;

  const data = await getTrucks(sessionCookie.value, page, truckType, status);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Fleet</h1>
        <p className="text-gray-600 mt-2">Manage your trucks and vehicles</p>
      </div>

      {/* Truck Management Client Component */}
      <TruckManagementClient
        initialTrucks={data?.trucks || []}
        pagination={data?.pagination}
      />
    </div>
  );
}
