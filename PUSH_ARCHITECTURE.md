# Push Notifications Architecture

**Date:** 2026-01-23
**Version:** 1.0
**Priority:** HIGH
**Estimated Effort:** 3-5 Sprints

---

## Executive Summary

This document outlines the architecture for implementing push notifications in the Freight Management Platform mobile applications. Currently, mobile users have **no way to receive real-time alerts** when not actively using the app, leading to:

- Missed load booking opportunities
- Delayed pickup confirmations
- Poor user engagement
- Competitive disadvantage

### Target: Full Push Notification Support for iOS (APNs) and Android (FCM)

---

## Current State vs Target State

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│                    Current Notification Flow                 │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Event   │───►│  Queue Job   │───►│  In-App Only     │  │
│  │ Trigger  │    │ (email/sms)  │    │  (must be active)│  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│                                                              │
│                    ❌ No Push Notifications                  │
└─────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Target Notification Flow                           │
│                                                                          │
│  ┌──────────┐    ┌──────────────────────────────────────────────────┐  │
│  │  Event   │    │              Notification Router                  │  │
│  │ Trigger  │───►│                                                   │  │
│  └──────────┘    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────┐ │  │
│                  │  │ In-App  │  │  Email  │  │   SMS   │  │ Push│ │  │
│                  │  │ (WS)    │  │ Queue   │  │ Queue   │  │Queue│ │  │
│                  │  └────┬────┘  └────┬────┘  └────┬────┘  └──┬──┘ │  │
│                  └───────┼────────────┼────────────┼──────────┼────┘  │
│                          │            │            │          │       │
│                          ▼            ▼            ▼          ▼       │
│                  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│                  │ WebSocket │ │ SendGrid │ │ Twilio   │ │ FCM/APNs│ │
│                  └───────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                                │       │
│                                                                ▼       │
│                                               ┌────────────────────┐  │
│                                               │   Mobile Device    │  │
│                                               │   (iOS/Android)    │  │
│                                               └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Push Notification System                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Device Registry                               │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  device_tokens                                                  │ │   │
│  │  │  ┌──────────┬──────────┬──────────┬──────────┬───────────────┐│ │   │
│  │  │  │ user_id  │ platform │  token   │ app_ver  │  last_active  ││ │   │
│  │  │  ├──────────┼──────────┼──────────┼──────────┼───────────────┤│ │   │
│  │  │  │ usr_123  │ ios      │ abc...   │ 1.2.0    │ 2026-01-23    ││ │   │
│  │  │  │ usr_123  │ android  │ def...   │ 1.2.0    │ 2026-01-22    ││ │   │
│  │  │  └──────────┴──────────┴──────────┴──────────┴───────────────┘│ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Push Worker (BullMQ)                          │   │
│  │                                                                      │   │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │   │
│  │  │ Priority: HIGH│    │ Priority: MED │    │ Priority: LOW │       │   │
│  │  │ Load Requests │    │ Trip Updates  │    │ Promotions    │       │   │
│  │  │ Payment Alerts│    │ Status Change │    │ News          │       │   │
│  │  └───────────────┘    └───────────────┘    └───────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                          ┌───────────┴───────────┐                         │
│                          │                       │                         │
│                          ▼                       ▼                         │
│             ┌────────────────────┐  ┌────────────────────┐                │
│             │   FCM Provider     │  │   APNs Provider    │                │
│             │   (Android)        │  │   (iOS)            │                │
│             │                    │  │                    │                │
│             │  Firebase Admin    │  │  @parse/node-apn   │                │
│             │  SDK               │  │  or apn2           │                │
│             └────────────────────┘  └────────────────────┘                │
│                          │                       │                         │
│                          └───────────┬───────────┘                         │
│                                      ▼                                      │
│                         ┌────────────────────────┐                         │
│                         │     Mobile Devices     │                         │
│                         │    (iOS & Android)     │                         │
│                         └────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Notification Types Catalog

### Critical Notifications (Priority: HIGH)

