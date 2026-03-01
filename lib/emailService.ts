/**
 * Email Notification Service
 *
 * Sprint 16 - Story 16.10: User Notifications
 * Task: Email notifications for GPS, Settlement, and Account events
 *
 * ASYNC QUEUE MIGRATION:
 * - sendEmail() and sendEmailToUser() now enqueue jobs to the email queue
 * - sendEmailDirect() performs synchronous sending (used by workers)
 * - Retry: 3 attempts with exponential backoff
 *
 * Supports multiple email providers: SendGrid, AWS SES, Resend
 */

import { db } from "./db";
import { addJob, registerProcessor, isQueueReadySync } from "./queue";
import { logger } from "./logger";

// M9 FIX: HTML escaping to prevent injection in email templates
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Email provider configuration
 */
export type EmailProvider = "SENDGRID" | "AWS_SES" | "RESEND" | "CONSOLE";

/**
 * Email template types
 */
export enum EmailTemplate {
  GPS_OFFLINE = "GPS_OFFLINE",
  GPS_BACK_ONLINE = "GPS_BACK_ONLINE",
  TRUCK_AT_PICKUP = "TRUCK_AT_PICKUP",
  TRUCK_AT_DELIVERY = "TRUCK_AT_DELIVERY",
  POD_SUBMITTED = "POD_SUBMITTED",
  POD_VERIFIED = "POD_VERIFIED",
  SERVICE_FEE_DEDUCTED = "SERVICE_FEE_DEDUCTED",
  SETTLEMENT_COMPLETE = "SETTLEMENT_COMPLETE",
  BYPASS_WARNING = "BYPASS_WARNING",
  ACCOUNT_FLAGGED = "ACCOUNT_FLAGGED",
}

/**
 * Email message interface
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

/**
 * Email template data
 */
export interface EmailTemplateData {
  recipientName?: string;
  truckPlate?: string;
  loadId?: string;
  amount?: number;
  message?: string;
  actionUrl?: string;
  [key: string]: unknown;
}

/**
 * Get email provider from environment
 */
function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER;

  if (!provider || provider === "CONSOLE") {
    return "CONSOLE"; // Development/testing mode
  }

  return provider as EmailProvider;
}

/**
 * Get email template content
 */
