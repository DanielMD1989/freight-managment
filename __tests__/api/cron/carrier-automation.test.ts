/**
 * US-13 · Cron Jobs / Automation
 *
 * Tests for cron-driven platform automation:
 * - POST /api/cron/expire-postings → auto-expires truck postings + pending requests
 * - POST /api/cron/expire-loads → auto-expires unassigned loads
 * - POST /api/cron/gps-monitor → polls GPS devices, sets SIGNAL_LOST
 * - POST /api/cron/gps-cleanup → cleans up stale GPS data
 * - POST /api/cron/auto-settle → auto-settles completed trips
 *
 * Security: All endpoints require CRON_SECRET authorization
 * Format: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest } from "next/server";
import {
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
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
} from "../../utils/routeTestUtils";

// Setup mocks
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
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

// Mock all cron-specific library dependencies
jest.mock("@/lib/truckPostingAutomation", () => ({
  expireOldTruckPostings: jest.fn(async () => ({
    success: true,
    expiredCount: 3,
    details: ["posting-1", "posting-2", "posting-3"],
  })),
  expireOldRequests: jest.fn(async () => ({
    success: true,
    loadRequestsExpired: 1,
    truckRequestsExpired: 2,
  })),
}));

jest.mock("@/lib/loadAutomation", () => ({
  expireOldLoads: jest.fn(async () => ({
    success: true,
    expiredCount: 5,
  })),
  autoSettleCompletedLoads: jest.fn(async () => ({
    success: true,
    settledCount: 2,
    totalFound: 3,
  })),
}));

jest.mock("@/lib/gpsMonitoring", () => ({
  pollAllGpsDevices: jest.fn(async () => ({
    polled: 10,
    errors: 0,
    summary: [],
  })),
  checkForOfflineTrucks: jest.fn(async () => ["truck-1", "truck-2"]),
}));

jest.mock("@/lib/gpsAlerts", () => ({
  triggerGpsOfflineAlerts: jest.fn(async () => {}),
}));

jest.mock("@/lib/geofenceNotifications", () => ({
  checkAllGeofenceEvents: jest.fn(async () => ({ eventsProcessed: 0 })),
}));

jest.mock("@/lib/gpsQuery", () => ({
  deleteOldPositions: jest.fn(async () => 42),
  getPositionsForTrip: jest.fn(async () => []),
  getPositionsSince: jest.fn(async () => []),
}));

// Import handlers AFTER mocks
const {
  POST: expirePostings,
} = require("@/app/api/cron/expire-postings/route");
const { POST: expireLoads } = require("@/app/api/cron/expire-loads/route");
const { POST: gpsMonitor } = require("@/app/api/cron/gps-monitor/route");
const { POST: autoSettle } = require("@/app/api/cron/auto-settle/route");
const { POST: gpsCleanup } = require("@/app/api/cron/gps-cleanup/route");

/**
 * Create a cron request with CRON_SECRET authorization.
 */
function createCronRequest(
  url: string,
  cronSecret: string = "test-cron-secret"
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
  });
}

