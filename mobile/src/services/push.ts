/**
 * Push Notification Service
 * Ported from Flutter's push_notification_service.dart (330 LOC)
 *
 * Uses expo-notifications for FCM token registration and local notifications.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-constants";
import apiClient, { getErrorMessage } from "../api/client";

// Configure notification handler (foreground display)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushService {
  /** Register for push notifications and send FCM token to server */
  async registerForPush(): Promise<string | null> {
    if (Platform.OS === "web") return null;

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
        projectId: Device.default.expoConfig?.extra?.eas?.projectId,
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
  onNotificationReceived(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /** Add notification response (tap) listener */
  onNotificationResponse(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /** Get badge count */
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  /** Set badge count */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}

export const pushService = new PushService();
