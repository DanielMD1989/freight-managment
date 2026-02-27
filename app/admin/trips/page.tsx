/**
 * Admin All Trips Page
 *
 * Platform-wide view of all trips
 * Admin oversight with financial summary
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminTripsClient from "./AdminTripsClient";

export const metadata = {
  title: "All Trips | Admin",
  description: "Platform-wide trip management",
};

export default async function AdminTripsPage() {
  const session = await requireAuth();

  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-md shadow-purple-500/25">
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
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              All Trips
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Platform-wide view of all trips with financial overview
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<TripsSkeleton />}>
        <AdminTripsClient />
      </Suspense>
    </div>
  );
}

function TripsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-700"></div>
        <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-700"></div>
        <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-700"></div>
      </div>
      <div className="h-12 w-96 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
      <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-700"></div>
    </div>
  );
}
