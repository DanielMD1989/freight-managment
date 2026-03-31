export const dynamic = "force-dynamic";
/**
 * Wallet Transactions API
 *
 * Get transaction history for organization's wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/wallet/transactions
 *
 * Get transaction history for current user's organization
 *
 * Query params:
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 * - type: COMMISSION | PAYMENT | REFUND | ADJUSTMENT (optional filter)
 */
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50") || 50, 1),
      100
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0") || 0,
      0
    );
    const typeParam = searchParams.get("type");
    const validTypes = [
      "DEPOSIT",
      "WITHDRAWAL",
      "COMMISSION",
      "SETTLEMENT",
      "REFUND",
      "SERVICE_FEE_DEDUCT",
      "SERVICE_FEE_REFUND",
    ] as const;
    // FIX: Use proper type narrowing
    type ValidType = (typeof validTypes)[number];
    const type: ValidType | null =
      typeParam && (validTypes as readonly string[]).includes(typeParam)
        ? (typeParam as ValidType)
        : null;

    // Get wallet accounts
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
      },
    });

    if (walletAccounts.length === 0) {
      return NextResponse.json(
        { error: "No wallet found for organization" },
        { status: 404 }
      );
    }

    const walletAccountIds = walletAccounts.map((account) => account.id);

    // Build where clause for journal entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      lines: {
        some: {
          OR: [
            { accountId: { in: walletAccountIds } },
            { creditAccountId: { in: walletAccountIds } },
          ],
        },
      },
    };

    if (type) {
      where.transactionType = type;
    }

    // Get transactions
    const [transactions, totalCount] = await Promise.all([
      db.journalEntry.findMany({
        where,
        select: {
          id: true,
          transactionType: true,
          description: true,
          reference: true,
          loadId: true,
          createdAt: true,
          lines: {
            where: {
              OR: [
                { accountId: { in: walletAccountIds } },
                { creditAccountId: { in: walletAccountIds } },
              ],
            },
            select: {
              amount: true,
              isDebit: true,
              accountId: true,
              creditAccountId: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      db.journalEntry.count({ where }),
    ]);

    // Format transactions for display
    const formattedTransactions = transactions
      .filter((tx) => tx.lines && tx.lines.length > 0) // Skip transactions with no lines
      .map((tx) => {
        // BUG-R3-2 FIX: Find the line for this org's wallet; skip if none found
        // (prevents wrong sign when tx.lines[0] belongs to another party)
        // BUG-B1-3 FIX: Also check creditAccountId so deposits/topups/refunds
        // (wallet on credit side) are not silently dropped.
        const walletLine = tx.lines.find(
          (line) =>
            (line.accountId && walletAccountIds.includes(line.accountId)) ||
            (line.creditAccountId &&
              walletAccountIds.includes(line.creditAccountId))
        );
        if (!walletLine) return null; // filtered out below

        const walletOnDebitSide = !!(
          walletLine.accountId &&
          walletAccountIds.includes(walletLine.accountId)
        );
        const amount = Number(walletLine.amount || 0);

        return {
          id: tx.id,
          type: tx.transactionType,
          description: tx.description,
          reference: tx.reference,
          loadId: tx.loadId,
          // G-M31-C1: isDebit true = money OUT (negative for user),
          // isDebit false = money IN (positive for user).
          // accountId position is always true (creditAccountId never set) —
          // must use isDebit flag for correct sign.
          amount: walletLine.isDebit ? -amount : amount,
          createdAt: tx.createdAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    return handleApiError(error, "Get wallet transactions error");
  }
}
