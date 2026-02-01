/**
 * Dispatcher Escalations Page
 *
 * View and manage escalations for all loads in the system
 * Dispatchers can track issues and escalate to admin when needed
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EscalationsClient from './EscalationsClient';

export default async function DispatcherEscalationsPage() {
  const session = await requireAuth();

  if (session.role !== 'DISPATCHER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/dispatcher');
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md shadow-red-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Escalations</h1>
            <p className="text-slate-500 text-sm">
              Monitor and manage issues that need attention. Escalate critical issues to admin.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<EscalationsSkeleton />}>
        <EscalationsClient />
      </Suspense>
    </div>
  );
}

function EscalationsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="h-20 bg-gray-200 rounded-xl"></div>
        <div className="h-20 bg-gray-200 rounded-xl"></div>
        <div className="h-20 bg-gray-200 rounded-xl"></div>
        <div className="h-20 bg-gray-200 rounded-xl"></div>
      </div>
      <div className="h-16 bg-gray-200 rounded-2xl"></div>
      <div className="h-96 bg-gray-200 rounded-2xl"></div>
    </div>
  );
}
