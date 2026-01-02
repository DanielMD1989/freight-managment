/**
 * Carrier Portal Layout
 *
 * Minimal layout for carrier portal without sidebar
 * Sprint 14 - Professional UI Transformation
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

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

  // Check if user is a carrier
  if (session.role !== 'CARRIER' && session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Simple full-width layout without sidebar
  return <>{children}</>;
}
