/**
 * Wallet Reconciliation Utility — Blueprint §8 financial integrity
 *
 * The platform's authoritative ledger is the JournalEntry / JournalLine table.
 * `FinancialAccount.balance` is a denormalized cache for fast reads. These two
 * MUST stay in sync — any drift indicates a data integrity bug.
 *
 * This utility provides:
 *   - `reconcileWallet(walletId)` — single-wallet drift report
 *   - `reconcileAllWallets()` — platform-wide audit
 *
 * Used by:
 *   - Admin reconciliation script (`scripts/reconcile-wallets.ts`)
 *   - Wallet page integrity check (logs warning if drift detected)
 *   - Jest test suite (`__tests__/financial/ledger-integrity.test.ts`)
 */

import { db } from "@/lib/db";

export interface WalletReconciliation {
  walletId: string;
  organizationId: string | null;
  accountType: string;
  /** Stored value of FinancialAccount.balance (denormalized cache) */
  storedBalance: number;
  /** Computed value from journal lines: sum(credits) − sum(debits) */
  computedBalance: number;
  /** Difference (stored − computed). Zero if in sync. */
  drift: number;
  /** True if |drift| <= 0.01 (rounding tolerance) */
  isInSync: boolean;
  /** Per-transaction-type breakdown of credits and debits */
  byType: Record<string, { credits: number; debits: number }>;
  /** Total credits (all types) */
  totalCredits: number;
  /** Total debits (all types) */
  totalDebits: number;
  /** Number of journal lines processed */
  lineCount: number;
}

/**
 * Reconcile a single wallet — compare stored balance vs computed from journal.
 *
 * @param walletId The FinancialAccount.id of the wallet to reconcile
 * @returns A WalletReconciliation report
 * @throws if the wallet doesn't exist
 */
export async function reconcileWallet(
  walletId: string
): Promise<WalletReconciliation> {
  const wallet = await db.financialAccount.findUnique({
    where: { id: walletId },
    select: {
      id: true,
      organizationId: true,
      accountType: true,
      balance: true,
    },
  });

  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  // Fetch ALL journal lines for this account, regardless of transactionType
  const lines = await db.journalLine.findMany({
    where: { accountId: walletId },
    select: {
      amount: true,
      isDebit: true,
      journalEntry: { select: { transactionType: true } },
    },
  });

  let totalCredits = 0;
  let totalDebits = 0;
  const byType: Record<string, { credits: number; debits: number }> = {};

  for (const line of lines) {
    const amount = Number(line.amount);
    const type = line.journalEntry.transactionType;
    if (!byType[type]) {
      byType[type] = { credits: 0, debits: 0 };
    }
    if (line.isDebit) {
      totalDebits += amount;
      byType[type].debits += amount;
    } else {
      totalCredits += amount;
      byType[type].credits += amount;
    }
  }

  const computedBalance = totalCredits - totalDebits;
  const storedBalance = Number(wallet.balance);
  const drift = storedBalance - computedBalance;

  return {
    walletId: wallet.id,
    organizationId: wallet.organizationId,
    accountType: wallet.accountType,
    storedBalance,
    computedBalance,
    drift,
    isInSync: Math.abs(drift) <= 0.01,
    byType,
    totalCredits,
    totalDebits,
    lineCount: lines.length,
  };
}

/**
 * Reconcile every wallet in the database. Returns one report per account.
 *
 * Use this for platform-wide audits. Sorted with out-of-sync wallets first
 * so reconciliation reports surface problems at the top.
 */
export async function reconcileAllWallets(): Promise<WalletReconciliation[]> {
  const wallets = await db.financialAccount.findMany({
    where: {
      accountType: {
        in: ["SHIPPER_WALLET", "CARRIER_WALLET", "PLATFORM_REVENUE"],
      },
    },
    select: { id: true },
  });

  const reports = await Promise.all(wallets.map((w) => reconcileWallet(w.id)));

  // Out-of-sync first, then by drift magnitude descending
  reports.sort((a, b) => {
    if (a.isInSync !== b.isInSync) return a.isInSync ? 1 : -1;
    return Math.abs(b.drift) - Math.abs(a.drift);
  });

  return reports;
}
