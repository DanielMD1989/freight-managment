/**
 * Sprint 7: Automation Rules Engine
 *
 * Core rule evaluation engine that executes automation rules
 * based on configurable conditions and triggers
 */

import { db } from '@/lib/db';
import { LoadStatus } from '@prisma/client';
import { calculateDistanceKm } from '@/lib/geo';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Load type used for automation rule evaluation
interface AutomationLoadTruck {
  id: string;
  gpsDevice?: {
    id: string;
    imei?: string;
  } | null;
}

interface AutomationLoad {
  id: string;
  status: LoadStatus;
  pickupDate?: Date | string | null;
  deliveryDate?: Date | string | null;
  tripKm?: number | null;
  assignedTruck?: AutomationLoadTruck | null;
}

export interface RuleCondition {
  // Time-based conditions
  graceHours?: number; // Grace period in hours
  hoursLateForHigh?: number; // Hours late to trigger HIGH priority
  hoursLateForCritical?: number; // Hours late to trigger CRITICAL priority

  // GPS-based conditions
  gpsOfflineHours?: number; // Hours offline before trigger
  gpsOfflineHoursForCritical?: number; // Hours offline for CRITICAL
  stalledThresholdKm?: number; // Km threshold for stalled detection
  stalledCheckHours?: number; // Hours to check for stalled movement

  // Threshold conditions
  minValue?: number;
  maxValue?: number;

  // Status filters
  statuses?: LoadStatus[]; // Only check loads in these statuses

  // Custom conditions
  customLogic?: string; // JavaScript expression to evaluate
}

export interface RuleAction {
  type: 'CREATE_ESCALATION' | 'SEND_NOTIFICATION' | 'CHANGE_LOAD_STATUS' | 'SEND_EMAIL' | 'WEBHOOK';

  // Escalation action params
  escalationType?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title?: string;
  description?: string;

  // Notification action params
  notificationType?: string;
  notificationTitle?: string;
  notificationMessage?: string;
  recipientUserIds?: string[];

  // Status change params
  newStatus?: LoadStatus;

  // Email params
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;

  // Webhook params
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  webhookPayload?: Record<string, unknown>;
}

