/**
 * Dispatcher Trips Page
 *
 * Full view of all active trips in the system
 * Dispatchers can monitor trip status and GPS tracking
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TripsClient from './TripsClient';

export default async function DispatcherTripsPage() {
  const session = await requireAuth();

  if (session.role !== 'DISPATCHER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/dispatcher');
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Active Trips</h1>
            <p className="text-slate-500 text-sm">
              Monitor all trips in the system. Track GPS status and delivery progress.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<TripsSkeleton />}>
        <TripsClient />
      </Suspense>
    </div>
  );
}

function TripsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-16 bg-gray-200 rounded-2xl"></div>
      <div className="h-96 bg-gray-200 rounded-2xl"></div>
    </div>
  );
}
