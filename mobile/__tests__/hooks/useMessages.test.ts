/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for messaging hooks — §13 In-App Messaging
 */
import { messagingService } from "../../src/services/messaging";

let capturedOptions: any = null;
let capturedMutationOptions: any = null;
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
  useMutation: (options: any) => {
    capturedMutationOptions = options;
    return { mutate: jest.fn(), isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock("../../src/services/messaging", () => ({
  messagingService: {
    sendMessage: jest.fn(),
    getMessages: jest.fn(),
    markAsRead: jest.fn(),
    getUnreadCount: jest.fn(),
  },
}));

import {
  useTripMessages,
  useSendMessage,
  useMarkMessageRead,
  useTripUnreadCount,
} from "../../src/hooks/useMessages";

describe("Messaging Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ── useTripMessages ──

  describe("useTripMessages", () => {
    it('should use queryKey ["messages", "trip", tripId]', () => {
      useTripMessages("trip-1");
      expect(capturedOptions.queryKey).toEqual(["messages", "trip", "trip-1"]);
    });

    it("should set enabled: true when tripId is truthy", () => {
      useTripMessages("trip-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when tripId is undefined", () => {
      useTripMessages(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set enabled: false when options.enabled is false", () => {
      useTripMessages("trip-1", { enabled: false });
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should default refetchInterval to 5000ms", () => {
      useTripMessages("trip-1");
      expect(capturedOptions.refetchInterval).toBe(5000);
    });

    it("should accept custom refetchInterval", () => {
      useTripMessages("trip-1", { refetchInterval: 10000 });
      expect(capturedOptions.refetchInterval).toBe(10000);
    });

    it("should call messagingService.getMessages as queryFn", () => {
      useTripMessages("trip-1");
      capturedOptions.queryFn();
      expect(messagingService.getMessages).toHaveBeenCalledWith("trip-1");
    });
  });

  // ── useSendMessage ──

  describe("useSendMessage", () => {
    it("should call messagingService.sendMessage with tripId and data", () => {
      useSendMessage();
      capturedMutationOptions.mutationFn({
        tripId: "trip-1",
        data: { content: "Hello" },
      });
      expect(messagingService.sendMessage).toHaveBeenCalledWith("trip-1", {
        content: "Hello",
      });
    });

    it("should invalidate trip messages on success", () => {
      useSendMessage();
      capturedMutationOptions.onSuccess(
        {},
        { tripId: "trip-1", data: { content: "Hello" } }
      );
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["messages", "trip", "trip-1"],
      });
    });
  });

  // ── useMarkMessageRead ──

  describe("useMarkMessageRead", () => {
    it("should call messagingService.markAsRead with tripId and messageId", () => {
      useMarkMessageRead();
      capturedMutationOptions.mutationFn({
        tripId: "trip-1",
        messageId: "msg-1",
      });
      expect(messagingService.markAsRead).toHaveBeenCalledWith(
        "trip-1",
        "msg-1"
      );
    });

    it("should invalidate trip messages and unread count on success", () => {
      useMarkMessageRead();
      capturedMutationOptions.onSuccess(
        {},
        { tripId: "trip-1", messageId: "msg-1" }
      );
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["messages", "trip", "trip-1"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["messages", "unread", "trip-1"],
      });
    });
  });

  // ── useTripUnreadCount ──

  describe("useTripUnreadCount", () => {
    it('should use queryKey ["messages", "unread", tripId]', () => {
      useTripUnreadCount("trip-1");
      expect(capturedOptions.queryKey).toEqual([
        "messages",
        "unread",
        "trip-1",
      ]);
    });

    it("should set enabled: true when tripId is truthy", () => {
      useTripUnreadCount("trip-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when tripId is undefined", () => {
      useTripUnreadCount(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set enabled: false when options.enabled is false", () => {
      useTripUnreadCount("trip-1", { enabled: false });
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should set refetchInterval to 30000ms", () => {
      useTripUnreadCount("trip-1");
      expect(capturedOptions.refetchInterval).toBe(30000);
    });

    it("should call messagingService.getUnreadCount as queryFn", () => {
      useTripUnreadCount("trip-1");
      capturedOptions.queryFn();
      expect(messagingService.getUnreadCount).toHaveBeenCalledWith("trip-1");
    });
  });
});
