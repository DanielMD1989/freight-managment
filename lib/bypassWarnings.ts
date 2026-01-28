/**
 * Bypass Detection Warning System
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Automated warnings for suspicious bypass behavior
 */

import { db } from './db';
import { createNotification } from './notifications';
import { sendEmail, EmailTemplate } from './emailService';
import { sendSms } from './sms';

/**
 * Warning types for bypass detection
 */
export enum BypassWarningType {
  FIRST_SUSPICIOUS_CANCELLATION = 'FIRST_SUSPICIOUS_CANCELLATION',
  MULTIPLE_SUSPICIOUS_CANCELLATIONS = 'MULTIPLE_SUSPICIOUS_CANCELLATIONS',
  ACCOUNT_FLAGGED = 'ACCOUNT_FLAGGED',
  BYPASS_REPORTED = 'BYPASS_REPORTED',
}

/**
 * Warning severity levels
 */
export enum WarningSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

interface WarningMessage {
  subject: string;
  message: string;
  severity: WarningSeverity;
  actionRequired: string;
}

/**
 * Get warning message template based on warning type
 */
function getWarningMessage(
  type: BypassWarningType,
  organizationName: string,
  details?: any
): WarningMessage {
  switch (type) {
    case BypassWarningType.FIRST_SUSPICIOUS_CANCELLATION:
      return {
        subject: 'Platform Completion Reminder',
        message: `Dear ${organizationName},\n\nWe noticed that you recently cancelled a load after viewing contact information. We understand that circumstances change, but we want to remind you of the benefits of completing loads through our platform:\n\n✓ GPS Tracking & Real-time Updates\n✓ Dispute Support & Resolution\n✓ Proof of Delivery Verification\n✓ Trust Score & Verified Badges\n✓ Payment Protection\n✓ Commission Discounts (up to 10% off for >90% completion rate)\n\nCompleting loads through the platform protects both parties and builds trust in the marketplace.\n\nIf you have any questions or concerns, please contact our support team.\n\nBest regards,\nFreightET Platform Team`,
        severity: WarningSeverity.INFO,
        actionRequired: 'None - This is a courtesy reminder',
      };

    case BypassWarningType.MULTIPLE_SUSPICIOUS_CANCELLATIONS:
      return {
        subject: 'Important: Multiple Suspicious Cancellations Detected',
        message: `Dear ${organizationName},\n\nWe have detected multiple instances (${details?.count || 'several'}) where loads were cancelled shortly after viewing contact information. This pattern may indicate platform bypass attempts.\n\n⚠️ WARNING: Continued suspicious behavior may result in:\n• Account flagging and review\n• Loss of verified status\n• Reduced visibility in search results\n• Potential account suspension\n\nPlatform Benefits You're Missing:\n✓ Commission Discounts: Save up to 10% on fees with high completion rates\n✓ Priority Listing: Verified companies appear higher in search results\n✓ Trust Score Bonus: Build reputation and attract more business\n✓ GPS Tracking: Monitor your shipments in real-time\n✓ Dispute Protection: Professional mediation for any issues\n\nPlease ensure all loads are completed through the platform. If you have legitimate reasons for cancellations, please contact our support team immediately.\n\nBest regards,\nFreightET Platform Team`,
        severity: WarningSeverity.WARNING,
        actionRequired: 'Review your account activity and ensure platform completion',
      };

    case BypassWarningType.ACCOUNT_FLAGGED:
      return {
        subject: 'URGENT: Account Flagged for Review',
        message: `Dear ${organizationName},\n\n🚨 URGENT NOTICE: Your account has been flagged for suspicious activity.\n\nReason: ${details?.reason || 'Pattern of suspicious cancellations after viewing contact information'}\n\nYour account is now under review by our platform operations team. During this review period:\n• Your listings may have reduced visibility\n• Some platform features may be restricted\n• You may be contacted for additional verification\n\nIMPORTATE ACTIONS REQUIRED:\n1. Review all recent load cancellations\n2. Contact our support team immediately to explain any unusual activity\n3. Ensure all future loads are completed through the platform\n4. Provide any documentation to support legitimate cancellations\n\nFailure to respond within 7 days may result in account suspension.\n\nTo protect your account standing:\n✓ Complete all loads through the platform\n✓ Maintain honest communication with all parties\n✓ Use platform features (GPS tracking, POD, disputes)\n✓ Build your trust score and completion rate\n\nContact Support: support@freightet.com\nPhone: +251-XX-XXX-XXXX\n\nBest regards,\nFreightET Platform Operations Team`,
        severity: WarningSeverity.CRITICAL,
        actionRequired: 'Contact support immediately and provide explanation',
      };

    case BypassWarningType.BYPASS_REPORTED:
      return {
        subject: 'Bypass Attempt Reported Against Your Account',
        message: `Dear ${organizationName},\n\nWe have received a report from another platform user alleging that you attempted to bypass the platform after viewing contact information.\n\nReport Details:\n• Load ID: ${details?.loadId || 'N/A'}\n• Reported By: ${details?.reportedBy || 'Another user'}\n• Date: ${details?.reportedAt ? new Date(details.reportedAt).toLocaleDateString() : 'N/A'}\n• Reason: ${details?.reason || 'Not provided'}\n\nThis report will be investigated by our platform operations team. Please note:\n• Multiple bypass reports may result in account flagging\n• False reports are taken seriously and investigated\n• You have the right to respond to this allegation\n\nWhat You Should Do:\n1. Review the details of the reported load\n2. If you have an explanation, contact support immediately\n3. Ensure all future loads are completed through the platform\n4. Maintain professional communication with all platform users\n\nRemember: Completing loads through the platform provides:\n✓ Legal protection for both parties\n✓ Dispute resolution support\n✓ Payment security\n✓ Trust score and reputation building\n✓ Commission discounts for high completion rates\n\nContact Support: support@freightet.com\n\nBest regards,\nFreightET Platform Team`,
        severity: WarningSeverity.WARNING,
        actionRequired: 'Review the report and contact support if needed',
      };

    default:
      return {
        subject: 'Platform Notice',
        message: 'Please review your account activity.',
        severity: WarningSeverity.INFO,
        actionRequired: 'None',
      };
  }
}

