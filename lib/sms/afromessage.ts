/**
 * AfroMessage SMS Service
 *
 * Sprint 19 - MFA Implementation
 *
 * Integration with AfroMessage (https://afromessage.com) - Ethiopia's
 * enterprise-grade SMS service provider.
 *
 * ASYNC QUEUE MIGRATION:
 * - sendSMS() now enqueues jobs to the sms queue
 * - sendSMSDirect() performs synchronous sending (used by workers)
 * - Retry: 3 attempts with exponential backoff
 * - Visibility timeout: 30 seconds for long-running jobs
 *
 * Features:
 * - Send OTP for MFA verification
 * - Send password reset codes
 * - Send notification SMS
 *
 * Environment Variables:
 * - AFROMESSAGE_API_KEY: Your API key from AfroMessage dashboard
 * - AFROMESSAGE_SENDER_NAME: Registered sender ID (e.g., "FreightMgt")
 */

import { addJob, registerProcessor, isQueueReadySync } from '../queue';
import { logger } from '../logger';

// AfroMessage API configuration
const AFROMESSAGE_API_URL = 'https://api.afromessage.com/api/send';

interface AfroMessageConfig {
  apiKey: string;
  senderName: string;
}

interface AfroMessageResponse {
  acknowledge: 'success' | 'error';
  response?: string;
  error?: string;
  message_id?: string;
}

interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get AfroMessage configuration from environment
 */
function getConfig(): AfroMessageConfig {
  const apiKey = process.env.AFROMESSAGE_API_KEY;
  const senderName = process.env.AFROMESSAGE_SENDER_NAME || 'FreightMgt';

  if (!apiKey) {
    throw new Error('AFROMESSAGE_API_KEY environment variable is not set');
  }

  return { apiKey, senderName };
}

/**
 * Format Ethiopian phone number to international format
 * Accepts: 0911234567, +251911234567, 251911234567, 911234567
 * Returns: 251911234567
 */
export function formatEthiopianPhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 0, replace with 251
  if (cleaned.startsWith('0')) {
    cleaned = '251' + cleaned.substring(1);
  }

  // If only 9 digits (no country code), add 251
  if (cleaned.length === 9 && (cleaned.startsWith('9') || cleaned.startsWith('7'))) {
    cleaned = '251' + cleaned;
  }

  // Validate Ethiopian phone number format
  if (!cleaned.startsWith('251') || cleaned.length !== 12) {
    throw new Error(`Invalid Ethiopian phone number: ${phone}`);
  }

  return cleaned;
}

/**
 * SMS job data for queue
 */
export interface SMSJobData {
  to: string;
  message: string;
  [key: string]: unknown; // Index signature for JobData compatibility
}

/**
 * Send SMS via AfroMessage API (direct - used by workers)
 *
 * @param to - Recipient phone number (Ethiopian format)
 * @param message - SMS message content (max 160 chars for single SMS)
 * @returns SendSMSResult with success status and optional message ID
 */
export async function sendSMSDirect(to: string, message: string): Promise<SendSMSResult> {
  try {
    const config = getConfig();
    const formattedPhone = formatEthiopianPhone(to);

    // Build query parameters
    const params = new URLSearchParams({
      token: config.apiKey,
      identifier: config.senderName,
      to: formattedPhone,
      message: message,
    });

    // Make API request
    const response = await fetch(`${AFROMESSAGE_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('[AfroMessage] HTTP error', { status: response.status, statusText: response.statusText });
      return {
        success: false,
        error: `HTTP error: ${response.status}`,
      };
    }

    const data: AfroMessageResponse = await response.json();

    if (data.acknowledge === 'success') {
      logger.info('[AfroMessage] SMS sent successfully', { to: formattedPhone });
      return {
        success: true,
        messageId: data.message_id,
      };
    } else {
      logger.error('[AfroMessage] API error', { error: data.error || data.response });
      return {
        success: false,
        error: data.error || data.response || 'Unknown error',
      };
    }
  } catch (error) {
    logger.error('[AfroMessage] Send SMS error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

/**
 * Send SMS via async queue
 *
 * Enqueues the SMS to be sent by a background worker.
 * Falls back to direct sending if queue is not available.
 *
 * @param to - Recipient phone number (Ethiopian format)
 * @param message - SMS message content (max 160 chars for single SMS)
 * @returns SendSMSResult with success status and optional message ID
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
  // Try to use queue if available
  if (isQueueReadySync()) {
    try {
      const jobId = await addJob('sms', 'send-sms', {
        to,
        message,
      } as SMSJobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000, // Start with 3s, then 6s, then 12s (SMS APIs often have stricter rate limits)
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      });

      logger.debug('[SMS] Queued', {
        jobId,
        to,
      });

      return {
        success: true,
        messageId: `queued:${jobId}`,
      };
    } catch (queueError) {
      logger.warn('[SMS] Queue failed, falling back to direct send', { error: queueError });
      // Fall through to direct send
    }
  }

  // Fallback to direct send
  return sendSMSDirect(to, message);
}

/**
 * Send OTP for MFA verification
 *
 * @param to - Recipient phone number
 * @param otp - 6-digit OTP code
 * @returns SendSMSResult
 */
export async function sendMFAOTP(to: string, otp: string): Promise<SendSMSResult> {
  const message = `Your verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
  return sendSMS(to, message);
}

/**
 * Send password reset OTP
 *
 * @param to - Recipient phone number
 * @param otp - 6-digit OTP code
 * @returns SendSMSResult
 */
export async function sendPasswordResetOTP(to: string, otp: string): Promise<SendSMSResult> {
  const message = `Your password reset code is: ${otp}. Valid for 10 minutes. If you didn't request this, ignore this message.`;
  return sendSMS(to, message);
}

/**
 * Send login alert notification
 *
 * @param to - Recipient phone number
 * @param deviceInfo - Device/browser information
 * @returns SendSMSResult
 */
export async function sendLoginAlert(to: string, deviceInfo: string): Promise<SendSMSResult> {
  const message = `New login detected on ${deviceInfo}. If this wasn't you, change your password immediately.`;
  return sendSMS(to, message);
}

/**
 * Check if AfroMessage is configured
 */
export function isAfroMessageConfigured(): boolean {
  return !!process.env.AFROMESSAGE_API_KEY;
}

/**
 * Validate phone number without throwing
 */
export function isValidEthiopianPhone(phone: string): boolean {
  try {
    formatEthiopianPhone(phone);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// SMS QUEUE PROCESSOR
// =============================================================================

/**
 * Process SMS job from queue
 *
 * Called by BullMQ worker to send SMS asynchronously.
 * Includes retry logic: 3 attempts with exponential backoff.
 */
export async function processSmsJob(
  job: { id: string; name: string; data: SMSJobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { to, message } = job.data;

  logger.info('[SMS WORKER] Processing job', {
    jobId: job.id,
    to,
  });

  await updateProgress(10);

  const result = await sendSMSDirect(to, message);

  await updateProgress(90);

  if (!result.success) {
    // Throw error to trigger retry
    throw new Error(result.error || 'Failed to send SMS');
  }

  await updateProgress(100);

  logger.info('[SMS WORKER] Job completed', {
    jobId: job.id,
    messageId: result.messageId,
  });
}

/**
 * Register SMS processor with queue system
 *
 * Call this during application startup to enable SMS queue processing.
 */
export function registerSmsProcessor(): void {
  registerProcessor('sms', 'send-sms', processSmsJob);
  logger.info('[SMS] Processor registered for queue: sms');
}
