import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const depositSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string(),
  externalTransactionId: z.string().optional(),
});

// GET /api/financial/wallet - Get wallet balance
export async function GET() {
  try {
    const session = await requireAuth();
    await requirePermission(Permission.VIEW_WALLET);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User does not belong to an organization" },
        { status: 400 }
      );
    }

    const wallet = await db.financialAccount.findFirst({
      where: {
        organizationId: user.organizationId,
        accountType: {
          in: ["SHIPPER_WALLET", "CARRIER_WALLET"],
        },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    // Get recent transactions
    const recentTransactions = await db.journalEntry.findMany({
      where: {
        lines: {
          some: {
            accountId: wallet.id,
          },
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                accountType: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json({
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency,
        accountType: wallet.accountType,
      },
      recentTransactions,
    });
  } catch (error) {
    console.error("Get wallet error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/financial/wallet - Deposit funds
export async function POST(request: NextRequest) {
  try {
    // H4 FIX: Add CSRF protection; M32 FIX: Use requireActiveUser
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    await requirePermission(Permission.DEPOSIT_FUNDS);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User does not belong to an organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, paymentMethod, externalTransactionId } =
      depositSchema.parse(body);

    // Get wallet
    const wallet = await db.financialAccount.findFirst({
      where: {
        organizationId: user.organizationId,
        accountType: {
          in: ["SHIPPER_WALLET", "CARRIER_WALLET"],
        },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    // B4 FIX: Wrap journal entry + balance update in transaction for atomicity
    const { journalEntry, updatedWallet } = await db.$transaction(
      async (tx) => {
        const journalEntry = await tx.journalEntry.create({
          data: {
            transactionType: "DEPOSIT",
            description: `Deposit via ${paymentMethod}`,
            reference: externalTransactionId,
            lines: {
              create: [
                {
                  accountId: wallet.id,
                  amount,
                  isDebit: true,
                },
                // Credit would be to an external liability account (simplified for MVP)
              ],
            },
          },
        });

        const updatedWallet = await tx.financialAccount.update({
          where: { id: wallet.id },
          data: {
            balance: {
              increment: amount,
            },
          },
        });

        return { journalEntry, updatedWallet };
      }
    );

    return NextResponse.json({
      message: "Deposit successful",
      journalEntry,
      newBalance: parseFloat(updatedWallet.balance.toString()).toFixed(2),
    });
  } catch (error) {
    console.error("Deposit error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