/**
 * Send in-app notification to organization users
 *
 * Creates a notification record in the database for display in the user's dashboard
 */
async function sendInAppNotification(
  organizationId: string,
  type: BypassWarningType,
  message: WarningMessage
): Promise<void> {
  try {
    // Get all active users for this organization
    const users = await db.user.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (users.length === 0) {
      console.log(`No active users found for organization ${organizationId}`);
      return;
    }

    // Create notification for each user
    console.log(`📬 In-app notification sent to ${users.length} users of organization ${organizationId}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Severity: ${message.severity}`);

    // Create actual notification records using the notification system
    await Promise.all(
      users.map((user) =>
        createNotification({
          userId: user.id,
          type: type === BypassWarningType.ACCOUNT_FLAGGED ? 'ACCOUNT_FLAGGED' : 'BYPASS_WARNING',
          title: message.subject,
          message: message.message,
          metadata: {
            severity: message.severity,
            actionRequired: message.actionRequired,
            warningType: type,
          },
        })
      )
    );
  } catch (error) {
    console.error('Failed to send in-app notification:', error);
  }
}

/**
 * Send email notification
 *
 * Uses the email service to send bypass warnings via email
 */
async function sendEmailNotification(
  organizationId: string,
  type: BypassWarningType,
  message: WarningMessage
): Promise<void> {
  try {
    // Get organization contact email
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        contactEmail: true,
        name: true,
      },
    });

    if (!organization?.contactEmail) {
      console.log(`No contact email for organization ${organizationId}`);
      return;
    }

    // Send email using the email service
    if (type === BypassWarningType.ACCOUNT_FLAGGED) {
      await sendEmail(organization.contactEmail, EmailTemplate.ACCOUNT_FLAGGED, {
        recipientName: organization.name,
        reason: message.message,
      });
    } else {
      // For other bypass warnings, use generic message
      await sendEmail(organization.contactEmail, EmailTemplate.BYPASS_WARNING, {
        recipientName: organization.name,
        message: message.message,
      });
    }

    console.log(`📧 Bypass warning email sent to: ${organization.contactEmail}`);
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

/**
 * Send SMS notification
 *
 * TD-011 FIX: Integrated with Twilio SMS service
 */
async function sendSmsNotification(
  organizationId: string,
  type: BypassWarningType,
  message: WarningMessage
): Promise<void> {
  try {
    // Only send SMS for critical warnings
    if (message.severity !== WarningSeverity.CRITICAL) {
      return;
    }

    // Get organization contact phone
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        contactPhone: true,
        name: true,
      },
    });

    if (!organization?.contactPhone) {
      console.log(`No contact phone for organization ${organizationId}`);
      return;
    }

    // Create short SMS version (max 160 chars for single SMS)
    const smsText = `FreightET URGENT: Your account has been flagged. Check your email and contact support immediately. Ref: ${organizationId.slice(-8)}`;

    // Send SMS via Twilio
    const result = await sendSms(organization.contactPhone, smsText);

    if (result.success) {
      console.log(`📱 SMS sent to: ${organization.contactPhone} (ID: ${result.messageId})`);
    } else {
      console.error(`📱 SMS failed to: ${organization.contactPhone} - ${result.error}`);
    }
  } catch (error) {
    console.error('Failed to send SMS notification:', error);
  }
}

/**
 * Send bypass warning to organization
 *
 * Sends multi-channel warning (in-app, email, SMS for critical)
 */