| Type | Trigger | Recipients | Payload |
|------|---------|------------|---------|
| `LOAD_REQUEST_RECEIVED` | Carrier receives load request | Carrier | Load details, shipper info |
| `LOAD_REQUEST_ACCEPTED` | Carrier accepts request | Shipper | Carrier info, pickup time |
| `LOAD_REQUEST_REJECTED` | Carrier rejects request | Shipper | Reason |
| `PAYMENT_RECEIVED` | Payment confirmed | Carrier | Amount, load ref |
| `PAYMENT_DUE` | Payment overdue | Shipper | Amount, days overdue |
| `TRIP_EMERGENCY` | Emergency reported | All stakeholders | Location, type |

### Important Notifications (Priority: MEDIUM)

| Type | Trigger | Recipients | Payload |
|------|---------|------------|---------|
| `TRIP_STARTED` | Driver starts trip | Shipper, Dispatcher | ETA, driver info |
| `TRIP_COMPLETED` | Trip completed | Shipper | POD available |
| `STATUS_UPDATE` | Load status change | Shipper, Carrier | New status, timestamp |
| `DOCUMENT_UPLOADED` | New document | Relevant parties | Document type |
| `DRIVER_ARRIVED` | Driver at location | Shipper | Location, time |
| `GEOFENCE_ENTER` | Truck enters zone | Dispatcher | Zone name, truck |
| `GEOFENCE_EXIT` | Truck exits zone | Dispatcher | Zone name, truck |

### Informational Notifications (Priority: LOW)

| Type | Trigger | Recipients | Payload |
|------|---------|------------|---------|
| `NEW_LOAD_POSTED` | Matching load available | Carriers (subscribed) | Load summary |
| `NEW_TRUCK_POSTED` | Matching truck available | Shippers (subscribed) | Truck summary |
| `RATE_UPDATE` | Market rate change | Subscribed users | Route, rate delta |
| `ACCOUNT_VERIFIED` | Account approved | User | Welcome message |
| `WEEKLY_SUMMARY` | Weekly digest | Active users | Stats summary |

---

## Database Schema

```sql
-- Device tokens table
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Device identification
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    token TEXT NOT NULL,
    device_id VARCHAR(255), -- For deduplication

    -- App info
    app_version VARCHAR(20),
    os_version VARCHAR(20),
    device_model VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Preferences
    notification_preferences JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, platform, device_id)
);

-- Index for fast lookups
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_token ON device_tokens(token);
CREATE INDEX idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = true;

-- Push notification log
CREATE TABLE push_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target
    user_id UUID NOT NULL REFERENCES users(id),
    device_token_id UUID REFERENCES device_tokens(id),

    -- Content
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',

    -- Delivery status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),
    platform VARCHAR(10),
    provider_message_id VARCHAR(255),

    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,

    -- TTL
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Index for analytics
CREATE INDEX idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_type ON push_notifications(notification_type);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_created ON push_notifications(created_at);

-- User notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Channel preferences
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT true,

    -- Type preferences
    preferences JSONB DEFAULT '{
        "LOAD_REQUEST_RECEIVED": {"push": true, "email": true, "sms": false},
        "TRIP_STARTED": {"push": true, "email": false, "sms": false},
        "PAYMENT_RECEIVED": {"push": true, "email": true, "sms": true},
        "NEW_LOAD_POSTED": {"push": false, "email": true, "sms": false}
    }',

    -- Quiet hours
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone VARCHAR(50) DEFAULT 'Africa/Addis_Ababa',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);
```

### Prisma Schema Addition

