/**
 * Sprint 5: Exception Detection API
 * Manually trigger exception detection for a specific load
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { checkAllRules, autoCreateEscalations } from "@/lib/exceptionDetection";
import { handleApiError } from "@/lib/apiErrors";

// POST /api/loads/[id]/check-exceptions - Manually trigger exception detection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C12 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { id: loadId } = await params;

    // Only dispatchers and admins can trigger exception checks
    if (
      session.role !== "DISPATCHER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only dispatchers and admins can check for exceptions" },
        { status: 403 }
      );
    }

    // Check all exception rules
    await checkAllRules(loadId);

    // Auto-create escalations for triggered rules
    const result = await autoCreateEscalations(loadId, session.userId);

    return NextResponse.json({
      message: `Exception check complete. ${result.created} new escalations created.`,
      triggeredRules: result.rules,
      createdEscalations: result.escalations,
      totalChecked: 4, // Number of rules checked
    });
  } catch (error) {
    return handleApiError(error, "Exception check error");
  }
}

// GET /api/loads/[id]/check-exceptions - Preview exceptions without creating
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: loadId } = await params;

    // Only dispatchers and admins can view exception checks
    if (
      session.role !== "DISPATCHER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only dispatchers and admins can check for exceptions" },
        { status: 403 }
      );
    }

    // Check all exception rules without creating escalations
    const triggeredRules = await checkAllRules(loadId);

    return NextResponse.json({
      triggeredRules,
      wouldCreate: triggeredRules.length,
      totalChecked: 4,
    });
  } catch (error) {
    return handleApiError(error, "Exception preview error");
  }
}
