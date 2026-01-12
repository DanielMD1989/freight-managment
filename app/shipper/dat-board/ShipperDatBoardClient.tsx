'use client';

/**
 * Shipper DAT Board Client Component
 *
 * Main client wrapper showing POST LOADS or SEARCH TRUCKS based on URL tab parameter
 * Navigation handled via sidebar
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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

  // Read tab from URL parameters (navigation via sidebar)
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
  }, [searchParams]);

  /**
   * Handle switching to SEARCH TRUCKS tab with filters
   */
  const handleSwitchToSearchTrucks = (filters: any) => {
    setSearchFilters(filters);
    // Navigate via URL for sidebar sync
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'SEARCH_TRUCKS');
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    setActiveTab('SEARCH_TRUCKS');
  };

  return (
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
  );
}
