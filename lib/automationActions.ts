/**
 * Sprint 7: Automation Action Executors
 *
 * Execute actions defined in automation rules:
 * - Create escalations
 * - Send notifications
 * - Change load status
 * - Send emails
 * - Trigger webhooks
 */

import { db } from "@/lib/db";
import { LoadStatus } from "@prisma/client";
import { sendEmailDirect } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { RuleAction, RuleEvaluationResult } from "./automationRules";

export interface ActionExecutionResult {
  action: RuleAction;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Execute all actions from a rule evaluation result
 */
export async function executeRuleActions(
  loadId: string,
  result: RuleEvaluationResult,
  createdBy: string = "SYSTEM"
): Promise<ActionExecutionResult[]> {
  const results: ActionExecutionResult[] = [];

  for (const action of result.actionsToExecute) {
    try {
      const executionResult = await executeAction(
        loadId,
        action,
        result,
        createdBy
      );
      results.push(executionResult);
    } catch (error) {
      results.push({
        action,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Execute a single action
 */
async function executeAction(
  loadId: string,
  action: RuleAction,
  result: RuleEvaluationResult,
  createdBy: string
): Promise<ActionExecutionResult> {
  switch (action.type) {
    case "CREATE_ESCALATION":
      return await executeCreateEscalation(loadId, action, result, createdBy);

    case "SEND_NOTIFICATION":
      return await executeSendNotification(loadId, action, result);

    case "CHANGE_LOAD_STATUS":
      return await executeChangeLoadStatus(loadId, action);

    case "SEND_EMAIL":
      return await executeSendEmail(loadId, action, result);

    case "WEBHOOK":
      return await executeWebhook(loadId, action, result);

    default:
      return {
        action,
        success: false,
        error: `Unknown action type: ${action.type}`,
      };
  }
}

/**
 * Create an escalation for the load
 */
async function executeCreateEscalation(
  loadId: string,
  action: RuleAction,
  result: RuleEvaluationResult,
  createdBy: string
): Promise<ActionExecutionResult> {
  // Check if escalation already exists to avoid duplicates
  const existingEscalation = await db.loadEscalation.findFirst({
    where: {
      loadId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum type mismatch with dynamic string
      escalationType: action.escalationType as any,
      status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
    },
  });

  if (existingEscalation) {
    return {
      action,
      success: true,
      data: {
        escalationId: existingEscalation.id,
        duplicate: true,
        message: "Escalation already exists",
      },
    };
  }

  // Determine title and description
  const title =
    action.title || result.reason || `Automation: ${action.escalationType}`;
  const description =
    action.description ||
    `Automatically created by rule "${result.ruleName}": ${result.reason}`;

  const escalation = await db.loadEscalation.create({
    data: {
      loadId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum type mismatch with dynamic string
      escalationType: action.escalationType as any,
      priority: action.priority || "MEDIUM",
      status: "OPEN",
      title,
      description,
      createdBy,
    },
  });

  return {
    action,
    success: true,
    data: {
      escalationId: escalation.id,
      escalationType: escalation.escalationType,
      priority: escalation.priority,
    },
  };
}

/**
 * Send notification to users
 */
async function executeSendNotification(
  loadId: string,
  action: RuleAction,
  result: RuleEvaluationResult
): Promise<ActionExecutionResult> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipperId: true,
      assignedTruckId: true,
      assignedTruck: {
        select: {
          carrierId: true,
        },
      },
    },
  });

  if (!load) {
    return {
      action,
      success: false,
      error: "Load not found",
    };
  }

  // Determine recipients
  const recipientIds = action.recipientUserIds || [];

  // Add shipper and carrier if not specified
  if (recipientIds.length === 0) {
    // Get users from shipper and carrier organizations
    const orgIds = [load.shipperId];
    if (load.assignedTruck?.carrierId) {
      orgIds.push(load.assignedTruck.carrierId);
    }

    const users = await db.user.findMany({
      where: {
        organizationId: { in: orgIds },
      },
      select: { id: true },
    });

    recipientIds.push(...users.map((u) => u.id));
  }

  // Create notifications
  const title =
    action.notificationTitle || `Automation Alert: ${result.ruleName}`;
  const message =
    action.notificationMessage || result.reason || "Automated notification";

  const notifications = await db.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      type: action.notificationType || "AUTOMATION_ALERT",
      title,
      message,
      metadata: {
        loadId,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        ...result.metadata,
      },
    })),
  });

  return {
    action,
    success: true,
    data: {
      notificationsSent: notifications.count,
      recipients: recipientIds,
    },
  };
}

/**
 * Change load status
 */
