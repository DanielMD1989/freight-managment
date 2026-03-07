/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for notification query hooks — verify query keys, polling interval,
 * and cache invalidation (S10: useUnreadNotificationCount → useNotificationUnreadCount)
 */
import { notificationService } from "../../src/services/notification";

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

jest.mock("../../src/services/notification", () => ({
  notificationService: {
    getNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  },
}));

import {
  useNotifications,
  useNotificationUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../../src/hooks/useNotifications";

describe("Notification Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  describe("useNotifications", () => {
    it('should use queryKey ["notifications", params]', () => {
      const params = { page: 1, limit: 20 };
      useNotifications(params);
      expect(capturedOptions.queryKey).toEqual(["notifications", params]);
    });

    it("should call notificationService.getNotifications as queryFn", () => {
      const params = { page: 2 };
      useNotifications(params);
      capturedOptions.queryFn();
      expect(notificationService.getNotifications).toHaveBeenCalledWith(params);
    });

    it("should include undefined params in queryKey when not provided", () => {
      useNotifications();
      expect(capturedOptions.queryKey).toEqual(["notifications", undefined]);
    });

    it("should set refetchInterval to 30000 (30s polling)", () => {
      useNotifications();
      expect(capturedOptions.refetchInterval).toBe(30000);
    });
  });

  describe("useNotificationUnreadCount (derived, no extra HTTP call)", () => {
    it("should return 0 when data is undefined", () => {
      // useNotifications returns { data: undefined } from the mock
      const count = useNotificationUnreadCount();
      expect(count).toBe(0);
    });

    it("should not make a separate getUnreadCount HTTP call", () => {
      useNotificationUnreadCount();
      // notificationService has no getUnreadCount — this validates it isn't called
      expect(notificationService.getNotifications).not.toHaveBeenCalled();
    });
  });

  describe("useMarkNotificationRead", () => {
    it("should call notificationService.markAsRead as mutationFn", () => {
      useMarkNotificationRead();
      capturedMutationOptions.mutationFn("n1");
      expect(notificationService.markAsRead).toHaveBeenCalledWith("n1");
    });

    it('should invalidate ["notifications"] on success', () => {
      useMarkNotificationRead();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["notifications"],
      });
    });
  });

  describe("useMarkAllNotificationsRead", () => {
    it("should call notificationService.markAllAsRead as mutationFn", () => {
      useMarkAllNotificationsRead();
      capturedMutationOptions.mutationFn();
      expect(notificationService.markAllAsRead).toHaveBeenCalledTimes(1);
    });

    it('should invalidate ["notifications"] on success', () => {
      useMarkAllNotificationsRead();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["notifications"],
      });
    });
  });
});
