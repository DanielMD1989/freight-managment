/**
 * Admin Wallet Deposits Approval Page — Blueprint §8 + §9
 *
 * Admin reviews pending self-service deposit requests submitted via
 * POST /api/wallet/deposit and approves/rejects them. Approval credits
 * the wallet atomically (journal entry + balance increment + status flip).
 *
 * Blueprint §8: "Wallet Top-Up Methods: Bank Transfer Slip (processed by Admin)"
 * Blueprint §9: "Wallet Management — Deposit funds via bank slip into user wallets"
 */

import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminWalletDepositsClient from "./AdminWalletDepositsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wallet Deposit Requests | Admin",
  description:
    "Review and approve user-submitted wallet deposit requests (Blueprint §8/§9)",
};

export default async function AdminWalletDepositsPage() {
  const session = await requireAuth();

  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Wallet Deposit Requests
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review user-submitted deposits and approve or reject (Blueprint §8
              / §9)
            </p>
          </div>
        </div>
      </div>

      <AdminWalletDepositsClient />
    </div>
  );
}
