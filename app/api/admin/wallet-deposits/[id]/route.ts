export const dynamic = "force-dynamic";
/**
 * Admin Wallet Deposit Approval API
 *
 * Connects the user-facing deposit request flow to the actual balance update.
 *
 * Flow:
 *   1. Shipper/Carrier submits deposit request via POST /api/wallet/deposit
 *      → creates WalletDeposit row with status=PENDING (no balance change)
 *   2. Admin reviews the request (slip URL, reference, notes)
 *   3. Admin calls POST /api/admin/wallet-deposits/{id}/approve OR /reject
 *
 * On APPROVE:
 *   - Atomically: create JournalEntry (DEPOSIT credit) + increment wallet
 *     balance + flip deposit.status PENDING→CONFIRMED. Mirrors the
 *     `/api/admin/users/[id]/wallet/topup` pattern.
 *   - Notify the requester's organization that funds were added.
 *
 * On REJECT:
 *   - Set status PENDING→REJECTED, store rejectionReason and rejectedAt.
 *   - Notify the requester so they can resubmit if appropriate.
 *
 * Both endpoints are idempotent — re-calling on a non-PENDING deposit
 * returns 409 instead of double-processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { notifyOrganization, NotificationType } from "@/lib/notifications";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";

const approveSchema = z.object({
  action: z.literal("approve"),
  notes: z.string().max(500).optional(),
});

const rejectSchema = z.object({
  action: z.literal("reject"),
  rejectionReason: z.string().min(1, "Rejection reason is required").max(500),
});

const bodySchema = z.discriminatedUnion("action", [
  approveSchema,
  rejectSchema,
]);

/**
 * POST /api/admin/wallet-deposits/[id]
 *
 * Approve or reject a pending wallet deposit request.
 * Body: { action: "approve" } | { action: "reject", rejectionReason: "..." }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    await requirePermission(Permission.MANAGE_WALLET);

    const { id: depositId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Fetch the deposit + wallet + requester org
    const deposit = await db.walletDeposit.findUnique({
      where: { id: depositId },
      include: {
        financialAccount: {
          select: {
            id: true,
            organizationId: true,
            currency: true,
          },
        },
      },
    });

    if (!deposit) {
      return NextResponse.json(
        { error: "Deposit request not found" },
        { status: 404 }
      );
    }

    if (deposit.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Deposit is not pending (current status: ${deposit.status})`,
          currentStatus: deposit.status,
        },
        { status: 409 }
      );
    }

    if (!deposit.financialAccount.organizationId) {
      return NextResponse.json(
        { error: "Deposit has no associated organization" },
        { status: 400 }
      );
    }

    if (parsed.data.action === "approve") {
      // Atomic: journal entry + balance update + status flip
      const description =
        parsed.data.notes ||
        `Deposit approved by admin (${deposit.paymentMethod})`;

      const result = await db.$transaction(async (tx) => {
        // Re-check status inside transaction (TOCTOU defense)
        const fresh = await tx.walletDeposit.findUnique({
          where: { id: depositId },
          select: { status: true },
        });
        if (!fresh || fresh.status !== "PENDING") {
          throw Object.assign(new Error("ALREADY_PROCESSED"), {
            statusCode: 409,
          });
        }

        const journalEntry = await tx.journalEntry.create({
          data: {
            transactionType: "DEPOSIT",
            description,
            reference: deposit.externalReference || `deposit-${deposit.id}`,
            metadata: {
              paymentMethod: deposit.paymentMethod,
              approvedBy: session.userId,
              approvedByEmail: session.email,
              depositId: deposit.id,
            },
            lines: {
              create: [
                {
                  accountId: deposit.financialAccountId,
                  amount: deposit.amount,
                  // Deposits are CREDITS (money IN). isDebit:false matches
                  // every other deposit writer. See G-M31-C1.
                  isDebit: false,
                },
              ],
            },
          },
        });

        const updatedDeposit = await tx.walletDeposit.update({
          where: { id: depositId },
          data: {
            status: "CONFIRMED",
            approvedById: session.userId,
            approvedAt: new Date(),
            journalEntryId: journalEntry.id,
          },
        });

        const updatedWallet = await tx.financialAccount.update({
          where: { id: deposit.financialAccountId },
          data: { balance: { increment: deposit.amount } },
        });

        return { updatedDeposit, updatedWallet, journalEntry };
      });

      // Cache invalidation for the requester
      await CacheInvalidation.user(deposit.requestedById).catch(() => {});

      // Notify the requester's organization
      const orgId = deposit.financialAccount.organizationId;
      const amountStr = Number(deposit.amount).toLocaleString();
      const newBalanceStr = Number(
        result.updatedWallet.balance
      ).toLocaleString();
      notifyOrganization({
        organizationId: orgId,
        type: NotificationType.WALLET_TOPUP_CONFIRMED,
        title: "Deposit approved",
        message: `Your deposit of ${amountStr} ETB has been approved. New balance: ${newBalanceStr} ETB.`,
        metadata: {
          depositId: deposit.id,
          amount: Number(deposit.amount),
          newBalance: Number(result.updatedWallet.balance),
          paymentMethod: deposit.paymentMethod,
        },
      }).catch((err) =>
        console.warn("Deposit approve notify failed:", err?.message)
      );

      return NextResponse.json({
        message: "Deposit approved",
        deposit: result.updatedDeposit,
        newBalance: Number(result.updatedWallet.balance),
      });
    }

    // REJECT path
    const updatedDeposit = await db.walletDeposit.update({
      where: { id: depositId },
      data: {
        status: "REJECTED",
        rejectionReason: parsed.data.rejectionReason,
        rejectedAt: new Date(),
        approvedById: session.userId,
      },
    });

    const orgId = deposit.financialAccount.organizationId;
    const amountStr = Number(deposit.amount).toLocaleString();
    notifyOrganization({
      organizationId: orgId,
      type: NotificationType.WALLET_TOPUP_CONFIRMED,
      title: "Deposit rejected",
      message: `Your deposit of ${amountStr} ETB was rejected. Reason: ${parsed.data.rejectionReason}`,
      metadata: {
        depositId: deposit.id,
        amount: Number(deposit.amount),
        rejectionReason: parsed.data.rejectionReason,
      },
    }).catch((err) =>
      console.warn("Deposit reject notify failed:", err?.message)
    );

    return NextResponse.json({
      message: "Deposit rejected",
      deposit: updatedDeposit,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_PROCESSED") {
      return NextResponse.json(
        { error: "Deposit was already processed by another admin" },
        { status: 409 }
      );
    }
    return handleApiError(error, "Wallet deposit approval error");
  }
}
