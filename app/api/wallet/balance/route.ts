export const dynamic = "force-dynamic";
/**
 * Wallet Balance API
 *
 * Get current wallet balance for organization
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";
import { reconcileWallet } from "@/lib/walletReconcile";

/**
 * GET /api/wallet/balance
 *
 * Get wallet balance for current user's organization
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User must belong to an organization" },
        { status: 400 }
      );
    }

    // Get wallet accounts for organization
    const walletAccounts = await db.financialAccount.findMany({
      where: {
        organizationId: user.organizationId,
        accountType: {
          in: ["SHIPPER_WALLET", "CARRIER_WALLET"],
        },
        isActive: true,
      },
      select: {
        id: true,
        accountType: true,
        balance: true,
        currency: true,
        minimumBalance: true,
        updatedAt: true,
      },
    });

    if (walletAccounts.length === 0) {
      return NextResponse.json(
        { error: "No wallet found for organization" },
        { status: 404 }
      );
    }

    // Calculate total balance across all wallets
    const totalBalance = walletAccounts.reduce(
      (sum, account) => sum + Number(account.balance),
      0
    );

    // Get recent transaction count
    const recentTransactions = await db.journalEntry.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
        lines: {
          some: {
            OR: [
              { creditAccount: { organizationId: user.organizationId } },
              { account: { organizationId: user.organizationId } },
            ],
          },
        },
      },
    });

    // Per-category breakdown for each wallet (Mobile parity with web)
    // Reuses the reconcileWallet utility to derive categories from journal
    // entries — single source of truth, matches the web wallet pages.
    const reconciliations = await Promise.all(
      walletAccounts.map((acct) => reconcileWallet(acct.id))
    );

    // Sum the per-wallet category totals into single org-level numbers
    let totalDeposited = 0;
    let totalRefunded = 0;
    let serviceFeesPaid = 0;
    let totalWithdrawn = 0;
    let aggregateDrift = 0;

    for (const r of reconciliations) {
      const dep = r.byType.DEPOSIT?.credits ?? 0;
      const refSvc = r.byType.SERVICE_FEE_REFUND?.credits ?? 0;
      const refWith = r.byType.REFUND?.credits ?? 0;
      const fee = r.byType.SERVICE_FEE_DEDUCT?.debits ?? 0;
      const withd = r.byType.WITHDRAWAL?.debits ?? 0;

      totalDeposited += dep;
      totalRefunded += refSvc + refWith;
      serviceFeesPaid += fee;
      totalWithdrawn += withd;
      aggregateDrift += r.drift;
    }

    return NextResponse.json({
      wallets: walletAccounts.map((account, i) => ({
        id: account.id,
        type: account.accountType,
        balance: Number(account.balance),
        currency: account.currency,
        minimumBalance: Number(account.minimumBalance ?? 0),
        updatedAt: account.updatedAt,
        // Per-wallet ledger metadata (drift indicator for admin tools)
        ledgerDrift: reconciliations[i].drift,
        isLedgerInSync: reconciliations[i].isInSync,
      })),
      totalBalance,
      currency: walletAccounts[0]?.currency || "ETB",
      recentTransactionsCount: recentTransactions,
      // Per-category totals (NEW — used by mobile + future admin views)
      // The math invariant always holds:
      //   totalBalance ≈ totalDeposited + totalRefunded
      //                  − serviceFeesPaid − totalWithdrawn
      // (modulo any drift, which is surfaced via isLedgerInSync below)
      totalDeposited,
      totalRefunded,
      serviceFeesPaid,
      totalWithdrawn,
      ledgerDrift: aggregateDrift,
      isLedgerInSync: Math.abs(aggregateDrift) <= 0.01,
    });
  } catch (error) {
    return handleApiError(error, "Get wallet balance error");
  }
}
