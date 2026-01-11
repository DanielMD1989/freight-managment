/**
 * Post Truck Tab Component
 *
 * Split view: Truck posting form (left) + Matching loads grid (right)
 *
 * Features:
 * - Truck posting form
 * - Auto-refresh matching loads after posting
 * - Responsive layout (stacks on mobile)
 *
 * Sprint 8 - Story 8.7: Single-Page Experience
 */

"use client";

import { useState } from "react";

export default function PostTruckTab() {
  const [posted, setPosted] = useState(false);
  const [matchingLoads, setMatchingLoads] = useState<any[]>([]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Posting Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-[#064d51] mb-4">
          Post Your Truck
        </h2>
        <div className="rounded-md bg-[#1e9c99]/10 p-4 border border-[#1e9c99]/20">
          <p className="text-sm text-[#064d51]">
            Truck posting form will be integrated here. For now, use the dedicated{" "}
            <a
              href="/dashboard/trucks/post"
              className="font-medium underline text-[#1e9c99] hover:text-[#064d51]"
            >
              Post Truck page
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right: Matching Loads */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-[#064d51] mb-4">
          Matching Loads
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="mt-2 text-sm">
              Post your truck to see matching loads
            </p>
          </div>
        ) : (
          <div className="text-center py-12 text-[#064d51]/60">
            <p className="text-sm">No matching loads found</p>
          </div>
        )}
      </div>
    </div>
  );
}