export interface RuleEvaluationContext {
  loadId: string;
  load: AutomationLoad;
  trigger: string;
  currentTime: Date;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  reason?: string;
  actionsToExecute: RuleAction[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RULE EVALUATION
// ============================================================================

/**
 * Evaluate a single automation rule against a load
 */
export async function evaluateRule(
  ruleId: string,
  loadId: string,
  trigger: string
): Promise<RuleEvaluationResult> {
  const rule = await db.automationRule.findUnique({
    where: { id: ruleId },
    select: {
      id: true,
      name: true,
      ruleType: true,
      trigger: true,
      conditions: true,
      actions: true,
      isEnabled: true,
    },
  });

  if (!rule || !rule.isEnabled) {
    return {
      ruleId,
      ruleName: rule?.name || 'Unknown',
      matched: false,
      reason: 'Rule not found or disabled',
      actionsToExecute: [],
    };
  }

  // Check if trigger matches
  if (rule.trigger !== 'ON_STATUS_CHANGE' && rule.trigger !== trigger) {
    return {
      ruleId,
      ruleName: rule.name,
      matched: false,
      reason: `Trigger mismatch: expected ${rule.trigger}, got ${trigger}`,
      actionsToExecute: [],
    };
  }

  // Get load data
  const loadData = await db.load.findUnique({
    where: { id: loadId },
    include: {
      assignedTruck: {
        include: {
          gpsDevice: true,
        },
      },
    },
  });

  if (!loadData) {
    return {
      ruleId,
      ruleName: rule.name,
      matched: false,
      reason: 'Load not found',
      actionsToExecute: [],
    };
  }

  // Convert Decimal tripKm to number for the AutomationLoad interface
  const load: AutomationLoad = {
    ...loadData,
    tripKm: loadData.tripKm ? Number(loadData.tripKm) : null,
    assignedTruck: loadData.assignedTruck ? {
      id: loadData.assignedTruck.id,
      gpsDevice: loadData.assignedTruck.gpsDevice ? {
        id: loadData.assignedTruck.gpsDevice.id,
        imei: loadData.assignedTruck.gpsDevice.imei,
      } : null,
    } : null,
  };

  const conditions = rule.conditions as RuleCondition;
  const context: RuleEvaluationContext = {
    loadId,
    load,
    trigger,
    currentTime: new Date(),
  };

  // Evaluate based on rule type
  let matched = false;
  let reason = '';
  let metadata: Record<string, any> = {};

  switch (rule.ruleType) {
    case 'TIME_BASED':
      ({ matched, reason, metadata } = await evaluateTimeBased(context, conditions));
      break;
    case 'GPS_BASED':
      ({ matched, reason, metadata } = await evaluateGpsBased(context, conditions));
      break;
    case 'THRESHOLD_BASED':
      ({ matched, reason, metadata } = await evaluateThresholdBased(context, conditions));
      break;
    case 'CUSTOM':
      ({ matched, reason, metadata } = await evaluateCustom(context, conditions));
      break;
    default:
      matched = false;
      reason = `Unknown rule type: ${rule.ruleType}`;
  }

  return {
    ruleId,
    ruleName: rule.name,
    matched,
    reason,
    actionsToExecute: matched ? (rule.actions as unknown as RuleAction[]) : [],
    metadata,
  };
}

/**
 * Evaluate time-based rules (late pickup, late delivery)
 */
async function evaluateTimeBased(
  context: RuleEvaluationContext,
  conditions: RuleCondition
): Promise<{ matched: boolean; reason: string; metadata: Record<string, unknown> }> {
  const { load, currentTime } = context;
  const graceHours = conditions.graceHours || 2;
  const gracePeriodMs = graceHours * 60 * 60 * 1000;

  // Check if status filter applies
  if (conditions.statuses && !conditions.statuses.includes(load.status)) {
    return {
      matched: false,
      reason: `Load status ${load.status} not in ${conditions.statuses.join(', ')}`,
      metadata: {},
    };
  }

  // Late pickup check
  if ((load.status === 'ASSIGNED' || load.status === 'PICKUP_PENDING') && load.pickupDate) {
    const pickupTime = new Date(load.pickupDate);
    if (currentTime.getTime() > pickupTime.getTime() + gracePeriodMs) {
      const hoursLate = Math.floor(
        (currentTime.getTime() - pickupTime.getTime()) / (60 * 60 * 1000)
      );

      return {
        matched: true,
        reason: `Pickup is ${hoursLate} hours late (grace period: ${graceHours}h)`,
        metadata: {
          hoursLate,
          pickupTime: pickupTime.toISOString(),
          graceHours,
        },
      };
    }
  }

  // Late delivery check
  if (load.status === 'IN_TRANSIT' && load.deliveryDate) {
    const deliveryTime = new Date(load.deliveryDate);
    if (currentTime.getTime() > deliveryTime.getTime() + gracePeriodMs) {
      const hoursLate = Math.floor(
        (currentTime.getTime() - deliveryTime.getTime()) / (60 * 60 * 1000)
      );

      return {
        matched: true,
        reason: `Delivery is ${hoursLate} hours late (grace period: ${graceHours}h)`,
        metadata: {
          hoursLate,
          deliveryTime: deliveryTime.toISOString(),
          graceHours,
        },
      };
    }
  }

  return {
    matched: false,
    reason: 'No time-based condition met',
    metadata: {},
  };
}

/**
 * Evaluate GPS-based rules (offline, stalled)
 */
async function evaluateGpsBased(
  context: RuleEvaluationContext,
  conditions: RuleCondition
): Promise<{ matched: boolean; reason: string; metadata: Record<string, unknown> }> {
  const { load, currentTime } = context;

  if (!load.assignedTruck) {
    return {
      matched: false,
      reason: 'No truck assigned',
      metadata: {},
    };
  }

  const gpsDevice = load.assignedTruck.gpsDevice;
  if (!gpsDevice) {
    return {
      matched: false,
      reason: 'No GPS device found',
      metadata: {},
    };
  }

  // GPS offline check
  const offlineHours = conditions.gpsOfflineHours || 4;
  const offlineThresholdMs = offlineHours * 60 * 60 * 1000;

  const latestPosition = await db.gpsPosition.findFirst({
    where: { truckId: load.assignedTruck.id },
    orderBy: { timestamp: 'desc' },
    select: {
      timestamp: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!latestPosition) {
    return {
      matched: true,
      reason: 'No GPS data available',
      metadata: { gpsDevice: gpsDevice.imei },
    };
  }

  const timeSinceLastUpdate = currentTime.getTime() - new Date(latestPosition.timestamp).getTime();
  if (timeSinceLastUpdate > offlineThresholdMs) {
    const hoursOffline = Math.floor(timeSinceLastUpdate / (60 * 60 * 1000));

    return {
      matched: true,
      reason: `GPS offline for ${hoursOffline} hours (threshold: ${offlineHours}h)`,
      metadata: {
        hoursOffline,
        lastUpdate: latestPosition.timestamp.toISOString(),
        thresholdHours: offlineHours,
      },
    };
  }

  // Stalled load check (only for IN_TRANSIT)
  if (load.status === 'IN_TRANSIT' && conditions.stalledCheckHours) {
    const stalledCheckMs = conditions.stalledCheckHours * 60 * 60 * 1000;
    const checkFrom = new Date(currentTime.getTime() - stalledCheckMs);

    const recentPositions = await db.gpsPosition.findMany({
      where: {
        truckId: load.assignedTruck.id,
        timestamp: { gte: checkFrom },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        latitude: true,
        longitude: true,
        timestamp: true,
      },
    });

    if (recentPositions.length >= 2) {
      // Calculate max distance moved (delegated to lib/geo.ts)
      let maxDistance = 0;
      for (let i = 1; i < recentPositions.length; i++) {
        const dist = calculateDistanceKm(
          Number(recentPositions[0].latitude),
          Number(recentPositions[0].longitude),
          Number(recentPositions[i].latitude),
          Number(recentPositions[i].longitude)
        );
        maxDistance = Math.max(maxDistance, dist);
      }

      const stalledThreshold = conditions.stalledThresholdKm || 1;
      if (maxDistance < stalledThreshold) {
        return {
          matched: true,
          reason: `Truck moved only ${maxDistance.toFixed(2)}km in ${conditions.stalledCheckHours}h (threshold: ${stalledThreshold}km)`,
          metadata: {
            distanceMoved: maxDistance,
            checkHours: conditions.stalledCheckHours,
            thresholdKm: stalledThreshold,
          },
        };
      }
    }
  }

  return {
    matched: false,
    reason: 'No GPS-based condition met',
    metadata: {},
  };
}

/**
 * Evaluate threshold-based rules
 */
async function evaluateThresholdBased(
  context: RuleEvaluationContext,
  conditions: RuleCondition
): Promise<{ matched: boolean; reason: string; metadata: Record<string, unknown> }> {
  const { load } = context;

  // Check min/max value thresholds (can be extended for various metrics)
  if (conditions.minValue !== undefined) {
    const value = Number(load.tripKm || 0);
    if (value < conditions.minValue) {
      return {
        matched: true,
        reason: `Value ${value} below minimum threshold ${conditions.minValue}`,
        metadata: { value, minValue: conditions.minValue },
      };
    }
  }

  if (conditions.maxValue !== undefined) {
    const value = Number(load.tripKm || 0);
    if (value > conditions.maxValue) {
      return {
        matched: true,
        reason: `Value ${value} exceeds maximum threshold ${conditions.maxValue}`,
        metadata: { value, maxValue: conditions.maxValue },
      };
    }
  }

  return {
    matched: false,
    reason: 'No threshold condition met',
    metadata: {},
  };
}

/**
 * Evaluate custom JavaScript-based rules
 */
async function evaluateCustom(
  context: RuleEvaluationContext,
  conditions: RuleCondition
): Promise<{ matched: boolean; reason: string; metadata: Record<string, unknown> }> {
  if (!conditions.customLogic) {
    return {
      matched: false,
      reason: 'No custom logic defined',
      metadata: {},
    };
  }

  try {
    // Safely evaluate custom logic
    // NOTE: In production, use a sandboxed environment like vm2
    const result = evaluateCustomLogic(conditions.customLogic, context);

    return {
      matched: !!result,
      reason: result ? 'Custom logic matched' : 'Custom logic did not match',
      metadata: { customLogic: conditions.customLogic },
    };
  } catch (error) {
    return {
      matched: false,
      reason: `Custom logic error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {},
    };
  }
}

/**
 * Safely evaluate custom logic (placeholder - use vm2 in production)
 */
function evaluateCustomLogic(logic: string, context: RuleEvaluationContext): boolean {
  // This is a simplified placeholder
  // In production, use vm2 or similar for safe JavaScript evaluation
  // For now, just return false to prevent security issues
  console.warn('Custom logic evaluation not implemented:', logic);
  return false;
}

/**
 * Evaluate all enabled rules for a specific trigger
 */
export async function evaluateRulesForTrigger(
  loadId: string,
  trigger: string
): Promise<RuleEvaluationResult[]> {
  const rules = await db.automationRule.findMany({
    where: {
      isEnabled: true,
      OR: [
        { trigger: trigger as any },
        { trigger: 'ON_STATUS_CHANGE' }, // Always check these
      ],
    },
    orderBy: { priority: 'desc' }, // Higher priority first
    select: { id: true },
  });

  const results = await Promise.all(
    rules.map((rule) => evaluateRule(rule.id, loadId, trigger))
  );

  return results.filter((r) => r.matched);
}

/**
 * Evaluate all scheduled rules (ON_SCHEDULE trigger)
 */
export async function evaluateScheduledRules(): Promise<{
  executed: number;
  successful: number;
  failed: number;
  results: Array<{ ruleId: string; loadId: string; result: RuleEvaluationResult }>;
}> {
  const now = new Date();

  // Get rules that are due to run
  const rules = await db.automationRule.findMany({
    where: {
      isEnabled: true,
      trigger: 'ON_SCHEDULE',
      OR: [
        { nextExecutionAt: null },
        { nextExecutionAt: { lte: now } },
      ],
    },
    orderBy: { priority: 'desc' },
  });

  let executed = 0;
  let successful = 0;
  let failed = 0;
  const results: Array<{ ruleId: string; loadId: string; result: RuleEvaluationResult }> = [];

  for (const rule of rules) {
    const conditions = rule.conditions as RuleCondition;

    // Get loads to check based on status filter
    const loads = await db.load.findMany({
      where: {
        status: {
          in: conditions.statuses || ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
        },
      },
      select: { id: true },
    });

    for (const load of loads) {
      executed++;

      try {
        const result = await evaluateRule(rule.id, load.id, 'ON_SCHEDULE');
        results.push({ ruleId: rule.id, loadId: load.id, result });
        successful++;
      } catch (error) {
        console.error(`Rule ${rule.id} evaluation failed for load ${load.id}:`, error);
        failed++;
      }
    }

    // Update last executed time
    await db.automationRule.update({
      where: { id: rule.id },
      data: {
        lastExecutedAt: now,
        executionCount: { increment: 1 },
        successCount: { increment: successful },
        failureCount: { increment: failed },
        // Calculate next execution (simplified - would use cron parser in production)
        nextExecutionAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes from now
      },
    });
  }

  return { executed, successful, failed, results };
}
