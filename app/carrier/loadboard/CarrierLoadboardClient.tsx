'use client';

/**
 * Carrier Load Board Client Component
 *
 * Main client wrapper with tab navigation between POST TRUCKS and SEARCH LOADS
 */

import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostTrucksTab from './PostTrucksTab';
import SearchLoadsTab from './SearchLoadsTab';
import { useTabState } from '@/lib/hooks/useTabState';

interface CarrierLoadboardClientProps {
  user: any;
}

type CarrierTabKey = 'POST_TRUCKS' | 'SEARCH_LOADS';

const TABS = [
  { key: 'POST_TRUCKS' as CarrierTabKey, label: 'My Trucks', icon: TruckIcon },
  { key: 'SEARCH_LOADS' as CarrierTabKey, label: 'Search Loads', icon: SearchIcon },
];

function TruckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
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

export default function CarrierLoadboardClient({ user }: CarrierLoadboardClientProps) {
  // URL-based tab persistence using infrastructure hook
  const [activeTab, setActiveTab] = useTabState('POST_TRUCKS');

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
          Post your trucks or find available loads
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
              onClick={() => setActiveTab(tab.key)}
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
        {activeTab === 'POST_TRUCKS' && <PostTrucksTab user={user} />}
        {activeTab === 'SEARCH_LOADS' && <SearchLoadsTab user={user} />}
      </ErrorBoundary>
    </div>
  );
}
