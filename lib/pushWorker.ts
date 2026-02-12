/**
 * Push Notification Worker
 *
 * PHASE 3: Push Notifications - FCM (Android) and APNs (iOS)
 *
 * Features:
 * - Firebase Cloud Messaging (FCM) for Android
 * - Apple Push Notification Service (APNs) for iOS
 * - Device token registry
 * - Notification templating
 * - Retry with exponential backoff
 * - Batch sending for efficiency
 * - Dead token cleanup
 *
 * Environment Variables:
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - FIREBASE_PRIVATE_KEY: Firebase service account private key
 * - FIREBASE_CLIENT_EMAIL: Firebase service account email
 * - APNS_KEY_ID: APNs key ID
 * - APNS_TEAM_ID: Apple team ID
 * - APNS_KEY_FILE: Path to APNs .p8 key file
 * - APNS_BUNDLE_ID: iOS app bundle ID
 */

import { registerProcessor, addJob } from './queue';
import { db } from './db';
import { logger } from './logger';

// =============================================================================
// TYPES
// =============================================================================

export type PushPlatform = 'ios' | 'android';

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: PushPlatform;
  appVersion: string;
  lastActive: Date;
  createdAt: Date;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  category?: string;
  threadId?: string;
  collapseKey?: string;
  priority?: 'high' | 'normal';
  ttl?: number; // Time to live in seconds
}

export interface PushJobData {
  userId?: string;
  userIds?: string[];
  tokens?: string[];
  platform?: PushPlatform;
  payload: PushNotificationPayload;
  notificationType: PushNotificationType;
  [key: string]: unknown; // Index signature for JobData compatibility
}

export type PushNotificationType =
  | 'load_request'
  | 'load_assigned'
  | 'load_status_change'
  | 'trip_started'
  | 'trip_completed'
  | 'payment_received'
  | 'payment_pending'
  | 'bid_received'
  | 'bid_accepted'
  | 'bid_rejected'
  | 'document_required'
  | 'document_approved'
  | 'document_rejected'
  | 'chat_message'
  | 'system_alert'
  | 'promotional';

// =============================================================================
// NOTIFICATION PAYLOAD CATALOG
// =============================================================================

/**
 * Pre-defined notification templates for different notification types
 */
export const NOTIFICATION_TEMPLATES: Record<
  PushNotificationType,
  {
    title: string;
    body: string;
    priority: 'high' | 'normal';
    sound: string;
    category?: string;
  }
> = {
  load_request: {
    title: 'New Load Request',
    body: 'You have a new load request from {{shipperName}}',
    priority: 'high',
    sound: 'default',
    category: 'LOAD_ACTION',
  },
  load_assigned: {
    title: 'Load Assigned',
    body: 'Load #{{loadId}} has been assigned to you',
    priority: 'high',
    sound: 'default',
    category: 'LOAD_ACTION',
  },
  load_status_change: {
    title: 'Load Status Update',
    body: 'Load #{{loadId}} status changed to {{status}}',
    priority: 'normal',
    sound: 'default',
  },
  trip_started: {
    title: 'Trip Started',
    body: 'Trip for load #{{loadId}} has started',
    priority: 'high',
    sound: 'default',
  },
  trip_completed: {
    title: 'Trip Completed',
    body: 'Trip for load #{{loadId}} has been completed',
    priority: 'high',
    sound: 'default',
  },
  payment_received: {
    title: 'Payment Received',
    body: 'You received a payment of {{amount}}',
    priority: 'high',
    sound: 'payment.wav',
    category: 'PAYMENT',
  },
  payment_pending: {
    title: 'Payment Pending',
    body: 'Payment of {{amount}} is being processed',
    priority: 'normal',
    sound: 'default',
  },
  bid_received: {
    title: 'New Bid Received',
    body: '{{carrierName}} placed a bid of {{amount}} on your load',
    priority: 'high',
    sound: 'default',
    category: 'BID_ACTION',
  },
  bid_accepted: {
    title: 'Bid Accepted',
    body: 'Your bid on load #{{loadId}} has been accepted',
    priority: 'high',
    sound: 'success.wav',
  },
  bid_rejected: {
    title: 'Bid Rejected',
    body: 'Your bid on load #{{loadId}} was not accepted',
    priority: 'normal',
    sound: 'default',
  },
  document_required: {
    title: 'Document Required',
    body: 'Please upload your {{documentType}}',
    priority: 'normal',
    sound: 'default',
    category: 'DOCUMENT_ACTION',
  },
  document_approved: {
    title: 'Document Approved',
    body: 'Your {{documentType}} has been approved',
    priority: 'normal',
    sound: 'success.wav',
  },
  document_rejected: {
    title: 'Document Rejected',
    body: 'Your {{documentType}} was rejected: {{reason}}',
    priority: 'high',
    sound: 'default',
    category: 'DOCUMENT_ACTION',
  },
  chat_message: {
    title: '{{senderName}}',
    body: '{{message}}',
    priority: 'high',
    sound: 'message.wav',
    category: 'CHAT',
  },
  system_alert: {
    title: 'System Alert',
    body: '{{message}}',
    priority: 'high',
    sound: 'alert.wav',
  },
  promotional: {
    title: '{{title}}',
    body: '{{body}}',
    priority: 'normal',
    sound: 'default',
  },
};

