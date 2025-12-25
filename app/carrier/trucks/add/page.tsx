/**
 * Add Truck Page
 *
 * Register a new truck to the carrier's fleet
 * Sprint 12 - Story 12.2: Truck Management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AddTruckForm from './AddTruckForm';

/**
 * Add Truck Page
 */
export default async function AddTruckPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier/trucks/add');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add New Truck</h1>
        <p className="text-gray-600 mt-2">
          Register a new vehicle to your fleet
        </p>
      </div>

      {/* Add Truck Form */}
      <AddTruckForm />
    </div>
  );
}