```prisma
// Add to prisma/schema.prisma

model DeviceToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  platform  String   // 'ios' | 'android'
  token     String
  deviceId  String?

  appVersion   String?
  osVersion    String?
  deviceModel  String?

  isActive     Boolean  @default(true)
  lastActiveAt DateTime @default(now())

  notificationPreferences Json @default("{}")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  pushNotifications PushNotification[]

  @@unique([userId, platform, deviceId])
  @@index([userId])
  @@index([token])
  @@map("device_tokens")
}

model PushNotification {
  id String @id @default(uuid())

  userId        String
  user          User        @relation(fields: [userId], references: [id])
  deviceTokenId String?
  deviceToken   DeviceToken? @relation(fields: [deviceTokenId], references: [id])

  notificationType String
  title            String
  body             String
  data             Json @default("{}")

  status            String @default("pending")
  platform          String?
  providerMessageId String?

  errorCode    String?
  errorMessage String?
  retryCount   Int @default(0)

  createdAt   DateTime  @default(now())
  sentAt      DateTime?
  deliveredAt DateTime?
  clickedAt   DateTime?
  expiresAt   DateTime?

  @@index([userId])
  @@index([notificationType])
  @@index([status])
  @@index([createdAt])
  @@map("push_notifications")
}

model NotificationPreference {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  pushEnabled  Boolean @default(true)
  emailEnabled Boolean @default(true)
  smsEnabled   Boolean @default(true)

  preferences Json @default("{}")

  quietHoursStart    String?
  quietHoursEnd      String?
  quietHoursTimezone String @default("Africa/Addis_Ababa")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("notification_preferences")
}
```

---

## Push Worker Implementation

### lib/push/push-worker.ts

