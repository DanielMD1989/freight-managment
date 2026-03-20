/**
 * Admin Wallet Top-Up API
 *
 * Allows admins to manually credit a user's wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { checkRpsLimit } from "@/lib/rateLimit";
import { CacheInvalidation } from "@/lib/cache";
import { z } from "zod";
import { handleApiError } from "@/lib/apiErrors";
import { DepositMethod } from "@prisma/client";
import { notifyOrganization, NotificationType } from "@/lib/notifications";
// H15 FIX: Import max topup constant
import {
  MAX_WALLET_TOPUP_AMOUNT,
  ADMIN_FINANCIAL_OPS_RPS,
  ADMIN_FINANCIAL_OPS_BURST,
} from "@/lib/types/admin";

// H15 FIX: Add maximum amount validation to prevent abuse
const topUpSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .max(
      MAX_WALLET_TOPUP_AMOUNT,
      `Maximum topup is ${MAX_WALLET_TOPUP_AMOUNT.toLocaleString()} ETB`
    ),
  paymentMethod: z
    .enum(["BANK_TRANSFER_SLIP", "TELEBIRR", "MPESA", "MANUAL"])
    .optional()
    .default("MANUAL"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/admin/users/[id]/wallet/topup
 *
 * Credit funds to a user's wallet
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // M9 FIX: Add rate limiting for financial operations
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-wallet-topup",
      ip,
      ADMIN_FINANCIAL_OPS_RPS,
      ADMIN_FINANCIAL_OPS_BURST
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    // M1 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requirePermission(Permission.MANAGE_WALLET);

    const { id } = await params;
    const body = await request.json();
    const { amount, paymentMethod, reference, notes } = topUpSchema.parse(body);

    // Get the user and their organization
    const user = await db.user.findUnique({
      where: { id },
      include: { organization: true },
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

    // Find the wallet
    const wallet = await db.financialAccount.findFirst({
      where: {
        organizationId: user.organizationId,
        accountType: {
          in: ["SHIPPER_WALLET", "CARRIER_WALLET"],
        },
        isActive: true,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "No wallet found for this user" },
        { status: 404 }
      );
    }

    // Create journal entry and update balance atomically
    const description = notes || `Manual top-up by admin via ${paymentMethod}`;

    const result = await db.$transaction(async (tx) => {
      // Create journal entry for the deposit
      const journalEntry = await tx.journalEntry.create({
        data: {
          transactionType: "DEPOSIT",
          description,
          reference: reference || null,
          metadata: {
            paymentMethod,
            processedBy: session.userId,
            processedByEmail: session.email,
            adminTopUp: true,
          },
          lines: {
            create: [
              {
                accountId: wallet.id,
                amount,
                // G-M31-C1: Deposits are CREDITS to wallet (money IN).
                // isDebit: false = money IN — matches all other writers.
                isDebit: false,
              },
            ],
          },
        },
      });

      // Round S8: Create WalletDeposit record so admin top-ups appear in deposit history
      const deposit = await tx.walletDeposit.create({
        data: {
          amount,
          currency: "ETB",
          paymentMethod: paymentMethod as DepositMethod,
          status: "CONFIRMED", // Admin-initiated = immediately confirmed
          externalReference: reference || null,
          notes: description,
          financialAccountId: wallet.id,
          requestedById: session.userId, // Admin is both requester and approver
          approvedById: session.userId,
          approvedAt: new Date(),
          journalEntryId: journalEntry.id,
        },
      });

      // Update wallet balance
      const updatedWallet = await tx.financialAccount.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      return {
        journalEntry,
        deposit,
        updatedWallet,
      };
    });

    // Invalidate user cache so wallet balance reflects immediately
    await CacheInvalidation.user(id);

    // G-W-N4-1: Notify all active org members that wallet was topped up
    notifyOrganization({
      organizationId: user.organizationId,
      type: NotificationType.WALLET_TOPUP_CONFIRMED,
      title: "Wallet Topped Up",
      message: `${amount.toLocaleString()} ETB has been added to your wallet. New balance: ${Number(result.updatedWallet.balance).toLocaleString()} ETB.`,
      metadata: {
        amount,
        newBalance: Number(result.updatedWallet.balance),
        depositId: result.deposit.id,
        paymentMethod,
      },
    }).catch((err) => console.error("topup notify err", err));

    return NextResponse.json({
      success: true,
      newBalance: Number(result.updatedWallet.balance),
      transactionId: result.journalEntry.id,
      depositId: result.deposit.id,
      message: `Successfully added ${amount} ETB to wallet`,
    });
  } catch (error) {
    return handleApiError(error, "Wallet top-up error");
  }
}
