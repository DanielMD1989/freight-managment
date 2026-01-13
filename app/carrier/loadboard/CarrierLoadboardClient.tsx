'use client';

/**
 * Carrier Load Board Client Component
 *
 * Main client wrapper with tab navigation between POST TRUCKS and SEARCH LOADS
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { NavTabs } from '@/components/loadboard-ui';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostTrucksTab from './PostTrucksTab';
import SearchLoadsTab from './SearchLoadsTab';
import NotificationBell from '@/components/NotificationBell';

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
    <div className="min-h-screen bg-[var(--bg-tinted)]">
      {/* Header - Medium Teal Design */}
      <div className="portal-header">
        {/* Navigation Tabs */}
        <div className="flex-1 flex justify-start">
          <NavTabs
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as CarrierTabKey)}
            userRole={user.role}
            portalType="carrier"
          />
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-4 pl-4 border-l border-white/20">
          {/* Notification Bell */}
          <NotificationBell />

          {/* Divider before user info */}
          <div className="h-8 w-px bg-white/20 hidden sm:block"></div>

          {/* User Info */}
          <div className="portal-header-user" style={{ borderLeft: 'none', paddingLeft: 0, marginLeft: 0 }}>
            <div className="portal-header-avatar">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="hidden sm:block">
              <div className="portal-header-name">{user.firstName} {user.lastName}</div>
              <div className="portal-header-role">{user.role}</div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white hover:bg-white/90 text-[#1e9c99] text-sm font-semibold rounded-lg transition-colors border border-white"
          >
            Logout
          </button>
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
            {activeTab === 'POST_TRUCKS' && <PostTrucksTab user={user} />}
            {activeTab === 'SEARCH_LOADS' && <SearchLoadsTab user={user} />}
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
