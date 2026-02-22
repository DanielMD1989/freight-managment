/**
 * Server-Side Push Notification Service
 *
 * Uses Firebase Admin SDK to send push notifications to mobile devices.
 * Device tokens are stored in the DeviceToken model.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Lazy-init Firebase Admin to avoid import errors when env vars are missing
let firebaseAdmin: typeof import("firebase-admin") | null = null;
let messagingInstance: import("firebase-admin/messaging").Messaging | null =
  null;

function getMessaging(): import("firebase-admin/messaging").Messaging | null {
  if (messagingInstance) return messagingInstance;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    logger.debug(
      "Firebase push notifications disabled — missing FIREBASE_* env vars"
    );
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    firebaseAdmin = require("firebase-admin");
    if (!firebaseAdmin) return null;

    const apps = firebaseAdmin.apps;
    if (!apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    }

    messagingInstance = firebaseAdmin.messaging();
    return messagingInstance;
  } catch (error) {
    logger.error("Failed to initialize Firebase Admin", error);
    return null;
  }
}

/**
 * Send a push notification to a specific user's devices
 */
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ sent: number; failed: number }> {
  const { userId, title, body, data } = params;

  const messaging = getMessaging();
  if (!messaging) {
    return { sent: 0, failed: 0 };
  }

  // Get all active device tokens for this user
  const deviceTokens = await db.deviceToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });

  if (deviceTokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const staleTokenIds: string[] = [];

  // Send to each device
  await Promise.all(
    deviceTokens.map(async (device) => {
      try {
        await messaging.send({
          token: device.token,
          notification: { title, body },
          data,
          android: {
            priority: "high",
            notification: { channelId: "default" },
          },
          apns: {
            payload: {
              aps: { sound: "default", badge: 1 },
            },
          },
        });
        sent++;
      } catch (error: unknown) {
        failed++;
        // Remove stale tokens (unregistered / invalid)
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code: string }).code
            : "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          staleTokenIds.push(device.id);
        } else {
          logger.warn("Push notification failed", {
            userId,
            tokenId: device.id,
            error: String(error),
          });
        }
      }
    })
  );

  // Clean up stale tokens
  if (staleTokenIds.length > 0) {
    await db.deviceToken
      .deleteMany({
        where: { id: { in: staleTokenIds } },
      })
      .catch((err) => logger.error("Failed to clean stale tokens", err));
  }

  return { sent, failed };
}

/**
 * Send a push notification to multiple users
 */
export async function sendPushToUsers(params: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ sent: number; failed: number }> {
  const { userIds, title, body, data } = params;

  const results = await Promise.all(
    userIds.map((userId) => sendPushNotification({ userId, title, body, data }))
  );

  return results.reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      failed: acc.failed + r.failed,
    }),
    { sent: 0, failed: 0 }
  );
}