```typescript
// lib/push/push-worker.ts

import { Job, Queue, Worker } from 'bullmq';
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';
import { sendFCMNotification, FCMPayload } from './fcm-provider';
import { sendAPNsNotification, APNsPayload } from './apns-provider';

// =============================================================================
// TYPES
// =============================================================================

export interface PushJobData {
  userId: string;
  notificationType: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  ttlSeconds?: number;
  collapseKey?: string; // For notification grouping
  targetPlatform?: 'ios' | 'android' | 'all';
  notificationId?: string; // For tracking
}

export interface PushResult {
  platform: 'ios' | 'android';
  token: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// QUEUE SETUP
// =============================================================================

const QUEUE_NAME = 'push-notifications';

const pushQueue = new Queue<PushJobData>(QUEUE_NAME, {
  connection: redis!,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // 7 days
    },
  },
});

// Priority queues
const PRIORITY_MAP = {
  high: 1,
  normal: 5,
  low: 10,
};

// =============================================================================
// WORKER
// =============================================================================

async function processPushJob(job: Job<PushJobData>): Promise<PushResult[]> {
  const {
    userId,
    notificationType,
    title,
    body,
    data = {},
    priority = 'normal',
    ttlSeconds = 86400,
    collapseKey,
    targetPlatform = 'all',
    notificationId,
  } = job.data;

  console.log(`[Push Worker] Processing job ${job.id} for user ${userId}`);

  // Get user's device tokens
  const deviceTokens = await db.deviceToken.findMany({
    where: {
      userId,
      isActive: true,
      ...(targetPlatform !== 'all' ? { platform: targetPlatform } : {}),
    },
  });

  if (deviceTokens.length === 0) {
    console.log(`[Push Worker] No active device tokens for user ${userId}`);
    return [];
  }

  // Check notification preferences
  const preferences = await db.notificationPreference.findUnique({
    where: { userId },
  });

  if (preferences && !preferences.pushEnabled) {
    console.log(`[Push Worker] Push notifications disabled for user ${userId}`);
    return [];
  }

  // Check quiet hours
  if (preferences && isQuietHours(preferences)) {
    console.log(`[Push Worker] Quiet hours active for user ${userId}`);
    // Re-queue for after quiet hours
    const delayMs = getQuietHoursEndDelay(preferences);
    await pushQueue.add(job.name, job.data, {
      delay: delayMs,
      priority: PRIORITY_MAP[priority],
    });
    return [];
  }

  // Send to all devices
  const results: PushResult[] = [];

  for (const deviceToken of deviceTokens) {
    try {
      let result: PushResult;

      if (deviceToken.platform === 'ios') {
        result = await sendAPNsNotification({
          token: deviceToken.token,
          title,
          body,
          data: {
            ...data,
            notificationType,
            notificationId: notificationId || job.id!,
          },
          badge: await getUnreadCount(userId),
          sound: priority === 'high' ? 'critical.caf' : 'default',
          category: notificationType,
          threadId: collapseKey,
          expiry: Math.floor(Date.now() / 1000) + ttlSeconds,
          priority: priority === 'high' ? 10 : 5,
        });
      } else {
        result = await sendFCMNotification({
          token: deviceToken.token,
          title,
          body,
          data: {
            ...data,
            notificationType,
            notificationId: notificationId || job.id!,
          },
          collapseKey,
          ttl: ttlSeconds,
          priority: priority === 'high' ? 'high' : 'normal',
        });
      }

      results.push(result);

      // Log result
      await logPushResult(userId, deviceToken.id, notificationType, result);

      // Handle invalid tokens
      if (!result.success && isInvalidTokenError(result.error)) {
        await db.deviceToken.update({
          where: { id: deviceToken.id },
          data: { isActive: false },
        });
        console.log(`[Push Worker] Deactivated invalid token for device ${deviceToken.id}`);
      }
    } catch (error) {
      console.error(`[Push Worker] Error sending to device ${deviceToken.id}:`, error);
      results.push({
        platform: deviceToken.platform as 'ios' | 'android',
        token: deviceToken.token,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

// Create worker
const pushWorker = new Worker<PushJobData, PushResult[]>(
  QUEUE_NAME,
  processPushJob,
  {
    connection: redis!,
    concurrency: 10,
    limiter: {
      max: 100, // Max 100 jobs per second
      duration: 1000,
    },
  }
);

// Worker events
pushWorker.on('completed', (job, result) => {
  console.log(`[Push Worker] Job ${job.id} completed: ${result.length} notifications sent`);
});

pushWorker.on('failed', (job, err) => {
  console.error(`[Push Worker] Job ${job?.id} failed:`, err.message);
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isQuietHours(preferences: {
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
}): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const tz = preferences.quietHoursTimezone;

  // Get current time in user's timezone
  const currentTime = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
  const endMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function getQuietHoursEndDelay(preferences: {
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
}): number {
  if (!preferences.quietHoursEnd) return 0;

  // Calculate delay until quiet hours end
  // Simplified - in production, use proper timezone handling
  const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
  const now = new Date();
  const end = new Date(now);
  end.setHours(endHour, endMinute, 0, 0);

  if (end <= now) {
    end.setDate(end.getDate() + 1);
  }

  return end.getTime() - now.getTime();
}

async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}

async function logPushResult(
  userId: string,
  deviceTokenId: string,
  notificationType: string,
  result: PushResult
): Promise<void> {
  await db.pushNotification.create({
    data: {
      userId,
      deviceTokenId,
      notificationType,
      title: '', // Would need to pass these
      body: '',
      status: result.success ? 'sent' : 'failed',
      platform: result.platform,
      providerMessageId: result.messageId,
      errorCode: result.success ? null : 'DELIVERY_FAILED',
      errorMessage: result.error,
      sentAt: result.success ? new Date() : null,
    },
  });
}

function isInvalidTokenError(error?: string): boolean {
  if (!error) return false;
  const invalidTokenErrors = [
    'NotRegistered',
    'InvalidRegistration',
    'Unregistered',
    'DeviceTokenNotForTopic',
    'BadDeviceToken',
  ];
  return invalidTokenErrors.some((e) => error.includes(e));
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Queue a push notification
 */
export async function queuePushNotification(data: PushJobData): Promise<string> {
  const priority = PRIORITY_MAP[data.priority || 'normal'];

  const job = await pushQueue.add(data.notificationType, data, {
    priority,
    jobId: data.notificationId,
  });

  return job.id!;
}

/**
 * Send immediate push notification (bypasses queue)
 */
export async function sendImmediatePush(data: PushJobData): Promise<PushResult[]> {
  const job = {
    id: `immediate-${Date.now()}`,
    data,
  } as Job<PushJobData>;

  return processPushJob(job);
}

/**
 * Get queue stats
 */
export async function getPushQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    pushQueue.getWaitingCount(),
    pushQueue.getActiveCount(),
    pushQueue.getCompletedCount(),
    pushQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

export { pushQueue, pushWorker };
```

