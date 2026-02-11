'use client';

/**
 * Shipper Load Board Client Component
 *
 * Main client wrapper showing POST LOADS or SEARCH TRUCKS based on URL tab parameter
 * Navigation handled via sidebar and inline tabs
 * Updated: UI/UX Professionalization Pass
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostLoadsTab from './PostLoadsTab';
import SearchTrucksTab from './SearchTrucksTab';
// L34 FIX: Properly typed search filters
interface SearchFilters {
  origin?: string;
  destination?: string;
  truckType?: string;
  pickupDate?: string;
  length?: string;
  weight?: string;
  [key: string]: string | number | boolean | undefined; // Allow dynamic keys
}

// User shape from session (userId vs id)
interface SessionUser {
  userId: string;
  email: string;
  role: string;
  status?: string;
  organizationId?: string;
}

interface ShipperLoadboardClientProps {
  user: SessionUser;
}

type ShipperTabKey = 'POST_LOADS' | 'SEARCH_TRUCKS';

const TABS = [
  { key: 'POST_LOADS' as ShipperTabKey, label: 'My Loads', icon: PackageIcon },
  { key: 'SEARCH_TRUCKS' as ShipperTabKey, label: 'Search Trucks', icon: SearchIcon },
];

function PackageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export default function ShipperLoadboardClient({ user }: ShipperLoadboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ShipperTabKey>('POST_LOADS');
  // L35 FIX: Properly typed search filters state
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);

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
   * Handle tab change
   */
  const handleTabChange = (tab: ShipperTabKey) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.push(`${window.location.pathname}?${params.toString()}`);
    setActiveTab(tab);
  };

  /**
   * Handle switching to SEARCH TRUCKS tab with filters
   * L36 FIX: Properly typed filters parameter
   */
  const handleSwitchToSearchTrucks = (filters: SearchFilters) => {
    setSearchFilters(filters);
    handleTabChange('SEARCH_TRUCKS');
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--foreground)' }}
        >
          Loadboard
        </h1>
        <p
          className="mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Post your loads or find available trucks
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        className="flex gap-1 p-1 rounded-lg mb-6 w-fit"
        style={{ background: 'var(--bg-tinted)' }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                transition-all duration-200
              `}
              style={{
                background: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
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
            initialFilters={searchFilters ?? undefined}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}
