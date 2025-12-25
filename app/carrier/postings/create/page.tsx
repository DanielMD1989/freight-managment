/**
 * Create Truck Posting Page
 *
 * Create a new truck posting to find matching loads
 * Sprint 12 - Story 12.3: Truck Posting
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CreatePostingForm from './CreatePostingForm';

/**
 * Fetch carrier's trucks
 */
async function getCarrierTrucks(
  sessionCookie: string
): Promise<any[] | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/trucks?myTrucks=true&limit=100`,
      {
        headers: {
          Cookie: `session=${sessionCookie}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch trucks:', response.status);
      return null;
    }

    const data = await response.json();
    return data.trucks || [];
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return null;
  }
}

/**
 * Create Truck Posting Page
 */
export default async function CreatePostingPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier/postings/create');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  // Fetch carrier's trucks
  const trucks = await getCarrierTrucks(sessionCookie.value);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Truck Posting</h1>
        <p className="text-gray-600 mt-2">
          Make your truck available to find matching loads
        </p>
      </div>

      {trucks && trucks.length === 0 ? (
        /* No Trucks Warning */
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">🚛</div>
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            No Trucks Available
          </h3>
          <p className="text-yellow-800 mb-4">
            You need to add at least one truck to your fleet before creating a posting.
          </p>
          <a
            href="/carrier/trucks/add"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add Your First Truck
          </a>
        </div>
      ) : (
        /* Create Posting Form */
        <CreatePostingForm trucks={trucks || []} />
      )}
    </div>
  );
}
