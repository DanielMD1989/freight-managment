/**
 * Carrier DAT-Style Load Board
 *
 * Main entry point for carrier interface with professional DAT-style UI
 * Sprint 14 - DAT-Style UI Transformation
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import CarrierDatBoardClient from './CarrierDatBoardClient';

export const metadata = {
  title: 'Carrier Dashboard - Load Board',
  description: 'Professional DAT-style load board for carriers',
};

export default async function CarrierPage() {
  // Get auth from headers (set by middleware)
  const headersList = await headers();
  const userHeader = headersList.get('x-user-data');

  // Redirect if not authenticated
  if (!userHeader) {
    redirect('/login');
  }

  // Parse user data
  const user = JSON.parse(userHeader);

  // Verify carrier role
  if (user.role !== 'CARRIER' && user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <CarrierDatBoardClient user={user} />;
}
