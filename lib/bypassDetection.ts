/**
 * Bypass Detection Utility
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Detects and prevents platform bypass attempts
 */

import { db } from './db';
import { sendBypassWarning, BypassWarningType } from './bypassWarnings';

/**
 * Track when a user views contact information for a load
 *
 * @param loadId - Load ID
 * @param userId - User ID who viewed contact info
 */
export async function trackContactView(
  loadId: string,
  userId: string
): Promise<void> {
  await db.load.update({
    where: { id: loadId },
    data: {
      contactViewedAt: new Date(),
    },
  });

  // Create load event
  await db.loadEvent.create({
    data: {
      loadId,
      eventType: 'CONTACT_VIEWED',
      description: 'Contact information viewed',
      userId,
    },
  });
}

/**
 * Calculate cancellation pattern after contact view
 *
 * Returns the percentage of loads that were cancelled after contact info was viewed
 *
 * @param organizationId - Organization ID to analyze
 * @returns Percentage (0-100) of cancellations after contact view
 */
export async function calculateCancellationPattern(
  organizationId: string
): Promise<number> {
  // Get all loads where this organization viewed contact AND then cancelled
  const loadsWithContactView = await db.load.findMany({
    where: {
      shipperId: organizationId,
      contactViewedAt: {
        not: null,
      },
    },
    select: {
      id: true,
      contactViewedAt: true,
      status: true,
      updatedAt: true,
    },
  });

  if (loadsWithContactView.length === 0) {
    return 0;
  }

  // Count how many were cancelled after viewing contact
  const cancelledAfterView = loadsWithContactView.filter((load) => {
    if (load.status !== 'CANCELLED') return false;

    // Check if cancellation happened after contact view
    if (!load.contactViewedAt) return false;

    // Consider it suspicious if cancelled within 48 hours of viewing contact
    const hoursSinceView =
      (load.updatedAt.getTime() - load.contactViewedAt.getTime()) /
      (1000 * 60 * 60);

    return hoursSinceView > 0 && hoursSinceView <= 48;
  }).length;

  const percentage = (cancelledAfterView / loadsWithContactView.length) * 100;
  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}

/**
 * Detect suspicious bypass patterns for an organization
 *
 * Rules:
 * - Rule 1: >50% cancellation rate after viewing contact info
 * - Rule 2: Contact viewed → cancellation within 24-48 hours (3+ times)
 * - Rule 3: High overall cancellation rate (>70%)
 * - Rule 4: Multiple bypass reports from different users
 *
 * @param organizationId - Organization ID to analyze
 * @returns true if suspicious pattern detected, false otherwise
 */
export async function detectSuspiciousPattern(
  organizationId: string
): Promise<boolean> {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      cancellationRate: true,
      suspiciousCancellationCount: true,
      bypassAttemptCount: true,
    },
  });

  if (!organization) {
    return false;
  }

  // Rule 1 & 2: >50% cancellation after contact view AND 3+ suspicious cancellations
  const cancellationAfterViewRate =
    await calculateCancellationPattern(organizationId);

  if (cancellationAfterViewRate > 50 && organization.suspiciousCancellationCount >= 3) {
    return true;
  }

  // Rule 3: High overall cancellation rate (>70%)
  if (
    organization.cancellationRate &&
    Number(organization.cancellationRate) > 70
  ) {
    return true;
  }

  // Rule 4: Multiple bypass reports (3+)
  if (organization.bypassAttemptCount >= 3) {
    return true;
  }

  return false;
}

/**
 * Flag an organization for review
 *
 * @param organizationId - Organization ID to flag
 * @param reason - Reason for flagging
 */
export async function flagUserForReview(
  organizationId: string,
  reason: string
): Promise<void> {
  await db.organization.update({
    where: { id: organizationId },
    data: {
      isFlagged: true,
      flaggedAt: new Date(),
      flagReason: reason,
    },
  });

  // Send automated warning to flagged organization
  try {
    await sendBypassWarning(organizationId, BypassWarningType.ACCOUNT_FLAGGED, {
      reason,
    });
    console.log(`✓ Flagged warning sent to organization ${organizationId}`);
  } catch (error) {
    console.error('Failed to send flagged warning:', error);
    // Don't throw - flagging succeeded even if warning failed
  }
}

/**
 * Record a bypass report
 *
 * @param loadId - Load ID where bypass was reported
 * @param reportedBy - User ID who is reporting
 * @param reason - Optional reason for report
 */
export async function recordBypassReport(
  loadId: string,
  reportedBy: string,
  reason?: string
): Promise<void> {
  // Get the load to find the shipper
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      shipperId: true,
      bypassReported: true,
    },
  });

  if (!load) {
    throw new Error('Load not found');
  }

  // Don't allow duplicate reports on same load
  if (load.bypassReported) {
    throw new Error('Bypass already reported for this load');
  }

  // Update load with bypass report
  await db.load.update({
    where: { id: loadId },
    data: {
      bypassReported: true,
      bypassReportedAt: new Date(),
      bypassReportedBy: reportedBy,
    },
  });

  // Increment organization's bypass attempt count
  await db.organization.update({
    where: { id: load.shipperId },
    data: {
      bypassAttemptCount: {
        increment: 1,
      },
    },
  });

  // Create load event
  await db.loadEvent.create({
    data: {
      loadId,
      eventType: 'BYPASS_REPORTED',
      description: reason || 'Bypass attempt reported',
      userId: reportedBy,
    },
  });

  // Send bypass report notification
  try {
    await sendBypassWarning(load.shipperId, BypassWarningType.BYPASS_REPORTED, {
      loadId,
      reportedBy,
      reportedAt: new Date(),
      reason,
    });
    console.log(`✓ Bypass report warning sent to organization ${load.shipperId}`);
  } catch (error) {
    console.error('Failed to send bypass report warning:', error);
  }

  // Check if organization should be flagged
  const isSuspicious = await detectSuspiciousPattern(load.shipperId);

  if (isSuspicious) {
    const cancellationPattern = await calculateCancellationPattern(
      load.shipperId
    );

    await flagUserForReview(
      load.shipperId,
      `Suspicious pattern detected: ${cancellationPattern}% cancellation rate after viewing contact info. ${await getBypassAttemptCount(load.shipperId)} bypass reports received.`
    );
  }
}

