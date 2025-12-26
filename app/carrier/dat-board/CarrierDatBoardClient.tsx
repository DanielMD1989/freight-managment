'use client';

/**
 * Carrier DAT Board Client Component
 *
 * Main client wrapper with tab navigation between POST TRUCKS and SEARCH LOADS
 * Sprint 14 - DAT-Style UI Transformation (Phase 6: Error Boundaries)
 */

import React, { useState } from 'react';
import { DatNavTabs } from '@/components/dat-ui';
import ErrorBoundary from '@/components/ErrorBoundary';
import PostTrucksTab from './PostTrucksTab';
import SearchLoadsTab from './SearchLoadsTab';

interface CarrierDatBoardClientProps {
  user: any;
}

type CarrierTabKey = 'POST_TRUCKS' | 'SEARCH_LOADS';

export default function CarrierDatBoardClient({ user }: CarrierDatBoardClientProps) {
  const [activeTab, setActiveTab] = useState<CarrierTabKey>('POST_TRUCKS');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">DAT Load Board</h1>
        <p className="text-sm text-gray-600 mt-1">
          Professional freight marketplace for carriers
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <DatNavTabs
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as CarrierTabKey)}
          userRole={user.role}
        />
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <ErrorBoundary>
          {activeTab === 'POST_TRUCKS' && <PostTrucksTab user={user} />}
          {activeTab === 'SEARCH_LOADS' && <SearchLoadsTab user={user} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
