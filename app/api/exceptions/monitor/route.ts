/**
 * Sprint 5: Exception Monitoring System
 * Run exception detection across all active loads
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { autoCreateEscalations } from "@/lib/exceptionDetection";

// POST /api/exceptions/monitor - Run exception detection on all active loads
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only admins can run system-wide exception monitoring
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only admins can run system-wide exception monitoring" },
        { status: 403 }
      );
    }

    // Get all active loads that could have exceptions
    const activeLoads = await db.load.findMany({
      where: {
        status: {
          in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"],
        },
      },
      select: {
        id: true,
        status: true,
        pickupCity: true,
        deliveryCity: true,
      },
    });

    // Run exception detection on each load
    const results = await Promise.allSettled(
      activeLoads.map((load) => autoCreateEscalations(load.id, "SYSTEM"))
    );

    // Count successful detections and escalations created
    let totalEscalations = 0;
    let loadsChecked = 0;
    let errors = 0;

    const summary = results.map((result, index) => {
      if (result.status === "fulfilled") {
        loadsChecked++;
        totalEscalations += result.value.created;
        return {
          loadId: activeLoads[index].id,
          route: `${activeLoads[index].pickupCity} → ${activeLoads[index].deliveryCity}`,
          created: result.value.created,
          rules: result.value.rules.map((r) => r.type),
        };
      } else {
        errors++;
        return {
          loadId: activeLoads[index].id,
          error: result.reason?.message || "Unknown error",
        };
      }
    });

    // Get current exception statistics
    const exceptionStats = await db.loadEscalation.groupBy({
      by: ["status"],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      _count: true,
    });

    return NextResponse.json({
      message: `Exception monitoring complete. Created ${totalEscalations} new escalations across ${loadsChecked} loads.`,
      summary: {
        totalLoadsChecked: activeLoads.length,
        loadsWithIssues: summary.filter(
          (
            s
          ): s is {
            loadId: string;
            route: string;
            created: number;
            rules: string[];
          } => "created" in s && typeof s.created === "number" && s.created > 0
        ).length,
        totalEscalationsCreated: totalEscalations,
        errors,
      },
      loads: summary,
      stats: {
        last24Hours: exceptionStats.reduce(
          (acc, s) => {
            acc[s.status] = s._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    console.error("Exception monitoring error:", error);
    return NextResponse.json(
      { error: "Failed to run exception monitoring" },
      { status: 500 }
    );
  }
}

// GET /api/exceptions/monitor - Get monitoring status and configuration
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only dispatchers and admins can view monitoring status
    if (
      session.role !== "DISPATCHER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only dispatchers and admins can view monitoring status" },
        { status: 403 }
      );
    }

    // Get active loads count
    const activeLoadsCount = await db.load.count({
      where: {
        status: {
          in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"],
        },
      },
    });

    // Get recent auto-created escalations
    const recentAutoEscalations = await db.loadEscalation.findMany({
      where: {
        createdBy: "SYSTEM",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      include: {
        load: {
          select: {
            id: true,
            status: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
      },
    });

    // Get escalation statistics
    const escalationStats = await db.loadEscalation.groupBy({
      by: ["escalationType"],
      where: {
        createdBy: "SYSTEM",
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      _count: true,
    });

    return NextResponse.json({
      monitoringConfig: {
        enabled: true,
        activeLoadsMonitored: activeLoadsCount,
        checkInterval: "Manual trigger only", // TODO: Add cron job
        rules: [
          {
            name: "Late Pickup",
            threshold: "2 hours past scheduled time",
            priority: "MEDIUM-HIGH",
          },
          {
            name: "Late Delivery",
            threshold: "2 hours past scheduled time",
            priority: "HIGH-CRITICAL",
          },
          {
            name: "GPS Offline",
            threshold: "4 hours without signal",
            priority: "HIGH-CRITICAL",
          },
          {
            name: "Stalled Load",
            threshold: "<1km movement in 4 hours",
            priority: "CRITICAL",
          },
        ],
      },
      recentEscalations: recentAutoEscalations,
      stats: {
        last24Hours: recentAutoEscalations.length,
        byType: escalationStats.reduce(
          (acc, s) => {
            acc[s.escalationType] = s._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    console.error("Monitoring status error:", error);
    return NextResponse.json(
      { error: "Failed to get monitoring status" },
      { status: 500 }
    );
  }
}
