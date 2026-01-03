/**
 * Carrier Portal Layout
 *
 * Layout with role-aware sidebar navigation
 * Sprint 14 - Professional UI Transformation
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import RoleAwareSidebar from '@/components/RoleAwareSidebar';

export default async function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect('/login?redirect=/carrier');
  }

  // Check if user is a carrier or admin
  if (session.role !== 'CARRIER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  // Layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50">
      <RoleAwareSidebar userRole={session.role} portalType="carrier" />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
