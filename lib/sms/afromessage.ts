/**
 * AfroMessage SMS Service
 *
 * Sprint 19 - MFA Implementation
 *
 * Integration with AfroMessage (https://afromessage.com) - Ethiopia's
 * enterprise-grade SMS service provider.
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
 * Send SMS via AfroMessage API
 *
 * @param to - Recipient phone number (Ethiopian format)
 * @param message - SMS message content (max 160 chars for single SMS)
 * @returns SendSMSResult with success status and optional message ID
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
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
      console.error('[AfroMessage] HTTP error:', response.status, response.statusText);
      return {
        success: false,
        error: `HTTP error: ${response.status}`,
      };
    }

    const data: AfroMessageResponse = await response.json();

    if (data.acknowledge === 'success') {
      console.log('[AfroMessage] SMS sent successfully to:', formattedPhone);
      return {
        success: true,
        messageId: data.message_id,
      };
    } else {
      console.error('[AfroMessage] API error:', data.error || data.response);
      return {
        success: false,
        error: data.error || data.response || 'Unknown error',
      };
    }
  } catch (error) {
    console.error('[AfroMessage] Send SMS error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
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
