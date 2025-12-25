/**
 * Load Management Page
 *
 * View and manage all loads for shipper
 * Sprint 11 - Story 11.3: Load Management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoadManagementClient from './LoadManagementClient';

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
  cargoDescription: string;
  fullPartial: string;
  createdAt: string;
  updatedAt: string;
}

interface LoadsResponse {
  loads: Load[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Fetch loads from API
 */
async function getLoads(
  page: number = 1,
  status?: string
): Promise<LoadsResponse | null> {
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
    });

    if (status && status !== 'all') {
      params.append('status', status.toUpperCase());
    }

    const response = await fetch(`${baseUrl}/api/loads?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch loads:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching loads:', error);
    return null;
  }
}

/**
 * Load Management Page
 */
export default async function LoadsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/loads');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Get query parameters
  const page = parseInt(searchParams.page || '1');
  const status = searchParams.status || 'all';

  // Fetch loads
  const data = await getLoads(page, status);

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Loads</h1>
          <p className="text-gray-600 mt-2">Manage your shipment postings</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Failed to load your loads. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Loads</h1>
          <p className="text-gray-600 mt-2">
            Manage your shipment postings ({data.pagination.total} total)
          </p>
        </div>
        <a
          href="/shipper/loads/create"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          + Post New Load
        </a>
      </div>

      {/* Load Management Client Component */}
      <LoadManagementClient
        initialLoads={data.loads}
        pagination={data.pagination}
        initialStatus={status}
      />
    </div>
  );
}