---

## FCM Provider

### lib/push/fcm-provider.ts

```typescript
// lib/push/fcm-provider.ts

import admin from 'firebase-admin';
import { PushResult } from './push-worker';

// =============================================================================
// INITIALIZATION
// =============================================================================

let firebaseApp: admin.app.App | null = null;

function initializeFirebase(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT || '{}'
  );

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  return firebaseApp;
}

// =============================================================================
// TYPES
// =============================================================================

export interface FCMPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  collapseKey?: string;
  ttl?: number;
  priority?: 'high' | 'normal';
  channelId?: string; // Android notification channel
}

// =============================================================================
// SEND NOTIFICATION
// =============================================================================

export async function sendFCMNotification(payload: FCMPayload): Promise<PushResult> {
  const app = initializeFirebase();
  const messaging = app.messaging();

  const {
    token,
    title,
    body,
    data = {},
    imageUrl,
    collapseKey,
    ttl = 86400,
    priority = 'normal',
    channelId = 'default',
  } = payload;

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
      },
      data: {
        ...data,
        // Ensure all values are strings
        title,
        body,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: priority === 'high' ? 'high' : 'normal',
        ttl: ttl * 1000,
        collapseKey,
        notification: {
          channelId,
          priority: priority === 'high' ? 'max' : 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      webpush: {
        headers: {
          TTL: String(ttl),
        },
        notification: {
          title,
          body,
          icon: '/icons/notification-icon.png',
        },
      },
    };

    const response = await messaging.send(message);

    return {
      platform: 'android',
      token,
      success: true,
      messageId: response,
    };
  } catch (error) {
    const fcmError = error as admin.messaging.FirebaseMessagingError;

    return {
      platform: 'android',
      token,
      success: false,
      error: fcmError.code || fcmError.message,
    };
  }
}

/**
 * Send to multiple tokens (batch)
 */
export async function sendFCMBatch(
  tokens: string[],
  payload: Omit<FCMPayload, 'token'>
): Promise<PushResult[]> {
  const app = initializeFirebase();
  const messaging = app.messaging();

  const { title, body, data = {}, ttl = 86400, priority = 'normal' } = payload;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data: {
      ...data,
      title,
      body,
    },
    android: {
      priority: priority === 'high' ? 'high' : 'normal',
      ttl: ttl * 1000,
    },
  };

  const response = await messaging.sendEachForMulticast(message);

  return response.responses.map((res, index) => ({
    platform: 'android' as const,
    token: tokens[index],
    success: res.success,
    messageId: res.messageId,
    error: res.error?.code,
  }));
}
```

---

## APNs Provider

### lib/push/apns-provider.ts

