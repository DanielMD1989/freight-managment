/**
 * Admin Layout
 *
 * Main layout for admin panel with navigation sidebar
 * Sprint 10 - Story 10.1: Admin Dashboard & Layout
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import NotificationBell from '@/components/NotificationBell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Freight Platform Admin
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Bell - Sprint 16: Story 16.10 */}
              <NotificationBell />

              <span className="text-sm text-gray-600">
                {session.email}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
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
            <NavLink href="/admin" icon="📊">
              Dashboard
            </NavLink>
            <NavLink href="/admin/users" icon="👥">
              Users
            </NavLink>
            <NavLink href="/admin/organizations" icon="🏢">
              Organizations
            </NavLink>
            <NavLink href="/admin/verification" icon="✓">
              Verification Queue
            </NavLink>

            {/* GPS & Financial Management */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                GPS & Financial
              </div>
              <NavLink href="/admin/gps" icon="📍">
                GPS Management
              </NavLink>
              <NavLink href="/admin/commission" icon="💰">
                Commission Settings
              </NavLink>
              <NavLink href="/admin/settlement" icon="💳">
                Settlement Automation
              </NavLink>
            </div>

            {/* Security & Compliance */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Security
              </div>
              <NavLink href="/admin/bypass-review" icon="⚠️">
                Bypass Review
              </NavLink>
              <NavLink href="/admin/audit-logs" icon="📋">
                Audit Logs
              </NavLink>
            </div>

            {/* System Configuration - Sprint 10 Story 10.6 */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Configuration
              </div>
              <NavLink href="/admin/settings" icon="⚙️">
                System Settings
              </NavLink>
            </div>

            {/* Quick Links */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <NavLink href="/" icon="🏠">
                Back to Platform
              </NavLink>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children
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
