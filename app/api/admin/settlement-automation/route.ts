/**
 * Settlement Automation API
 *
 * Admin endpoint to trigger automated settlement workflows
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import {
  runSettlementAutomation,
  getSettlementStats,
  autoVerifyExpiredPODs,
  processReadySettlements,
} from "@/lib/settlementAutomation";
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";

/**
 * GET /api/admin/settlement-automation
 *
 * Get current settlement statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.MANAGE_SETTLEMENTS);

    const stats = await getSettlementStats();

    return NextResponse.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get settlement stats error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settlement-automation
 *
 * Manually trigger settlement automation
 *
 * Query parameters:
 * - action: 'auto-verify' | 'process-settlements' | 'full' (default)
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_SETTLEMENTS);

    const { searchParams } = request.nextUrl;
    const action = searchParams.get("action") || "full";

    let result: {
      action: string;
      autoVerifiedCount?: number;
      settledCount?: number;
      [key: string]: unknown;
    } = { action: "" };

    switch (action) {
      case "auto-verify":
        const autoVerifiedCount = await autoVerifyExpiredPODs();
        result = {
          action: "auto-verify",
          autoVerifiedCount,
        };
        break;

      case "process-settlements":
        const settledCount = await processReadySettlements();
        result = {
          action: "process-settlements",
          settledCount,
        };
        break;

      case "full":
      default:
        const automationResult = await runSettlementAutomation();
        result = {
          action: "full",
          ...automationResult,
        };
        break;
    }

    // Get updated stats
    const stats = await getSettlementStats();

    return NextResponse.json({
      message: "Settlement automation completed successfully",
      result,
      stats,
      timestamp: new Date().toISOString(),
    });
    // FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error("Settlement automation error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Settlement automation failed" },
      { status: 500 }
    );
  }
}
