/**
 * Trust Metrics Calculation Utility
 *
 * Sprint 16 - Story 16.5: Trust & Reliability Features
 *
 * Calculates and updates trust metrics for organizations including:
 * - Completion rate (% of loads delivered)
 * - Cancellation rate (% of loads cancelled)
 * - Dispute rate (% of loads with disputes)
 * - Trust score (weighted composite score 0-100)
 *
 * ROUNDING: Delegated to lib/rounding.ts (2026-02-07)
 * Uses roundPercentage2() for all percentage metrics (2 decimal places)
 */

import { db } from "./db";
import { Decimal } from "decimal.js";
import { roundPercentage2 } from "./rounding";

/**
 * Calculate completion rate for an organization
 *
 * Completion rate = (delivered loads / total loads) * 100
 *
 * @param orgId - Organization ID
 * @returns Completion rate as percentage (0-100)
 */
export async function calculateCompletionRate(orgId: string): Promise<number> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      totalLoadsCompleted: true,
      totalLoadsCancelled: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  const totalLoads =
    organization.totalLoadsCompleted + organization.totalLoadsCancelled;

  if (totalLoads === 0) {
    return 0; // No loads yet
  }

  const completionRate = (organization.totalLoadsCompleted / totalLoads) * 100;
  // Rounding delegated to lib/rounding.ts:roundPercentage2()
  return roundPercentage2(completionRate);
}

/**
 * Calculate cancellation rate for an organization
 *
 * Cancellation rate = (cancelled loads / total loads) * 100
 *
 * @param orgId - Organization ID
 * @returns Cancellation rate as percentage (0-100)
 */
export async function calculateCancellationRate(
  orgId: string
): Promise<number> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      totalLoadsCompleted: true,
      totalLoadsCancelled: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  const totalLoads =
    organization.totalLoadsCompleted + organization.totalLoadsCancelled;

  if (totalLoads === 0) {
    return 0; // No loads yet
  }

  const cancellationRate =
    (organization.totalLoadsCancelled / totalLoads) * 100;
  // Rounding delegated to lib/rounding.ts:roundPercentage2()
  return roundPercentage2(cancellationRate);
}

/**
 * Calculate dispute rate for an organization
 *
 * Dispute rate = (loads with disputes / total loads) * 100
 *
 * @param orgId - Organization ID
 * @returns Dispute rate as percentage (0-100)
 */
export async function calculateDisputeRate(orgId: string): Promise<number> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      totalLoadsCompleted: true,
      totalLoadsCancelled: true,
      totalDisputes: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  const totalLoads =
    organization.totalLoadsCompleted + organization.totalLoadsCancelled;

  if (totalLoads === 0) {
    return 0; // No loads yet
  }

  const disputeRate = (organization.totalDisputes / totalLoads) * 100;
  // Rounding delegated to lib/rounding.ts:roundPercentage2()
  return roundPercentage2(disputeRate);
}

/**
 * Update all trust metrics for an organization
 *
 * Recalculates and saves:
 * - Completion rate
 * - Cancellation rate
 * - Dispute rate
 *
 * @param orgId - Organization ID
 */
export async function updateOrganizationMetrics(orgId: string): Promise<void> {
  const completionRate = await calculateCompletionRate(orgId);
  const cancellationRate = await calculateCancellationRate(orgId);
  const disputeRate = await calculateDisputeRate(orgId);

  await db.organization.update({
    where: { id: orgId },
    data: {
      completionRate: new Decimal(completionRate),
      cancellationRate: new Decimal(cancellationRate),
      disputeRate: new Decimal(disputeRate),
    },
  });
}

/**
 * Calculate trust score for an organization
 *
 * Trust score = weighted composite of:
 * - Completion rate (40% weight)
 * - Low cancellation rate (30% weight)
 * - Low dispute rate (20% weight)
 * - Verified status (10% weight)
 *
 * @param orgId - Organization ID
 * @returns Trust score (0-100)
 */
