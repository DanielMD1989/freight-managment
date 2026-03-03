/**
 * Admin Wallets Summary API
 *
 * GET /api/wallets/summary — Aggregate wallet balances by type (admin only)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";

export async function GET() {
  try {
    const session = await requireActiveUser();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    return handleApiError(error, "Admin wallets summary error");
  }
}
