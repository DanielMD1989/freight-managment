/**
 * DAT Board Layout
 *
 * Full-width layout without sidebar for DAT Power interface
 * Sprint 14 - DAT-Style UI Transformation
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const metadata = {
  title: 'DAT Power - Shipper Portal',
  description: 'Professional DAT-style load board',
};

export default async function DatBoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/dat-board');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect('/login?redirect=/shipper/dat-board');
  }

  // Check if user is a shipper or admin
  if (session.role !== 'SHIPPER' && session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Full-width layout without sidebar
  return <>{children}</>;
}
