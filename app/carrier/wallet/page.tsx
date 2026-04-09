/**
 * Carrier Wallet Page
 *
 * Financial management page showing:
 * - Wallet balance (current and available)
 * - Financial summary (earnings, pending, completed)
 * - Transaction history with filtering
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import CarrierWalletClient from "./CarrierWalletClient";

export const metadata = {
  title: "Wallet | Carrier",
  description: "Manage your earnings and view transactions",
};

export default async function CarrierWalletPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/carrier/wallet");
  }

  const session = await verifyToken(sessionCookie.value);

  if (
    !session ||
    (session.role !== "CARRIER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized");
  }

  if (!session.organizationId) {
    redirect("/carrier?error=no-organization");
  }

  // Fetch wallet account
  const walletAccount = await db.financialAccount.findFirst({
    where: {
      organizationId: session.organizationId,
      accountType: "CARRIER_WALLET",
    },
    select: {
      id: true,
      balance: true,
      currency: true,
      minimumBalance: true,
      createdAt: true,
    },
  });

  if (!walletAccount) {
    redirect("/carrier?error=no-wallet");
  }

  // Pending earnings (trips in progress that will pay out)
  const pendingTrips = await db.load.aggregate({
    where: {
      assignedTruck: {
        is: { carrierId: session.organizationId },
      },
      status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
    },
    _count: true,
  });

  // ─── Financial summary from journal entries ───────────────────────────────
  // Per-category breakdown (matches shipper wallet pattern, single source of truth):
  //   - totalDeposited:  DEPOSIT credits (admin top-ups, user deposits)
  //   - totalRefunded:   SERVICE_FEE_REFUND + REFUND credits
  //   - serviceFeesPaid: SERVICE_FEE_DEDUCT debits (carrier fees, NOT withdrawals)
  //   - totalWithdrawn:  WITHDRAWAL debits
  //
  // Math invariant (always true if ledger is consistent):
  //   balance === (totalDeposited + totalRefunded) − (serviceFeesPaid + totalWithdrawn)
  //
  // Previous version conflated SERVICE_FEE_REFUND with "earnings" and
  // SERVICE_FEE_DEDUCT with "withdrawals" — fixed.
  const journalGroups = await db.journalLine.groupBy({
    by: ["isDebit"],
    where: { accountId: walletAccount.id },
    _sum: { amount: true },
  });

  const totalCredits = Number(
    journalGroups.find((g) => g.isDebit === false)?._sum.amount ?? 0
  );
  const totalDebits = Number(
    journalGroups.find((g) => g.isDebit === true)?._sum.amount ?? 0
  );

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

  // Ledger integrity check
  const computedBalance = totalCredits - totalDebits;
  const storedBalance = Number(walletAccount.balance);
  const ledgerDrift = storedBalance - computedBalance;
  if (Math.abs(ledgerDrift) > 0.01) {
    console.warn(
      `[wallet integrity] Carrier wallet ${walletAccount.id} drift: stored=${storedBalance}, computed=${computedBalance}, drift=${ledgerDrift}`
    );
  }

  const completedTripsCount = await db.load.count({
    where: {
      status: "DELIVERED",
      assignedTruck: {
        is: { carrierId: session.organizationId },
      },
    },
  });

  // Recent transactions
  const recentTransactions = await db.journalLine.findMany({
    where: {
      account: {
        organizationId: session.organizationId,
        accountType: "CARRIER_WALLET",
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
    take: 50,
  });

  const transactions = recentTransactions.map((line) => ({
    id: line.id,
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
    // Per-category totals (derived from journal — single source of truth)
    totalDeposited,
    totalRefunded,
    serviceFeesPaid,
    totalWithdrawn,
    // Legacy fields kept for backward compat with existing UI cards
    // Carrier "earnings" historically meant deposits + refunds (real income)
    totalEarnings: totalDeposited + totalRefunded,
    totalWithdrawals: totalWithdrawn,
    pendingTripsCount: pendingTrips._count,
    completedTripsCount,
    minimumBalance: Number(walletAccount.minimumBalance || 0),
    // Ledger integrity metadata
    ledgerDrift,
    isLedgerInSync: Math.abs(ledgerDrift) <= 0.01,
    transactions,
  };

  return <CarrierWalletClient walletData={walletData} />;
}
