/**
 * Admin User Wallet API
 *
 * Get wallet information for a specific user
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { z } from "zod";

const walletPatchSchema = z.object({
  minimumBalance: z.number().nonnegative(),
});

/**
 * PATCH /api/admin/users/[id]/wallet
 *
 * Update wallet settings for a user's organization.
 * Currently supports: minimumBalance (§8 marketplace gate threshold).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_WALLET);

    const { id } = await params;
    const body = await request.json();
    const parsed = walletPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User or organization not found" },
        { status: 404 }
      );
    }

    const updated = await db.financialAccount.updateMany({
      where: {
        organizationId: user.organizationId,
        accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] },
        isActive: true,
      },
      data: { minimumBalance: parsed.data.minimumBalance },
    });

    return NextResponse.json({
      message: "Wallet settings updated",
      count: updated.count,
      minimumBalance: parsed.data.minimumBalance,
    });
  } catch (error) {
    return handleApiError(error, "Update wallet settings error");
  }
}

/**
 * GET /api/admin/users/[id]/wallet
 *
 * Get wallet data for a user's organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(Permission.MANAGE_WALLET);

    const { id } = await params;

    // Get the user and their organization
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "User has no organization" },
        { status: 400 }
      );
    }

    // Get wallet for the organization
    const wallet = await db.financialAccount.findFirst({
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
        updatedAt: true,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "No wallet found for this user" },
        { status: 404 }
      );
    }

    // Get recent transactions for this wallet
    const transactions = await db.journalEntry.findMany({
      where: {
        lines: {
          some: {
            OR: [{ accountId: wallet.id }, { creditAccountId: wallet.id }],
          },
        },
      },
      select: {
        id: true,
        transactionType: true,
        description: true,
        reference: true,
        createdAt: true,
        lines: {
          where: {
            OR: [{ accountId: wallet.id }, { creditAccountId: wallet.id }],
          },
          select: {
            amount: true,
            isDebit: true,
            accountId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // Format transactions
    const formattedTransactions = transactions.map((tx) => {
      const line = tx.lines[0];
      const isCredit = line?.accountId === wallet.id && line?.isDebit === true;
      const amount = Number(line?.amount || 0);

      return {
        id: tx.id,
        type: tx.transactionType,
        description: tx.description,
        reference: tx.reference,
        amount: isCredit ? amount : -amount,
        createdAt: tx.createdAt,
      };
    });

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance),
        currency: wallet.currency,
        accountType: wallet.accountType,
        updatedAt: wallet.updatedAt,
      },
      transactions: formattedTransactions,
    });
  } catch (error) {
    return handleApiError(error, "Get user wallet error");
  }
}