// =============================================================================
// CONFIGURATION
// =============================================================================

interface PushConfig {
  fcmEnabled: boolean;
  apnsEnabled: boolean;
  firebase: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  } | null;
  apns: {
    keyId: string;
    teamId: string;
    keyFile: string;
    bundleId: string;
    production: boolean;
  } | null;
}

function getConfig(): PushConfig {
  const fcmEnabled = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  );

  const apnsEnabled = !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_KEY_FILE &&
    process.env.APNS_BUNDLE_ID
  );

  return {
    fcmEnabled,
    apnsEnabled,
    firebase: fcmEnabled
      ? {
          projectId: process.env.FIREBASE_PROJECT_ID!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        }
      : null,
    apns: apnsEnabled
      ? {
          keyId: process.env.APNS_KEY_ID!,
          teamId: process.env.APNS_TEAM_ID!,
          keyFile: process.env.APNS_KEY_FILE!,
          bundleId: process.env.APNS_BUNDLE_ID!,
          production: process.env.NODE_ENV === 'production',
        }
      : null,
  };
}

// =============================================================================
// FIREBASE CLOUD MESSAGING (FCM)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseApp: any = null;

async function initializeFirebase(): Promise<boolean> {
  const config = getConfig();

  if (!config.fcmEnabled || !config.firebase) {
    logger.warn('[Push] Firebase not configured');
    return false;
  }

  if (firebaseApp) {
    return true;
  }

  try {
    // Dynamic import to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dynamicRequire = (moduleName: string): any => {
      return eval('require')(moduleName);
    };

    const admin = dynamicRequire('firebase-admin');

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });

    logger.info('[Push] Firebase Admin SDK initialized');
    return true;
  } catch (error) {
    logger.error('[Push] Failed to initialize Firebase', error);
    return false;
  }
}

/**
 * Send push notification via FCM (Android)
 */
