"use client";

/**
 * Status Tabs Component
 *
 * Status filter tabs with counts (ALL: 6, POSTED: 4, KEPT: 2, etc.)
 * Load Board UI Component Library
 */

import { StatusTabsProps } from "@/types/loadboard-ui";

export default function StatusTabs({
  tabs,
  activeTab,
  onTabChange,
}: StatusTabsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              isActive
                ? "bg-[#064d51] text-white shadow-md"
                : "border border-[#064d51]/20 bg-white text-[#064d51] hover:bg-[#064d51]/10"
            } `}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-2 ${isActive ? "text-white/70" : "text-[#064d51]/60"}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
