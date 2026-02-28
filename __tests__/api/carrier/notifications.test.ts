/**
 * Notifications API Tests
 *
 * Tests for notification management:
 * - GET /api/notifications → { notifications, unreadCount }
 * - PUT /api/notifications/[id]/read → { success: true }
 * - PUT /api/notifications/mark-all-read → { success: true }
 *
 * Business rules:
 * - Uses getSessionAny (not requireAuth) — returns 401 explicitly
 * - Carrier can only mark own notifications as read
 * - CSRF validation on mutation endpoints
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockLoadUtils,
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
// Override notification mock to include markAllAsRead
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyTruckRequest: jest.fn(async () => {}),
  getRecentNotifications: jest.fn(async () => [
    {
      id: "notif-carrier-1",
      type: "TRIP_STATUS",
      title: "Trip updated",
      message: "Trip status changed",
      read: false,
      userId: "carrier-user-1",
      createdAt: new Date().toISOString(),
    },
    {
      id: "notif-carrier-2",
      type: "SYSTEM",
      title: "System notice",
      message: "Maintenance window",
      read: true,
      userId: "carrier-user-1",
      createdAt: new Date().toISOString(),
    },
  ]),
  getUnreadCount: jest.fn(async () => 1),
  markAsRead: jest.fn(async () => {}),
  markAllAsRead: jest.fn(async () => {}),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    TRIP_CANCELLED: "TRIP_CANCELLED",
    SYSTEM: "SYSTEM",
  },
}));
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockLoadUtils();

// Import handlers AFTER mocks
const { GET: getNotifications } = require("@/app/api/notifications/route");
const { PUT: markRead } = require("@/app/api/notifications/[id]/read/route");
const {
  PUT: markAllRead,
} = require("@/app/api/notifications/mark-all-read/route");
const {
  getRecentNotifications,
  markAsRead,
  markAllAsRead: markAllAsReadFn,
} = require("@/lib/notifications");

describe("Notifications API", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const otherSession = createMockSession({
    userId: "other-user-1",
    email: "other@test.com",
    role: "CARRIER",
    organizationId: "other-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create notifications for the carrier user
    await db.notification.create({
      data: {
        id: "notif-carrier-1",
        type: "TRIP_STATUS",
        title: "Trip updated",
        message: "Trip status changed to IN_TRANSIT",
        userId: "carrier-user-1",
        read: false,
      },
    });
    await db.notification.create({
      data: {
        id: "notif-carrier-2",
        type: "SYSTEM",
        title: "System notice",
        message: "Scheduled maintenance window",
        userId: "carrier-user-1",
        read: true,
      },
    });
    // Notification belonging to another user
    await db.notification.create({
      data: {
        id: "notif-other-1",
        type: "LOAD_REQUEST",
        title: "New load request",
        message: "You have a new load request",
        userId: "other-user-1",
        read: false,
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/notifications ──────────────────────────────────────────────

  describe("GET /api/notifications", () => {
    it("unauthenticated → 401", async () => {
      setAuthSession(null);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      const res = await getNotifications(req);
      expect(res.status).toBe(401);
    });

    it("carrier gets notifications → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      const res = await getNotifications(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.notifications).toBeDefined();
      expect(Array.isArray(data.notifications)).toBe(true);
    });

    it("returns notifications array + unreadCount", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      const res = await getNotifications(req);
      const data = await parseResponse(res);
      expect(data).toHaveProperty("notifications");
      expect(data).toHaveProperty("unreadCount");
      expect(typeof data.unreadCount).toBe("number");
    });

    it("calls getRecentNotifications with userId and limit", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );
      await getNotifications(req);
      expect(getRecentNotifications).toHaveBeenCalledWith("carrier-user-1", 20);
    });
  });

  // ─── PUT /api/notifications/[id]/read ─────────────────────────────────

  describe("PUT /api/notifications/[id]/read", () => {
    it("unauthenticated → 401", async () => {
      setAuthSession(null);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/notif-carrier-1/read"
      );
      const res = await callHandler(markRead, req, { id: "notif-carrier-1" });
      expect(res.status).toBe(401);
    });

    it("own notification → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/notif-carrier-1/read"
      );
      const res = await callHandler(markRead, req, { id: "notif-carrier-1" });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });

    it("other user's notification → 404", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/notif-other-1/read"
      );
      const res = await callHandler(markRead, req, { id: "notif-other-1" });
      expect(res.status).toBe(404);
    });

    it("non-existent notification → 404", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/nonexistent/read"
      );
      const res = await callHandler(markRead, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("calls markAsRead with notification id", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/notif-carrier-1/read"
      );
      await callHandler(markRead, req, { id: "notif-carrier-1" });
      expect(markAsRead).toHaveBeenCalledWith("notif-carrier-1");
    });
  });

  // ─── PUT /api/notifications/mark-all-read ─────────────────────────────

  describe("PUT /api/notifications/mark-all-read", () => {
    it("unauthenticated → 401", async () => {
      setAuthSession(null);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/mark-all-read"
      );
      const res = await markAllRead(req);
      expect(res.status).toBe(401);
    });

    it("returns success: true", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/mark-all-read"
      );
      const res = await markAllRead(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });

    it("calls markAllAsRead with userId", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "PUT",
        "http://localhost:3000/api/notifications/mark-all-read"
      );
      await markAllRead(req);
      expect(markAllAsReadFn).toHaveBeenCalledWith("carrier-user-1");
    });
  });
});
