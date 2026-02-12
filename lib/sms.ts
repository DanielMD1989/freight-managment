/**
 * SMS Service
 *
 * TD-011 FIX: SMS service integration
 *
 * Provides SMS sending functionality via Twilio.
 *
 * Supported providers:
 * - Twilio (primary)
 * - Console (development/testing - logs SMS instead of sending)
 *
 * Environment variables:
 * - SMS_PROVIDER: 'twilio' | 'console'
 * - TWILIO_ACCOUNT_SID: Twilio account SID
 * - TWILIO_AUTH_TOKEN: Twilio auth token
 * - TWILIO_PHONE_NUMBER: Twilio phone number to send from
 */

import { logger } from './logger';

/**
 * SMS message structure
 */
export interface SmsMessage {
  to: string;
  message: string;
}

/**
 * SMS send result
 */
export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * SMS provider interface
 */
interface SmsProvider {
  send(message: SmsMessage): Promise<SmsResult>;
}

/**
 * Console SMS provider (for development)
 *
 * Logs SMS to console instead of sending them.
 * Useful for development and testing.
 */
class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<SmsResult> {
    console.log('\n========== SMS (Console Mode) ==========');
    console.log('To:', message.to);
    console.log('Message:', message.message);
    console.log('=========================================\n');

    return {
      success: true,
      messageId: `console-sms-${Date.now()}`,
    };
  }
}

/**
 * Twilio SMS provider
 *
 * Enterprise-grade SMS delivery via Twilio.
 *
 * Setup:
 * 1. Sign up at twilio.com
 * 2. Get Account SID, Auth Token, and Phone Number
 * 3. Set environment variables:
 *    - TWILIO_ACCOUNT_SID
 *    - TWILIO_AUTH_TOKEN
 *    - TWILIO_PHONE_NUMBER
 */
class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      // Format phone number (ensure E.164 format for Ethiopia)
      let toNumber = message.to.replace(/\s+/g, '');
      if (toNumber.startsWith('0')) {
        toNumber = '+251' + toNumber.substring(1);
      } else if (!toNumber.startsWith('+')) {
        toNumber = '+' + toNumber;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: toNumber,
          From: this.fromNumber,
          Body: message.message,
        }).toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Twilio API error:', data);
        return {
          success: false,
          error: data.message || `Twilio error: ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error: unknown) {
      console.error('Error sending SMS via Twilio:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS via Twilio',
      };
    }
  }
}

/**
 * Get configured SMS provider
 *
 * @returns SMS provider instance
 */
function getSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER || 'console';

  switch (provider.toLowerCase()) {
    case 'twilio':
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !phoneNumber) {
        console.warn('Twilio credentials not fully configured, falling back to console mode');
        console.warn('Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
        return new ConsoleSmsProvider();
      }

      return new TwilioSmsProvider(accountSid, authToken, phoneNumber);

    case 'console':
    default:
      return new ConsoleSmsProvider();
  }
}

/**
 * Send SMS
 *
 * @param to Recipient phone number
 * @param message SMS message text
 * @returns Send result
 */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const provider = getSmsProvider();

  try {
    const result = await provider.send({ to, message });

    // Log SMS send attempt
    logger.info('[SMS] Sent', {
      to,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });

    return result;
  } catch (error: unknown) {
    logger.error('[SMS ERROR]', error, { to });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

/**
 * Send bulk SMS
 *
 * @param recipients Array of phone numbers
 * @param message SMS message text
 * @returns Array of send results
 */
export async function sendBulkSms(
  recipients: string[],
  message: string
): Promise<{ recipient: string; result: SmsResult }[]> {
  const results = await Promise.all(
    recipients.map(async (to) => ({
      recipient: to,
      result: await sendSms(to, message),
    }))
  );

  const successful = results.filter((r) => r.result.success).length;
  logger.info(`[SMS BULK] Sent ${successful}/${recipients.length} messages`);

  return results;
}

/**
 * Test SMS connection
 *
 * Sends a test SMS to verify service is working.
 *
 * @param toPhone Phone number to send test to
 * @returns Send result
 */
export async function sendTestSms(toPhone: string): Promise<SmsResult> {
  const message = `FreightET Test: SMS service is configured correctly. Provider: ${process.env.SMS_PROVIDER || 'console'}. Timestamp: ${new Date().toISOString()}`;

  return sendSms(toPhone, message);
}
