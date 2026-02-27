/**
 * Notification Preferences Unit Tests
 *
 * Tests for user notification preference enforcement
 * Covers all permutations of preference settings
 */

import { db } from "@/lib/db";
import {
  createNotification,
  isNotificationEnabled,
  NotificationType,
} from "@/lib/notifications";

// Mock the database and WebSocket
jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/websocket-server", () => ({
  sendRealtimeNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockDb = db as jest.Mocked<typeof db>;

describe("Notification Preferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isNotificationEnabled", () => {
    const userId = "user-123";

    it("should return true when user has no preferences set", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: null,
      });

      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true);
    });

    it("should return true when user not found (default behavior)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue(null);

      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true);
    });

    it("should return true when notification type is not in preferences (default enabled)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: true,
          // LOAD_REQUEST not specified - should default to enabled
        },
      });

      const enabled = await isNotificationEnabled(userId, "LOAD_REQUEST");
      expect(enabled).toBe(true);
    });

    it("should return true when notification type is explicitly enabled", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: true,
        },
      });

      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true);
    });

    it("should return false when notification type is explicitly disabled", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: false,
        },
      });

      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(false);
    });

    it("should handle database errors gracefully (default to enabled)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true);
    });
  });

  describe("createNotification", () => {
    const userId = "user-123";
    const notificationParams = {
      userId,
      type: "GPS_OFFLINE",
      title: "GPS Signal Lost",
      message: "Truck ABC-123 has lost GPS signal",
    };

    it("should create notification when type is enabled", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: true,
        },
      });

      (mockDb.notification.create as jest.Mock).mockResolvedValue({
        id: "notif-123",
        userId,
        type: "GPS_OFFLINE",
        title: "GPS Signal Lost",
        message: "Truck ABC-123 has lost GPS signal",
        read: false,
        createdAt: new Date(),
      });

      const result = await createNotification(notificationParams);

      expect(result).toBeDefined();
      expect(result?.id).toBe("notif-123");
      expect(result?.skipped).toBeUndefined();
      expect(mockDb.notification.create).toHaveBeenCalledTimes(1);
    });

    it("should skip notification when type is disabled", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: false,
        },
      });

      const result = await createNotification(notificationParams);

      expect(result).toBeDefined();
      expect(result?.skipped).toBe(true);
      expect(result?.id).toBe("");
      expect(mockDb.notification.create).not.toHaveBeenCalled();
    });

    it("should create notification when preferences are not set (default enabled)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: null,
      });

      (mockDb.notification.create as jest.Mock).mockResolvedValue({
        id: "notif-456",
        userId,
        type: "GPS_OFFLINE",
        title: "GPS Signal Lost",
        message: "Truck ABC-123 has lost GPS signal",
        read: false,
        createdAt: new Date(),
      });

      const result = await createNotification(notificationParams);

      expect(result?.id).toBe("notif-456");
      expect(result?.skipped).toBeUndefined();
      expect(mockDb.notification.create).toHaveBeenCalledTimes(1);
    });

    it("should skip preference check when skipPreferenceCheck is true", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: false, // Disabled, but should be bypassed
        },
      });

      (mockDb.notification.create as jest.Mock).mockResolvedValue({
        id: "notif-critical",
        userId,
        type: "GPS_OFFLINE",
        title: "Critical Alert",
        message: "System critical notification",
        read: false,
        createdAt: new Date(),
      });

      const result = await createNotification({
        ...notificationParams,
        skipPreferenceCheck: true,
      });

      expect(result?.id).toBe("notif-critical");
      expect(result?.skipped).toBeUndefined();
      expect(mockDb.notification.create).toHaveBeenCalledTimes(1);
    });

    it("should handle database creation errors gracefully", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: { GPS_OFFLINE: true },
      });

      (mockDb.notification.create as jest.Mock).mockRejectedValue(
        new Error("Insert failed")
      );

      const result = await createNotification(notificationParams);

      expect(result).toBeNull();
    });
  });

  describe("Preference Permutations", () => {
    const userId = "user-permutation-test";
    const notificationTypes = [
      "GPS_OFFLINE",
      "LOAD_REQUEST",
      "TRUCK_REQUEST",
      "POD_SUBMITTED",
      "EXCEPTION_CREATED",
    ];

    it("should correctly handle all enabled preferences", async () => {
      const allEnabled = notificationTypes.reduce(
        (acc, type) => ({ ...acc, [type]: true }),
        {}
      );

      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: allEnabled,
      });

      (mockDb.notification.create as jest.Mock).mockResolvedValue({
        id: "notif-test",
        userId,
        type: "GPS_OFFLINE",
        title: "Test",
        message: "Test",
        read: false,
        createdAt: new Date(),
      });

      for (const type of notificationTypes) {
        const enabled = await isNotificationEnabled(userId, type);
        expect(enabled).toBe(true);
      }
    });

    it("should correctly handle all disabled preferences", async () => {
      const allDisabled = notificationTypes.reduce(
        (acc, type) => ({ ...acc, [type]: false }),
        {}
      );

      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: allDisabled,
      });

      for (const type of notificationTypes) {
        const enabled = await isNotificationEnabled(userId, type);
        expect(enabled).toBe(false);
      }
    });

    it("should correctly handle mixed preferences", async () => {
      const mixedPreferences = {
        GPS_OFFLINE: true,
        LOAD_REQUEST: false,
        TRUCK_REQUEST: true,
        POD_SUBMITTED: false,
        EXCEPTION_CREATED: true,
      };

      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: mixedPreferences,
      });

      for (const [type, expectedEnabled] of Object.entries(mixedPreferences)) {
        const enabled = await isNotificationEnabled(userId, type);
        expect(enabled).toBe(expectedEnabled);
      }
    });

    it("should handle partial preferences (some types not specified)", async () => {
      // Only GPS_OFFLINE is specified, others should default to enabled
      const partialPreferences = {
        GPS_OFFLINE: false,
      };

      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: partialPreferences,
      });

      // Specified as false
      expect(await isNotificationEnabled(userId, "GPS_OFFLINE")).toBe(false);

      // Not specified - should default to enabled
      expect(await isNotificationEnabled(userId, "LOAD_REQUEST")).toBe(true);
      expect(await isNotificationEnabled(userId, "TRUCK_REQUEST")).toBe(true);
      expect(await isNotificationEnabled(userId, "POD_SUBMITTED")).toBe(true);
    });
  });

  describe("Notification Type Coverage", () => {
    const userId = "user-coverage";

    // Test all notification types from NotificationType
    const allNotificationTypes = Object.values(NotificationType);

    it("should respect preferences for all defined notification types", async () => {
      // Create preferences with alternating enabled/disabled
      const preferences: Record<string, boolean> = {};
      allNotificationTypes.forEach((type, index) => {
        preferences[type] = index % 2 === 0;
      });

      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: preferences,
      });

      for (const type of allNotificationTypes) {
        const expected = preferences[type];
        const actual = await isNotificationEnabled(userId, type);
        expect(actual).toBe(expected);
      }
    });

    it("should handle unknown notification types (default enabled)", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {},
      });

      // Unknown type not in NotificationType
      const enabled = await isNotificationEnabled(userId, "UNKNOWN_TYPE_XYZ");
      expect(enabled).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    const userId = "user-edge";

    it("should handle empty preferences object", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {},
      });

      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true); // Default to enabled
    });

    it("should handle preferences with null values", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: null, // Invalid but possible from API
        },
      });

      // null !== false, so should be treated as enabled
      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true);
    });

    it('should handle preferences with string "false" (invalid)', async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: "false" as unknown as boolean, // Invalid but possible from bad API input
        },
      });

      // "false" !== false (strict equality), should not disable
      const enabled = await isNotificationEnabled(userId, "GPS_OFFLINE");
      expect(enabled).toBe(true);
    });

    it("should handle concurrent preference checks", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: true,
          LOAD_REQUEST: false,
        },
      });

      // Check multiple preferences concurrently
      const results = await Promise.all([
        isNotificationEnabled(userId, "GPS_OFFLINE"),
        isNotificationEnabled(userId, "LOAD_REQUEST"),
        isNotificationEnabled(userId, "GPS_OFFLINE"),
        isNotificationEnabled(userId, "TRUCK_REQUEST"),
      ]);

      expect(results).toEqual([true, false, true, true]);
    });
  });

  describe("Integration Scenarios", () => {
    const userId = "user-integration";

    it("should not send GPS notifications when user disables them", async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: false,
          TRUCK_AT_PICKUP: false,
          TRUCK_AT_DELIVERY: false,
        },
      });

      // All GPS-related notifications should be skipped
      const gpsOffline = await createNotification({
        userId,
        type: "GPS_OFFLINE",
        title: "GPS Signal Lost",
        message: "Test",
      });

      expect(gpsOffline?.skipped).toBe(true);
      expect(mockDb.notification.create).not.toHaveBeenCalled();
    });

    it("should send critical notifications even when preferences are restrictive", async () => {
      // User has disabled almost everything
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        notificationPreferences: {
          GPS_OFFLINE: false,
          LOAD_REQUEST: false,
          TRUCK_REQUEST: false,
        },
      });

      (mockDb.notification.create as jest.Mock).mockResolvedValue({
        id: "critical-notif",
        userId,
        type: "ACCOUNT_FLAGGED",
        title: "Account Security Alert",
        message: "Your account has been flagged",
        read: false,
        createdAt: new Date(),
      });

      // Critical notification with skipPreferenceCheck
      const result = await createNotification({
        userId,
        type: "ACCOUNT_FLAGGED",
        title: "Account Security Alert",
        message: "Your account has been flagged",
        skipPreferenceCheck: true, // Bypass preferences for critical alerts
      });

      expect(result?.id).toBe("critical-notif");
      expect(result?.skipped).toBeUndefined();
      expect(mockDb.notification.create).toHaveBeenCalledTimes(1);
    });
  });
});