export async function calculateTrustScore(orgId: string): Promise<number> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      completionRate: true,
      cancellationRate: true,
      disputeRate: true,
      isVerified: true,
      totalLoadsCompleted: true,
      totalLoadsCancelled: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  const totalLoads =
    organization.totalLoadsCompleted + organization.totalLoadsCancelled;

  // If no activity, return 0
  if (totalLoads === 0) {
    return 0;
  }

  // Get rates as numbers
  const completionRate = organization.completionRate
    ? Number(organization.completionRate)
    : 0;
  const cancellationRate = organization.cancellationRate
    ? Number(organization.cancellationRate)
    : 0;
  const disputeRate = organization.disputeRate
    ? Number(organization.disputeRate)
    : 0;

  // Calculate weighted score
  const completionScore = completionRate * 0.4; // 40% weight
  const cancellationScore = (100 - cancellationRate) * 0.3; // 30% weight (inverted - lower is better)
  const disputeScore = (100 - disputeRate) * 0.2; // 20% weight (inverted - lower is better)
  const verifiedScore = organization.isVerified ? 10 : 0; // 10% weight (10 points if verified)

  const trustScore =
    completionScore + cancellationScore + disputeScore + verifiedScore;

  // Rounding delegated to lib/rounding.ts:roundPercentage2()
  return roundPercentage2(trustScore);
}

/**
 * Increment completed loads count and update metrics
 *
 * Called when a load is delivered
 *
 * @param orgId - Organization ID (shipper or carrier)
 */
export async function incrementCompletedLoads(orgId: string): Promise<void> {
  await db.organization.update({
    where: { id: orgId },
    data: {
      totalLoadsCompleted: {
        increment: 1,
      },
    },
  });

  // Recalculate metrics
  await updateOrganizationMetrics(orgId);
}

/**
 * Increment cancelled loads count and update metrics
 *
 * Called when a load is cancelled
 *
 * @param orgId - Organization ID (shipper or carrier)
 */
export async function incrementCancelledLoads(orgId: string): Promise<void> {
  await db.organization.update({
    where: { id: orgId },
    data: {
      totalLoadsCancelled: {
        increment: 1,
      },
    },
  });

  // Recalculate metrics
  await updateOrganizationMetrics(orgId);
}

/**
 * Increment disputes count and update metrics
 *
 * Called when a dispute is filed
 *
 * @param orgId - Organization ID (disputed organization)
 */
export async function incrementDisputes(orgId: string): Promise<void> {
  await db.organization.update({
    where: { id: orgId },
    data: {
      totalDisputes: {
        increment: 1,
      },
    },
  });

  // Recalculate metrics
  await updateOrganizationMetrics(orgId);
}

/**
 * Check if organization has high cancellation rate (>50%)
 *
 * Returns true if organization should be flagged for review
 *
 * @param orgId - Organization ID
 * @returns True if cancellation rate exceeds 50%
 */
export async function hasHighCancellationRate(orgId: string): Promise<boolean> {
  const cancellationRate = await calculateCancellationRate(orgId);
  return cancellationRate > 50;
}

/**
 * Get trust badge level based on trust score
 *
 * - Platinum: 90-100 (verified + excellent metrics)
 * - Gold: 75-89 (verified + good metrics)
 * - Silver: 60-74 (verified OR good metrics)
 * - Bronze: 40-59 (average metrics)
 * - None: 0-39 (poor metrics)
 *
 * @param trustScore - Trust score (0-100)
 * @returns Badge level string
 */
export function getTrustBadgeLevel(trustScore: number): string {
  if (trustScore >= 90) return "PLATINUM";
  if (trustScore >= 75) return "GOLD";
  if (trustScore >= 60) return "SILVER";
  if (trustScore >= 40) return "BRONZE";
  return "NONE";
}

/**
 * Get GPS status indicator based on last seen time
 *
 * - GREEN: Last seen < 5 minutes ago (Active)
 * - YELLOW: Last seen 5-30 minutes ago (Stale)
 * - RED: Last seen > 30 minutes ago (Offline)
 * - GRAY: No GPS data
 *
 * @param lastSeenAt - Last GPS update timestamp
 * @returns Status indicator object
 */
export function getGpsStatusIndicator(lastSeenAt: Date | null): {
  color: "GREEN" | "YELLOW" | "RED" | "GRAY";
  label: string;
  minutesAgo: number | null;
} {
  if (!lastSeenAt) {
    return {
      color: "GRAY",
      label: "No GPS",
      minutesAgo: null,
    };
  }

  const now = new Date();
  const minutesAgo = Math.floor(
    (now.getTime() - lastSeenAt.getTime()) / 1000 / 60
  );

  if (minutesAgo < 5) {
    return {
      color: "GREEN",
      label: "Active",
      minutesAgo,
    };
  } else if (minutesAgo < 30) {
    return {
      color: "YELLOW",
      label: `${minutesAgo} min ago`,
      minutesAgo,
    };
  } else {
    return {
      color: "RED",
      label:
        minutesAgo < 60
          ? `${minutesAgo} min ago`
          : `${Math.floor(minutesAgo / 60)}h ago`,
      minutesAgo,
    };
  }
}