```typescript
// lib/push/apns-provider.ts

import apn from '@parse/node-apn';
import { PushResult } from './push-worker';

// =============================================================================
// INITIALIZATION
// =============================================================================

let apnProvider: apn.Provider | null = null;

function initializeAPNs(): apn.Provider {
  if (apnProvider) return apnProvider;

  const options: apn.ProviderOptions = {
    token: {
      key: process.env.APNS_KEY_PATH || './certs/APNsAuthKey.p8',
      keyId: process.env.APNS_KEY_ID!,
      teamId: process.env.APNS_TEAM_ID!,
    },
    production: process.env.NODE_ENV === 'production',
  };

  apnProvider = new apn.Provider(options);

  return apnProvider;
}

// =============================================================================
// TYPES
// =============================================================================

export interface APNsPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  category?: string;
  threadId?: string;
  expiry?: number;
  priority?: 5 | 10;
  mutableContent?: boolean;
}

// =============================================================================
// SEND NOTIFICATION
// =============================================================================

export async function sendAPNsNotification(payload: APNsPayload): Promise<PushResult> {
  const provider = initializeAPNs();

  const {
    token,
    title,
    body,
    data = {},
    badge,
    sound = 'default',
    category,
    threadId,
    expiry,
    priority = 10,
    mutableContent = false,
  } = payload;

  const notification = new apn.Notification();

  // Required
  notification.alert = {
    title,
    body,
  };
  notification.topic = process.env.APNS_BUNDLE_ID!;

  // Optional
  if (badge !== undefined) notification.badge = badge;
  if (sound) notification.sound = sound;
  if (category) notification.category = category;
  if (threadId) notification.threadId = threadId;
  if (expiry) notification.expiry = expiry;
  notification.priority = priority;
  notification.mutableContent = mutableContent;

  // Custom data
  notification.payload = {
    ...data,
    notificationType: data.notificationType,
  };

  // Content available for background refresh
  notification.contentAvailable = true;

  try {
    const result = await provider.send(notification, token);

    if (result.failed.length > 0) {
      const failure = result.failed[0];
      return {
        platform: 'ios',
        token,
        success: false,
        error: failure.response?.reason || 'Unknown error',
      };
    }

    return {
      platform: 'ios',
      token,
      success: true,
      messageId: result.sent[0]?.device,
    };
  } catch (error) {
    return {
      platform: 'ios',
      token,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send to multiple tokens (batch)
 */
export async function sendAPNsBatch(
  tokens: string[],
  payload: Omit<APNsPayload, 'token'>
): Promise<PushResult[]> {
  const provider = initializeAPNs();

  const notification = new apn.Notification();
  notification.alert = { title: payload.title, body: payload.body };
  notification.topic = process.env.APNS_BUNDLE_ID!;
  notification.payload = payload.data || {};

  if (payload.badge !== undefined) notification.badge = payload.badge;
  if (payload.sound) notification.sound = payload.sound;
  notification.priority = payload.priority || 10;

  const result = await provider.send(notification, tokens);

  const results: PushResult[] = [];

  // Successful
  for (const sent of result.sent) {
    results.push({
      platform: 'ios',
      token: sent.device,
      success: true,
      messageId: sent.device,
    });
  }

  // Failed
  for (const failed of result.failed) {
    results.push({
      platform: 'ios',
      token: failed.device,
      success: false,
      error: failed.response?.reason,
    });
  }

  return results;
}

/**
 * Shutdown provider (for graceful shutdown)
 */
export function shutdownAPNs(): void {
  if (apnProvider) {
    apnProvider.shutdown();
    apnProvider = null;
  }
}
```

---

## API Endpoints

### Device Token Registration

```typescript
// app/api/push/register/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const registerSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().optional(),
  appVersion: z.string().optional(),
  osVersion: z.string().optional(),
  deviceModel: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validation = registerSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.issues },
      { status: 400 }
    );
  }

  const { token, platform, deviceId, appVersion, osVersion, deviceModel } = validation.data;

  // Upsert device token
  const deviceToken = await db.deviceToken.upsert({
    where: {
      userId_platform_deviceId: {
        userId: user.id,
        platform,
        deviceId: deviceId || 'default',
      },
    },
    update: {
      token,
      appVersion,
      osVersion,
      deviceModel,
      isActive: true,
      lastActiveAt: new Date(),
    },
    create: {
      userId: user.id,
      platform,
      token,
      deviceId,
      appVersion,
      osVersion,
      deviceModel,
    },
  });

  return NextResponse.json({
    success: true,
    deviceTokenId: deviceToken.id,
  });
}

// Unregister device
export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');

  if (deviceId) {
    await db.deviceToken.updateMany({
      where: {
        userId: user.id,
        deviceId,
      },
      data: { isActive: false },
    });
  } else {
    // Deactivate all devices for user
    await db.deviceToken.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });
  }

  return NextResponse.json({ success: true });
}
```

---

## Mobile SDK Integration

### React Native (Expo)

