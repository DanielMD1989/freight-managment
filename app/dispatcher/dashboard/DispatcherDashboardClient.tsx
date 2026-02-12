'use client';

/**
 * Dispatcher Dashboard Client Component
 *
 * Sprint 20 - Dashboard Visual Redesign
 * Clean, minimal, well-proportioned design
 *
 * Stats: Active Loads, Assigned, In-Transit, Available Trucks, Alerts
 * Quick Actions: Assign Load, View Map, Manage Trucks
 * Sections: Unassigned Loads, Active Trips, Trucks Overview
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  StatCard,
  DashboardSection,
  QuickActionButton,
  StatusBadge,
  PackageIcon,
  TruckIcon,
  MapIcon,
  ClockIcon,
  AlertIcon,
  RefreshIcon,
  SearchIcon,
  AssignIcon,
} from '@/components/dashboard';
import QuickAssignModal from '@/components/QuickAssignModal';
import StatusUpdateModal from '@/components/StatusUpdateModal';
// H1 FIX: Import proper types from centralized types file
import type {
  DashboardStats,
  DashboardData,
  DashboardUser,
  PickupToday,
  DispatcherLoad,
  DispatcherTruckPosting,
} from '@/lib/types/dispatcher';
// M2 FIX: Import page size constant
import { DISPATCHER_PAGE_SIZE } from '@/lib/types/dispatcher';

type DashboardTab = 'loads' | 'trucks';

interface DispatcherDashboardClientProps {
  user: DashboardUser;
  dashboardData?: DashboardData | null;
}

export default function DispatcherDashboardClient({
  user,
  dashboardData,
}: DispatcherDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('loads');
  // H1 FIX: Use proper types instead of any[]
  const [loads, setLoads] = useState<DispatcherLoad[]>([]);
  const [trucks, setTrucks] = useState<DispatcherTruckPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Dispatcher';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // L5 FIX: Use useCallback to prevent stale closure bugs
  const fetchLoads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: DISPATCHER_PAGE_SIZE.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      if (searchQuery) {
        params.append('pickupCity', searchQuery);
      }

      const response = await fetch(`/api/loads?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch loads');
      }

      const data = await response.json();
      setLoads(data.loads || []);
    // H1 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      console.error('Error fetching loads:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch loads';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // L5 FIX: Use useCallback to prevent stale closure bugs
  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: DISPATCHER_PAGE_SIZE.toString(),
      });

      const response = await fetch(`/api/truck-postings?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch trucks');
      }

      const data = await response.json();
      setTrucks(data.postings || []);
    // H1 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      console.error('Error fetching trucks:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch trucks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // L5 FIX: Include fetch functions in dependency array
  useEffect(() => {
    if (activeTab === 'loads') {
      fetchLoads();
    } else {
      fetchTrucks();
    }
  }, [activeTab, fetchLoads, fetchTrucks]);

  // Use API-provided stats (accurate, full database counts) with fallback to client calculation
  const stats = dashboardData?.stats;
  const postedLoads = stats?.postedLoads ?? loads.filter(l => l.status === 'POSTED').length;
  const assignedLoads = stats?.assignedLoads ?? loads.filter(l => l.status === 'ASSIGNED').length;
  const inTransitLoads = stats?.inTransitLoads ?? loads.filter(l => l.status === 'IN_TRANSIT').length;
  const availableTrucks = stats?.availableTrucks ?? trucks.length;
  const deliveriesToday = stats?.deliveriesToday ?? 0;
  const onTimeRate = stats?.onTimeRate ?? 100;
  const alertCount = stats?.alertCount ?? 0;

  // Today's pickups - use API data when available
  const todayStr = new Date().toISOString().split('T')[0];
  const pickupsToday = dashboardData?.pickupsToday ?? loads.filter(l => {
    const pickupDate = l.pickupDate ? new Date(l.pickupDate).toISOString().split('T')[0] : null;
    return pickupDate === todayStr && (l.status === 'ASSIGNED' || l.status === 'POSTED');
  });

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
                Welcome back, {firstName}
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {today}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid - 6 cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-5 mb-8">
          <StatCard
            title="Unassigned Loads"
            value={postedLoads}
            icon={<PackageIcon />}
            color="warning"
            trend={postedLoads > 0 ? { value: 'Needs attention', positive: false } : undefined}
          />
          <StatCard
            title="In Transit"
            value={inTransitLoads}
            icon={<MapIcon />}
            color="accent"
            trend={inTransitLoads > 0 ? { value: 'Active', positive: true } : undefined}
          />
          <StatCard
            title="Deliveries Today"
            value={deliveriesToday}
            icon={<ClockIcon />}
            color="primary"
            subtitle="Scheduled"
          />
          <StatCard
            title="On-Time Rate"
            value={`${onTimeRate}%`}
            icon={<TruckIcon />}
            color="success"
            trend={onTimeRate >= 90 ? { value: 'Good', positive: true } : { value: 'Needs improvement', positive: false }}
          />
          <StatCard
            title="Available Trucks"
            value={availableTrucks}
            icon={<TruckIcon />}
            color="secondary"
          />
          <StatCard
            title="Alerts"
            value={alertCount}
            icon={<AlertIcon />}
            color={alertCount > 0 ? 'error' : 'success'}
            trend={alertCount > 0 ? { value: 'Late deliveries', positive: false } : undefined}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <QuickActionButton
              href="/dispatcher/loads"
              icon={<AssignIcon />}
              label="Find Matches"
              description="Match loads to trucks"
              variant="primary"
            />
            <QuickActionButton
              href="/dispatcher/map"
              icon={<MapIcon />}
              label="View Map"
              description="Live GPS tracking"
              variant="outline"
            />
            <QuickActionButton
              href="/dispatcher/trucks"
              icon={<TruckIcon />}
              label="Manage Trucks"
              description="Fleet overview"
              variant="outline"
            />
          </div>
        </div>

        {/* Tabs */}
        <div
          className="rounded-xl border overflow-hidden mb-6"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="flex border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setActiveTab('loads')}
              className={`px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'loads' ? '' : 'opacity-60 hover:opacity-80'
              }`}
              style={{ color: 'var(--foreground)' }}
            >
              All Loads
              {activeTab === 'loads' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--primary-500)' }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('trucks')}
              className={`px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'trucks' ? '' : 'opacity-60 hover:opacity-80'
              }`}
              style={{ color: 'var(--foreground)' }}
            >
              All Trucks
              {activeTab === 'trucks' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--primary-500)' }}
                />
              )}
            </button>
          </div>

          {/* Filters */}
          <div
            className="p-4 flex flex-wrap gap-4 items-end border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Status Filter (for loads) */}
            {activeTab === 'loads' && (
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="POSTED">Posted</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            )}

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Search
              </label>
              <div className="relative">
                <div
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'loads'
                      ? 'Search by city...'
                      : 'Search trucks...'
                  }
                  className="w-full rounded-lg pl-10 pr-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => (activeTab === 'loads' ? fetchLoads() : fetchTrucks())}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 transition-colors"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mx-4 my-3 px-4 py-3 rounded-lg text-sm"
              style={{
                background: 'var(--error-500)',
                color: 'white',
              }}
            >
              {error}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <p
                className="mt-4 text-sm"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Loading...
              </p>
            </div>
          ) : activeTab === 'loads' ? (
            <LoadsTable loads={loads} onRefresh={fetchLoads} userRole={user.role} />
          ) : (
            <TrucksTable trucks={trucks} onRefresh={fetchTrucks} />
          )}
        </div>

        {/* Additional Sections Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Live Map Preview */}
          <DashboardSection
            title="Live Map"
            subtitle="Real-time fleet tracking"
            action={{ label: 'Full Map', href: '/dispatcher/map' }}
            noPadding
          >
            <div className="relative h-48 overflow-hidden">
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'var(--bg-tinted)' }}
              >
                <div className="text-center">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'var(--primary-500)/10' }}
                  >
                    <MapIcon />
                  </div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {inTransitLoads} trucks in transit
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    Click to view full map
                  </p>
                  <Link
                    href="/dispatcher/map"
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-sm font-medium text-white rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors"
                  >
                    <MapIcon />
                    Open Map
                  </Link>
                </div>
              </div>
            </div>
          </DashboardSection>

          {/* Today's Schedule */}
          <DashboardSection
            title="Today's Schedule"
            subtitle="Pickups and deliveries"
            noPadding
          >
            {pickupsToday.length > 0 ? (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {/* H1 FIX: Use proper type for load */}
                {pickupsToday.slice(0, 4).map((load: PickupToday) => (
                  <Link
                    key={load.id}
                    href={`/dispatcher/loads/${load.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-tinted)]"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--primary-500)/10' }}
                    >
                      <PackageIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {load.pickupCity} → {load.deliveryCity}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: 'var(--foreground-muted)' }}
                      >
                        Pickup: {new Date(load.pickupDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <StatusBadge status={load.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'var(--bg-tinted)' }}
                >
                  <ClockIcon />
                </div>
                <p
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  No pickups scheduled today
                </p>
              </div>
            )}
          </DashboardSection>

          {/* Alerts Section */}
          <DashboardSection
            title="Alerts"
            subtitle="Issues requiring attention"
            noPadding
          >
            {alertCount > 0 ? (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {loads
                  .filter(l => {
                    if (l.status === 'DELIVERED' || l.status === 'CANCELLED' || l.status === 'COMPLETED') return false;
                    if (!l.deliveryDate) return false;
                    return new Date(l.deliveryDate) < new Date();
                  })
                  .slice(0, 4)
                  .map((load: DispatcherLoad) => (
                    <Link
                      key={load.id}
                      href={`/dispatcher/loads/${load.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-tinted)]"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--error-500)/10' }}
                      >
                        <AlertIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {load.pickupCity} → {load.deliveryCity}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: 'var(--error-500)' }}
                        >
                          Past due: {new Date(load.deliveryDate).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={load.status} />
                    </Link>
                  ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'var(--success-500)/10' }}
                >
                  <svg className="w-5 h-5" style={{ color: 'var(--success-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  All clear!
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  No issues at this time
                </p>
              </div>
            )}
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}

// H1 FIX: Use proper types for LoadsTable component
function LoadsTable({ loads, onRefresh, userRole }: { loads: DispatcherLoad[]; onRefresh: () => void; userRole: string }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<DispatcherLoad | null>(null);

  const handleAssignLoad = (load: DispatcherLoad) => {
    setSelectedLoad(load);
    setAssignModalOpen(true);
  };

  const handleUpdateStatus = (load: DispatcherLoad) => {
    setSelectedLoad(load);
    setStatusModalOpen(true);
  };

  const handleAssignSuccess = () => {
    onRefresh();
    setSelectedLoad(null);
  };

  const handleStatusUpdateSuccess = () => {
    onRefresh();
    setSelectedLoad(null);
  };

  if (loads.length === 0) {
    return (
      <div className="py-16 text-center">
        <div
          className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--bg-tinted)' }}
        >
          <svg className="w-6 h-6" style={{ color: 'var(--foreground-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          No loads found
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Quick Assignment Modal */}
      {selectedLoad && (
        <QuickAssignModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedLoad(null);
          }}
          loadId={selectedLoad.id}
          loadDetails={{
            pickupCity: selectedLoad.pickupCity,
            deliveryCity: selectedLoad.deliveryCity,
            truckType: selectedLoad.truckType,
            weight: selectedLoad.weight,
          }}
          onAssignSuccess={handleAssignSuccess}
          userRole={userRole}
        />
      )}

      {/* Status Update Modal */}
      {selectedLoad && (
        <StatusUpdateModal
          isOpen={statusModalOpen}
          onClose={() => {
            setStatusModalOpen(false);
            setSelectedLoad(null);
          }}
          loadId={selectedLoad.id}
          currentStatus={selectedLoad.status}
          loadDetails={{
            pickupCity: selectedLoad.pickupCity,
            deliveryCity: selectedLoad.deliveryCity,
          }}
          onUpdateSuccess={handleStatusUpdateSuccess}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Load ID
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Status
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Route
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Truck Type
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Rate
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Shipper
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {loads.map((load) => (
              <tr
                key={load.id}
                className="transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <td className="px-4 py-3">
                  <span
                    className="text-sm font-mono"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {load.id.slice(0, 8)}...
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={load.status} />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {load.pickupCity} → {load.deliveryCity}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {new Date(load.pickupDate).toLocaleDateString()} - {new Date(load.deliveryDate).toLocaleDateString()}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-sm"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {load.truckType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {load.rate?.toLocaleString()} {load.currency || 'ETB'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-sm"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {load.shipper?.name || 'Unknown'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {load.status === 'POSTED' && (
                      <button
                        onClick={() => handleAssignLoad(load)}
                        className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                        style={{
                          background: 'var(--primary-500)',
                          color: 'white',
                        }}
                      >
                        Assign
                      </button>
                    )}
                    {load.status !== 'DELIVERED' && load.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleUpdateStatus(load)}
                        className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                        style={{
                          background: 'var(--accent-500)',
                          color: 'white',
                        }}
                      >
                        Update
                      </button>
                    )}
                    {(load.status === 'ASSIGNED' || load.status === 'IN_TRANSIT') && (
                      <Link
                        href={`/tracking?loadId=${load.id}`}
                        target="_blank"
                        className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors bg-emerald-500 text-white"
                      >
                        GPS
                      </Link>
                    )}
                    <Link
                      href={`/dispatcher/loads/${load.id}`}
                      className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                      style={{
                        background: 'var(--bg-tinted)',
                        color: 'var(--foreground)',
                      }}
                    >
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Trucks Table Component
// H1 FIX: Use proper types for TrucksTable component
function TrucksTable({ trucks, onRefresh }: { trucks: DispatcherTruckPosting[]; onRefresh: () => void }) {
  if (trucks.length === 0) {
    return (
      <div className="py-16 text-center">
        <div
          className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--bg-tinted)' }}
        >
          <svg className="w-6 h-6" style={{ color: 'var(--foreground-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
          </svg>
        </div>
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          No trucks found
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Try adjusting your search
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              License Plate
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Truck Type
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Route
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Available From
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Carrier
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              GPS Status
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {trucks.map((posting) => (
            <tr
              key={posting.id}
              className="transition-colors hover:bg-[var(--bg-tinted)]"
            >
              <td className="px-4 py-3">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  {posting.truck?.licensePlate || 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {posting.truck?.truckType || 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3">
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  {posting.originCity?.name || 'N/A'} → {posting.destinationCity?.name || 'N/A'}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {new Date(posting.availableFrom).toLocaleDateString()}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className="text-sm"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {posting.carrier?.name || 'Unknown'}
                </span>
              </td>
              <td className="px-4 py-3">
                {posting.truck?.gpsStatus === 'ACTIVE' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : posting.truck?.imei ? (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Registered
                  </span>
                ) : (
                  <span
                    className="text-xs"
                    style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}
                  >
                    No GPS
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dispatcher/trucks/${posting.truck?.id || posting.id}`}
                  className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                  style={{
                    background: 'var(--bg-tinted)',
                    color: 'var(--foreground)',
                  }}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
