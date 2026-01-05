/**
 * Dispatcher Portal Layout
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * Layout for dispatcher portal with role-aware sidebar
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import RoleAwareSidebar from '@/components/RoleAwareSidebar';

export default async function DispatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/dispatcher');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect('/login?redirect=/dispatcher');
  }

  // Check if user has dispatcher privileges
  if (
    session.role !== 'DISPATCHER' &&
    session.role !== 'SUPER_ADMIN' &&
    session.role !== 'ADMIN'
  ) {
    redirect('/unauthorized');
  }

  // Layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
      <RoleAwareSidebar userRole={session.role} portalType="dispatcher" />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
