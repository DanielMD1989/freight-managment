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

interface ShipperDatBoardClientProps {
  user: any;
}

type ShipperTabKey = 'POST_LOADS' | 'SEARCH_TRUCKS';

export default function ShipperDatBoardClient({ user }: ShipperDatBoardClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ShipperTabKey>('POST_LOADS');
  const [searchFilters, setSearchFilters] = useState<any>(null);
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

  /**
   * Handle switching to SEARCH TRUCKS tab with filters
   */
  const handleSwitchToSearchTrucks = (filters: any) => {
    setSearchFilters(filters);
    setActiveTab('SEARCH_TRUCKS');
  };

  return (
    <div className="p-6">
      {/* DAT Board Tab Navigation */}
      <div className="mb-6">
        <DatNavTabs
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ShipperTabKey)}
          userRole={user.role}
          portalType="shipper"
        />
      </div>

      {/* Tab Content */}
      <div>
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
