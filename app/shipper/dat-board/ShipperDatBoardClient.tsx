'use client';

/**
 * Shipper DAT Board Client Component
 *
 * Main client wrapper with tab navigation between POST LOADS and SEARCH TRUCKS
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState } from 'react';
import { DatNavTabs } from '@/components/dat-ui';
import PostLoadsTab from './PostLoadsTab';
import SearchTrucksTab from './SearchTrucksTab';

interface ShipperDatBoardClientProps {
  user: any;
}

type ShipperTabKey = 'POST_LOADS' | 'SEARCH_TRUCKS';

export default function ShipperDatBoardClient({ user }: ShipperDatBoardClientProps) {
  const [activeTab, setActiveTab] = useState<ShipperTabKey>('POST_LOADS');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">DAT Load Board</h1>
        <p className="text-sm text-gray-600 mt-1">
          Professional freight marketplace for shippers
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <DatNavTabs
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ShipperTabKey)}
          userRole={user.role}
        />
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'POST_LOADS' && <PostLoadsTab user={user} />}
        {activeTab === 'SEARCH_TRUCKS' && <SearchTrucksTab user={user} />}
      </div>
    </div>
  );
}
