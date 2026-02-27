/**
 * Admin All Wallets Page
 *
 * Platform-wide view of all financial accounts
 * Admin oversight with financial summary
 */

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminWalletsClient from "./AdminWalletsClient";

export const metadata = {
  title: "All Wallets | Admin",
  description: "Platform-wide financial account management",
};

export default async function AdminWalletsPage() {
  const session = await requireAuth();

  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-md shadow-green-500/25">
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
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              User Wallets
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage shipper and carrier financial accounts
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<WalletsSkeleton />}>
        <AdminWalletsClient />
      </Suspense>
    </div>
  );
}

function WalletsSkeleton() {
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
