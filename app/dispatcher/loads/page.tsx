/**
 * Dispatcher Loads Page
 *
 * Full view of all posted loads in the system
 * Dispatchers can search, filter, and find matching trucks
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoadsClient from "./LoadsClient";

export default async function DispatcherLoadsPage() {
  const session = await requireAuth();

  if (
    session.role !== "DISPATCHER" &&
    session.role !== "ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    redirect("/dispatcher");
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/25">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">All Loads</h1>
            <p className="text-sm text-slate-500">
              Browse and search all posted loads. Find matching trucks for
              assignment.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadsSkeleton />}>
        <LoadsClient />
      </Suspense>
    </div>
  );
}

function LoadsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-16 rounded-2xl bg-gray-200"></div>
      <div className="h-96 rounded-2xl bg-gray-200"></div>
    </div>
  );
}