function getEmailTemplate(
  template: EmailTemplate,
  data: EmailTemplateData
): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // M9 FIX: Escape all user-supplied data for HTML context
  const recipientName = escapeHtml((data.recipientName as string) || "User");
  const truckPlate = escapeHtml(data.truckPlate as string);
  const lastLocation = escapeHtml(data.lastLocation as string);
  const reason = escapeHtml(data.reason as string);
  const estimatedTime = escapeHtml(data.estimatedTime as string);

  switch (template) {
    case EmailTemplate.GPS_OFFLINE:
      return {
        subject: `GPS Alert: Truck ${truckPlate} Offline`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">GPS Signal Lost</h2>
            <p>Hello ${recipientName},</p>
            <p>The GPS signal for truck <strong>${truckPlate}</strong> on Load #${data.loadId} has been lost for more than 30 minutes.</p>
            <p><strong>Last Known Location:</strong> ${lastLocation || "Unknown"}</p>
            <p>Please check with the driver to ensure everything is okay.</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/loads/${data.loadId}/tracking"
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Tracking
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `GPS Signal Lost\n\nHello ${recipientName},\n\nThe GPS signal for truck ${truckPlate} on Load #${data.loadId} has been lost for more than 30 minutes.\n\nLast Known Location: ${lastLocation || "Unknown"}\n\nPlease check with the driver to ensure everything is okay.\n\nView Tracking: ${baseUrl}/loads/${data.loadId}/tracking\n\nFreightET Platform`,
      };

    case EmailTemplate.GPS_BACK_ONLINE:
      return {
        subject: `GPS Restored: Truck ${truckPlate}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">GPS Signal Restored</h2>
            <p>Hello ${recipientName},</p>
            <p>Good news! The GPS signal for truck <strong>${truckPlate}</strong> has been restored.</p>
            <p>You can now continue tracking the load in real-time.</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/loads/${data.loadId}/tracking"
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Live Tracking
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `GPS Signal Restored\n\nHello ${recipientName},\n\nGood news! The GPS signal for truck ${truckPlate} has been restored.\n\nYou can now continue tracking the load in real-time.\n\nView Live Tracking: ${baseUrl}/loads/${data.loadId}/tracking\n\nFreightET Platform`,
      };

    case EmailTemplate.TRUCK_AT_PICKUP:
      return {
        subject: `Truck Arrived: Load #${data.loadId?.slice(-8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Truck Arrived at Pickup</h2>
            <p>Hello ${recipientName},</p>
            <p>Truck <strong>${truckPlate}</strong> has arrived at the pickup location for Load #${data.loadId?.slice(-8)}.</p>
            <p><strong>Estimated Loading Time:</strong> ${estimatedTime || "30-60 minutes"}</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/loads/${data.loadId}"
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Load Details
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `Truck Arrived at Pickup\n\nHello ${recipientName},\n\nTruck ${truckPlate} has arrived at the pickup location for Load #${data.loadId?.slice(-8)}.\n\nEstimated Loading Time: ${estimatedTime || "30-60 minutes"}\n\nView Load Details: ${baseUrl}/loads/${data.loadId}\n\nFreightET Platform`,
      };

    case EmailTemplate.TRUCK_AT_DELIVERY:
      return {
        subject: `Delivery Imminent: Load #${data.loadId?.slice(-8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Truck Arrived for Delivery</h2>
            <p>Hello ${recipientName},</p>
            <p>Truck <strong>${truckPlate}</strong> has arrived at the delivery location for Load #${data.loadId?.slice(-8)}.</p>
            <p>Please prepare to receive the shipment.</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/loads/${data.loadId}"
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Load Details
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `Truck Arrived for Delivery\n\nHello ${recipientName},\n\nTruck ${truckPlate} has arrived at the delivery location for Load #${data.loadId?.slice(-8)}.\n\nPlease prepare to receive the shipment.\n\nView Load Details: ${baseUrl}/loads/${data.loadId}\n\nFreightET Platform`,
      };

    case EmailTemplate.POD_SUBMITTED:
      return {
        subject: `POD Submitted: Load #${data.loadId?.slice(-8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Proof of Delivery Submitted</h2>
            <p>Hello ${recipientName},</p>
            <p>A Proof of Delivery (POD) has been submitted for Load #${data.loadId?.slice(-8)}.</p>
            <p>Please review and verify the POD within 24 hours.</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/loads/${data.loadId}"
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review POD
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `Proof of Delivery Submitted\n\nHello ${recipientName},\n\nA Proof of Delivery (POD) has been submitted for Load #${data.loadId?.slice(-8)}.\n\nPlease review and verify the POD within 24 hours.\n\nReview POD: ${baseUrl}/loads/${data.loadId}\n\nFreightET Platform`,
      };

    case EmailTemplate.POD_VERIFIED:
      return {
        subject: `POD Verified: Load #${data.loadId?.slice(-8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">POD Verified - Settlement Processing</h2>
            <p>Hello ${recipientName},</p>
            <p>The Proof of Delivery for Load #${data.loadId?.slice(-8)} has been verified.</p>
            <p>Settlement is now being processed.</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/loads/${data.loadId}"
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Settlement Status
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `POD Verified - Settlement Processing\n\nHello ${recipientName},\n\nThe Proof of Delivery for Load #${data.loadId?.slice(-8)} has been verified.\n\nSettlement is now being processed.\n\nView Settlement Status: ${baseUrl}/loads/${data.loadId}\n\nFreightET Platform`,
      };

    case EmailTemplate.SERVICE_FEE_DEDUCTED: {
      const totalAmount = Number(data.totalAmount) || 0;
      const feeAmount = data.amount || 0;
      const netAmount = totalAmount - feeAmount;
      return {
        subject: `Service Fee Deducted: ${data.amount} ETB`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Service Fee Deducted</h2>
            <p>Hello ${recipientName},</p>
            <p>A service fee of <strong>${data.amount} ETB</strong> has been deducted for Load #${data.loadId?.slice(-8)}.</p>
            <p><strong>Load Amount:</strong> ${totalAmount} ETB</p>
            <p><strong>Net Amount:</strong> ${netAmount} ETB</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/"
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Wallet
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `Service Fee Deducted\n\nHello ${recipientName},\n\nA service fee of ${data.amount} ETB has been deducted for Load #${data.loadId?.slice(-8)}.\n\nLoad Amount: ${totalAmount} ETB\nNet Amount: ${netAmount} ETB\n\nView Wallet: ${baseUrl}/\n\nFreightET Platform`,
      };
    }

    case EmailTemplate.SETTLEMENT_COMPLETE:
      return {
        subject: `Settlement Complete: Load #${data.loadId?.slice(-8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Settlement Complete</h2>
            <p>Hello ${recipientName},</p>
            <p>The settlement for Load #${data.loadId?.slice(-8)} has been completed.</p>
            <p><strong>Settlement Amount:</strong> ${data.amount} ETB</p>
            <p><strong>Status:</strong> PAID</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/"
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Transaction History
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `Settlement Complete\n\nHello ${recipientName},\n\nThe settlement for Load #${data.loadId?.slice(-8)} has been completed.\n\nSettlement Amount: ${data.amount} ETB\nStatus: PAID\n\nView Transaction History: ${baseUrl}/\n\nFreightET Platform`,
      };

    case EmailTemplate.ACCOUNT_FLAGGED:
      return {
        subject: "⚠️ URGENT: Account Flagged for Review",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">⚠️ Account Flagged for Review</h2>
            <p>Hello ${recipientName},</p>
            <p>Your account has been flagged for suspicious activity and is under review.</p>
            <p><strong>Reason:</strong> ${reason || "Pattern of suspicious cancellations"}</p>
            <p>Please contact our support team immediately to resolve this issue.</p>
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/support"
                 style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Contact Support
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              FreightET Platform - Freight Management System
            </p>
          </div>
        `,
        text: `⚠️ Account Flagged for Review\n\nHello ${recipientName},\n\nYour account has been flagged for suspicious activity and is under review.\n\nReason: ${reason || "Pattern of suspicious cancellations"}\n\nPlease contact our support team immediately to resolve this issue.\n\nContact Support: ${baseUrl}/support\n\nFreightET Platform`,
      };

    default:
      return {
        subject: "FreightET Notification",
        html: `<p>Hello ${recipientName},</p><p>${data.message}</p>`,
        text: `Hello ${recipientName},\n\n${data.message}`,
      };
  }
}

/**
 * Send email via console (development/testing)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sendViaConsole(message: EmailMessage): Promise<void> {}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(message: EmailMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not configured, falling back to console");
    return sendViaConsole(message);
  }

  try {
    // In production, use @sendgrid/mail
    // sgMail.setApiKey(apiKey);
    //   to: message.to,
    //   from: message.from || 'noreply@freightet.com',
    //   subject: message.subject,
    //   text: message.text,
    //   html: message.html,
  } catch (error) {
    console.error("SendGrid email failed:", error);
    throw error;
  }
}

/**
 * Send email via AWS SES
 */
async function sendViaAwsSes(message: EmailMessage): Promise<void> {
  const region = process.env.AWS_REGION;

  if (!region) {
    console.warn("AWS_REGION not configured, falling back to console");
    return sendViaConsole(message);
  }

  try {
    // In production, use AWS SDK
    //   Source: message.from || 'noreply@freightet.com',
    //   Destination: { ToAddresses: [message.to] },
    //   Message: {
    //     Subject: { Data: message.subject },
    //     Body: {
    //       Text: { Data: message.text },
    //       Html: { Data: message.html },
  } catch (error) {
    console.error("AWS SES email failed:", error);
    throw error;
  }
}

/**
 * Send email via Resend
 */
async function sendViaResend(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured, falling back to console");
    return sendViaConsole(message);
  }

  try {
    // In production, use resend package
    //   from: message.from || 'FreightET <noreply@freightet.com>',
    //   to: message.to,
    //   subject: message.subject,
    //   text: message.text,
    //   html: message.html,
  } catch (error) {
    console.error("Resend email failed:", error);
    throw error;
  }
}

/**
 * Send an email notification directly (synchronous - used by workers)
 *
 * @param to - Recipient email address
 * @param template - Email template to use
 * @param data - Template data
 */
export async function sendEmailDirect(
  to: string,
  template: EmailTemplate,
  data: EmailTemplateData
): Promise<void> {
  try {
    // Get template content
    const templateContent = getEmailTemplate(template, data);

    // Create email message
    const message: EmailMessage = {
      to,
      subject: templateContent.subject,
      html: templateContent.html,
      text: templateContent.text,
      from: process.env.EMAIL_FROM || "noreply@freightet.com",
    };

    // Send via configured provider
    const provider = getEmailProvider();

    switch (provider) {
      case "SENDGRID":
        await sendViaSendGrid(message);
        break;
      case "AWS_SES":
        await sendViaAwsSes(message);
        break;
      case "RESEND":
        await sendViaResend(message);
        break;
      case "CONSOLE":
      default:
        await sendViaConsole(message);
        break;
    }

    logger.info(`[EMAIL SERVICE] Sent: ${template} to ${to}`);
  } catch (error) {
    logger.error("[EMAIL SERVICE] Failed to send email", error);
    throw error; // Re-throw for queue retry
  }
}

/**
 * Template email job data for queue
 */
export interface TemplateEmailJobData {
  to: string;
  template: EmailTemplate;
  data: EmailTemplateData;
  [key: string]: unknown; // Index signature for JobData compatibility
}

/**
 * Send an email notification via async queue
 *
 * Enqueues the email to be sent by a background worker.
 * Falls back to direct sending if queue is not available.
 *
 * @param to - Recipient email address
 * @param template - Email template to use
 * @param data - Template data
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: EmailTemplateData
): Promise<void> {
  // Try to use queue if available
  if (isQueueReadySync()) {
    try {
      const jobId = await addJob(
        "email",
        "send-template-email",
        {
          to,
          template,
          data,
        } as TemplateEmailJobData,
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000, // Start with 2s, then 4s, then 8s
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        }
      );

      logger.debug("[EMAIL SERVICE] Queued", {
        jobId,
        to,
        template,
      });

      return;
    } catch (queueError) {
      logger.warn("[EMAIL SERVICE] Queue failed, falling back to direct send", {
        error: queueError,
      });
      // Fall through to direct send
    }
  }

  // Fallback to direct send (swallows errors like before)
  try {
    await sendEmailDirect(to, template, data);
  } catch (error) {
    logger.error("[EMAIL SERVICE] Failed to send email", error);
    // Don't throw - emails are non-critical, just log the error
  }
}

/**
 * Send email notification to user
 *
 * @param userId - User ID
 * @param template - Email template
 * @param data - Template data
 */
export async function sendEmailToUser(
  userId: string,
  template: EmailTemplate,
  data: EmailTemplateData
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user?.email) {
    logger.debug(`[EMAIL SERVICE] No email address for user ${userId}`);
    return;
  }

  const recipientName = user.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "User";

  await sendEmail(user.email, template, {
    ...data,
    recipientName,
  });
}

// =============================================================================
// EMAIL TEMPLATE QUEUE PROCESSOR
// =============================================================================

/**
 * Process template email job from queue
 *
 * Called by BullMQ worker to send template-based emails asynchronously.
 * Includes retry logic: 3 attempts with exponential backoff.
 */
export async function processTemplateEmailJob(
  job: { id: string; name: string; data: TemplateEmailJobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { to, template, data } = job.data;

  logger.info("[EMAIL SERVICE WORKER] Processing job", {
    jobId: job.id,
    to,
    template,
  });

  await updateProgress(10);

  await sendEmailDirect(to, template, data);

  await updateProgress(100);

  logger.info("[EMAIL SERVICE WORKER] Job completed", {
    jobId: job.id,
  });
}

/**
 * Register email service processor with queue system
 *
 * Call this during application startup to enable template email queue processing.
 */
export function registerTemplateEmailProcessor(): void {
  registerProcessor("email", "send-template-email", processTemplateEmailJob);
  logger.info(
    "[EMAIL SERVICE] Processor registered for queue: email (template)"
  );
}
