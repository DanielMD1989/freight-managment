/**
 * Security Events Library
 *
 * Sprint 19 - Session Management & Security
 *
 * Provides functions to log security-related events for audit trail
 * and user security activity history.
 */

import { db } from "./db";

// Security Event Types
export const SecurityEventType = {
  // Authentication events
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGOUT: "LOGOUT",

  // Password events
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET: "PASSWORD_RESET",
  PASSWORD_RESET_REQUEST: "PASSWORD_RESET_REQUEST",

  // MFA events
  MFA_ENABLE: "MFA_ENABLE",
  MFA_DISABLE: "MFA_DISABLE",
  MFA_VERIFY_SUCCESS: "MFA_VERIFY_SUCCESS",
  MFA_VERIFY_FAILURE: "MFA_VERIFY_FAILURE",
  RECOVERY_CODE_USED: "RECOVERY_CODE_USED",
  RECOVERY_CODES_REGENERATED: "RECOVERY_CODES_REGENERATED",

  // Session events
  SESSION_REVOKE: "SESSION_REVOKE",
  SESSION_REVOKE_ALL: "SESSION_REVOKE_ALL",

  // Profile events
  PROFILE_UPDATE: "PROFILE_UPDATE",
  EMAIL_CHANGE: "EMAIL_CHANGE",
  PHONE_CHANGE: "PHONE_CHANGE",
} as const;

export type SecurityEventTypeValue =
  (typeof SecurityEventType)[keyof typeof SecurityEventType];

export interface LogSecurityEventParams {
  userId: string;
  eventType: SecurityEventTypeValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Log a security event
 */
export async function logSecurityEvent({
  userId,
  eventType,
  ipAddress,
  userAgent,
  success = true,
  metadata,
}: LogSecurityEventParams): Promise<void> {
  try {
    // Parse device info from user agent
    const deviceInfo = parseDeviceInfo(userAgent);

    await db.securityEvent.create({
      data: {
        userId,
        eventType,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceInfo,
        success,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  } catch (error) {
    // Log but don't throw - security logging shouldn't break the main flow
    console.error("Failed to log security event:", error);
  }
}

/**
 * Get recent security events for a user
 */
export async function getUserSecurityEvents(
  userId: string,
  options?: {
    limit?: number;
    eventTypes?: SecurityEventTypeValue[];
  }
) {
  const { limit = 50, eventTypes } = options || {};

  return db.securityEvent.findMany({
    where: {
      userId,
      ...(eventTypes &&
        eventTypes.length > 0 && { eventType: { in: eventTypes } }),
    },
    select: {
      id: true,
      eventType: true,
      ipAddress: true,
      deviceInfo: true,
      success: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get security event counts by type for a user
 */
export async function getSecurityEventStats(userId: string) {
  const events = await db.securityEvent.groupBy({
    by: ["eventType"],
    where: { userId },
    _count: { eventType: true },
  });

  return events.reduce(
    (acc, event) => {
      acc[event.eventType] = event._count.eventType;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Check for suspicious activity patterns
 * Returns true if suspicious activity detected
 */
export async function checkSuspiciousActivity(
  userId: string
): Promise<{ suspicious: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // Check for failed login attempts in last hour
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const failedLogins = await db.securityEvent.count({
    where: {
      userId,
      eventType: SecurityEventType.LOGIN_FAILURE,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (failedLogins >= 5) {
    reasons.push(`${failedLogins} failed login attempts in the last hour`);
  }

  // Check for multiple password reset requests
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const passwordResets = await db.securityEvent.count({
    where: {
      userId,
      eventType: SecurityEventType.PASSWORD_RESET_REQUEST,
      createdAt: { gte: oneDayAgo },
    },
  });

  if (passwordResets >= 3) {
    reasons.push(
      `${passwordResets} password reset requests in the last 24 hours`
    );
  }

  // Check for session revocations
  const sessionRevokes = await db.securityEvent.count({
    where: {
      userId,
      eventType: {
        in: [
          SecurityEventType.SESSION_REVOKE,
          SecurityEventType.SESSION_REVOKE_ALL,
        ],
      },
      createdAt: { gte: oneDayAgo },
    },
  });

  if (sessionRevokes >= 5) {
    reasons.push(`${sessionRevokes} session revocations in the last 24 hours`);
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Parse user agent to extract device info
 */
function parseDeviceInfo(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";

  let browser = "Unknown browser";
  let os = "Unknown OS";

  // Detect browser
  if (userAgent.includes("Firefox/")) browser = "Firefox";
  else if (userAgent.includes("Edg/")) browser = "Edge";
  else if (userAgent.includes("Chrome/")) browser = "Chrome";
  else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome"))
    browser = "Safari";
  else if (userAgent.includes("Opera") || userAgent.includes("OPR/"))
    browser = "Opera";

  // Detect OS
  if (
    userAgent.includes("Windows NT 10") ||
    userAgent.includes("Windows NT 11")
  )
    os = "Windows";
  else if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS X")) os = "macOS";
  else if (userAgent.includes("Linux") && !userAgent.includes("Android"))
    os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone")) os = "iPhone";
  else if (userAgent.includes("iPad")) os = "iPad";

  return `${browser} on ${os}`;
}

/**
 * Format security event for display
 */
export function formatSecurityEvent(event: {
  eventType: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  success: boolean;
}): string {
  const eventDescriptions: Record<string, string> = {
    [SecurityEventType.LOGIN_SUCCESS]: "Successful login",
    [SecurityEventType.LOGIN_FAILURE]: "Failed login attempt",
    [SecurityEventType.LOGOUT]: "Logged out",
    [SecurityEventType.PASSWORD_CHANGE]: "Password changed",
    [SecurityEventType.PASSWORD_RESET]: "Password reset completed",
    [SecurityEventType.PASSWORD_RESET_REQUEST]: "Password reset requested",
    [SecurityEventType.MFA_ENABLE]: "Two-factor authentication enabled",
    [SecurityEventType.MFA_DISABLE]: "Two-factor authentication disabled",
    [SecurityEventType.MFA_VERIFY_SUCCESS]:
      "Two-factor verification successful",
    [SecurityEventType.MFA_VERIFY_FAILURE]: "Two-factor verification failed",
    [SecurityEventType.RECOVERY_CODE_USED]: "Recovery code used for login",
    [SecurityEventType.RECOVERY_CODES_REGENERATED]:
      "Recovery codes regenerated",
    [SecurityEventType.SESSION_REVOKE]: "Session revoked",
    [SecurityEventType.SESSION_REVOKE_ALL]: "All sessions revoked",
    [SecurityEventType.PROFILE_UPDATE]: "Profile updated",
    [SecurityEventType.EMAIL_CHANGE]: "Email address changed",
    [SecurityEventType.PHONE_CHANGE]: "Phone number changed",
  };

  return eventDescriptions[event.eventType] || event.eventType;
}

/**
 * Clean up old security events (run periodically)
 * Keeps events for 90 days
 */
export async function cleanupOldSecurityEvents(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const result = await db.securityEvent.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}
