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
              rounded-lg
              text-sm
              font-semibold
              transition-colors
              duration-150
              ${
                isActive
                  ? 'bg-[#064d51] text-white shadow-md'
                  : 'bg-white text-[#064d51] hover:bg-[#064d51]/10 border border-[#064d51]/20'
              }
            `}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`ml-2 ${isActive ? 'text-white/70' : 'text-[#064d51]/60'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
