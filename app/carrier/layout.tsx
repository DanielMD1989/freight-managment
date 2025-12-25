/**
 * Carrier Portal Layout
 *
 * Main layout for carrier portal with navigation
 * Sprint 12 - Story 12.1: Carrier Dashboard
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

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

  // Get organization details
  const organization = session.organizationId
    ? await db.organization.findUnique({
        where: { id: session.organizationId },
        select: {
          id: true,
          name: true,
          type: true,
          isVerified: true,
        },
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Carrier Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">
                Freight Platform
              </h1>
              {organization && (
                <span className="text-sm text-gray-600">
                  {organization.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {organization && !organization.isVerified && (
                <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  Pending Verification
                </span>
              )}
              <span className="text-sm text-gray-600">{session.email}</span>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                {session.role}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16">
          <nav className="p-4 space-y-1">
            <NavLink href="/carrier" icon="📊">
              Dashboard
            </NavLink>
            <NavLink href="/carrier/trucks" icon="🚛">
              My Fleet
            </NavLink>
            <NavLink href="/carrier/trucks/add" icon="➕">
              Add Truck
            </NavLink>
            <NavLink href="/carrier/postings" icon="📍">
              Truck Postings
            </NavLink>
            <NavLink href="/carrier/matches" icon="📦">
              Load Matches
            </NavLink>
            <NavLink href="/carrier/gps" icon="🗺️">
              GPS Tracking
            </NavLink>
            <NavLink href="/carrier/documents" icon="📄">
              Documents
            </NavLink>
            <NavLink href="/carrier/wallet" icon="💰">
              Wallet
            </NavLink>
            <NavLink href="/carrier/transactions" icon="💳">
              Transactions
            </NavLink>
            <NavLink href="/carrier/settings" icon="⚙️">
              Settings
            </NavLink>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <NavLink href="/" icon="🏠">
                Back to Home
              </NavLink>
              {session.role === 'ADMIN' && (
                <NavLink href="/admin" icon="🔧">
                  Admin Panel
                </NavLink>
              )}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {!organization && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                <strong>Action Required:</strong> You need to create or join an
                organization to access carrier features.{' '}
                <Link
                  href="/organizations/create"
                  className="underline font-medium"
                >
                  Create Organization
                </Link>
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      {children}
    </Link>
  );
}