async function sendFCM(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}> {
  if (!firebaseApp) {
    const initialized = await initializeFirebase();
    if (!initialized) {
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dynamicRequire = (moduleName: string): any => {
    return eval('require')(moduleName);
  };

  const admin = dynamicRequire('firebase-admin');
  const messaging = admin.messaging();

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
    },
    data: payload.data || {},
    android: {
      priority: payload.priority === 'high' ? 'high' : 'normal',
      ttl: (payload.ttl || 86400) * 1000, // Convert to milliseconds
      notification: {
        sound: payload.sound || 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        channelId: 'freight_notifications',
      },
      collapseKey: payload.collapseKey,
    },
    tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);

    const invalidTokens: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        // Mark tokens as invalid for certain error codes
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    logger.info('[Push FCM] Sent', {
      success: response.successCount,
      failure: response.failureCount,
      invalidTokens: invalidTokens.length,
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (error) {
    logger.error('[Push FCM] Error', error);
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }
}

// =============================================================================
// APPLE PUSH NOTIFICATION SERVICE (APNs)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let apnsProvider: any = null;

async function initializeAPNs(): Promise<boolean> {
  const config = getConfig();

  if (!config.apnsEnabled || !config.apns) {
    logger.warn('[Push] APNs not configured');
    return false;
  }

  if (apnsProvider) {
    return true;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dynamicRequire = (moduleName: string): any => {
      return eval('require')(moduleName);
    };

    const apn = dynamicRequire('apn');

    apnsProvider = new apn.Provider({
      token: {
        key: config.apns.keyFile,
        keyId: config.apns.keyId,
        teamId: config.apns.teamId,
      },
      production: config.apns.production,
    });

    logger.info('[Push] APNs provider initialized', {
      production: config.apns.production,
    });
    return true;
  } catch (error) {
    logger.error('[Push] Failed to initialize APNs', error);
    return false;
  }
}

/**
 * Send push notification via APNs (iOS)
 */
async function sendAPNs(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}> {
  if (!apnsProvider) {
    const initialized = await initializeAPNs();
    if (!initialized) {
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }

  const config = getConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dynamicRequire = (moduleName: string): any => {
    return eval('require')(moduleName);
  };

  const apn = dynamicRequire('apn');

  const notification = new apn.Notification();
  notification.alert = {
    title: payload.title,
    body: payload.body,
  };
  notification.topic = config.apns?.bundleId;
  notification.sound = payload.sound || 'default';
  notification.badge = payload.badge;
  notification.category = payload.category;
  notification.threadId = payload.threadId;
  notification.payload = payload.data || {};
  notification.expiry = Math.floor(Date.now() / 1000) + (payload.ttl || 86400);
  notification.priority = payload.priority === 'high' ? 10 : 5;
  notification.collapseId = payload.collapseKey;

  if (payload.imageUrl) {
    notification.mutableContent = true;
    notification.payload.imageUrl = payload.imageUrl;
  }

  try {
    const response = await apnsProvider.send(notification, tokens);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidTokens = response.failed
      .filter(
        (f: { response?: { reason?: string }; device: string }) =>
          f.response?.reason === 'BadDeviceToken' ||
          f.response?.reason === 'Unregistered'
      )
      .map((f: { device: string }) => f.device);

    logger.info('[Push APNs] Sent', {
      success: response.sent.length,
      failure: response.failed.length,
      invalidTokens: invalidTokens.length,
    });

    return {
      successCount: response.sent.length,
      failureCount: response.failed.length,
      invalidTokens,
    };
  } catch (error) {
    logger.error('[Push APNs] Error', error);
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }
}

// =============================================================================
// DEVICE TOKEN MANAGEMENT
// =============================================================================

/**
 * Register a device token for push notifications
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: PushPlatform,
  appVersion: string
): Promise<DeviceToken> {
  // Upsert device token
  const existing = await db.deviceToken.findFirst({
    where: { userId, token },
  });

  if (existing) {
    // Update existing token
    const updated = await db.deviceToken.update({
      where: { id: existing.id },
      data: {
        platform,
        appVersion,
        lastActive: new Date(),
      },
    });

    logger.debug('[Push] Device token updated', { userId, platform });
    return updated as DeviceToken;
  }

  // Create new token
  const created = await db.deviceToken.create({
    data: {
      userId,
      token,
      platform,
      appVersion,
      lastActive: new Date(),
    },
  });

  logger.info('[Push] Device token registered', { userId, platform });
  return created as DeviceToken;
}

/**
 * Unregister a device token
 */
export async function unregisterDeviceToken(
  userId: string,
  token: string
): Promise<boolean> {
  try {
    await db.deviceToken.deleteMany({
      where: { userId, token },
    });
    logger.info('[Push] Device token unregistered', { userId });
    return true;
  } catch (error) {
    logger.error('[Push] Failed to unregister device token', error);
    return false;
  }
}

/**
 * Get device tokens for a user
 */
export async function getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
  const tokens = await db.deviceToken.findMany({
    where: { userId },
    orderBy: { lastActive: 'desc' },
  });
  return tokens as DeviceToken[];
}

/**
 * Remove invalid/expired tokens
 */
export async function removeInvalidTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;

  const result = await db.deviceToken.deleteMany({
    where: { token: { in: tokens } },
  });

  logger.info('[Push] Removed invalid tokens', { count: result.count });
  return result.count;
}

/**
 * Cleanup inactive device tokens (older than 30 days)
 */
export async function cleanupInactiveTokens(daysInactive: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  const result = await db.deviceToken.deleteMany({
    where: {
      lastActive: { lt: cutoffDate },
    },
  });

  logger.info('[Push] Cleaned up inactive tokens', {
    count: result.count,
    daysInactive,
  });
  return result.count;
}

// =============================================================================
// PUSH NOTIFICATION SENDING
// =============================================================================

/**
 * Send push notification to a user
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload,
  notificationType: PushNotificationType
): Promise<{ sent: number; failed: number }> {
  const tokens = await getUserDeviceTokens(userId);

  if (tokens.length === 0) {
    logger.debug('[Push] No device tokens for user', { userId });
    return { sent: 0, failed: 0 };
  }

  // Separate by platform
  const androidTokens = tokens.filter((t) => t.platform === 'android').map((t) => t.token);
  const iosTokens = tokens.filter((t) => t.platform === 'ios').map((t) => t.token);

  let totalSent = 0;
  let totalFailed = 0;
  const invalidTokens: string[] = [];

  // Send to Android devices
  if (androidTokens.length > 0) {
    const fcmResult = await sendFCM(androidTokens, payload);
    totalSent += fcmResult.successCount;
    totalFailed += fcmResult.failureCount;
    invalidTokens.push(...fcmResult.invalidTokens);
  }

  // Send to iOS devices
  if (iosTokens.length > 0) {
    const apnsResult = await sendAPNs(iosTokens, payload);
    totalSent += apnsResult.successCount;
    totalFailed += apnsResult.failureCount;
    invalidTokens.push(...apnsResult.invalidTokens);
  }

  // Remove invalid tokens
  if (invalidTokens.length > 0) {
    await removeInvalidTokens(invalidTokens);
  }

  // Log notification sent
  await db.notification.create({
    data: {
      userId,
      type: notificationType,
      title: payload.title,
      message: payload.body,
      metadata: payload.data as any,
      read: false,
    },
  });

  return { sent: totalSent, failed: totalFailed };
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload,
  notificationType: PushNotificationType
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((userId) => sendPushToUser(userId, payload, notificationType))
    );

    for (const result of results) {
      totalSent += result.sent;
      totalFailed += result.failed;
    }
  }

  return { sent: totalSent, failed: totalFailed };
}

// =============================================================================
// QUEUE PROCESSOR
// =============================================================================

/**
 * Process push notification job
 */
async function processPushJob(
  job: { id: string; name: string; data: PushJobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { userId, userIds, tokens, platform, payload, notificationType } = job.data;

  logger.info('[Push Worker] Processing job', {
    jobId: job.id,
    jobName: job.name,
    notificationType,
    hasUserId: !!userId,
    userIdsCount: userIds?.length,
    tokensCount: tokens?.length,
  });

  await updateProgress(10);

  try {
    if (userId) {
      // Single user
      await sendPushToUser(userId, payload, notificationType);
    } else if (userIds && userIds.length > 0) {
      // Multiple users
      await sendPushToUsers(userIds, payload, notificationType);
    } else if (tokens && tokens.length > 0) {
      // Direct tokens (for testing or specific targeting)
      if (platform === 'android') {
        await sendFCM(tokens, payload);
      } else if (platform === 'ios') {
        await sendAPNs(tokens, payload);
      }
    }

    await updateProgress(100);
    logger.info('[Push Worker] Job completed', { jobId: job.id });
  } catch (error) {
    logger.error('[Push Worker] Job failed', error, { jobId: job.id });
    throw error;
  }
}

/**
 * Register push notification processor with queue system
 */
export function registerPushProcessor(): void {
  registerProcessor('notifications', 'push', processPushJob);
  registerProcessor('notifications', 'push-batch', processPushJob);
  registerProcessor('notifications', 'push-broadcast', processPushJob);

  logger.info('[Push Worker] Processors registered');
}

// =============================================================================
// PUBLIC API - QUEUE WRAPPERS
// =============================================================================

/**
 * Queue a push notification for a single user
 */
export async function queuePushNotification(
  userId: string,
  notificationType: PushNotificationType,
  templateData: Record<string, string> = {}
): Promise<string> {
  const template = NOTIFICATION_TEMPLATES[notificationType];

  // Replace template variables
  let title = template.title;
  let body = template.body;

  for (const [key, value] of Object.entries(templateData)) {
    title = title.replace(`{{${key}}}`, value);
    body = body.replace(`{{${key}}}`, value);
  }

  const payload: PushNotificationPayload = {
    title,
    body,
    priority: template.priority,
    sound: template.sound,
    category: template.category,
    data: {
      type: notificationType,
      ...templateData,
    },
  };

  return addJob('notifications', 'push', {
    userId,
    payload,
    notificationType,
  });
}

/**
 * Queue a push notification for multiple users
 */
export async function queuePushNotificationBatch(
  userIds: string[],
  notificationType: PushNotificationType,
  templateData: Record<string, string> = {}
): Promise<string> {
  const template = NOTIFICATION_TEMPLATES[notificationType];

  let title = template.title;
  let body = template.body;

  for (const [key, value] of Object.entries(templateData)) {
    title = title.replace(`{{${key}}}`, value);
    body = body.replace(`{{${key}}}`, value);
  }

  const payload: PushNotificationPayload = {
    title,
    body,
    priority: template.priority,
    sound: template.sound,
    category: template.category,
    data: {
      type: notificationType,
      ...templateData,
    },
  };

  return addJob('notifications', 'push-batch', {
    userIds,
    payload,
    notificationType,
  });
}

/**
 * Queue a custom push notification
 */
export async function queueCustomPushNotification(
  userId: string,
  payload: PushNotificationPayload,
  notificationType: PushNotificationType = 'system_alert'
): Promise<string> {
  return addJob('notifications', 'push', {
    userId,
    payload,
    notificationType,
  });
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export interface PushHealthStatus {
  fcmConfigured: boolean;
  fcmInitialized: boolean;
  apnsConfigured: boolean;
  apnsInitialized: boolean;
  deviceTokenCount: number;
}

/**
 * Get push notification system health status
 */
export async function getPushHealthStatus(): Promise<PushHealthStatus> {
  const config = getConfig();
  const tokenCount = await db.deviceToken.count();

  return {
    fcmConfigured: config.fcmEnabled,
    fcmInitialized: !!firebaseApp,
    apnsConfigured: config.apnsEnabled,
    apnsInitialized: !!apnsProvider,
    deviceTokenCount: tokenCount,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Registration
  registerDeviceToken,
  unregisterDeviceToken,
  getUserDeviceTokens,
  removeInvalidTokens,
  cleanupInactiveTokens,

  // Sending
  sendPushToUser,
  sendPushToUsers,

  // Queue wrappers
  queuePushNotification,
  queuePushNotificationBatch,
  queueCustomPushNotification,

  // Worker
  registerPushProcessor,

  // Health
  getPushHealthStatus,

  // Templates
  NOTIFICATION_TEMPLATES,
};
