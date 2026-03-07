/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for notification service — verifies corrected API contracts (S10 fixes)
 *
 * FIX 1: markAsRead uses PUT /api/notifications/:id/read (not PATCH)
 * FIX 2: markAllAsRead uses PUT /api/notifications/mark-all-read (not POST)
 * FIX 3: getUnreadCount removed — unreadCount comes inline from getNotifications
 */
import { notificationService } from "../../src/services/notification";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    put: (...args: any[]) => mockPut(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Notification Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getNotifications", () => {
    it("should call GET /api/notifications", async () => {
      const mockData = {
        notifications: [{ id: "n1", message: "Test" }],
        unreadCount: 1,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await notificationService.getNotifications();
      expect(mockGet).toHaveBeenCalledWith("/api/notifications", {
        params: undefined,
      });
      expect(result.notifications).toHaveLength(1);
      expect(result.unreadCount).toBe(1);
    });

    it("should pass page and limit params", async () => {
      mockGet.mockResolvedValue({
        data: {
          notifications: [],
          unreadCount: 0,
          pagination: { page: 2, limit: 10, total: 0, pages: 0 },
        },
      });

      await notificationService.getNotifications({ page: 2, limit: 10 });
      expect(mockGet).toHaveBeenCalledWith("/api/notifications", {
        params: { page: 2, limit: 10 },
      });
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));

      await expect(notificationService.getNotifications()).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("markAsRead — FIX: PUT /api/notifications/:id/read", () => {
    it("should call PUT /api/notifications/:id/read (fixed from PATCH)", async () => {
      mockPut.mockResolvedValue({ data: {} });

      await notificationService.markAsRead("n1");

      expect(mockPut).toHaveBeenCalledWith("/api/notifications/n1/read");
      expect(mockPatch).not.toHaveBeenCalled();
    });

    it("should propagate errors", async () => {
      mockPut.mockRejectedValue(new Error("Not found"));

      await expect(notificationService.markAsRead("n1")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("markAllAsRead — FIX: PUT /api/notifications/mark-all-read", () => {
    it("should call PUT /api/notifications/mark-all-read (fixed from POST)", async () => {
      mockPut.mockResolvedValue({ data: {} });

      await notificationService.markAllAsRead();

      expect(mockPut).toHaveBeenCalledWith("/api/notifications/mark-all-read");
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("should propagate errors", async () => {
      mockPut.mockRejectedValue(new Error("Server error"));

      await expect(notificationService.markAllAsRead()).rejects.toThrow(
        "Server error"
      );
    });
  });
});
