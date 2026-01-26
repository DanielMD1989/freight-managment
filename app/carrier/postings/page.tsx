/**
 * Truck Postings Page
 *
 * View and manage truck postings
 * Sprint 12 - Story 12.3: Truck Posting
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TruckPostingsClient from './TruckPostingsClient';

interface TruckPosting {
  id: string;
  status: string;
  availableFrom: string;
  availableTo: string | null;
  fullPartial: string;
  contactName: string;
  contactPhone: string;
  notes: string | null;
  postedAt: string;
  truck: {
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  originCity: {
    name: string;
    region: string;
  };
  destinationCity: {
    name: string;
    region: string;
  } | null;
  carrier: {
    name: string;
    isVerified: boolean;
  };
}

/**
 * Fetch truck postings
 */
async function getTruckPostings(
  sessionCookie: string,
  organizationId: string,
  status?: string
): Promise<{ postings: TruckPosting[]; total: number } | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      organizationId,
      limit: '50',
    });

    if (status && status !== 'all') {
      params.set('status', status);
    }

    const response = await fetch(
      `${baseUrl}/api/truck-postings?${params.toString()}`,
      {
        headers: {
          Cookie: `session=${sessionCookie}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch truck postings:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching truck postings:', error);
    return null;
  }
}

/**
 * Truck Postings Page
 */
export default async function TruckPostingsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier/postings');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  // Fetch truck postings
  const status = searchParams.status;
  const data = await getTruckPostings(
    sessionCookie.value,
    session.organizationId,
    status
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-teal-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Truck Postings</h1>
            <p className="text-slate-500 text-sm">Manage your available truck listings</p>
          </div>
        </div>
      </div>

      {/* Truck Postings Client Component */}
      <TruckPostingsClient
        initialPostings={data?.postings || []}
        total={data?.total || 0}
      />
    </div>
  );
}
