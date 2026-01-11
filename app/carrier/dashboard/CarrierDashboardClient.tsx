'use client';

/**
 * Carrier Dashboard Client Component
 *
 * Professional dashboard with stats, quick actions, and activity feed
 * Design System: Clean & Minimal with Teal accent
 */

import Link from 'next/link';
import { useState } from 'react';

interface DashboardData {
  totalTrucks: number;
  activeTrucks: number;
  activePostings: number;
  completedDeliveries: number;
  totalRevenue: number;
  wallet: {
    balance: number;
    currency: string;
  };
  recentPostings: number;
}

interface Load {
  id: string;
  origin: string;
  destination: string;
  status: string;
  rate: number;
  createdAt: string;
}

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  isAvailable: boolean;
  status: string;
  currentCity?: string;
}

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  name?: string;
}

interface CarrierDashboardClientProps {
  user: User;
  dashboardData: DashboardData | null;
  recentLoads: Load[];
  trucks: Truck[];
}

function formatCurrency(amount: number, currency: string = 'ETB'): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'teal',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'teal' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const colorStyles = {
    teal: {
      iconBg: 'bg-gradient-to-br from-teal-50 to-cyan-50',
      iconColor: 'text-teal-600',
      border: 'border-teal-100',
    },
    emerald: {
      iconBg: 'bg-gradient-to-br from-emerald-50 to-green-50',
      iconColor: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    amber: {
      iconBg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
      iconColor: 'text-amber-600',
      border: 'border-amber-100',
    },
    rose: {
      iconBg: 'bg-gradient-to-br from-rose-50 to-pink-50',
      iconColor: 'text-rose-600',
      border: 'border-rose-100',
    },
    slate: {
      iconBg: 'bg-gradient-to-br from-slate-50 to-gray-50',
      iconColor: 'text-slate-600',
      border: 'border-slate-100',
    },
  };

  const styles = colorStyles[color];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl ${styles.iconBg} ${styles.iconColor} flex items-center justify-center`}>
          {icon}
        </div>
        {trend && trendValue && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              trend === 'up'
                ? 'text-emerald-700 bg-emerald-50'
                : trend === 'down'
                ? 'text-rose-700 bg-rose-50'
                : 'text-slate-600 bg-slate-100'
            }`}
          >
            {trend === 'up' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {trend === 'down' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {trendValue}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  href,
  color = 'teal',
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color?: 'teal' | 'emerald' | 'amber' | 'indigo';
}) {
  const colorStyles = {
    teal: 'from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700',
    emerald: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
    amber: 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700',
    indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
  };

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorStyles[color]} p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-white/80 mt-1">{description}</p>
      </div>
      <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function LoadStatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    POSTED: 'bg-blue-50 text-blue-700 border-blue-200',
    ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    IN_TRANSIT: 'bg-amber-50 text-amber-700 border-amber-200',
    DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-teal-50 text-teal-700 border-teal-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const statusLabels: Record<string, string> = {
    POSTED: 'Posted',
    ASSIGNED: 'Assigned',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function TruckStatusBadge({ isAvailable, status }: { isAvailable: boolean; status: string }) {
  if (!isAvailable) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        Unavailable
      </span>
    );
  }

  const statusStyles: Record<string, string> = {
    IDLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EN_ROUTE: 'bg-amber-50 text-amber-700 border-amber-200',
    LOADING: 'bg-blue-50 text-blue-700 border-blue-200',
    UNLOADING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    MAINTENANCE: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status] || 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
      {isAvailable ? 'Available' : status}
    </span>
  );
}

