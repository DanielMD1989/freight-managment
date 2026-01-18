/**
 * Admin Layout
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Main layout for admin panel with role-aware sidebar and portal header
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import RoleAwareSidebar from '@/components/RoleAwareSidebar';
import PortalHeader from '@/components/PortalHeader';

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

  // Fetch user data for header
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  // Layout with sidebar and header
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <RoleAwareSidebar userRole={session.role} portalType="admin" />
      <div className="flex-1 flex flex-col overflow-auto">
        <PortalHeader
          user={{
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            email: user?.email || '',
            role: session.role,
          }}
          portalPrefix="/admin"
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8" style={{ color: 'var(--foreground)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