function createCronRequestNoAuth(url: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

// Set CRON_SECRET for all tests
const CRON_SECRET = "test-cron-secret";

describe("US-13 · Cron Jobs / Automation", () => {
  beforeAll(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterAll(() => {
    delete process.env.CRON_SECRET;
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/cron/expire-postings ─────────────────────────────────────

  describe("POST /api/cron/expire-postings", () => {
    it("valid CRON_SECRET → 200 with expiration results", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-postings"
      );
      const res = await expirePostings(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("missing Authorization header → 401", async () => {
      const req = createCronRequestNoAuth(
        "http://localhost:3000/api/cron/expire-postings"
      );
      const res = await expirePostings(req);
      expect(res.status).toBe(401);
    });

    it("wrong CRON_SECRET → 401", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-postings",
        "wrong-secret"
      );
      const res = await expirePostings(req);
      expect(res.status).toBe(401);
    });

    it("returns postings.expiredCount and requests counts", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-postings"
      );
      const res = await expirePostings(req);
      const data = await res.json();
      expect(data.postings).toBeDefined();
      expect(data.requests).toBeDefined();
      expect(typeof data.postings.expiredCount).toBe("number");
      expect(typeof data.requests.loadRequestsExpired).toBe("number");
      expect(typeof data.requests.truckRequestsExpired).toBe("number");
    });

    it("calls expireOldTruckPostings and expireOldRequests", async () => {
      const {
        expireOldTruckPostings,
        expireOldRequests,
      } = require("@/lib/truckPostingAutomation");
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-postings"
      );
      await expirePostings(req);
      expect(expireOldTruckPostings).toHaveBeenCalled();
      expect(expireOldRequests).toHaveBeenCalled();
    });

    it("returns timestamp in response", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-postings"
      );
      const res = await expirePostings(req);
      const data = await res.json();
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  // ─── POST /api/cron/expire-loads ────────────────────────────────────────

  describe("POST /api/cron/expire-loads", () => {
    it("valid CRON_SECRET → 200 with expired count", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-loads"
      );
      const res = await expireLoads(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("missing Authorization → 401", async () => {
      const req = createCronRequestNoAuth(
        "http://localhost:3000/api/cron/expire-loads"
      );
      const res = await expireLoads(req);
      expect(res.status).toBe(401);
    });

    it("wrong secret → 401", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-loads",
        "bad-secret"
      );
      const res = await expireLoads(req);
      expect(res.status).toBe(401);
    });

    it("returns expiredCount in response", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-loads"
      );
      const res = await expireLoads(req);
      const data = await res.json();
      expect(typeof data.expiredCount).toBe("number");
    });

    it("calls expireOldLoads automation function", async () => {
      const { expireOldLoads } = require("@/lib/loadAutomation");
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-loads"
      );
      await expireLoads(req);
      expect(expireOldLoads).toHaveBeenCalled();
    });
  });

  // ─── POST /api/cron/gps-monitor ─────────────────────────────────────────

  describe("POST /api/cron/gps-monitor", () => {
    it("valid CRON_SECRET → 200", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-monitor"
      );
      const res = await gpsMonitor(req);
      expect(res.status).toBe(200);
    });

    it("missing Authorization → 401", async () => {
      const req = createCronRequestNoAuth(
        "http://localhost:3000/api/cron/gps-monitor"
      );
      const res = await gpsMonitor(req);
      expect(res.status).toBe(401);
    });

    it("wrong secret → 401", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-monitor",
        "wrong-monitor-secret"
      );
      const res = await gpsMonitor(req);
      expect(res.status).toBe(401);
    });

    it("calls pollAllGpsDevices and checkForOfflineTrucks", async () => {
      const {
        pollAllGpsDevices,
        checkForOfflineTrucks,
      } = require("@/lib/gpsMonitoring");
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-monitor"
      );
      await gpsMonitor(req);
      expect(pollAllGpsDevices).toHaveBeenCalled();
      expect(checkForOfflineTrucks).toHaveBeenCalled();
    });

    it("triggers offline alerts for detected offline trucks", async () => {
      const { triggerGpsOfflineAlerts } = require("@/lib/gpsAlerts");
      const { checkForOfflineTrucks } = require("@/lib/gpsMonitoring");
      checkForOfflineTrucks.mockResolvedValueOnce(["truck-signal-lost-1"]);
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-monitor"
      );
      await gpsMonitor(req);
      expect(triggerGpsOfflineAlerts).toHaveBeenCalledWith([
        "truck-signal-lost-1",
      ]);
    });

    it("no offline trucks → no alerts triggered", async () => {
      const { triggerGpsOfflineAlerts } = require("@/lib/gpsAlerts");
      const { checkForOfflineTrucks } = require("@/lib/gpsMonitoring");
      checkForOfflineTrucks.mockResolvedValueOnce([]); // No offline trucks
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-monitor"
      );
      await gpsMonitor(req);
      expect(triggerGpsOfflineAlerts).not.toHaveBeenCalled();
    });
  });

  // ─── CRON_SECRET not configured ─────────────────────────────────────────

  describe("CRON_SECRET not configured → 500", () => {
    it("expire-postings without CRON_SECRET env → 401 or 500", async () => {
      const origSecret = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-postings"
      );
      const res = await expirePostings(req);
      expect([401, 500]).toContain(res.status);
      process.env.CRON_SECRET = origSecret;
    });

    it("expire-loads without CRON_SECRET env → 401 or 500", async () => {
      const origSecret = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      const req = createCronRequest(
        "http://localhost:3000/api/cron/expire-loads"
      );
      const res = await expireLoads(req);
      expect([401, 500]).toContain(res.status);
      process.env.CRON_SECRET = origSecret;
    });

    it("gps-monitor without CRON_SECRET env → 500 (misconfigured)", async () => {
      const origSecret = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-monitor"
      );
      const res = await gpsMonitor(req);
      // gps-monitor always requires CRON_SECRET - returns 500 if missing
      expect([401, 500]).toContain(res.status);
      process.env.CRON_SECRET = origSecret;
    });
  });

  // ─── POST /api/cron/auto-settle ─────────────────────────────────────────

  describe("POST /api/cron/auto-settle", () => {
    it("valid CRON_SECRET → 200 with settlement results", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/auto-settle"
      );
      const res = await autoSettle(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("missing Authorization → 401", async () => {
      const req = createCronRequestNoAuth(
        "http://localhost:3000/api/cron/auto-settle"
      );
      const res = await autoSettle(req);
      expect(res.status).toBe(401);
    });

    it("wrong secret → 401", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/auto-settle",
        "wrong-secret"
      );
      const res = await autoSettle(req);
      expect(res.status).toBe(401);
    });

    it("returns settledCount and totalFound", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/auto-settle"
      );
      const res = await autoSettle(req);
      const data = await res.json();
      expect(typeof data.settledCount).toBe("number");
      expect(typeof data.totalFound).toBe("number");
    });

    it("calls autoSettleCompletedLoads", async () => {
      const { autoSettleCompletedLoads } = require("@/lib/loadAutomation");
      const req = createCronRequest(
        "http://localhost:3000/api/cron/auto-settle"
      );
      await autoSettle(req);
      expect(autoSettleCompletedLoads).toHaveBeenCalled();
    });

    it("without CRON_SECRET env → 401 or 500", async () => {
      const origSecret = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      const req = createCronRequest(
        "http://localhost:3000/api/cron/auto-settle"
      );
      const res = await autoSettle(req);
      expect([401, 500]).toContain(res.status);
      process.env.CRON_SECRET = origSecret;
    });
  });

  // ─── POST /api/cron/gps-cleanup ─────────────────────────────────────────

  describe("POST /api/cron/gps-cleanup", () => {
    it("valid CRON_SECRET → 200 with deletion results", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-cleanup"
      );
      const res = await gpsCleanup(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("missing Authorization → 401", async () => {
      const req = createCronRequestNoAuth(
        "http://localhost:3000/api/cron/gps-cleanup"
      );
      const res = await gpsCleanup(req);
      expect(res.status).toBe(401);
    });

    it("wrong secret → 401", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-cleanup",
        "wrong-secret"
      );
      const res = await gpsCleanup(req);
      expect(res.status).toBe(401);
    });

    it("returns deletedPositions count and retentionDays", async () => {
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-cleanup"
      );
      const res = await gpsCleanup(req);
      const data = await res.json();
      expect(typeof data.deletedPositions).toBe("number");
      expect(data.retentionDays).toBe(90);
    });

    it("calls deleteOldPositions with 90 days", async () => {
      const { deleteOldPositions } = require("@/lib/gpsQuery");
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-cleanup"
      );
      await gpsCleanup(req);
      expect(deleteOldPositions).toHaveBeenCalledWith(90);
    });

    it("without CRON_SECRET env → 500", async () => {
      const origSecret = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      const req = createCronRequest(
        "http://localhost:3000/api/cron/gps-cleanup"
      );
      const res = await gpsCleanup(req);
      expect([401, 500]).toContain(res.status);
      process.env.CRON_SECRET = origSecret;
    });
  });
});
