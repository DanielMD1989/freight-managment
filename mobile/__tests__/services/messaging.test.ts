/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for messaging service — §13 In-App Messaging
 */
import { messagingService } from "../../src/services/messaging";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Messaging Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── sendMessage ──

  describe("sendMessage", () => {
    it("should call POST /api/trips/:id/messages", async () => {
      const mockMsg = { id: "m1", content: "Hello", senderId: "u1" };
      mockPost.mockResolvedValue({ data: { message: mockMsg } });

      const result = await messagingService.sendMessage("t1", {
        content: "Hello",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t1/messages", {
        content: "Hello",
      });
      expect(result.id).toBe("m1");
    });

    it("should handle unwrapped response", async () => {
      const mockMsg = { id: "m2", content: "Hi" };
      mockPost.mockResolvedValue({ data: mockMsg });

      const result = await messagingService.sendMessage("t1", {
        content: "Hi",
      });
      expect(result.id).toBe("m2");
    });

    it("should pass attachmentUrl when provided", async () => {
      mockPost.mockResolvedValue({
        data: { id: "m3", content: "See file" },
      });

      await messagingService.sendMessage("t1", {
        content: "See file",
        attachmentUrl: "https://example.com/file.pdf",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t1/messages", {
        content: "See file",
        attachmentUrl: "https://example.com/file.pdf",
      });
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Forbidden"));

      await expect(
        messagingService.sendMessage("t1", { content: "Hi" })
      ).rejects.toThrow("Forbidden");
    });
  });

  // ── getMessages ──

  describe("getMessages", () => {
    it("should call GET /api/trips/:id/messages", async () => {
      const mockData = {
        messages: [],
        readOnly: false,
        tripStatus: "IN_TRANSIT",
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await messagingService.getMessages("t1");
      expect(mockGet).toHaveBeenCalledWith("/api/trips/t1/messages", {
        params: undefined,
      });
      expect(result.messages).toEqual([]);
      expect(result.readOnly).toBe(false);
    });

    it("should pass pagination params", async () => {
      mockGet.mockResolvedValue({
        data: { messages: [], readOnly: true, tripStatus: "DELIVERED" },
      });

      await messagingService.getMessages("t1", {
        limit: 20,
        before: "cursor-1",
      });
      expect(mockGet).toHaveBeenCalledWith("/api/trips/t1/messages", {
        params: { limit: 20, before: "cursor-1" },
      });
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(messagingService.getMessages("t1")).rejects.toThrow(
        "Not found"
      );
    });
  });

  // ── markAsRead ──

  describe("markAsRead", () => {
    it("should call PUT /api/trips/:tripId/messages/:messageId/read", async () => {
      mockPut.mockResolvedValue({ data: {} });

      await messagingService.markAsRead("t1", "m1");
      expect(mockPut).toHaveBeenCalledWith("/api/trips/t1/messages/m1/read");
    });

    it("should throw on error", async () => {
      mockPut.mockRejectedValue(new Error("Server error"));

      await expect(messagingService.markAsRead("t1", "m1")).rejects.toThrow(
        "Server error"
      );
    });
  });

  // ── getUnreadCount ──

  describe("getUnreadCount", () => {
    it("should call GET /api/trips/:id/messages/unread-count", async () => {
      mockGet.mockResolvedValue({ data: { unreadCount: 3 } });

      const result = await messagingService.getUnreadCount("t1");
      expect(mockGet).toHaveBeenCalledWith(
        "/api/trips/t1/messages/unread-count"
      );
      expect(result).toBe(3);
    });

    it("should return 0 when unreadCount is missing", async () => {
      mockGet.mockResolvedValue({ data: {} });

      const result = await messagingService.getUnreadCount("t1");
      expect(result).toBe(0);
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("Unauthorized"));

      await expect(messagingService.getUnreadCount("t1")).rejects.toThrow(
        "Unauthorized"
      );
    });
  });
});
