'use client';

/**
 * Shipper Dashboard Client Component
 *
 * Professional dashboard with stats, quick actions, and activity overview
 * Design System: Clean & Minimal with Teal accent
 */

import React from 'react';
import Link from 'next/link';

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  name?: string;
}

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  truckType: string;
  weight: number;
  rate: number;
  status: string;
  createdAt: string;
}

interface Trip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    plateNumber: string;
    truckType: string;
  };
  carrier: {
    name: string;
  };
  pickupLocation?: {
    address: string;
  };
  deliveryLocation?: {
    address: string;
  };
}

interface DashboardData {
  stats?: {
    totalLoads: number;
    activeLoads: number;
    inTransitLoads: number;
    deliveredLoads: number;
    totalSpent: number;
    pendingPayments: number;
  };
}

interface ShipperDashboardClientProps {
  user: User;
  dashboardData: DashboardData | null;
  recentLoads: Load[];
  activeTrips: Trip[];
}

// Status badge colors
const loadStatusColors: Record<string, string> = {
  POSTED: 'bg-blue-50 text-blue-700 border border-blue-200',
  MATCHED: 'bg-purple-50 text-purple-700 border border-purple-200',
  ACCEPTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  PICKED_UP: 'bg-teal-50 text-teal-700 border border-teal-200',
  IN_TRANSIT: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border border-slate-200',
};

const tripStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_TRANSIT: 'bg-teal-50 text-teal-700 border border-teal-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

export default function ShipperDashboardClient({
  user,
  dashboardData,
  recentLoads,
  activeTrips,
}: ShipperDashboardClientProps) {
  const stats = dashboardData?.stats || {
    totalLoads: 0,
    activeLoads: 0,
    inTransitLoads: 0,
    deliveredLoads: 0,
    totalSpent: 0,
    pendingPayments: 0,
  };

  const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0] || 'Shipper';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-800">
            Welcome back, {firstName}
          </h1>
          <p className="text-slate-500 mt-1">
            Here&apos;s an overview of your shipping operations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Posted Loads"
            value={stats.activeLoads}
            subtitle="Available for carriers"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            trend={stats.totalLoads > 0 ? `${stats.totalLoads} total` : undefined}
            color="teal"
          />
          <StatCard
            title="In Transit"
            value={stats.inTransitLoads}
            subtitle="Currently moving"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            color="indigo"
          />
          <StatCard
            title="Delivered"
            value={stats.deliveredLoads}
            subtitle="Completed shipments"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="emerald"
          />
          <StatCard
            title="Total Spent"
            value={`${stats.totalSpent.toLocaleString()} ETB`}
            subtitle={stats.pendingPayments > 0 ? `${stats.pendingPayments.toLocaleString()} ETB pending` : 'All payments settled'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="amber"
            isLarge
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <QuickActionCard
                href="/shipper?tab=POST_LOADS"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
                title="Post New Load"
                description="Create a new shipment listing"
                color="teal"
              />
              <QuickActionCard
                href="/shipper?tab=SEARCH_TRUCKS"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                title="Find Trucks"
                description="Search available carriers"
                color="indigo"
              />
              <QuickActionCard
                href="/shipper/map"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                }
                title="Track Shipments"
                description="Live GPS tracking"
                color="emerald"
              />
              <QuickActionCard
                href="/shipper/loads"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                title="My Loads"
                description="Manage all shipments"
                color="slate"
              />
            </div>
          </div>

          {/* Recent Loads */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Recent Loads</h2>
                <p className="text-sm text-slate-500">Your latest shipment postings</p>
              </div>
              <Link
                href="/shipper/loads"
                className="text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentLoads.length > 0 ? (
                recentLoads.map((load) => (
                  <LoadRow key={load.id} load={load} />
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-slate-600 font-medium mb-1">No loads posted yet</h3>
                  <p className="text-sm text-slate-400">
                    Create your first shipment to get started
                  </p>
                  <Link
                    href="/shipper?tab=POST_LOADS"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-medium rounded-lg shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/30 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Post Your First Load
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Trips Section */}
        {activeTrips.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Active Shipments</h2>
                <p className="text-sm text-slate-500">Shipments currently in transit</p>
              </div>
              <Link
                href="/shipper/map"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Track All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {activeTrips.map((trip) => (
                <TripRow key={trip.id} trip={trip} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// StatCard Component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  color: 'teal' | 'indigo' | 'emerald' | 'amber' | 'slate';
  isLarge?: boolean;
}

function StatCard({ title, value, subtitle, icon, trend, color, isLarge }: StatCardProps) {
  const colorClasses = {
    teal: 'from-teal-500 to-teal-600 shadow-teal-500/30',
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/30',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/30',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/30',
    slate: 'from-slate-500 to-slate-600 shadow-slate-500/30',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg flex items-center justify-center text-white`}>
          {icon}
        </div>
        {trend && (
          <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <div className={`${isLarge ? 'text-2xl' : 'text-3xl'} font-bold text-slate-800`}>
          {value}
        </div>
        <div className="text-sm text-slate-500 mt-1">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

// QuickActionCard Component
interface QuickActionCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'teal' | 'indigo' | 'emerald' | 'slate';
}

function QuickActionCard({ href, icon, title, description, color }: QuickActionCardProps) {
  const colorClasses = {
    teal: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100',
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    slate: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
  };

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
    >
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center transition-colors`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
          {title}
        </div>
        <div className="text-xs text-slate-400">{description}</div>
      </div>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// LoadRow Component
interface LoadRowProps {
  load: Load;
}

function LoadRow({ load }: LoadRowProps) {
  const statusClass = loadStatusColors[load.status] || 'bg-slate-50 text-slate-600 border border-slate-200';

  return (
    <Link
      href={`/shipper/loads/${load.id}`}
      className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-800 truncate">
            {load.pickupCity}
          </span>
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className="font-medium text-slate-800 truncate">
            {load.deliveryCity}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{load.truckType}</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full" />
          <span>{load.weight.toLocaleString()} kg</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full" />
          <span>{new Date(load.pickupDate).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-semibold text-slate-800">
            {load.rate.toLocaleString()} ETB
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusClass}`}>
          {load.status.replace('_', ' ')}
        </span>
      </div>
    </Link>
  );
}

// TripRow Component
interface TripRowProps {
  trip: Trip;
}

function TripRow({ trip }: TripRowProps) {
  const statusClass = tripStatusColors[trip.status] || 'bg-slate-50 text-slate-600 border border-slate-200';

  return (
    <Link
      href="/shipper/map"
      className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-800 truncate">
            Load #{trip.loadId.slice(-6)}
          </span>
          <span className="text-slate-400">-</span>
          <span className="text-slate-600 truncate">
            {trip.carrier.name}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{trip.truck.plateNumber}</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full" />
          <span>{trip.truck.truckType}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusClass}`}>
          {trip.status.replace('_', ' ')}
        </span>
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
