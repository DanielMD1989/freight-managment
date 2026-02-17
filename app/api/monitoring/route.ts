/**
 * Monitoring API
 *
 * PHASE 3: Application-Level Logging & Monitoring
 *
 * Endpoints:
 * - GET /api/monitoring - Get monitoring data and metrics
 * - GET /api/monitoring?summary=true - Get summary only
 * - GET /api/monitoring?alerts=true - Get alerts only
 *
 * Access: Admin only (or via API key for external monitoring)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  getMonitoringData,
  getMonitoringSummary,
  getAllAlerts,
  resolveAlert,
} from "@/lib/monitoring";
import { logger } from "@/lib/logger";

/**
 * Verify admin access or monitoring API key
 */
async function verifyAccess(
  request: NextRequest
): Promise<{ authorized: boolean; userId?: string }> {
  // Check for monitoring API key (for external monitoring tools)
  const apiKey = request.headers.get("x-monitoring-api-key");
  if (
    apiKey &&
    process.env.MONITORING_API_KEY &&
    apiKey === process.env.MONITORING_API_KEY
  ) {
    return { authorized: true };
  }

  // Check for admin session
  try {
    const session = await requireAuth();
    if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
      return { authorized: true, userId: session.userId };
    }
    return { authorized: false };
  } catch {
    return { authorized: false };
  }
}

/**
 * GET /api/monitoring
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify access
    const { authorized, userId } = await verifyAccess(request);
    if (!authorized) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access or API key required" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const summaryOnly = searchParams.get("summary") === "true";
    const alertsOnly = searchParams.get("alerts") === "true";
    const alertLimit = parseInt(searchParams.get("limit") || "50");

    // Return appropriate data based on query params
    if (summaryOnly) {
      const summary = getMonitoringSummary();
      return NextResponse.json({
        ...summary,
        timestamp: new Date().toISOString(),
      });
    }

    if (alertsOnly) {
      const alerts = getAllAlerts(alertLimit);
      return NextResponse.json({
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Full monitoring data
    const data = getMonitoringData();
    const logMetrics = logger.getMetrics();

    // Log the monitoring access
    logger.info("Monitoring data accessed", {
      userId,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({
      ...data,
      logging: {
        requests: logMetrics.requests,
        errors: logMetrics.errors,
        slowQueries: {
          count: logMetrics.slowQueries.count,
          recent: logMetrics.slowQueries.queries.slice(0, 10),
        },
        uptime: logMetrics.uptime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Monitoring endpoint error", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve monitoring data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring
 * Actions: resolve alerts, reset metrics
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Verify access
    const { authorized, userId } = await verifyAccess(request);
    if (!authorized) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, alertId } = body;

    switch (action) {
      case "resolve_alert":
        if (!alertId) {
          return NextResponse.json(
            { error: "alertId required" },
            { status: 400 }
          );
        }
        const resolved = resolveAlert(alertId);
        logger.info("Alert resolved via API", { alertId, userId });
        return NextResponse.json({ success: resolved, alertId });

      case "reset_metrics":
        logger.resetMetrics();
        logger.info("Metrics reset via API", { userId });
        return NextResponse.json({ success: true, message: "Metrics reset" });

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: resolve_alert, reset_metrics" },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error("Monitoring POST error", error);

    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/monitoring
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-monitoring-api-key",
    },
  });
}
