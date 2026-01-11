/**
 * Shipper Portal Layout
 *
 * Layout with role-aware sidebar navigation
 * Sprint 14 - Professional UI Transformation
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import RoleAwareSidebar from '@/components/RoleAwareSidebar';

export default async function ShipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect('/login?redirect=/shipper');
  }

  // Check if user is a shipper or admin
  if (session.role !== 'SHIPPER' && session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Layout with sidebar
  return (
    <div className="flex min-h-screen bg-gray-50">
      <RoleAwareSidebar userRole={session.role} portalType="shipper" />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
