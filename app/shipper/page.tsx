/**
 * Shipper Main Page - FreightET Power Interface
 *
 * Main entry point for shipper portal with professional load board
 * Sprint 14 - Professional UI Transformation
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import ShipperDatBoardClient from './dat-board/ShipperDatBoardClient';

export const metadata = {
  title: 'FreightET Power - Shipper Portal',
  description: 'Professional freight load board for shippers',
};

export default async function ShipperPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Return DAT Power interface wrapped in Suspense for useSearchParams
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 animate-pulse" />}>
      <ShipperDatBoardClient user={session} />
    </Suspense>
  );
}
