/**
 * Shipper Portal Layout
 *
 * Minimal layout for shipper portal without sidebar
 * Sprint 14 - Professional UI Transformation
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

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

  // Check if user is a shipper
  if (session.role !== 'SHIPPER' && session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Simple full-width layout without sidebar
  return <>{children}</>;
}
