/**
 * Platform Operations Dashboard (Super Admin)
 *
 * Sprint 20 - Dashboard Visual Redesign
 * Clean, minimal, well-proportioned design
 *
 * Stats: Active Loads, Trucks, Pending Docs, GPS Coverage
 * Quick Actions: Verify Docs, GPS Tracking, Organizations, Users
 * Sections: Dispatch Board, System Links
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import {
  StatusBadge,
  PackageIcon,
  TruckIcon,
  MapIcon,
  DocumentIcon,
  UsersIcon,
  BuildingIcon,
} from '@/components/dashboard';
import { formatDate } from '@/lib/formatters';

/**
 * Fetch operational statistics
 */
async function getOperationalStats() {
  try {
    const [
      totalLoads,
      activeLoads,
      totalTrucks,
      activeTrucks,
      pendingDocuments,
      activeDisputes,
      recentLoads,
      trucksWithGPS,
    ] = await Promise.all([
      db.load.count(),
      db.load.count({
        where: {
          status: {
            in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'],
          },
        },
      }),
      db.truck.count(),
      db.truck.count({
        where: {
          isAvailable: true,
        },
      }),
      Promise.all([
        db.companyDocument.count({
          where: {
            verificationStatus: 'PENDING',
          },
        }),
        db.truckDocument.count({
          where: {
            verificationStatus: 'PENDING',
          },
        }),
      ]).then(([company, truck]) => company + truck),
      0,
      db.load.count({
        where: {
          postedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.truck.count({
        where: {
          gpsDeviceId: {
            not: null,
          },
        },
      }),
    ]);

    return {
      totalLoads,
      activeLoads,
      totalTrucks,
      activeTrucks,
      pendingDocuments,
      activeDisputes,
      recentLoads,
      trucksWithGPS,
    };
  } catch (error) {
    console.error('Error fetching operational stats:', error);
    return {
      totalLoads: 0,
      activeLoads: 0,
      totalTrucks: 0,
      activeTrucks: 0,
      pendingDocuments: 0,
      activeDisputes: 0,
      recentLoads: 0,
      trucksWithGPS: 0,
    };
  }
}

/**
 * Fetch active loads for dispatch board
 */
async function getDispatchBoard() {
  try {
    const loads = await db.load.findMany({
      where: {
        status: {
          in: ['POSTED', 'ASSIGNED', 'IN_TRANSIT'],
        },
      },
      include: {
        pickupLocation: {
          select: {
            name: true,
          },
        },
        deliveryLocation: {
          select: {
            name: true,
          },
        },
        shipper: {
          select: {
            name: true,
          },
        },
        assignedTruck: {
          select: {
            licensePlate: true,
            carrier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        pickupDate: 'asc',
      },
      take: 20,
    });

    return loads;
  } catch (error) {
    console.error('Error fetching dispatch board:', error);
    return [];
  }
}

// Local icons not in shared components
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

/**
 * Stat Card Component
 */
function StatCard({
  title,
  value,
  icon,
  subtitle,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
}) {
  const colorStyles = {
    primary: {
      iconBg: 'bg-primary-500/15 dark:bg-primary-500/20',
      iconColor: 'text-primary-600 dark:text-primary-400',
    },
    secondary: {
      iconBg: 'bg-secondary-500/15 dark:bg-secondary-500/20',
      iconColor: 'text-secondary-600 dark:text-secondary-400',
    },
    accent: {
      iconBg: 'bg-accent-500/15 dark:bg-accent-500/20',
      iconColor: 'text-accent-600 dark:text-accent-400',
    },
    success: {
      iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      iconBg: 'bg-amber-500/15 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    error: {
      iconBg: 'bg-rose-500/15 dark:bg-rose-500/20',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
  };

  const styles = colorStyles[color];

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:shadow-md"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl ${styles.iconBg} ${styles.iconColor} flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>

      <div
        className="text-3xl font-bold mb-1 tracking-tight"
        style={{ color: 'var(--foreground)' }}
      >
        {value}
      </div>

      <div
        className="text-sm font-medium"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {title}
      </div>

      {subtitle && (
        <div
          className="text-xs mt-1"
          style={{ color: 'var(--foreground-muted)', opacity: 0.7 }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Quick Action Button
 */
function QuickAction({
  href,
  icon,
  label,
  badge,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  color: 'primary' | 'secondary' | 'success' | 'accent' | 'warning';
}) {
  const colorStyles = {
    primary: 'bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    secondary: 'bg-secondary-500/10 hover:bg-secondary-500/20 text-secondary-600 dark:text-secondary-400',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    accent: 'bg-accent-500/10 hover:bg-accent-500/20 text-accent-600 dark:text-accent-400',
    warning: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  };

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center p-5 rounded-xl transition-colors ${colorStyles[color]}`}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--background)' }}>
        {icon}
      </div>
      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="mt-2 px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}

/**
 * System Link
 */
function SystemLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-[var(--bg-tinted)]"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div>
        <div
          className="font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          {title}
        </div>
        <div
          className="text-sm mt-0.5"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ color: 'var(--foreground-muted)' }}>
        <ChevronRightIcon />
      </div>
    </Link>
  );
}

/**
 * Platform Ops Dashboard Page
 */
export default async function OpsDashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/ops');
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')
  ) {
    redirect('/unauthorized');
  }

  const stats = await getOperationalStats();
  const dispatchBoard = await getDispatchBoard();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const gpsPercentage = stats.totalTrucks > 0 ? Math.round((stats.trucksWithGPS / stats.totalTrucks) * 100) : 0;
  const userName = session.firstName || session.email?.split('@')[0] || 'Admin';

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl lg:text-[28px] font-bold tracking-tight"
                style={{ color: 'var(--foreground)' }}
              >
                Welcome back, {userName}
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {today} - Platform Operations Dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>System Online</span>
              </div>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                {session.role}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid - 4 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5 mb-8">
          <StatCard
            title="Active Loads"
            value={stats.activeLoads}
            icon={<PackageIcon />}
            color="success"
            subtitle={`of ${stats.totalLoads} total`}
          />
          <StatCard
            title="Active Trucks"
            value={stats.activeTrucks}
            icon={<TruckIcon />}
            color="primary"
            subtitle={`of ${stats.totalTrucks} total`}
          />
          <StatCard
            title="Pending Docs"
            value={stats.pendingDocuments}
            icon={<DocumentIcon />}
            color="warning"
            subtitle="Need review"
          />
          <StatCard
            title="GPS Tracked"
            value={stats.trucksWithGPS}
            icon={<MapIcon />}
            color="accent"
            subtitle={`${gpsPercentage}% coverage`}
          />
        </div>

        {/* Quick Actions */}
        <div
          className="rounded-xl border overflow-hidden mb-8"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              Quick Actions
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction
              href="/admin/verification"
              icon={<DocumentIcon />}
              label="Verify Docs"
              badge={stats.pendingDocuments}
              color="warning"
            />
            <QuickAction
              href="/admin/gps"
              icon={<MapIcon />}
              label="GPS Tracking"
              color="primary"
            />
            <QuickAction
              href="/admin/organizations"
              icon={<BuildingIcon />}
              label="Organizations"
              color="success"
            />
            <QuickAction
              href="/admin/users"
              icon={<UsersIcon />}
              label="Users"
              color="accent"
            />
          </div>
        </div>

        {/* Dispatch Board */}
        <div
          className="rounded-xl border overflow-hidden mb-8"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              Dispatch Board
            </h2>
            <span
              className="text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {dispatchBoard.length} active
            </span>
          </div>

          {dispatchBoard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Status
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Route
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Pickup
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Shipper
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Truck
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {dispatchBoard.map((load) => (
                    <tr
                      key={load.id}
                      className="transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={load.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="text-sm font-medium"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {load.pickupLocation?.name || load.pickupCity} → {load.deliveryLocation?.name || load.deliveryCity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="text-sm"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          {formatDate(load.pickupDate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="text-sm"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          {load.shipper?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {load.assignedTruck ? (
                          <div>
                            <p
                              className="text-sm font-medium"
                              style={{ color: 'var(--foreground)' }}
                            >
                              {load.assignedTruck.licensePlate}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: 'var(--foreground-muted)' }}
                            >
                              {load.assignedTruck.carrier?.name}
                            </p>
                          </div>
                        ) : (
                          <span
                            className="text-sm"
                            style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}
                          >
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/loads/${load.id}`}
                          className="text-sm font-medium transition-colors"
                          style={{ color: 'var(--primary-500)' }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'var(--bg-tinted)' }}
              >
                <PackageIcon />
              </div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--foreground)' }}
              >
                No Active Dispatches
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--foreground-muted)' }}
              >
                All loads are currently cleared
              </p>
            </div>
          )}
        </div>

        {/* System Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <SystemLink
            href="/admin"
            title="Admin Panel"
            subtitle="Full system access"
          />
          <SystemLink
            href="/admin/loads"
            title="All Loads"
            subtitle={`${stats.totalLoads} total`}
          />
          <SystemLink
            href="/admin/trucks"
            title="All Trucks"
            subtitle={`${stats.totalTrucks} total`}
          />
        </div>

        {/* Additional Management Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Financial Overview */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Financial Overview
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <Link
                href="/admin/wallet"
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Platform Wallet</span>
                </div>
                <ChevronRightIcon />
              </Link>
              <Link
                href="/admin/withdrawals"
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Withdrawals</span>
                </div>
                <ChevronRightIcon />
              </Link>
              <Link
                href="/admin/disputes"
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/10">
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Disputes</span>
                </div>
                <ChevronRightIcon />
              </Link>
            </div>
          </div>

          {/* Audit & Logs */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Audit & Logs
              </h3>
              <Link
                href="/admin/audit-logs"
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--primary-500)' }}
              >
                View All
              </Link>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-primary-500" />
                <div>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>System operational</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>All services running</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-emerald-500" />
                <div>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{stats.recentLoads} loads today</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>New postings in 24h</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-accent-500" />
                <div>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{gpsPercentage}% GPS coverage</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Fleet tracking status</p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Tools */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Admin Tools
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <Link
                href="/admin/users"
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-500/10">
                    <UsersIcon />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>User Management</span>
                </div>
                <ChevronRightIcon />
              </Link>
              <Link
                href="/admin/organizations"
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary-500/10">
                    <BuildingIcon />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Organizations</span>
                </div>
                <ChevronRightIcon />
              </Link>
              <Link
                href="/admin/settings"
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-500/10">
                    <svg className="w-4 h-4" style={{ color: 'var(--accent-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>System Settings</span>
                </div>
                <ChevronRightIcon />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
