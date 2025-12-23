import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";

// GET /api/admin/dashboard - Get admin dashboard stats
export async function GET() {
  try {
    await requirePermission(Permission.VIEW_DASHBOARD);

    const [
      totalUsers,
      totalOrganizations,
      totalLoads,
      totalTrucks,
      activeLoads,
      totalRevenue,
      escrowBalance,
      pendingWithdrawals,
      openDisputes,
    ] = await Promise.all([
      db.user.count(),
      db.organization.count(),
      db.load.count(),
      db.truck.count(),
      db.load.count({ where: { status: { in: ["POSTED", "ASSIGNED", "IN_TRANSIT"] } } }),
      db.financialAccount.findFirst({
        where: { accountType: "PLATFORM_REVENUE" },
        select: { balance: true },
      }),
      db.financialAccount.findFirst({
        where: { accountType: "ESCROW" },
        select: { balance: true },
      }),
      db.withdrawalRequest.count({ where: { status: "PENDING" } }),
      db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    ]);

    // Get load stats by status
    const loadsByStatus = await db.load.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await db.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    const recentLoads = await db.load.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    return NextResponse.json({
      stats: {
        users: {
          total: totalUsers,
          recentWeek: recentUsers,
        },
        organizations: {
          total: totalOrganizations,
        },
        loads: {
          total: totalLoads,
          active: activeLoads,
          recentWeek: recentLoads,
          byStatus: loadsByStatus.reduce(
            (acc, item) => ({
              ...acc,
              [item.status]: item._count,
            }),
            {}
          ),
        },
        trucks: {
          total: totalTrucks,
        },
        financial: {
          revenue: totalRevenue?.balance || 0,
          escrow: escrowBalance?.balance || 0,
          pendingWithdrawals,
        },
        disputes: {
          open: openDisputes,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
