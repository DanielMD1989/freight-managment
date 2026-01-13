/**
 * Shipper DAT-Style Load Board
 *
 * Main entry point for shipper DAT board interface
 * Sprint 14 - DAT-Style UI Transformation
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ShipperDatBoardClient from './ShipperDatBoardClient';

export const metadata = {
  title: 'DAT Load Board - Shipper',
  description: 'Professional DAT-style load board for shippers',
};

export default async function ShipperDatBoardPage() {
  // Get session directly from cookie (robust approach)
  const session = await getSession();

  // Redirect if not authenticated
  if (!session) {
    redirect('/login');
  }

  // Verify shipper role
  if (session.role !== 'SHIPPER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  // Pass user data to client component
  const user = {
    userId: session.userId,
    email: session.email,
    role: session.role,
    status: session.status,
    organizationId: session.organizationId,
  };

  return <ShipperDatBoardClient user={user} />;
}
