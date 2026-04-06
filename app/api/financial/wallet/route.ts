export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

// GET /api/financial/wallet - Get wallet balance
export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "financial-wallet",
      ip,
      RPS_CONFIGS.read.rps,
      RPS_CONFIGS.read.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const session = await requireActiveUser();
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
    return handleApiError(error, "Get wallet error");
  }
}

// POST /api/financial/wallet — REMOVED (2026-04-06)
//
// Reason: This endpoint was unused (zero callers across app/, components/,
// mobile/) AND contained a sign bug — it created a JournalLine with
// `isDebit: true` while incrementing the balance, which would corrupt the
// double-entry ledger if any client wired up to it.
//
// The blueprint §8 deposit flow is:
//   1. POST /api/wallet/deposit       (creates pending WalletDeposit request)
//   2. Admin approves request
//   3. POST /api/admin/users/[id]/wallet/topup (creates atomic
//      JournalEntry with isDebit: false + balance increment)
//
// Any future direct-deposit feature should be added to that flow, not here.
