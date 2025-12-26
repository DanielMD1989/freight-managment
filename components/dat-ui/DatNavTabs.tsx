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
    roles: ['SHIPPER', 'ADMIN'],
  },
  {
    key: 'SEARCH_TRUCKS',
    label: 'SEARCH TRUCKS',
    roles: ['SHIPPER', 'ADMIN'],
  },
  {
    key: 'POST_TRUCKS',
    label: 'POST TRUCKS',
    roles: ['CARRIER', 'ADMIN'],
  },
  {
    key: 'SEARCH_LOADS',
    label: 'SEARCH LOADS',
    roles: ['CARRIER', 'ADMIN'],
  },
];

export default function DatNavTabs({
  userRole,
  activeTab,
  onTabChange,
}: DatNavTabsProps) {
  // Filter tabs based on user role
  const visibleTabs = ALL_TABS.filter((tab) => tab.roles.includes(userRole));

  return (
    <div className="flex gap-2 mb-6 border-b border-gray-200">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              px-6 py-3
              text-sm
              font-semibold
              uppercase
              tracking-wide
              border-b-2
              transition-colors
              duration-150
              ${
                isActive
                  ? 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
