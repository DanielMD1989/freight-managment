/**
 * Admin Wallets API
 *
 * GET /api/wallets — List all financial accounts (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-wallets",
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

    const session = await requireActiveUser();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const accountType = searchParams.get("accountType");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100
    );

    const where: Prisma.FinancialAccountWhereInput = {};
    if (accountType) {
      where.accountType = accountType as Prisma.EnumAccountTypeFilter["equals"];
    }

    const [accounts, total] = await Promise.all([
      db.financialAccount.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.financialAccount.count({ where }),
    ]);

    // Transform to match Wallet interface expected by AdminWalletsClient
    const wallets = accounts.map((account) => {
      const org = account.organization;
      const isShipperWallet = account.accountType === "SHIPPER_WALLET";
      const isCarrierWallet = account.accountType === "CARRIER_WALLET";

      return {
        id: account.id,
        accountType: account.accountType,
        balance: Number(account.balance),
        currency: account.currency,
        lastTransactionAt: account.updatedAt.toISOString(),
        createdAt: account.createdAt.toISOString(),
        shipper: isShipperWallet && org ? { id: org.id, name: org.name } : null,
        carrier: isCarrierWallet && org ? { id: org.id, name: org.name } : null,
      };
    });

    return NextResponse.json({
      wallets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "Admin wallets list error");
  }
}
