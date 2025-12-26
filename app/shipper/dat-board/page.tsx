/**
 * Shipper DAT-Style Load Board
 *
 * Main entry point for shipper DAT board interface
 * Sprint 14 - DAT-Style UI Transformation
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import ShipperDatBoardClient from './ShipperDatBoardClient';

export const metadata = {
  title: 'DAT Load Board - Shipper',
  description: 'Professional DAT-style load board for shippers',
};

export default async function ShipperDatBoardPage() {
  // Get auth from headers (set by middleware)
  const headersList = await headers();
  const userHeader = headersList.get('x-user-data');

  // Redirect if not authenticated
  if (!userHeader) {
    redirect('/login');
  }

  // Parse user data
  const user = JSON.parse(userHeader);

  // Verify shipper role
  if (user.role !== 'SHIPPER' && user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <ShipperDatBoardClient user={user} />;
}
