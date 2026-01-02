'use client';

/**
 * Shipper DAT Board Client Component
 *
 * Main client wrapper with tab navigation between POST LOADS and SEARCH TRUCKS
 * Sprint 14 - DAT-Style UI Transformation (Phase 6: Error Boundaries)
 */

import React, { useState, useEffect } from 'react';
import { DatNavTabs } from '@/components/dat-ui';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostLoadsTab from './PostLoadsTab';
import SearchTrucksTab from './SearchTrucksTab';
import { CommissionDiscountBadge } from '@/components/CommissionDiscountCard';
import NotificationBell from '@/components/NotificationBell';

interface ShipperDatBoardClientProps {
  user: any;
}

type ShipperTabKey = 'POST_LOADS' | 'SEARCH_TRUCKS';

export default function ShipperDatBoardClient({ user }: ShipperDatBoardClientProps) {
  const [activeTab, setActiveTab] = useState<ShipperTabKey>('POST_LOADS');
  const [searchFilters, setSearchFilters] = useState<any>(null);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Check URL parameters on mount to set active tab and filters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ShipperTabKey;

      if (tabParam === 'SEARCH_TRUCKS') {
        setActiveTab('SEARCH_TRUCKS');

        // Extract search filters from URL
        const filters = {
          origin: params.get('origin') || '',
          destination: params.get('destination') || '',
          truckType: params.get('truckType') || '',
          pickupDate: params.get('pickupDate') || '',
          length: params.get('length') || '',
          weight: params.get('weight') || '',
        };

        setSearchFilters(filters);
      }
    }
  }, []);

  // Sync activeTab with URL (without page reload)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const currentTab = params.get('tab');

      // Update URL if tab changed
      if (currentTab !== activeTab) {
        params.set('tab', activeTab);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [activeTab]);

  // Fetch organization completion rate - Sprint 16: Story 16.6
  useEffect(() => {
    const fetchCompletionRate = async () => {
      try {
        const response = await fetch('/api/organizations/me');
        if (response.ok) {
          const data = await response.json();
          setCompletionRate(data.completionRate ? Number(data.completionRate) : 0);
        }
      } catch (error) {
        console.error('Failed to fetch completion rate:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletionRate();
  }, []);

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Redirect to login page
        window.location.href = '/login';
      } else {
        alert('Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed. Please try again.');
    }
  };

  /**
   * Handle switching to SEARCH TRUCKS tab with filters
   */
  const handleSwitchToSearchTrucks = (filters: any) => {
    setSearchFilters(filters);
    setActiveTab('SEARCH_TRUCKS');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with DAT Power Branding */}
      <div className="bg-gray-200 border-b border-gray-300 px-6 py-3 flex items-center justify-between">
        {/* Navigation Tabs */}
        <div className="flex-1">
          <DatNavTabs
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as ShipperTabKey)}
            userRole={user.role}
          />
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          {/* Commission Discount Badge - Sprint 16: Story 16.6 */}
          {!loading && completionRate > 0 && (
            <CommissionDiscountBadge completionRate={completionRate} />
          )}

          {/* Notification Bell - Sprint 16: Story 16.10 */}
          <NotificationBell />

          {/* User Info */}
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">{user.firstName} {user.lastName}</span>
            <span className="text-gray-500">|</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">
              {user.role}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 bg-red-500 text-white text-sm font-bold rounded hover:bg-red-600 transition-colors"
          >
            LOGOUT
          </button>

          {/* FreightET Branding */}
          <div className="text-gray-700 font-bold text-lg tracking-wide">
            FreightET
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <ErrorBoundary>
          {activeTab === 'POST_LOADS' && (
            <PostLoadsTab
              user={user}
              onSwitchToSearchTrucks={handleSwitchToSearchTrucks}
            />
          )}
          {activeTab === 'SEARCH_TRUCKS' && (
            <SearchTrucksTab
              user={user}
              initialFilters={searchFilters}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
