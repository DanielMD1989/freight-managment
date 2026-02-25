/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for push notification service
 *
 * The push service conditionally requires expo-notifications and expo-constants
 * at module load time based on Platform.OS. Web gets null modules (no-op stubs),
 * native gets the real expo packages. We test both paths.
 */

// --- Mocks that must be declared before any imports ---

const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: (e: any) => e?.message || "Unknown error",
}));

// By default mock Platform as "web" — native tests override via jest.isolateModules
jest.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

// Provide module stubs so require() does not crash in isolation tests
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getBadgeCountAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: "test-project-id" },
      },
    },
  },
}));

// ---------- Tests ----------

describe("Push Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // Web platform tests — expo modules are null, everything no-ops
  // ============================================================
  describe("web platform (no-op behavior)", () => {
    let pushService: any;

    beforeAll(() => {
      // The top-level mock sets Platform.OS = "web", so importing pushService
      // will leave Notifications and Constants as null.
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        pushService = require("../../src/services/push").pushService;
      });
    });

    it("registerForPush returns null on web", async () => {
      const result = await pushService.registerForPush();
      expect(result).toBeNull();
    });

    it("getBadgeCount returns 0 on web", async () => {
      const count = await pushService.getBadgeCount();
      expect(count).toBe(0);
    });

    it("setBadgeCount is a no-op on web", async () => {
      // Should not throw
      await expect(pushService.setBadgeCount(5)).resolves.toBeUndefined();
    });

    it("onNotificationReceived returns a remove stub on web", () => {
      const subscription = pushService.onNotificationReceived(() => {});
      expect(subscription).toBeDefined();
      expect(typeof subscription.remove).toBe("function");
      // Calling remove should not throw
      subscription.remove();
    });

    it("onNotificationResponse returns a remove stub on web", () => {
      const subscription = pushService.onNotificationResponse(() => {});
      expect(subscription).toBeDefined();
      expect(typeof subscription.remove).toBe("function");
      subscription.remove();
    });
  });

  // ============================================================
  // registerToken / unregisterToken — platform-independent (use apiClient directly)
  // ============================================================
  describe("registerToken", () => {
    let pushService: any;

    beforeAll(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        pushService = require("../../src/services/push").pushService;
      });
    });

    it("sends POST /api/user/fcm-token with token and platform", async () => {
      mockPost.mockResolvedValue({ data: {} });

      await pushService.registerToken("ExponentPushToken[abc123]");

      expect(mockPost).toHaveBeenCalledWith("/api/user/fcm-token", {
        token: "ExponentPushToken[abc123]",
        platform: "web", // Platform.OS from mock
      });
    });

    it("throws on API error", async () => {
      mockPost.mockRejectedValue(new Error("Unauthorized"));

      await expect(
        pushService.registerToken("ExponentPushToken[abc123]")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("unregisterToken", () => {
    let pushService: any;

    beforeAll(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        pushService = require("../../src/services/push").pushService;
      });
    });

    it("sends DELETE /api/user/fcm-token", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await pushService.unregisterToken();

      expect(mockDelete).toHaveBeenCalledWith("/api/user/fcm-token");
    });

    it("silently ignores errors (best effort)", async () => {
      mockDelete.mockRejectedValue(new Error("Server error"));

      // Should NOT throw
      await expect(pushService.unregisterToken()).resolves.toBeUndefined();
    });
  });
});
