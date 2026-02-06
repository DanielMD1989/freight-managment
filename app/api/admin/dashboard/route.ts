import { NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import { getAdminDashboardMetrics } from "@/lib/admin/metrics";

/**
 * GET /api/admin/dashboard
 *
 * @deprecated Use /api/admin/analytics instead.
 * This endpoint is maintained for backwards compatibility only.
 * The admin dashboard page now uses /api/admin/analytics as the
 * single source of truth for all admin metrics.
 *
 * Uses lib/admin/metrics.ts for calculations.
 */
export async function GET() {
  try {
    await requirePermission(Permission.VIEW_DASHBOARD);

    const metrics = await getAdminDashboardMetrics();

    // Return in the format expected by existing frontend
    return NextResponse.json({
      // Entity counts
      totalUsers: metrics.counts.totalUsers,
      totalOrganizations: metrics.counts.totalOrganizations,
      totalLoads: metrics.counts.totalLoads,
      totalTrucks: metrics.counts.totalTrucks,

      // Active counts - uses consistent definitions from metrics module
      activeLoads: metrics.loads.active + metrics.loads.inProgress,
      activeTrips: metrics.trips.active, // Uses Trip model, not Load model

      // Revenue from PLATFORM_REVENUE account
      totalRevenue: { balance: metrics.revenue.platformBalance },
      pendingWithdrawals: metrics.revenue.pendingWithdrawals,

      // Disputes
      openDisputes: metrics.disputes.open + metrics.disputes.underReview,

      // Load breakdown by status
      loadsByStatus: Object.entries(metrics.loads.byStatus).map(([status, count]) => ({
        status,
        _count: count,
      })),

      // Recent activity
      recentUsers: metrics.recentActivity.usersLast7Days,
      recentLoads: metrics.recentActivity.loadsLast7Days,

      // Additional metrics for enhanced dashboard
      trucks: {
        total: metrics.trucks.total,
        available: metrics.trucks.available,
        unavailable: metrics.trucks.unavailable,
        byApprovalStatus: metrics.trucks.byApprovalStatus,
      },
      trips: {
        total: metrics.trips.total,
        active: metrics.trips.active,
        completed: metrics.trips.completed,
        cancelled: metrics.trips.cancelled,
        byStatus: metrics.trips.byStatus,
      },
      loads: {
        total: metrics.loads.total,
        active: metrics.loads.active,
        inProgress: metrics.loads.inProgress,
        delivered: metrics.loads.delivered,
        completed: metrics.loads.completed,
        cancelled: metrics.loads.cancelled,
        byStatus: metrics.loads.byStatus,
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
