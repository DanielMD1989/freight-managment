/**
 * Admin Withdrawal Approval/Rejection API
 *
 * PATCH /api/admin/withdrawals/[id] — Approve or reject a withdrawal request
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { notifyOrganization, NotificationType } from "@/lib/notifications";

const updateSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-withdrawals",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, rejectionReason } = parsed.data;

    // Use transaction with re-fetch to guard against race conditions
    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.withdrawalRequest.findUnique({
        where: { id },
      });
      if (!existing) {
        throw Object.assign(new Error("Withdrawal request not found"), {
          statusCode: 404,
        });
      }

      if (existing.status !== "PENDING") {
        throw Object.assign(
          new Error(`Cannot update a ${existing.status} withdrawal request`),
          { statusCode: 400 }
        );
      }

      const result = await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: action,
          approvedById: session.userId,
          approvedAt: new Date(),
          rejectionReason: action === "REJECTED" ? rejectionReason : null,
          completedAt: action === "APPROVED" ? new Date() : null,
        },
      });

      // C2 FIX: On approval, deduct wallet balance and create journal entry
      if (action === "APPROVED") {
        // Find the requesting user's organization
        const requestingUser = await tx.user.findUnique({
          where: { id: existing.requestedById },
          select: { organizationId: true },
        });

        if (requestingUser?.organizationId) {
          // Find their wallet
          const wallet = await tx.financialAccount.findFirst({
            where: {
              organizationId: requestingUser.organizationId,
              accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] },
              isActive: true,
            },
          });

          if (
            !wallet ||
            parseFloat(wallet.balance.toString()) <
              parseFloat(existing.amount.toString())
          ) {
            throw Object.assign(new Error("INSUFFICIENT_BALANCE"), {
              statusCode: 400,
            });
          }

          if (wallet) {
            // Decrement wallet balance
            await tx.financialAccount.update({
              where: { id: wallet.id },
              data: { balance: { decrement: existing.amount } },
            });

            // Create WITHDRAWAL journal entry
            await tx.journalEntry.create({
              data: {
                transactionType: "WITHDRAWAL",
                description: `Withdrawal approved: ${Number(existing.amount).toFixed(2)} ETB to ${existing.bankName} (${existing.bankAccount})`,
                reference: id,
                lines: {
                  create: [
                    {
                      accountId: wallet.id,
                      amount: existing.amount,
                      isDebit: true,
                    },
                  ],
                },
              },
            });
          }
        }
      }

      if (action === "REJECTED") {
        // RC-1 FIX: Return funds to wallet on rejection
        const requestingUser = await tx.user.findUnique({
          where: { id: existing.requestedById },
          select: { organizationId: true },
        });

        if (requestingUser?.organizationId) {
          const wallet = await tx.financialAccount.findFirst({
            where: {
              organizationId: requestingUser.organizationId,
              accountType: { in: ["SHIPPER_WALLET", "CARRIER_WALLET"] },
              isActive: true,
            },
          });
          if (wallet) {
            await tx.financialAccount.update({
              where: { id: wallet.id },
              data: { balance: { increment: existing.amount } },
            });
            await tx.journalEntry.create({
              data: {
                transactionType: "REFUND",
                description: "Withdrawal request rejected — funds returned",
                reference: `WITHDRAW-REJ-${id}`,
                lines: {
                  create: [
                    {
                      amount: existing.amount,
                      isDebit: false,
                      accountId: wallet.id,
                    },
                  ],
                },
              },
            });
          }
        }
      }

      return result;
    });

    // Invalidate requesting user's cache so their wallet reflects immediately
    await CacheInvalidation.user(updated.requestedById);

    // G-W-N4-2 / G-W-N4-3: Notify requesting user's org of approval/rejection
    const reqUser = await db.user.findUnique({
      where: { id: updated.requestedById },
      select: { organizationId: true },
    });
    if (reqUser?.organizationId) {
      if (action === "APPROVED") {
        notifyOrganization({
          organizationId: reqUser.organizationId,
          type: NotificationType.WITHDRAWAL_APPROVED,
          title: "Withdrawal Approved",
          message: `Your withdrawal of ${Number(updated.amount).toLocaleString()} ETB to ${updated.bankName} has been approved.`,
          metadata: {
            withdrawalRequestId: id,
            amount: Number(updated.amount),
            bankName: updated.bankName,
          },
        }).catch((err) => console.error("withdrawal approved notify err", err));
      } else {
        notifyOrganization({
          organizationId: reqUser.organizationId,
          type: NotificationType.WITHDRAWAL_REJECTED,
          title: "Withdrawal Request Rejected",
          message: `Your withdrawal request of ${Number(updated.amount).toLocaleString()} ETB was not approved. Funds have been returned to your wallet.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
          metadata: {
            withdrawalRequestId: id,
            amount: Number(updated.amount),
            rejectionReason,
          },
        }).catch((err) => console.error("withdrawal rejected notify err", err));
      }
    }

    return NextResponse.json({
      message: `Withdrawal request ${action.toLowerCase()}`,
      withdrawalRequest: updated,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    if (err?.statusCode === 404) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err?.statusCode === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(error, "Admin withdrawal update error");
  }
}
