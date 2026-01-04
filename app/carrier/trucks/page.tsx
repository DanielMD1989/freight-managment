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
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  rejectionReason: string | null;
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
 * Fetch trucks with optional approval status filter
 */
async function getTrucks(
  sessionCookie: string,
  page: number = 1,
  truckType?: string,
  status?: string,
  approvalStatus?: string
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

    // Sprint 18: Filter by approval status
    if (approvalStatus) {
      params.set('approvalStatus', approvalStatus);
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
 * Sprint 18: Shows approved trucks + pending approval section
 */
export default async function TrucksPage({
  searchParams,
}: {
  searchParams: { page?: string; truckType?: string; status?: string; tab?: string };
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

  // Parse params
  const page = parseInt(searchParams.page || '1');
  const truckType = searchParams.truckType;
  const status = searchParams.status;
  const activeTab = searchParams.tab || 'approved';

  // Sprint 18: Fetch approved and pending trucks separately
  const [approvedData, pendingData, rejectedData] = await Promise.all([
    getTrucks(sessionCookie.value, activeTab === 'approved' ? page : 1, truckType, status, 'APPROVED'),
    getTrucks(sessionCookie.value, activeTab === 'pending' ? page : 1, undefined, undefined, 'PENDING'),
    getTrucks(sessionCookie.value, activeTab === 'rejected' ? page : 1, undefined, undefined, 'REJECTED'),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Fleet</h1>
        <p className="text-gray-600 mt-2">Manage your trucks and vehicles</p>
      </div>

      {/* Truck Management Client Component */}
      <TruckManagementClient
        initialApprovedTrucks={approvedData?.trucks || []}
        initialPendingTrucks={pendingData?.trucks || []}
        initialRejectedTrucks={rejectedData?.trucks || []}
        approvedPagination={approvedData?.pagination}
        pendingPagination={pendingData?.pagination}
        rejectedPagination={rejectedData?.pagination}
        initialTab={activeTab}
      />
    </div>
  );
}
