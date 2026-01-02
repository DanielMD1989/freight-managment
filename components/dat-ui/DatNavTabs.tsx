'use client';

/**
 * DAT Navigation Tabs Component
 *
 * Top-level navigation: POST LOADS | SEARCH TRUCKS | POST TRUCKS | SEARCH LOADS
 * Sprint 14 - DAT-Style UI Transformation
 */

import { DatNavTabsProps, DatNavTab } from '@/types/dat-ui';

const ALL_TABS: DatNavTab[] = [
  {
    key: 'POST_LOADS',
    label: 'POST LOADS',
    icon: '📦',
    roles: ['SHIPPER', 'ADMIN'],
  },
  {
    key: 'SEARCH_TRUCKS',
    label: 'SEARCH TRUCKS',
    icon: '🚛',
    roles: ['SHIPPER', 'ADMIN'],
  },
  {
    key: 'POST_TRUCKS',
    label: 'POST TRUCKS',
    icon: '🚚',
    roles: ['CARRIER', 'ADMIN'],
  },
  {
    key: 'SEARCH_LOADS',
    label: 'SEARCH LOADS',
    icon: '🔍',
    roles: ['CARRIER', 'ADMIN'],
  },
];

export default function DatNavTabs({
  userRole,
  activeTab,
  onTabChange,
  portalType,
}: DatNavTabsProps) {
  // Filter tabs based on user role AND portal type
  const visibleTabs = ALL_TABS.filter((tab) => {
    // First check if user role is allowed for this tab
    if (!tab.roles.includes(userRole)) {
      return false;
    }

    // If portalType is specified, filter by portal context
    if (portalType === 'shipper') {
      return tab.key === 'POST_LOADS' || tab.key === 'SEARCH_TRUCKS';
    } else if (portalType === 'carrier') {
      return tab.key === 'POST_TRUCKS' || tab.key === 'SEARCH_LOADS';
    }

    // If no portalType specified, show all tabs for user's role (backward compatible)
    return true;
  });

  return (
    <div className="flex gap-1">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              px-5 py-2
              text-xs
              font-bold
              uppercase
              tracking-wide
              rounded-t-md
              transition-colors
              duration-150
              flex
              items-center
              gap-2
              ${
                isActive
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }
            `}
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
