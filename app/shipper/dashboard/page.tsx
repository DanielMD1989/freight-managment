/**
 * Shipper Dashboard Page
 *
 * Professional dashboard for shipper portal
 * Design System: Clean & Minimal with Teal accent
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import ShipperDashboardClient from './ShipperDashboardClient';

export const metadata = {
  title: 'Dashboard | Shipper Portal',
  description: 'Shipper dashboard - manage your loads and shipments',
};

async function getDashboardData(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/shipper/dashboard`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch dashboard:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return null;
  }
}

async function getRecentLoads(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/loads?limit=5&myLoads=true`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.loads || [];
  } catch {
    return [];
  }
}

async function getActiveTrips(sessionCookie: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/map/trips?role=shipper&limit=5`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.trips || [];
  } catch {
    return [];
  }
}

export default async function ShipperDashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/dashboard');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/unauthorized');
  }

  const [dashboardData, recentLoads, activeTrips] = await Promise.all([
    getDashboardData(sessionCookie.value),
    getRecentLoads(sessionCookie.value),
    getActiveTrips(sessionCookie.value),
  ]);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ShipperDashboardClient
        user={session}
        dashboardData={dashboardData}
        recentLoads={recentLoads}
        activeTrips={activeTrips}
      />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2" />
        <div className="h-4 w-64 bg-slate-200 rounded mb-8" />

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 h-32 border border-slate-200/60" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 h-96 border border-slate-200/60" />
          <div className="bg-white rounded-2xl p-6 h-96 border border-slate-200/60" />
        </div>
      </div>
    </div>
  );
}
