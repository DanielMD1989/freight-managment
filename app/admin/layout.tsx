/**
 * Admin Layout
 *
 * Main layout for admin panel with role-aware sidebar
 * Sprint 10 - Story 10.1: Admin Dashboard & Layout
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import RoleAwareSidebar from '@/components/RoleAwareSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/unauthorized');
  }

  // Layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950">
      <RoleAwareSidebar userRole={session.role} portalType="admin" />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
