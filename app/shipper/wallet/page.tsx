/**
 * Shipper Wallet Page
 *
 * Financial management page showing:
 * - Wallet balance (current and available)
 * - Financial summary (deposits, spending, pending)
 * - Transaction history with filtering
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import ShipperWalletClient from "./ShipperWalletClient";

export const metadata = {
  title: "Wallet | Shipper",
  description: "Manage your wallet balance and view transactions",
};

export default async function WalletPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/shipper/wallet");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "SHIPPER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/shipper?error=no-organization");
  }

  // Fetch wallet account
  const walletAccount = await db.financialAccount.findFirst({
    where: {
      organizationId: session.organizationId,
      accountType: "SHIPPER_WALLET",
    },
    select: {
      id: true,
      balance: true,
      currency: true,
      minimumBalance: true,
      createdAt: true,
    },
  });

  // Calculate pending payments (trips in progress that will deduct service fees)
  const pendingTrips = await db.load.aggregate({
    where: {
      shipperId: session.organizationId,
      status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT", "DELIVERED"] },
      shipperServiceFee: { gt: 0 },
      shipperFeeStatus: { not: "DEDUCTED" },
    },
    _sum: {
      shipperServiceFee: true,
    },
    _count: true,
  });

  // ─── Financial summary from journal entries ───────────────────────────────
  // Single source of truth: ALL journal lines for this wallet, grouped by
  // transactionType + isDebit. This guarantees:
  //   totalDeposited (all credits) − totalSpent (all debits) === wallet.balance
  // (modulo seed-time drift, surfaced as integrity warning below)
  //
  // Categories shown in UI:
  //   - totalDeposited:  DEPOSIT credits (real money in)
  //   - totalRefunded:   SERVICE_FEE_REFUND + REFUND credits (money returned)
  //   - serviceFeesPaid: SERVICE_FEE_DEDUCT debits
  //   - totalWithdrawn:  WITHDRAWAL debits
  //   - totalSpent:      serviceFeesPaid + totalWithdrawn (existing card label)
  //
  // Math invariant (always true if ledger is consistent):
  //   balance === (totalDeposited + totalRefunded) − (serviceFeesPaid + totalWithdrawn)
  if (!walletAccount) {
    redirect("/shipper?error=no-wallet");
  }

  const journalGroups = await db.journalLine.groupBy({
    by: ["isDebit"],
    where: {
      accountId: walletAccount.id,
    },
    _sum: { amount: true },
  });

  const totalCredits = Number(
    journalGroups.find((g) => g.isDebit === false)?._sum.amount ?? 0
  );
  const totalDebits = Number(
    journalGroups.find((g) => g.isDebit === true)?._sum.amount ?? 0
  );

  // Per-type breakdown for the labelled cards
  const journalByType = await db.journalLine.findMany({
    where: { accountId: walletAccount.id },
    select: {
      amount: true,
      isDebit: true,
      journalEntry: { select: { transactionType: true } },
    },
  });

  const sumByCategory = (types: string[], debit: boolean): number =>
    journalByType
      .filter(
        (l) =>
          l.isDebit === debit && types.includes(l.journalEntry.transactionType)
      )
      .reduce((sum, l) => sum + Number(l.amount), 0);

  const totalDeposited = sumByCategory(["DEPOSIT"], false);
  const totalRefunded = sumByCategory(["SERVICE_FEE_REFUND", "REFUND"], false);
  const serviceFeesPaid = sumByCategory(["SERVICE_FEE_DEDUCT"], true);
  const totalWithdrawn = sumByCategory(["WITHDRAWAL"], true);

  // Ledger integrity check: stored balance should equal computed balance
  // (totalCredits − totalDebits). Drift indicates a data integrity issue
  // (most often a seed bug). Surface to logs so devs notice.
  const computedBalance = totalCredits - totalDebits;
  const storedBalance = Number(walletAccount.balance);
  const ledgerDrift = storedBalance - computedBalance;
  if (Math.abs(ledgerDrift) > 0.01) {
    console.warn(
      `[wallet integrity] Shipper wallet ${walletAccount.id} drift: stored=${storedBalance}, computed=${computedBalance}, drift=${ledgerDrift}`
    );
  }

  // Get recent transactions with details
  const recentTransactions = await db.journalLine.findMany({
    where: {
      account: {
        organizationId: session.organizationId,
        accountType: "SHIPPER_WALLET",
      },
    },
    include: {
      journalEntry: {
        select: {
          id: true,
          transactionType: true,
          description: true,
          reference: true,
          createdAt: true,
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50, // Get last 50 transactions for client-side filtering
  });

  // Transform transactions for client. Sprint: data-consistency audit —
  // use journalEntry.id (not journalLine.id) so the test can compare to
  // the same entity API/Expo use.
  const transactions = recentTransactions.map((line) => ({
    id: line.journalEntry.id,
    date: line.createdAt.toISOString(),
    type: line.journalEntry.transactionType,
    description: line.journalEntry.description,
    reference: line.journalEntry.reference,
    amount: Number(line.amount),
    isDebit: line.isDebit,
    loadId: line.journalEntry.load?.id || null,
    loadRoute: line.journalEntry.load
      ? `${line.journalEntry.load.pickupCity} → ${line.journalEntry.load.deliveryCity}`
      : null,
  }));

  const walletData = {
    balance: storedBalance,
    currency: walletAccount.currency || "ETB",
    availableBalance:
      storedBalance - Number(pendingTrips._sum.shipperServiceFee || 0),
    pendingAmount: Number(pendingTrips._sum.shipperServiceFee || 0),
    pendingTripsCount: pendingTrips._count,
    // Per-category totals (derived from journal — single source of truth)
    totalDeposited,
    totalRefunded,
    serviceFeesPaid,
    totalWithdrawn,
    // totalSpent kept for backward-compat with existing UI card label
    totalSpent: serviceFeesPaid + totalWithdrawn,
    minimumBalance: Number(walletAccount.minimumBalance || 0),
    // Ledger integrity metadata
    ledgerDrift,
    isLedgerInSync: Math.abs(ledgerDrift) <= 0.01,
    transactions,
  };

  return <ShipperWalletClient walletData={walletData} />;
}