export default function CarrierDashboardClient({
  user,
  dashboardData,
  recentLoads,
  trucks,
}: CarrierDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'loads' | 'trucks'>('loads');

  const data = dashboardData || {
    totalTrucks: 0,
    activeTrucks: 0,
    activePostings: 0,
    completedDeliveries: 0,
    totalRevenue: 0,
    wallet: { balance: 0, currency: 'ETB' },
    recentPostings: 0,
  };

  const utilizationRate = data.totalTrucks > 0 ? Math.round((data.activeTrucks / data.totalTrucks) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Welcome back, {user.name?.split(' ')[0] || user.email?.split('@')[0] || 'Carrier'}
              </h1>
              <p className="text-slate-500 mt-1">
                Here&apos;s what&apos;s happening with your fleet today
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/carrier/trucks/add"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Truck
              </Link>
              <Link
                href="/carrier?tab=POST_TRUCKS"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl text-sm font-medium hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                Post Truck
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Fleet"
            value={data.totalTrucks}
            subtitle={`${data.activeTrucks} available`}
            color="teal"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            }
          />
          <StatCard
            title="Active Postings"
            value={data.activePostings}
            subtitle={`+${data.recentPostings} this week`}
            trend={data.recentPostings > 0 ? 'up' : 'neutral'}
            trendValue={data.recentPostings > 0 ? `+${data.recentPostings}` : undefined}
            color="emerald"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            }
          />
          <StatCard
            title="Deliveries"
            value={data.completedDeliveries}
            subtitle="Completed deliveries"
            color="amber"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            }
          />
          <StatCard
            title="Wallet Balance"
            value={formatCurrency(data.wallet.balance, data.wallet.currency)}
            subtitle="Available balance"
            color="slate"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              title="Post a Truck"
              description="List your available trucks for shippers"
              color="teal"
              href="/carrier?tab=POST_TRUCKS"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            />
            <QuickActionCard
              title="Find Loads"
              description="Search available loads to haul"
              color="emerald"
              href="/carrier?tab=SEARCH_LOADS"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <QuickActionCard
              title="View Fleet"
              description="Manage your trucks and vehicles"
              color="amber"
              href="/carrier/trucks"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              }
            />
            <QuickActionCard
              title="View Map"
              description="Track trucks in real-time"
              color="indigo"
              href="/carrier/map"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('loads')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'loads'
                    ? 'text-teal-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Recent Loads
                {activeTab === 'loads' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-teal-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('trucks')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'trucks'
                    ? 'text-teal-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                My Trucks
                {activeTab === 'trucks' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-teal-600" />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'loads' && (
                <>
                  {recentLoads.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-medium text-slate-800">No loads yet</h3>
                      <p className="text-sm text-slate-500 mt-1">Start by finding loads to haul</p>
                      <Link
                        href="/carrier?tab=SEARCH_LOADS"
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Find Loads
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentLoads.map((load) => (
                        <Link
                          key={load.id}
                          href={`/carrier/loads/${load.id}`}
                          className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/80 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">
                                  {load.origin}
                                </span>
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                                <span className="text-sm font-medium text-slate-800">
                                  {load.destination}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <LoadStatusBadge status={load.status} />
                                <span className="text-xs text-slate-400">{formatDate(load.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-800">
                              {formatCurrency(load.rate, 'ETB')}
                            </span>
                            <svg className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'trucks' && (
                <>
                  {trucks.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-medium text-slate-800">No trucks registered</h3>
                      <p className="text-sm text-slate-500 mt-1">Add your first truck to get started</p>
                      <Link
                        href="/carrier/trucks/add"
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Truck
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trucks.map((truck) => (
                        <Link
                          key={truck.id}
                          href={`/carrier/trucks/${truck.id}`}
                          className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/80 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">
                                  {truck.truckType}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {truck.licensePlate}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <TruckStatusBadge isAvailable={truck.isAvailable} status={truck.status} />
                                {truck.currentCity && (
                                  <span className="text-xs text-slate-400">{truck.currentCity}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
              <Link
                href={activeTab === 'loads' ? '/carrier/trips' : '/carrier/trucks'}
                className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1"
              >
                View all {activeTab === 'loads' ? 'loads' : 'trucks'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Fleet Utilization */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Fleet Utilization</h3>
              <div className="relative">
                <svg className="w-full" viewBox="0 0 120 60">
                  {/* Background arc */}
                  <path
                    d="M 10 55 A 50 50 0 0 1 110 55"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Progress arc */}
                  <path
                    d="M 10 55 A 50 50 0 0 1 110 55"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(utilizationRate / 100) * 157} 157`}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className="text-3xl font-bold text-slate-800">{utilizationRate}%</span>
                  <span className="text-xs text-slate-500">Utilization Rate</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">{data.activeTrucks}</div>
                  <div className="text-xs text-slate-500">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-600">{data.totalTrucks - data.activeTrucks}</div>
                  <div className="text-xs text-slate-500">In Use</div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Revenue</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(data.totalRevenue, data.wallet.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Active Postings</span>
                  <span className="text-sm font-semibold text-slate-800">{data.activePostings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Completed</span>
                  <span className="text-sm font-semibold text-emerald-600">{data.completedDeliveries}</span>
                </div>
              </div>
              <Link
                href="/carrier/analytics"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Analytics
              </Link>
            </div>

            {/* Help Card */}
            <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">Need Help?</h3>
              <p className="text-sm text-teal-100 mb-4">
                Our support team is here to help you get the most out of FreightET.
              </p>
              <button className="w-full px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors backdrop-blur">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
