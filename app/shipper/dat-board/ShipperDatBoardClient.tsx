'use client';

/**
 * Shipper DAT Board Client Component
 *
 * Main client wrapper with tab navigation between POST LOADS and SEARCH TRUCKS
 * Sprint 14 - DAT-Style UI Transformation (Phase 6: Error Boundaries)
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ShipperTabKey>('POST_LOADS');
  const [searchFilters, setSearchFilters] = useState<any>(null);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Story 15.11: Task 15.11.1-15.11.6 - Tab State Management with URL persistence
  // Sync tab state with URL parameters (works with both initial load and client-side navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as ShipperTabKey;

    if (tabParam === 'POST_LOADS' || tabParam === 'SEARCH_TRUCKS') {
      setActiveTab(tabParam);
    }

    // Extract search filters from URL (restore filter state)
    const filters = {
      origin: searchParams.get('origin') || '',
      destination: searchParams.get('destination') || '',
      truckType: searchParams.get('truckType') || '',
      pickupDate: searchParams.get('pickupDate') || '',
      length: searchParams.get('length') || '',
      weight: searchParams.get('weight') || '',
    };

    // Only set filters if at least one filter has a value
    if (Object.values(filters).some(v => v)) {
      setSearchFilters(filters);
    }

    // Mark initial load complete after a short delay
    if (isInitialLoad) {
      setTimeout(() => setIsInitialLoad(false), 100);
    }
  }, [searchParams, isInitialLoad]);

  // Sync activeTab with URL (without page reload)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialLoad) {
      const params = new URLSearchParams(window.location.search);
      const currentTab = params.get('tab');

      // Update URL if tab changed
      if (currentTab !== activeTab) {
        params.set('tab', activeTab);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        // Use pushState for user actions to support back/forward navigation
        window.history.pushState({ tab: activeTab }, '', newUrl);
      }
    }
  }, [activeTab, isInitialLoad]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ShipperTabKey;

      if (tabParam === 'POST_LOADS' || tabParam === 'SEARCH_TRUCKS') {
        setActiveTab(tabParam);

        // Restore filters from URL
        const filters = {
          origin: params.get('origin') || '',
          destination: params.get('destination') || '',
          truckType: params.get('truckType') || '',
          pickupDate: params.get('pickupDate') || '',
          length: params.get('length') || '',
          weight: params.get('weight') || '',
        };

        if (Object.values(filters).some(v => v)) {
          setSearchFilters(filters);
        }
      } else {
        setActiveTab('POST_LOADS');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    <div className="min-h-screen bg-[var(--background-secondary)]">
      {/* Header - Clean & Minimal Design */}
      <div className="bg-white border-b border-[var(--border)] px-6 py-4 flex items-center justify-between shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex-1">
          <DatNavTabs
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as ShipperTabKey)}
            userRole={user.role}
            portalType="shipper"
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
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] text-[var(--primary-700)] flex items-center justify-center font-semibold text-xs">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="hidden sm:block">
              <div className="font-medium text-[var(--foreground)]">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-[var(--foreground-muted)]">{user.role}</div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[var(--error-500)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--error-600)] transition-colors shadow-sm"
          >
            Logout
          </button>

          {/* FreightET Branding */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[var(--border)]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
              </svg>
            </div>
            <span className="text-[var(--foreground)] font-bold">FreightET</span>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {isInitialLoad ? (
          /* Loading skeleton while restoring tab state */
          <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6 animate-pulse">
            <div className="h-8 bg-[var(--neutral-100)] rounded-lg w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-[var(--neutral-100)] rounded w-full"></div>
              <div className="h-4 bg-[var(--neutral-100)] rounded w-5/6"></div>
              <div className="h-4 bg-[var(--neutral-100)] rounded w-4/6"></div>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
