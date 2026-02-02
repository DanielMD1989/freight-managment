/**
 * Admin All Loads Page
 *
 * Platform-wide view of all loads across all shippers
 * Admin oversight and management
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLoadsClient from './AdminLoadsClient';

export const metadata = {
  title: 'All Loads | Admin',
  description: 'Platform-wide load management',
};

export default async function AdminLoadsPage() {
  const session = await requireAuth();

  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/admin');
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">All Loads</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Platform-wide view of all loads across all shippers
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadsSkeleton />}>
        <AdminLoadsClient />
      </Suspense>
    </div>
  );
}

function LoadsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-96"></div>
      <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
    </div>
  );
}
