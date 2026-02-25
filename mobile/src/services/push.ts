/**
 * Push Notification Service
 * Ported from Flutter's push_notification_service.dart (330 LOC)
 *
 * Uses expo-notifications for FCM token registration and local notifications.
 */
import { Platform } from "react-native";
import apiClient, { getErrorMessage } from "../api/client";

// expo-notifications only works on iOS/Android — lazy-load to avoid web crashes
let Notifications: typeof import("expo-notifications") | null = null;
let Constants: typeof import("expo-constants").default | null = null;

if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Constants = require("expo-constants").default;

  // Configure notification handler (foreground display)
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

class PushService {
  /** Register for push notifications and send FCM token to server */
  async registerForPush(): Promise<string | null> {
    if (!Notifications || !Constants) return null;

    // Check permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    // Get push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      const token = tokenData.data;

      // Register with server
      await this.registerToken(token);

      return token;
    } catch {
      return null;
    }
  }

  /** Send FCM/Expo push token to server */
  async registerToken(token: string): Promise<void> {
    try {
      await apiClient.post("/api/user/fcm-token", {
        token,
        platform: Platform.OS,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Unregister push token */
  async unregisterToken(): Promise<void> {
    try {
      await apiClient.delete("/api/user/fcm-token");
    } catch {
      // Ignore - best effort
    }
  }

  /** Add notification received listener */
  onNotificationReceived(callback: (notification: unknown) => void) {
    if (!Notifications) return { remove: () => {} };
    return Notifications.addNotificationReceivedListener(callback);
  }

  /** Add notification response (tap) listener */
  onNotificationResponse(callback: (response: unknown) => void) {
    if (!Notifications) return { remove: () => {} };
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /** Get badge count */
  async getBadgeCount(): Promise<number> {
    if (!Notifications) return 0;
    return Notifications.getBadgeCountAsync();
  }

  /** Set badge count */
  async setBadgeCount(count: number): Promise<void> {
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  }
}

export const pushService = new PushService();
