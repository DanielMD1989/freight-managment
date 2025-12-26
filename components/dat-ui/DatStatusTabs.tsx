'use client';

/**
 * DAT Status Tabs Component
 *
 * Status filter tabs with counts (ALL: 6, POSTED: 4, KEPT: 2, etc.)
 * Sprint 14 - DAT-Style UI Transformation
 */

import { DatStatusTabsProps } from '@/types/dat-ui';

export default function DatStatusTabs({
  tabs,
  activeTab,
  onTabChange,
}: DatStatusTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              px-4 py-2
              rounded-md
              text-sm
              font-medium
              transition-colors
              duration-150
              ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`ml-2 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
