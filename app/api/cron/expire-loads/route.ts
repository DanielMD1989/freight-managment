/**
 * Cron Job: Expire Old Loads
 * Sprint 2 - Story 2.5: Load Expiration Automation
 *
 * Run daily to expire loads that haven't been assigned after 7 days
 */

import { NextRequest, NextResponse } from "next/server";
import { expireOldLoads } from "@/lib/loadAutomation";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          error: !cronSecret
            ? "Server misconfigured - CRON_SECRET required"
            : "Unauthorized",
        },
        { status: !cronSecret ? 500 : 401 }
      );
    }

    // Run expiration
    const result = await expireOldLoads();

    return NextResponse.json({
      success: result.success,
      expiredCount: result.expiredCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in expire-loads cron:", error);
    return NextResponse.json(
      {
        error: "Failed to expire loads",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "expire-loads",
    description:
      "Expires loads that have been posted for more than 7 days without assignment",
    schedule: "0 2 * * *", // Daily at 2 AM
    lastRun: null,
  });
}
