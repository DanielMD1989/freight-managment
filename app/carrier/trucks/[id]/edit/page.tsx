/**
 * Edit Truck Page
 *
 * Edit an existing truck or resubmit a rejected truck
 * Sprint 12 - Story 12.2: Truck Management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EditTruckForm from './EditTruckForm';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resubmit?: string }>;
}

/**
 * Fetch truck data
 */
async function getTruck(sessionCookie: string, truckId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/trucks/${truckId}`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching truck:', error);
    return null;
  }
}

/**
 * Edit Truck Page
 */
export default async function EditTruckPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect(`/login?redirect=/carrier/trucks/${resolvedParams.id}/edit`);
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  // Fetch truck data
  const truck = await getTruck(sessionCookie.value, resolvedParams.id);

  if (!truck) {
    redirect('/carrier/trucks?error=truck-not-found');
  }

  const isResubmit = resolvedSearchParams.resubmit === 'true';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isResubmit ? 'Resubmit Truck for Approval' : 'Edit Truck'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isResubmit
            ? 'Update your truck details and resubmit for admin approval'
            : 'Update your truck information'
          }
        </p>
        {truck.approvalStatus === 'REJECTED' && truck.rejectionReason && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Rejection Reason:</p>
            <p className="text-red-700 mt-1">{truck.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Edit Truck Form */}
      <EditTruckForm truck={truck} isResubmit={isResubmit} />
    </div>
  );
}
