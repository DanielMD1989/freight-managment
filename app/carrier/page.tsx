/**
 * Carrier Main Page - FreightET Power Interface
 *
 * Main entry point for carrier portal with professional load board
 * Sprint 14 - Professional UI Transformation
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import CarrierLoadboardClient from './loadboard/CarrierLoadboardClient';

export const metadata = {
  title: 'FreightET - Carrier Portal',
  description: 'Professional freight load board for carriers',
};

export default async function CarrierPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  // Return load board interface wrapped in Suspense for useSearchParams
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 animate-pulse" />}>
      <CarrierLoadboardClient user={session} />
    </Suspense>
  );
}
