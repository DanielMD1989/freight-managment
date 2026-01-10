'use client';

/**
 * DAT Navigation Tabs Component
 *
 * Top-level navigation: POST LOADS | SEARCH TRUCKS | POST TRUCKS | SEARCH LOADS
 * Option B: Clean & Minimal Design System (Teal + Indigo)
 */

import { DatNavTabsProps, DatNavTab } from '@/types/dat-ui';

// SVG Icon Components
const PackageIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

// Icon mapping
const iconComponents: Record<string, React.FC> = {
  'POST_LOADS': PackageIcon,
  'SEARCH_TRUCKS': TruckIcon,
  'POST_TRUCKS': UploadIcon,
  'SEARCH_LOADS': SearchIcon,
};

const ALL_TABS: DatNavTab[] = [
  {
    key: 'POST_LOADS',
    label: 'Post Loads',
    icon: '📦',
    roles: ['SHIPPER', 'ADMIN'],
  },
  {
    key: 'SEARCH_TRUCKS',
    label: 'Search Trucks',
    icon: '🚛',
    roles: ['SHIPPER', 'ADMIN'],
  },
  {
    key: 'POST_TRUCKS',
    label: 'Post Trucks',
    icon: '🚚',
    roles: ['CARRIER', 'ADMIN'],
  },
  {
    key: 'SEARCH_LOADS',
    label: 'Search Loads',
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
  // Filter tabs based on portal type (role-based filtering happens via tab.roles)
  const visibleTabs = ALL_TABS.filter((tab) => {
    // First check if user role is allowed for this tab
    if (!tab.roles.includes(userRole)) {
      return false;
    }

    // Filter by portal context - applies to ALL users including ADMIN
    if (portalType === 'shipper') {
      return tab.key === 'POST_LOADS' || tab.key === 'SEARCH_TRUCKS';
    } else if (portalType === 'carrier') {
      return tab.key === 'POST_TRUCKS' || tab.key === 'SEARCH_LOADS';
    }

    // If no portalType specified, show all tabs for user's role (backward compatible)
    return true;
  });

  return (
    <div className="flex gap-2">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const IconComponent = iconComponents[tab.key];

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              px-5 py-2.5
              text-sm
              font-semibold
              rounded-lg
              transition-all
              duration-200
              flex
              items-center
              gap-2
              ${
                isActive
                  ? 'bg-white text-[#1e9c99] shadow-md'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white border border-white/20'
              }
            `}
          >
            {IconComponent && <IconComponent />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
