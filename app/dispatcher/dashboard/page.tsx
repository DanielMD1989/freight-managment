/**
 * Dispatcher Dashboard
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 * Sprint 20 - Dashboard optimization: server-side data fetching
 *
 * System-wide view of all loads and trucks for dispatchers
 * - View all loads (any organization)
 * - View all trucks (any organization)
 * - Assign loads to trucks
 * - Access GPS tracking for all active loads
 * - Filter and search capabilities
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import DispatcherDashboardClient from './DispatcherDashboardClient';

export const metadata: Metadata = {
  title: 'Dispatcher Dashboard - Freight Management',
  description: 'System-wide dispatcher dashboard for load and truck management',
};

interface DashboardStats {
  postedLoads: number;
  assignedLoads: number;
  inTransitLoads: number;
  availableTrucks: number;
  deliveriesToday: number;
  onTimeRate: number;
  alertCount: number;
}

interface PickupToday {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  status: string;
  truckType: string;
}

interface DashboardData {
  stats: DashboardStats;
  pickupsToday: PickupToday[];
}

async function fetchDashboardData(): Promise<DashboardData | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const csrfCookie = cookieStore.get('csrf_token');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/dispatcher/dashboard`, {
      headers: {
        Cookie: `session=${sessionCookie.value}${csrfCookie ? `; csrf_token=${csrfCookie.value}` : ''}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch dispatcher dashboard:', response.status);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching dispatcher dashboard:', error);
    return null;
  }
}

export default async function DispatcherDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only DISPATCHER, PLATFORM_OPS, and ADMIN can access
  if (
    user.role !== 'DISPATCHER' &&
    user.role !== 'SUPER_ADMIN' &&
    user.role !== 'ADMIN'
  ) {
    redirect('/unauthorized');
  }

  // Fetch dashboard data server-side
  const dashboardData = await fetchDashboardData();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Dispatcher Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            System-wide view of all loads and trucks
          </p>
        </div>

        {/* Client Component */}
        <DispatcherDashboardClient
          user={{
            userId: user.id,
            email: user.email,
            role: user.role,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
          }}
          dashboardData={dashboardData}
        />
      </div>
    </div>
  );
}
