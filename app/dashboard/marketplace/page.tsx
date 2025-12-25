/**
 * Unified Marketplace Page
 *
 * Single-page marketplace experience with tabbed interface.
 *
 * Tabs:
 * 1. Post Truck - Truck posting form + matching loads grid
 * 2. Post Load - Load posting form + matching trucks grid
 * 3. Find Loads - Load marketplace (carrier view)
 * 4. Find Trucks - Truck postings (shipper view)
 *
 * Features:
 * - Tab state persisted in URL params
 * - Split view layout for posting tabs (form left, results right)
 * - Responsive layout (stacks on mobile)
 * - Auto-refresh of matching results
 *
 * Sprint 8 - Story 8.7: Single-Page Experience
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PostTruckTab from "@/components/marketplace/PostTruckTab";
import PostLoadTab from "@/components/marketplace/PostLoadTab";
import FindLoadsTab from "@/components/marketplace/FindLoadsTab";
import FindTrucksTab from "@/components/marketplace/FindTrucksTab";

type TabId = "post-truck" | "post-load" | "find-loads" | "find-trucks";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
  roles?: string[]; // Optional role restriction
}

const TABS: Tab[] = [
  {
    id: "post-truck",
    label: "Post Truck",
    icon: "🚛",
    description: "Post your available truck and see matching loads",
    roles: ["CARRIER", "LOGISTICS_AGENT"],
  },
  {
    id: "post-load",
    label: "Post Load",
    icon: "📦",
    description: "Post your load and find matching trucks",
    roles: ["SHIPPER", "LOGISTICS_AGENT"],
  },
  {
    id: "find-loads",
    label: "Find Loads",
    icon: "🔍",
    description: "Browse available loads for your trucks",
    roles: ["CARRIER", "LOGISTICS_AGENT"],
  },
  {
    id: "find-trucks",
    label: "Find Trucks",
    icon: "🚚",
    description: "Browse available trucks for your loads",
    roles: ["SHIPPER", "LOGISTICS_AGENT"],
  },
];

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get tab from URL params, default to post-truck
  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "post-truck"
  );

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [activeTab]);

  // Sync state with URL params
  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
        <p className="mt-2 text-sm text-gray-600">
          Post trucks, post loads, or browse the marketplace - all in one place
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm
                  flex items-center gap-2 min-w-fit
                  ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Description */}
      <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4">
        <p className="text-sm text-blue-700">
          {TABS.find((t) => t.id === activeTab)?.description}
        </p>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === "post-truck" && <PostTruckTab />}
        {activeTab === "post-load" && <PostLoadTab />}
        {activeTab === "find-loads" && <FindLoadsTab />}
        {activeTab === "find-trucks" && <FindTrucksTab />}
      </div>
    </div>
  );
}
