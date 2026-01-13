/**
 * Carrier DAT-Style Load Board
 *
 * Main entry point for carrier DAT board interface
 * Sprint 14 - DAT-Style UI Transformation (Phase 4)
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import CarrierDatBoardClient from './CarrierDatBoardClient';

export const metadata = {
  title: 'DAT Load Board - Carrier',
  description: 'Professional DAT-style load board for carriers',
};

export default async function CarrierDatBoardPage() {
  // Get session directly from cookie (robust approach)
  const session = await getSession();

  // Redirect if not authenticated
  if (!session) {
    redirect('/login');
  }

  // Verify carrier role
  if (session.role !== 'CARRIER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
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

  return <CarrierDatBoardClient user={user} />;
}
