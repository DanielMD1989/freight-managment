/**
 * Load Creation Page
 *
 * Form for shippers to create new load postings
 * Sprint 11 - Story 11.2: Load Creation Form
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoadCreationForm from './LoadCreationForm';

/**
 * Load Creation Page
 */
export default async function CreateLoadPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/loads/create');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/shipper?error=no-organization');
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Post New Load</h1>
        <p className="text-gray-600 mt-2">
          Create a new shipment posting to find available carriers
        </p>
      </div>

      {/* Load Creation Form */}
      <LoadCreationForm />
    </div>
  );
}
