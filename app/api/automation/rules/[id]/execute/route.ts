/**
 * Sprint 7: Manual Rule Execution
 * Manually trigger an automation rule for testing or immediate action
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { evaluateRule } from "@/lib/automationRules";
import { executeAndRecordRuleActions } from "@/lib/automationActions";
import { z } from "zod";

const executeRuleSchema = z.object({
  loadId: z.string().min(1, "loadId is required"),
});

// POST /api/automation/rules/[id]/execute - Manually execute rule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(Permission.MANAGE_RULES);

    const { id: ruleId } = await params;
    const body = await request.json();
    const result = executeRuleSchema.safeParse(body);
    if (!result.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(result.error);
    }

    const { loadId } = result.data;

    // Check if rule exists
    const rule = await db.automationRule.findUnique({
      where: { id: ruleId },
      select: { id: true, name: true, isEnabled: true },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Automation rule not found" },
        { status: 404 }
      );
    }

    // Evaluate rule (even if disabled, for testing)
    const evaluation = await evaluateRule(ruleId, loadId, "ON_MANUAL");

    if (!evaluation.matched) {
      return NextResponse.json({
        message: "Rule evaluated but did not match",
        evaluation: {
          ruleId,
          ruleName: rule.name,
          matched: false,
          reason: evaluation.reason,
        },
      });
    }

    // Execute actions
    const executionResult = await executeAndRecordRuleActions(
      loadId,
      evaluation,
      session.userId
    );

    return NextResponse.json({
      message: "Rule executed successfully",
      evaluation: {
        ruleId,
        ruleName: rule.name,
        matched: true,
        reason: evaluation.reason,
        metadata: evaluation.metadata,
      },
      execution: {
        executionId: executionResult.executionId,
        actionsExecuted: executionResult.actionsExecuted,
        successful: executionResult.successful,
        failed: executionResult.failed,
      },
      results: executionResult.results,
    });
  } catch (error) {
    console.error("Execute automation rule error:", error);
    return NextResponse.json(
      { error: "Failed to execute automation rule" },
      { status: 500 }
    );
  }
}
