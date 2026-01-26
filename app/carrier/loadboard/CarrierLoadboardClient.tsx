'use client';

/**
 * Carrier Load Board Client Component
 *
 * Main client wrapper with tab navigation between POST TRUCKS and SEARCH LOADS
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostTrucksTab from './PostTrucksTab';
import SearchLoadsTab from './SearchLoadsTab';

interface CarrierLoadboardClientProps {
  user: any;
}

type CarrierTabKey = 'POST_TRUCKS' | 'SEARCH_LOADS';

export default function CarrierLoadboardClient({ user }: CarrierLoadboardClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CarrierTabKey>('POST_TRUCKS');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Tab State Management with URL persistence
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
    const handlePopState = () => {
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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-teal-500/25 p-2">
            <Image
              src="/cargo-icon.png"
              alt="Load Board"
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Load Board</h1>
            <p className="text-slate-500 text-sm">Post trucks and search for available loads</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-1.5 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('POST_TRUCKS')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'POST_TRUCKS'
              ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Post Trucks
        </button>
        <button
          onClick={() => setActiveTab('SEARCH_LOADS')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'SEARCH_LOADS'
              ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search Loads
        </button>
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
            {activeTab === 'POST_TRUCKS' && <PostTrucksTab user={user} />}
            {activeTab === 'SEARCH_LOADS' && <SearchLoadsTab user={user} />}
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
