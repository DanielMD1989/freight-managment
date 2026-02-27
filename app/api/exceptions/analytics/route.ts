/**
 * Sprint 5: Exception Analytics
 * Insights and reporting on exception patterns
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canViewSystemDashboard } from "@/lib/dispatcherPermissions";
import { UserRole } from "@prisma/client";

// GET /api/exceptions/analytics - Get exception analytics and insights
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only dispatchers and admins can view analytics
    // FIX: Use proper enum type
    const canView = canViewSystemDashboard({
      role: session.role as UserRole,
      organizationId: null,
      userId: session.userId,
    });

    if (!canView) {
      return NextResponse.json(
        { error: "You do not have permission to view exception analytics" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10); // Default 30 days
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Exception frequency by type
    const byType = await db.loadEscalation.groupBy({
      by: ["escalationType"],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
      orderBy: {
        _count: {
          escalationType: "desc",
        },
      },
    });

    // 2. Exception frequency by priority
    const byPriority = await db.loadEscalation.groupBy({
      by: ["priority"],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // 3. Resolution time statistics (MTTR - Mean Time To Resolution)
    const resolvedEscalations = await db.loadEscalation.findMany({
      where: {
        status: {
          in: ["RESOLVED", "CLOSED"],
        },
        resolvedAt: { not: null },
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        escalationType: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const resolutionTimes = resolvedEscalations.map((esc) => {
      const created = new Date(esc.createdAt).getTime();
      const resolved = new Date(esc.resolvedAt!).getTime();
      const hoursToResolve = (resolved - created) / (60 * 60 * 1000);
      return {
        escalationType: esc.escalationType,
        priority: esc.priority,
        hours: hoursToResolve,
      };
    });

    const averageMTTR =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, r) => sum + r.hours, 0) /
          resolutionTimes.length
        : 0;

    // MTTR by type
    const mttrByType: Record<string, number> = {};
    byType.forEach((type) => {
      const typeResolutions = resolutionTimes.filter(
        (r) => r.escalationType === type.escalationType
      );
      if (typeResolutions.length > 0) {
        mttrByType[type.escalationType] =
          typeResolutions.reduce((sum, r) => sum + r.hours, 0) /
          typeResolutions.length;
      }
    });

    // 4. Top carriers with exceptions
    const escalationsWithCarrier = await db.loadEscalation.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        load: {
          select: {
            assignedTruck: {
              select: {
                carrier: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const carrierCounts: Record<string, { name: string; count: number }> = {};
    escalationsWithCarrier.forEach((esc) => {
      const carrier = esc.load.assignedTruck?.carrier;
      if (carrier) {
        if (!carrierCounts[carrier.id]) {
          carrierCounts[carrier.id] = { name: carrier.name, count: 0 };
        }
        carrierCounts[carrier.id].count++;
      }
    });

    const topCarriers = Object.entries(carrierCounts)
      .map(([id, data]) => ({ carrierId: id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 5. Exception trends over time (daily)
    const dailyTrends = await db.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM load_escalations
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // 6. Current open exceptions by age
    const openEscalations = await db.loadEscalation.findMany({
      where: {
        status: {
          in: ["OPEN", "ASSIGNED", "IN_PROGRESS"],
        },
      },
      select: {
        id: true,
        createdAt: true,
        priority: true,
        escalationType: true,
      },
    });

    const now = Date.now();
    const exceptionsByAge = {
      under1Hour: openEscalations.filter(
        (e) => now - new Date(e.createdAt).getTime() < 60 * 60 * 1000
      ).length,
      under4Hours: openEscalations.filter((e) => {
        const age = now - new Date(e.createdAt).getTime();
        return age >= 60 * 60 * 1000 && age < 4 * 60 * 60 * 1000;
      }).length,
      under24Hours: openEscalations.filter((e) => {
        const age = now - new Date(e.createdAt).getTime();
        return age >= 4 * 60 * 60 * 1000 && age < 24 * 60 * 60 * 1000;
      }).length,
      over24Hours: openEscalations.filter(
        (e) => now - new Date(e.createdAt).getTime() >= 24 * 60 * 60 * 1000
      ).length,
    };

    // 7. Auto-detected vs manual exceptions
    const autoVsManual = await db.loadEscalation.groupBy({
      by: ["createdBy"],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const autoDetected =
      autoVsManual.find((g) => g.createdBy === "SYSTEM")?._count || 0;
    const manual = autoVsManual
      .filter((g) => g.createdBy !== "SYSTEM")
      .reduce((sum, g) => sum + g._count, 0);

    return NextResponse.json({
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
      summary: {
        totalExceptions: byType.reduce((sum, t) => sum + t._count, 0),
        resolved: resolvedEscalations.length,
        open: openEscalations.length,
        averageMTTR: Math.round(averageMTTR * 10) / 10, // Round to 1 decimal
        autoDetected,
        manual,
      },
      byType: byType.map((t) => ({
        type: t.escalationType,
        count: t._count,
        mttr: mttrByType[t.escalationType]
          ? Math.round(mttrByType[t.escalationType] * 10) / 10
          : null,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count,
      })),
      topCarriers,
      dailyTrends: dailyTrends.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      openExceptionsByAge: exceptionsByAge,
      resolutionMetrics: {
        averageHours: Math.round(averageMTTR * 10) / 10,
        fastest:
          resolutionTimes.length > 0
            ? Math.min(...resolutionTimes.map((r) => r.hours))
            : null,
        slowest:
          resolutionTimes.length > 0
            ? Math.max(...resolutionTimes.map((r) => r.hours))
            : null,
        byPriority: {
          CRITICAL:
            resolutionTimes.filter((r) => r.priority === "CRITICAL").length > 0
              ? resolutionTimes
                  .filter((r) => r.priority === "CRITICAL")
                  .reduce((sum, r) => sum + r.hours, 0) /
                resolutionTimes.filter((r) => r.priority === "CRITICAL").length
              : null,
          HIGH:
            resolutionTimes.filter((r) => r.priority === "HIGH").length > 0
              ? resolutionTimes
                  .filter((r) => r.priority === "HIGH")
                  .reduce((sum, r) => sum + r.hours, 0) /
                resolutionTimes.filter((r) => r.priority === "HIGH").length
              : null,
          MEDIUM:
            resolutionTimes.filter((r) => r.priority === "MEDIUM").length > 0
              ? resolutionTimes
                  .filter((r) => r.priority === "MEDIUM")
                  .reduce((sum, r) => sum + r.hours, 0) /
                resolutionTimes.filter((r) => r.priority === "MEDIUM").length
              : null,
          LOW:
            resolutionTimes.filter((r) => r.priority === "LOW").length > 0
              ? resolutionTimes
                  .filter((r) => r.priority === "LOW")
                  .reduce((sum, r) => sum + r.hours, 0) /
                resolutionTimes.filter((r) => r.priority === "LOW").length
              : null,
        },
      },
    });
  } catch (error) {
    console.error("Exception analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exception analytics" },
      { status: 500 }
    );
  }
}
