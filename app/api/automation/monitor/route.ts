/**
 * Sprint 7: Automation Rules Monitoring & Scheduled Execution
 * System endpoint for running scheduled automation rules
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { evaluateScheduledRules } from "@/lib/automationRules";
import { executeAndRecordRuleActions } from "@/lib/automationActions";

// POST /api/automation/monitor - Run scheduled automation rules
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permission.MANAGE_RULES);

    // Evaluate all scheduled rules
    const scheduledResults = await evaluateScheduledRules();

    // Execute actions for matched rules
    const executionResults = [];
    for (const { ruleId, loadId, result } of scheduledResults.results) {
      if (result.matched) {
        const execution = await executeAndRecordRuleActions(
          loadId,
          result,
          "SYSTEM"
        );
        executionResults.push({
          ruleId,
          loadId,
          executionId: execution.executionId,
          actionsExecuted: execution.actionsExecuted,
          successful: execution.successful,
          failed: execution.failed,
        });
      }
    }

    return NextResponse.json({
      message: "Scheduled automation rules executed",
      summary: {
        rulesEvaluated: scheduledResults.executed,
        successful: scheduledResults.successful,
        failed: scheduledResults.failed,
        actionsExecuted: executionResults.reduce(
          (sum, r) => sum + r.actionsExecuted,
          0
        ),
      },
      executions: executionResults,
    });
  } catch (error) {
    console.error("Monitor automation rules error:", error);
    return NextResponse.json(
      { error: "Failed to monitor automation rules" },
      { status: 500 }
    );
  }
}

// GET /api/automation/monitor - Get monitoring status
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_RULES);

    // Get rules due for execution
    const now = new Date();
    const dueRules = await db.automationRule.findMany({
      where: {
        isEnabled: true,
        trigger: "ON_SCHEDULE",
        OR: [{ nextExecutionAt: null }, { nextExecutionAt: { lte: now } }],
      },
      select: {
        id: true,
        name: true,
        nextExecutionAt: true,
        lastExecutedAt: true,
        executionCount: true,
        successCount: true,
        failureCount: true,
      },
    });

    // Get recent executions
    const recentExecutions = await db.automationRuleExecution.findMany({
      where: {
        executedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { executedAt: "desc" },
      take: 20,
      include: {
        rule: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      dueRules: {
        count: dueRules.length,
        rules: dueRules,
      },
      recentActivity: {
        count: recentExecutions.length,
        executions: recentExecutions,
      },
    });
  } catch (error) {
    console.error("Get automation monitor status error:", error);
    return NextResponse.json(
      { error: "Failed to get automation monitor status" },
      { status: 500 }
    );
  }
}