async function executeChangeLoadStatus(
  loadId: string,
  action: RuleAction
): Promise<ActionExecutionResult> {
  if (!action.newStatus) {
    return {
      action,
      success: false,
      error: "No new status specified",
    };
  }

  const load = await db.load.findUnique({
    where: { id: loadId },
    select: { status: true },
  });

  if (!load) {
    return {
      action,
      success: false,
      error: "Load not found",
    };
  }

  // Update load status
  await db.load.update({
    where: { id: loadId },
    data: { status: action.newStatus as LoadStatus },
  });

  return {
    action,
    success: true,
    data: {
      oldStatus: load.status,
      newStatus: action.newStatus,
    },
  };
}

/**
 * Send email notification
 */
async function executeSendEmail(
  loadId: string,
  action: RuleAction,
  result: RuleEvaluationResult
): Promise<ActionExecutionResult> {
  // This is a placeholder for email integration
  // In production, integrate with SendGrid, AWS SES, or similar

  if (!action.emailTo) {
    return {
      action,
      success: false,
      error: "No email recipient specified",
    };
  }

  const subject = action.emailSubject || `Automation Alert: ${result.ruleName}`;
  const body =
    action.emailBody || result.reason || "Automated email notification";

  try {
    const emailResult = await sendEmailDirect({
      to: action.emailTo,
      subject,
      html: `<p>${body}</p><p><small>Load ID: ${loadId} | Rule: ${result.ruleName}</small></p>`,
      text: `${body}\n\nLoad ID: ${loadId} | Rule: ${result.ruleName}`,
    });

    return {
      action,
      success: emailResult.success,
      data: {
        emailTo: action.emailTo,
        subject,
        sent: emailResult.success,
        messageId: emailResult.messageId,
      },
    };
  } catch (error) {
    logger.error("Automation email send failed", error);
    return {
      action,
      success: false,
      error: `Email send failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Trigger webhook
 */
async function executeWebhook(
  loadId: string,
  action: RuleAction,
  result: RuleEvaluationResult
): Promise<ActionExecutionResult> {
  if (!action.webhookUrl) {
    return {
      action,
      success: false,
      error: "No webhook URL specified",
    };
  }

  const method = action.webhookMethod || "POST";
  const payload = action.webhookPayload || {
    loadId,
    ruleId: result.ruleId,
    ruleName: result.ruleName,
    reason: result.reason,
    metadata: result.metadata,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(action.webhookUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FreightPlatform-Automation/1.0",
      },
      body: method === "POST" ? JSON.stringify(payload) : undefined,
    });

    return {
      action,
      success: response.ok,
      data: {
        statusCode: response.status,
        url: action.webhookUrl,
        method,
      },
      error: response.ok
        ? undefined
        : `Webhook failed with status ${response.status}`,
    };
  } catch (error) {
    return {
      action,
      success: false,
      error: `Webhook request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Execute actions for a rule evaluation result and record execution
 */
export async function executeAndRecordRuleActions(
  loadId: string,
  result: RuleEvaluationResult,
  createdBy: string = "SYSTEM"
): Promise<{
  executionId: string;
  actionsExecuted: number;
  successful: number;
  failed: number;
  results: ActionExecutionResult[];
}> {
  // Execute actions
  const actionResults = await executeRuleActions(loadId, result, createdBy);

  const successful = actionResults.filter((r) => r.success).length;
  const failed = actionResults.filter((r) => !r.success).length;

  // Record execution
  const execution = await db.automationRuleExecution.create({
    data: {
      ruleId: result.ruleId,
      status: failed > 0 ? "FAILED" : "COMPLETED",
      executedAt: new Date(),
      completedAt: new Date(),
      result: {
        loadId,
        matched: result.matched,
        reason: result.reason,
        metadata: result.metadata,
        actionResults: actionResults.map((ar) => ({
          type: ar.action.type,
          success: ar.success,
          error: ar.error,
          data: ar.data,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Json field accepts dynamic shape
      } as any,
      matchedLoads: 1,
      actionsExecuted: actionResults.length,
      errorMessage: failed > 0 ? `${failed} action(s) failed` : undefined,
    },
  });

  // Update rule execution counters
  await db.automationRule.update({
    where: { id: result.ruleId },
    data: {
      executionCount: { increment: 1 },
      successCount: { increment: failed === 0 ? 1 : 0 },
      failureCount: { increment: failed > 0 ? 1 : 0 },
      lastExecutedAt: new Date(),
    },
  });

  return {
    executionId: execution.id,
    actionsExecuted: actionResults.length,
    successful,
    failed,
    results: actionResults,
  };
}
