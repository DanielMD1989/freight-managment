/**
 * Admin Wallets Summary API
 *
 * GET /api/wallets/summary — Aggregate wallet balances by type (admin only)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireAuth();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [platformRevenue, shipperDeposits, carrierEarnings] =
      await Promise.all([
        db.financialAccount.aggregate({
          where: { accountType: "PLATFORM_REVENUE" },
          _sum: { balance: true },
        }),
        db.financialAccount.aggregate({
          where: { accountType: "SHIPPER_WALLET" },
          _sum: { balance: true },
        }),
        db.financialAccount.aggregate({
          where: { accountType: "CARRIER_WALLET" },
          _sum: { balance: true },
        }),
      ]);

    return NextResponse.json({
      totalPlatformRevenue: Number(platformRevenue._sum.balance || 0),
      totalShipperDeposits: Number(shipperDeposits._sum.balance || 0),
      totalCarrierEarnings: Number(carrierEarnings._sum.balance || 0),
    });
  } catch (error) {
    console.error("Admin wallets summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