/**
 * Get bypass attempt count for an organization
 *
 * @param organizationId - Organization ID
 * @returns Number of bypass attempts
 */
export async function getBypassAttemptCount(
  organizationId: string
): Promise<number> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { bypassAttemptCount: true },
  });

  return org?.bypassAttemptCount || 0;
}

/**
 * Increment suspicious cancellation count
 *
 * Called when a load is cancelled after contact info was viewed
 *
 * @param organizationId - Organization ID
 */
export async function incrementSuspiciousCancellation(
  organizationId: string
): Promise<void> {
  // Increment count and get updated value
  const updated = await db.organization.update({
    where: { id: organizationId },
    data: {
      suspiciousCancellationCount: {
        increment: 1,
      },
    },
    select: {
      suspiciousCancellationCount: true,
    },
  });

  const count = updated.suspiciousCancellationCount;

  // Send warnings based on count
  try {
    if (count === 1) {
      // First offense - send info warning
      await sendBypassWarning(
        organizationId,
        BypassWarningType.FIRST_SUSPICIOUS_CANCELLATION,
        { count }
      );
    } else if (count >= 3 && count < 5) {
      // Multiple offenses - send serious warning
      await sendBypassWarning(
        organizationId,
        BypassWarningType.MULTIPLE_SUSPICIOUS_CANCELLATIONS,
        { count }
      );
    }
    console.log(
      `✓ Suspicious cancellation warning sent (count: ${count}) to organization ${organizationId}`
    );
  } catch (error) {
    console.error('Failed to send suspicious cancellation warning:', error);
  }

  // Check if organization should be flagged
  const isSuspicious = await detectSuspiciousPattern(organizationId);

  if (isSuspicious) {
    const cancellationPattern =
      await calculateCancellationPattern(organizationId);

    await flagUserForReview(
      organizationId,
      `Suspicious cancellation pattern: ${cancellationPattern}% of loads cancelled after viewing contact info.`
    );
  }
}

/**
 * Check if a load cancellation should be flagged as suspicious
 *
 * Called when a load is being cancelled
 *
 * @param loadId - Load ID
 * @returns true if suspicious, false otherwise
 */
export async function checkSuspiciousCancellation(
  loadId: string
): Promise<boolean> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      contactViewedAt: true,
      shipperId: true,
    },
  });

  if (!load || !load.contactViewedAt) {
    return false; // Not suspicious if contact wasn't viewed
  }

  // Calculate hours since contact view
  const hoursSinceView =
    (new Date().getTime() - load.contactViewedAt.getTime()) / (1000 * 60 * 60);

  // Suspicious if cancelling within 48 hours of viewing contact
  if (hoursSinceView > 0 && hoursSinceView <= 48) {
    await incrementSuspiciousCancellation(load.shipperId);
    return true;
  }

  return false;
}

/**
 * Get platform benefits for incentivizing platform use
 *
 * Returns list of benefits users get from using the platform
 */
export function getPlatformBenefits(): Array<{
  title: string;
  description: string;
  icon: string;
}> {
  return [
    {
      title: 'GPS Tracking Access',
      description:
        'Real-time tracking of your shipments with live updates and ETAs',
      icon: '📍',
    },
    {
      title: 'Dispute Support & Resolution',
      description:
        'Professional mediation and support for any shipment disputes',
      icon: '🛡️',
    },
    {
      title: 'POD Verification',
      description:
        'Proof of delivery system ensures accountability and transparency',
      icon: '📄',
    },
    {
      title: 'Completion Rate & Verified Badges',
      description:
        'Build trust with verified status and high completion rate badges',
      icon: '✓',
    },
    {
      title: 'Payment Protection',
      description:
        'Secure payment processing with commission-based settlement',
      icon: '💳',
    },
    {
      title: 'Priority Listing',
      description:
        'Verified companies get priority placement in search results',
      icon: '⭐',
    },
    {
      title: 'Commission Discounts',
      description: 'Earn lower commission rates with >90% completion rate',
      icon: '💰',
    },
    {
      title: 'Trust Score Bonus',
      description: 'Higher trust scores lead to more business opportunities',
      icon: '📊',
    },
  ];
}

/**
 * Calculate commission discount based on completion rate
 *
 * Organizations with >90% completion rate get 10% off commission
 *
 * @param organizationId - Organization ID
 * @returns Discount percentage (0-10)
 */
export async function calculateCommissionDiscount(
  organizationId: string
): Promise<number> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      completionRate: true,
      isVerified: true,
    },
  });

  if (!org) {
    return 0;
  }

  const completionRate = org.completionRate ? Number(org.completionRate) : 0;

  // 10% discount for >90% completion rate
  if (completionRate > 90 && org.isVerified) {
    return 10;
  }

  // 5% discount for >80% completion rate
  if (completionRate > 80 && org.isVerified) {
    return 5;
  }

  return 0;
}
