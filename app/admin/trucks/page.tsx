/**
 * Admin All Trucks Page
 *
 * Platform-wide view of all trucks across all carriers
 * Admin oversight and management
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminTrucksClient from './AdminTrucksClient';

export const metadata = {
  title: 'All Trucks | Admin',
  description: 'Platform-wide truck management',
};

export default async function AdminTrucksPage() {
  const session = await requireAuth();

  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/admin');
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">All Trucks</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Platform-wide view of all trucks across all carriers
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<TrucksSkeleton />}>
        <AdminTrucksClient />
      </Suspense>
    </div>
  );
}

function TrucksSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-96"></div>
      <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
    </div>
  );
}
