/**
 * Wallet Gate — Blueprint §8 enforcement
 *
 * "Before any action — searching loads, matching trucks, sending/receiving
 *  requests — the system checks wallet balance. If below the required minimum,
 *  the user cannot view, match, request, or be requested."
 *
 * Returns a 402 NextResponse if the caller's org wallet is below minimumBalance,
 * or null if the gate passes (caller may proceed).
 *
 * Admin/SuperAdmin are always exempt (they don't have marketplace wallets).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification, NotificationType } from "@/lib/notifications";

interface WalletGateSession {
  userId: string;
  role: string;
  organizationId?: string | null;
}

/**
 * Check wallet balance for a marketplace action.
 *
 * @returns NextResponse (402) if blocked, or null if OK.
 */
export async function checkWalletGate(
  session: WalletGateSession
): Promise<NextResponse | null> {
  // Admin/SuperAdmin bypass — no marketplace wallet
  if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
    return null;
  }

  // Dispatcher bypass — no wallet, coordination-only role
  if (session.role === "DISPATCHER") {
    return null;
  }

  // Driver bypass — drivers are workers inside a carrier org, not marketplace
  // actors. The carrier org's wallet gates its own marketplace access.
  if (session.role === "DRIVER") {
    return null;
  }

  if (!session.organizationId) {
    return null;
  }

  const walletAccount = await db.financialAccount.findFirst({
    where: { organizationId: session.organizationId, isActive: true },
    select: { balance: true, minimumBalance: true },
  });

  if (!walletAccount || walletAccount.balance >= walletAccount.minimumBalance) {
    return null; // Gate passes
  }

  // Fire LOW_BALANCE_WARNING at most once per 24h per user (non-blocking)
  const oneDayAgo = new Date(Date.now() - 86_400_000);
  db.notification
    .findFirst({
      where: {
        userId: session.userId,
        type: NotificationType.LOW_BALANCE_WARNING,
        createdAt: { gte: oneDayAgo },
      },
    })
    .then((existing) => {
      if (!existing) {
        createNotification({
          userId: session.userId,
          type: NotificationType.LOW_BALANCE_WARNING,
          title: "Insufficient Wallet Balance",
          message: `Your wallet balance is below the required minimum (${Number(walletAccount.minimumBalance).toLocaleString()} ETB). Top up to restore marketplace access.`,
          metadata: {
            currentBalance: Number(walletAccount.balance),
            minimumBalance: Number(walletAccount.minimumBalance),
          },
        }).catch((err) => console.error("low-balance notify err", err));
      }
    })
    .catch(() => {});

  return NextResponse.json(
    { error: "Insufficient wallet balance for marketplace access" },
    { status: 402 }
  );
}
