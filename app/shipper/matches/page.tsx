/**
 * Truck Matches Page
 *
 * View matching trucks for shipper's posted loads
 * Sprint 11 - Story 11.4: Matching Trucks View
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import TruckMatchesClient from './TruckMatchesClient';

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  rate: number;
  status: string;
}

/**
 * Fetch shipper's posted loads
 */
async function getPostedLoads(organizationId: string): Promise<Load[]> {
  try {
    const loads = await db.load.findMany({
      where: {
        shipperId: organizationId,
        status: 'POSTED',
      },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        pickupDate: true,
        deliveryDate: true,
        truckType: true,
        weight: true,
        rate: true,
        status: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return loads.map((load) => ({
      ...load,
      weight: Number(load.weight),
      rate: Number(load.rate),
    }));
  } catch (error) {
    console.error('Error fetching posted loads:', error);
    return [];
  }
}

/**
 * Truck Matches Page
 */
export default async function TruckMatchesPage({
  searchParams,
}: {
  searchParams: { loadId?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/matches');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/shipper?error=no-organization');
  }

  // Fetch posted loads
  const postedLoads = await getPostedLoads(session.organizationId);

  // Get selected load ID from query param or use first posted load
  const selectedLoadId = searchParams.loadId || postedLoads[0]?.id;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Truck Matches</h1>
        <p className="text-gray-600 mt-2">
          Find available carriers for your posted loads
        </p>
      </div>

      {postedLoads.length === 0 ? (
        /* No Posted Loads */
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🚛</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Posted Loads
          </h3>
          <p className="text-gray-600 mb-6">
            You need to post a load before you can view truck matches.
          </p>
          <a
            href="/shipper/loads/create"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Post a Load
          </a>
        </div>
      ) : (
        /* Truck Matches Client Component */
        <TruckMatchesClient
          postedLoads={postedLoads}
          selectedLoadId={selectedLoadId}
        />
      )}
    </div>
  );
}