```typescript
// mobile/lib/push-notifications.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Get permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PROJECT_ID,
  });

  // Platform-specific configuration
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgent',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'urgent.wav',
    });
  }

  // Register with backend
  await api.post('/push/register', {
    token: token.data,
    platform: Platform.OS,
    deviceId: Device.deviceName,
    appVersion: Device.osVersion,
    osVersion: Device.osVersion,
    deviceModel: Device.modelName,
  });

  return token.data;
}

/**
 * Handle notification received
 */
export function setupNotificationListeners(
  onNotification: (notification: Notifications.Notification) => void,
  onNotificationResponse: (response: Notifications.NotificationResponse) => void
) {
  // Foreground notifications
  const notificationListener = Notifications.addNotificationReceivedListener(
    onNotification
  );

  // Notification taps
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    onNotificationResponse
  );

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}
```

### Flutter

```dart
// lib/services/push_notification_service.dart

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:freight_app/services/api_service.dart';

class PushNotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    // Request permission
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      // Get token
      String? token = await _fcm.getToken();
      if (token != null) {
        await _registerToken(token);
      }

      // Listen for token refresh
      _fcm.onTokenRefresh.listen(_registerToken);

      // Configure local notifications
      await _configureLocalNotifications();

      // Handle messages
      _setupMessageHandlers();
    }
  }

  Future<void> _registerToken(String token) async {
    await ApiService.post('/push/register', {
      'token': token,
      'platform': Platform.isIOS ? 'ios' : 'android',
      'deviceId': await _getDeviceId(),
    });
  }

  Future<void> _configureLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Create Android notification channels
    const urgentChannel = AndroidNotificationChannel(
      'urgent',
      'Urgent Notifications',
      importance: Importance.max,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(urgentChannel);
  }

  void _setupMessageHandlers() {
    // Foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Background messages
    FirebaseMessaging.onBackgroundMessage(_handleBackgroundMessage);

    // Notification tap (app was in background)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    // Show local notification
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title,
      message.notification?.body,
      const NotificationDetails(
        android: AndroidNotificationDetails('default', 'Default'),
        iOS: DarwinNotificationDetails(),
      ),
      payload: message.data['notificationId'],
    );
  }

  void _handleNotificationTap(RemoteMessage message) {
    // Navigate based on notification type
    final type = message.data['notificationType'];
    final id = message.data['entityId'];

    switch (type) {
      case 'LOAD_REQUEST_RECEIVED':
        NavigationService.navigateTo('/loads/$id');
        break;
      case 'TRIP_STARTED':
        NavigationService.navigateTo('/trips/$id');
        break;
      // ... other types
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    // Handle local notification tap
    if (response.payload != null) {
      // Navigate to notification detail
    }
  }
}

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _handleBackgroundMessage(RemoteMessage message) async {
  // Handle background message
  print('Background message: ${message.messageId}');
}
```

---

## Environment Configuration

```bash
# .env.production

# Firebase (Android FCM)
FIREBASE_PROJECT_ID=freight-management-prod
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Apple Push Notifications
APNS_KEY_ID=ABC123DEFG
APNS_TEAM_ID=TEAM123456
APNS_KEY_PATH=./certs/APNsAuthKey.p8
APNS_BUNDLE_ID=com.freight.app

# Push queue settings
PUSH_QUEUE_CONCURRENCY=10
PUSH_QUEUE_RATE_LIMIT=100
```

---

## Timeline

| Sprint | Task | Deliverable |
|--------|------|-------------|
| 1 | Database schema + Device registry API | Device token CRUD |
| 1 | FCM integration | Android notifications |
| 2 | APNs integration | iOS notifications |
| 2 | Push worker + queue | Background processing |
| 3 | Mobile SDK integration | React Native/Flutter code |
| 3 | Notification preferences API | User settings |
| 4 | Testing + monitoring | Analytics dashboard |
| 5 | Advanced features | Rich notifications, actions |

**Total: 3-5 Sprints**

---

## Cost Estimate

| Service | Free Tier | Production Cost |
|---------|-----------|-----------------|
| FCM | Unlimited | $0 |
| APNs | Unlimited | $0 (requires Apple Developer Program - $99/year) |
| Infrastructure | - | ~$20-50/month (worker, queue) |

---

**Report Generated:** 2026-01-23
**Version:** 1.0
**Status:** ARCHITECTURE COMPLETE
