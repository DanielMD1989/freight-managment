'use client';

/**
 * Carrier DAT Board Client Component
 *
 * Main client wrapper with tab navigation between POST TRUCKS and SEARCH LOADS
 * Sprint 14 - DAT-Style UI Transformation (Phase 6: Error Boundaries)
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DatNavTabs } from '@/components/dat-ui';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostTrucksTab from './PostTrucksTab';
import SearchLoadsTab from './SearchLoadsTab';
import { CommissionDiscountBadge } from '@/components/CommissionDiscountCard';
import NotificationBell from '@/components/NotificationBell';

interface CarrierDatBoardClientProps {
  user: any;
}

type CarrierTabKey = 'POST_TRUCKS' | 'SEARCH_LOADS';

export default function CarrierDatBoardClient({ user }: CarrierDatBoardClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CarrierTabKey>('POST_TRUCKS');
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Story 15.11: Task 15.11.1-15.11.6 - Tab State Management with URL persistence
  // Sync tab state with URL parameters (works with both initial load and client-side navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as CarrierTabKey;

    if (tabParam === 'SEARCH_LOADS' || tabParam === 'POST_TRUCKS') {
      setActiveTab(tabParam);
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
      const tabParam = params.get('tab') as CarrierTabKey;

      if (tabParam === 'SEARCH_LOADS' || tabParam === 'POST_TRUCKS') {
        setActiveTab(tabParam);
      } else {
        setActiveTab('POST_TRUCKS');
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with DAT Power Branding */}
      <div className="bg-gray-200 border-b border-gray-300 px-6 py-3 flex items-center justify-between">
        {/* Navigation Tabs */}
        <div className="flex-1">
          <DatNavTabs
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as CarrierTabKey)}
            userRole={user.role}
            portalType="carrier"
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
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">
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
        {isInitialLoad ? (
          /* Loading skeleton while restoring tab state */
          <div className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            {activeTab === 'POST_TRUCKS' && <PostTrucksTab user={user} />}
            {activeTab === 'SEARCH_LOADS' && <SearchLoadsTab user={user} />}
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
