/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for notification service — documents 3 API contract bugs
 *
 * BUG 1: markAsRead calls PATCH /api/notifications/:id instead of PUT /api/notifications/:id/read
 * BUG 2: markAllAsRead calls POST instead of PUT /api/notifications/mark-all-read
 * BUG 3: getUnreadCount calls non-existent /api/notifications/unread-count
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
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await notificationService.getNotifications();
      expect(mockGet).toHaveBeenCalledWith("/api/notifications", {
        params: undefined,
      });
      expect(result.notifications).toHaveLength(1);
    });

    it("should pass page and limit params", async () => {
      mockGet.mockResolvedValue({
        data: {
          notifications: [],
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

  describe("markAsRead", () => {
    // BUG: Mobile calls PATCH /api/notifications/:id with { read: true }
    // Web API expects PUT /api/notifications/:id/read (no body)
    // This test documents the CURRENT (buggy) behavior

    it("should call PATCH /api/notifications/:id with { read: true } (BUG: should be PUT /api/notifications/:id/read)", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      await notificationService.markAsRead("n1");

      // Documents current behavior — uses PATCH instead of PUT
      expect(mockPatch).toHaveBeenCalledWith("/api/notifications/n1", {
        read: true,
      });
      // BUG: Should instead be:
      // expect(mockPut).toHaveBeenCalledWith("/api/notifications/n1/read")
    });

    it("should NOT call PUT (but should per web API contract)", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      await notificationService.markAsRead("n1");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Not found"));

      await expect(notificationService.markAsRead("n1")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("markAllAsRead", () => {
    // BUG: Mobile calls POST /api/notifications/mark-all-read
    // Web API expects PUT /api/notifications/mark-all-read

    it("should call POST /api/notifications/mark-all-read (BUG: should be PUT)", async () => {
      mockPost.mockResolvedValue({ data: {} });

      await notificationService.markAllAsRead();

      // Documents current behavior — uses POST instead of PUT
      expect(mockPost).toHaveBeenCalledWith("/api/notifications/mark-all-read");
      // BUG: Should instead be:
      // expect(mockPut).toHaveBeenCalledWith("/api/notifications/mark-all-read")
    });

    it("should NOT call PUT (but should per web API contract)", async () => {
      mockPost.mockResolvedValue({ data: {} });

      await notificationService.markAllAsRead();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Server error"));

      await expect(notificationService.markAllAsRead()).rejects.toThrow(
        "Server error"
      );
    });
  });

  describe("getUnreadCount", () => {
    // BUG: Mobile calls GET /api/notifications/unread-count
    // This endpoint does NOT exist on the web API.
    // Unread count is returned inline with GET /api/notifications as { notifications, unreadCount }

    it("should call GET /api/notifications/unread-count (BUG: endpoint does not exist)", async () => {
      mockGet.mockResolvedValue({ data: { count: 5 } });

      const result = await notificationService.getUnreadCount();

      expect(mockGet).toHaveBeenCalledWith("/api/notifications/unread-count");
      expect(result).toBe(5);
    });

    it("should default to 0 when count is missing", async () => {
      mockGet.mockResolvedValue({ data: {} });

      const result = await notificationService.getUnreadCount();
      expect(result).toBe(0);
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(notificationService.getUnreadCount()).rejects.toThrow(
        "Not found"
      );
    });
  });
});
