/**
 * Sprint 7: Automation Rule Details & Management
 * Get, update, delete specific automation rules
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const updateRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  conditions: z.record(z.string(), z.any()).optional(),
  actions: z.array(z.record(z.string(), z.any())).optional(),
  isEnabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  schedulePattern: z.string().optional(),
});

// GET /api/automation/rules/[id] - Get rule details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(Permission.VIEW_RULES);

    const { id } = await params;

    const rule = await db.automationRule.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { executedAt: "desc" },
          take: 10,
        },
        _count: {
          select: { executions: true },
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Automation rule not found" },
        { status: 404 }
      );
    }

    // Calculate success rate
    const successRate =
      rule.executionCount > 0
        ? (rule.successCount / rule.executionCount) * 100
        : 0;

    return NextResponse.json({
      rule: {
        ...rule,
        stats: {
          successRate: Math.round(successRate * 10) / 10,
          totalExecutions: rule.executionCount,
          successful: rule.successCount,
          failed: rule.failureCount,
        },
      },
    });
  } catch (error) {
    console.error("Get automation rule error:", error);
    return NextResponse.json(
      { error: "Failed to get automation rule" },
      { status: 500 }
    );
  }
}

// PATCH /api/automation/rules/[id] - Update rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_RULES);

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateRuleSchema.parse(body);

    // Check if rule exists
    const existingRule = await db.automationRule.findUnique({
      where: { id },
      select: { id: true, isSystem: true },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: "Automation rule not found" },
        { status: 404 }
      );
    }

    // Prevent editing system rules (can only enable/disable)
    if (existingRule.isSystem) {
      const allowedFields = ["isEnabled"];
      const hasDisallowedFields = Object.keys(validatedData).some(
        (key) => !allowedFields.includes(key)
      );

      if (hasDisallowedFields) {
        return NextResponse.json(
          { error: "System rules can only be enabled/disabled" },
          { status: 403 }
        );
      }
    }

    // Update next execution time if schedule pattern changed
    let nextExecutionAt = undefined;
    if (validatedData.schedulePattern) {
      nextExecutionAt = new Date(Date.now() + 5 * 60 * 1000);
    }

    const updatedRule = await db.automationRule.update({
      where: { id },
      data: {
        ...validatedData,
        nextExecutionAt,
      },
    });

    return NextResponse.json({
      message: "Automation rule updated successfully",
      rule: updatedRule,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    console.error("Update automation rule error:", error);
    return NextResponse.json(
      { error: "Failed to update automation rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/automation/rules/[id] - Delete rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_RULES);

    const { id } = await params;

    // Check if rule exists and is not a system rule
    const rule = await db.automationRule.findUnique({
      where: { id },
      select: { id: true, isSystem: true, name: true },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Automation rule not found" },
        { status: 404 }
      );
    }

    if (rule.isSystem) {
      return NextResponse.json(
        { error: "System rules cannot be deleted" },
        { status: 403 }
      );
    }

    await db.automationRule.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Automation rule deleted successfully",
      rule: { id: rule.id, name: rule.name },
    });
  } catch (error) {
    console.error("Delete automation rule error:", error);
    return NextResponse.json(
      { error: "Failed to delete automation rule" },
      { status: 500 }
    );
  }
}
