/**
 * Post Load Tab Component
 *
 * Split view: Load posting form (left) + Matching trucks grid (right)
 *
 * Features:
 * - Load posting form
 * - Auto-refresh matching trucks after posting
 * - Responsive layout (stacks on mobile)
 *
 * Sprint 8 - Story 8.7: Single-Page Experience
 */

"use client";

import { useState } from "react";

export default function PostLoadTab() {
  const [posted, setPosted] = useState(false);
  const [matchingTrucks, setMatchingTrucks] = useState<any[]>([]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Posting Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-[#064d51] mb-4">
          Post Your Load
        </h2>
        <div className="rounded-md bg-[#1e9c99]/10 p-4 border border-[#1e9c99]/20">
          <p className="text-sm text-[#064d51]">
            Load posting form will be integrated here. For now, use the dedicated{" "}
            <a
              href="/dashboard/loads/new"
              className="font-medium underline text-[#1e9c99] hover:text-[#064d51]"
            >
              Post Load page
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right: Matching Trucks */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-[#064d51] mb-4">
          Matching Trucks
        </h2>
        {!posted ? (
          <div className="text-center py-12 text-[#064d51]/60">
            <svg
              className="mx-auto h-12 w-12 text-[#064d51]/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p className="mt-2 text-sm">
              Post your load to see matching trucks
            </p>
          </div>
        ) : (
          <div className="text-center py-12 text-[#064d51]/60">
            <p className="text-sm">No matching trucks found</p>
          </div>
        )}
      </div>
    </div>
  );
}