export async function sendBypassWarning(
  organizationId: string,
  type: BypassWarningType,
  details?: any
): Promise<void> {
  try {
    // Get organization name
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
      },
    });

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    // Get warning message
    const message = getWarningMessage(type, organization.name, details);

    console.log(`\n🚨 Sending bypass warning to ${organization.name}`);
    console.log(`Type: ${type}`);
    console.log(`Severity: ${message.severity}`);

    // Send multi-channel notifications
    await Promise.all([
      sendInAppNotification(organizationId, type, message),
      sendEmailNotification(organizationId, type, message),
      sendSmsNotification(organizationId, type, message),
    ]);

    console.log(`✓ Bypass warning sent successfully to ${organization.name}\n`);
  } catch (error) {
    console.error('Failed to send bypass warning:', error);
    throw error;
  }
}

/**
 * Report a bypass attempt by another user
 *
 * Allows users to report suspected bypass behavior
 *
 * @param loadId - Load ID where bypass was suspected
 * @param reportedOrgId - Organization being reported
 * @param reporterUserId - User making the report
 * @param reason - Reason for report
 */
export async function reportBypassAttempt(
  loadId: string,
  reportedOrgId: string,
  reporterUserId: string,
  reason: string
): Promise<void> {
  try {
    // Get load and reporter details
    const [load, reporter] = await Promise.all([
      db.load.findUnique({
        where: { id: loadId },
        select: { id: true },
      }),
      db.user.findUnique({
        where: { id: reporterUserId },
        select: {
          organization: {
            select: { name: true },
          },
        },
      }),
    ]);

    if (!load) {
      throw new Error('Load not found');
    }

    // Send warning to reported organization
    await sendBypassWarning(reportedOrgId, BypassWarningType.BYPASS_REPORTED, {
      loadId,
      reportedBy: reporter?.organization?.name || 'Another user',
      reportedAt: new Date(),
      reason,
    });

    // Notify admins about the report
    const admins = await db.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPER_ADMIN'],
        },
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'BYPASS_REPORTED',
          title: 'Bypass Attempt Reported',
          message: `A bypass attempt has been reported for Load #${loadId.slice(-8)}`,
          metadata: {
            loadId,
            reportedOrgId,
            reporterUserId,
            reason,
          },
        })
      )
    );

    console.log(`Bypass report submitted for load ${loadId}`);
  } catch (error) {
    console.error('Failed to report bypass attempt:', error);
    throw error;
  }
}

/**
 * Check and send warnings for organizations with suspicious patterns
 *
 * This should be called periodically (e.g., daily cron job) to check for
 * organizations that need warnings
 */
export async function checkAndSendWarnings(): Promise<{
  warningsSent: number;
  organizationsWarned: string[];
}> {
  console.log('=== Checking for organizations needing bypass warnings ===');

  const organizationsWarned: string[] = [];

  // Find organizations with 1-2 suspicious cancellations (send info warning)
  const firstTimeOffenders = await db.organization.findMany({
    where: {
      suspiciousCancellationCount: {
        gte: 1,
        lt: 3,
      },
      isFlagged: false,
    },
    select: {
      id: true,
      name: true,
      suspiciousCancellationCount: true,
    },
  });

  for (const org of firstTimeOffenders) {
    await sendBypassWarning(
      org.id,
      BypassWarningType.FIRST_SUSPICIOUS_CANCELLATION,
      { count: org.suspiciousCancellationCount }
    );
    organizationsWarned.push(org.name);
  }

  // Find organizations with 3+ suspicious cancellations but not yet flagged
  const multipleOffenders = await db.organization.findMany({
    where: {
      suspiciousCancellationCount: {
        gte: 3,
      },
      isFlagged: false,
    },
    select: {
      id: true,
      name: true,
      suspiciousCancellationCount: true,
    },
  });

  for (const org of multipleOffenders) {
    await sendBypassWarning(
      org.id,
      BypassWarningType.MULTIPLE_SUSPICIOUS_CANCELLATIONS,
      { count: org.suspiciousCancellationCount }
    );
    organizationsWarned.push(org.name);
  }

  // Find newly flagged organizations (flagged within last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newlyFlagged = await db.organization.findMany({
    where: {
      isFlagged: true,
      flaggedAt: {
        gte: twentyFourHoursAgo,
      },
    },
    select: {
      id: true,
      name: true,
      flagReason: true,
    },
  });

  for (const org of newlyFlagged) {
    await sendBypassWarning(org.id, BypassWarningType.ACCOUNT_FLAGGED, {
      reason: org.flagReason,
    });
    organizationsWarned.push(org.name);
  }

  console.log(`=== Warning check complete: ${organizationsWarned.length} warnings sent ===`);

  return {
    warningsSent: organizationsWarned.length,
    organizationsWarned,
  };
}
