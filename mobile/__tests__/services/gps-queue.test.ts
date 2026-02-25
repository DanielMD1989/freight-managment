/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for GPS Queue Service - Offline GPS position queue
 *
 * Uses web platform (localStorage fallback) since MMKV is native-only.
 * Date.now() is mocked to return incrementing values so each enqueue
 * produces a unique key ({truckId}_{timestamp}).
 */

// Mock Platform as web so the service uses localStorage fallback
jest.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

// Mock apiClient
const mockPost = jest.fn();
jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: (e: any) => e?.message || "Unknown error",
}));

// In-memory localStorage mock
const localStorageStore: Record<string, string> = {};
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: jest.fn((key: string) => localStorageStore[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      localStorageStore[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete localStorageStore[key];
    }),
    key: jest.fn((i: number) => Object.keys(localStorageStore)[i] ?? null),
    get length() {
      return Object.keys(localStorageStore).length;
    },
    clear: jest.fn(() => {
      for (const key of Object.keys(localStorageStore))
        delete localStorageStore[key];
    }),
  },
  writable: true,
});

import { gpsQueueService } from "../../src/services/gps-queue";

/** Base timestamp used for Date.now mock. Increments on each call. */
let fakeNow: number;

function makePoint(
  truckId = "truck1",
  overrides: Partial<{
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    timestamp: string;
  }> = {}
) {
  return {
    truckId,
    latitude: 9.02,
    longitude: 38.75,
    speed: 60,
    heading: 180,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/** Clear all keys from the in-memory store */
function clearLocalStorage() {
  for (const key of Object.keys(localStorageStore)) {
    delete localStorageStore[key];
  }
}

describe("GPS Queue Service", () => {
  beforeEach(() => {
    clearLocalStorage();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Mock Date.now to return incrementing values so each enqueue gets a unique key
    fakeNow = 1700000000000;
    jest.spyOn(Date, "now").mockImplementation(() => {
      return fakeNow++;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("enqueue", () => {
    it("should add a GPS point to the queue", async () => {
      const point = makePoint("truck1");

      await gpsQueueService.enqueue(point);

      const size = await gpsQueueService.getQueueSize();
      expect(size).toBe(1);

      // Verify localStorage was written with gps_ prefix
      const keys = Object.keys(localStorageStore).filter((k) =>
        k.startsWith("gps_")
      );
      expect(keys.length).toBe(1);
      expect(keys[0]).toMatch(/^gps_truck1_\d+$/);

      const stored = JSON.parse(localStorageStore[keys[0]]);
      expect(stored.truckId).toBe("truck1");
      expect(stored.latitude).toBe(9.02);
    });

    it("should enqueue multiple points and increase queue size", async () => {
      await gpsQueueService.enqueue(makePoint("truck1"));
      await gpsQueueService.enqueue(makePoint("truck2"));
      await gpsQueueService.enqueue(makePoint("truck1"));

      const size = await gpsQueueService.getQueueSize();
      expect(size).toBe(3);
    });
  });

  describe("getQueueSize", () => {
    it("should return 0 for empty queue", async () => {
      const size = await gpsQueueService.getQueueSize();
      expect(size).toBe(0);
    });

    it("should return correct count after enqueues", async () => {
      await gpsQueueService.enqueue(makePoint("t1"));
      await gpsQueueService.enqueue(makePoint("t2"));

      const size = await gpsQueueService.getQueueSize();
      expect(size).toBe(2);
    });
  });

  describe("flush", () => {
    it("should upload queued positions to API in a batch", async () => {
      mockPost.mockResolvedValue({ data: { ok: true } });

      await gpsQueueService.enqueue(makePoint("truck1"));
      await gpsQueueService.enqueue(makePoint("truck1"));

      const result = await gpsQueueService.flush();

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        "/api/tracking/ingest/batch",
        expect.objectContaining({
          positions: expect.arrayContaining([
            expect.objectContaining({ truckId: "truck1" }),
          ]),
        })
      );
      expect(result.uploaded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should remove uploaded entries after successful flush", async () => {
      mockPost.mockResolvedValue({ data: { ok: true } });

      await gpsQueueService.enqueue(makePoint("truck1"));
      await gpsQueueService.enqueue(makePoint("truck2"));

      const sizeBefore = await gpsQueueService.getQueueSize();
      expect(sizeBefore).toBe(2);

      await gpsQueueService.flush();

      const sizeAfter = await gpsQueueService.getQueueSize();
      expect(sizeAfter).toBe(0);
    });

    it("should return zero counts when queue is empty", async () => {
      const result = await gpsQueueService.flush();

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.uploaded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("should keep entries in queue when API call fails", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      await gpsQueueService.enqueue(makePoint("truck1"));
      await gpsQueueService.enqueue(makePoint("truck1"));

      const result = await gpsQueueService.flush();

      expect(result.uploaded).toBe(0);
      expect(result.failed).toBe(2);

      // Entries should still be in the queue
      const size = await gpsQueueService.getQueueSize();
      expect(size).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all entries from the queue", async () => {
      await gpsQueueService.enqueue(makePoint("truck1"));
      await gpsQueueService.enqueue(makePoint("truck2"));
      await gpsQueueService.enqueue(makePoint("truck3"));

      const sizeBefore = await gpsQueueService.getQueueSize();
      expect(sizeBefore).toBe(3);

      await gpsQueueService.clear();

      const sizeAfter = await gpsQueueService.getQueueSize();
      expect(sizeAfter).toBe(0);
    });
  });

  describe("trimQueue (max size)", () => {
    it("should enforce maximum of 1000 entries", async () => {
      // Directly insert 1005 entries into localStorage to bypass enqueue overhead
      const baseTs = 1700000000000;
      for (let i = 0; i < 1005; i++) {
        const ts = baseTs + i;
        const key = `gps_truck1_${ts}`;
        localStorageStore[key] = JSON.stringify({
          truckId: "truck1",
          latitude: 9.0 + i * 0.001,
          longitude: 38.75,
          timestamp: new Date(ts).toISOString(),
        });
      }

      // Verify we seeded more than 1000
      const keysBefore = Object.keys(localStorageStore).filter((k) =>
        k.startsWith("gps_")
      );
      expect(keysBefore.length).toBe(1005);

      // Enqueue one more point - this triggers trimQueue internally
      await gpsQueueService.enqueue(makePoint("truck1"));

      const sizeAfter = await gpsQueueService.getQueueSize();
      expect(sizeAfter).toBeLessThanOrEqual(1000);
    });
  });

  describe("trimQueue (TTL expiry)", () => {
    it("should remove entries older than 24 hours", async () => {
      // Use a fixed "now" for this test
      const realNow = 1700100000000;
      const twentyFiveHoursAgo = realNow - 25 * 60 * 60 * 1000;

      // Reset the Date.now mock to use realNow as the base
      jest.spyOn(Date, "now").mockImplementation(() => {
        return fakeNow++;
      });
      // Set fakeNow to our controlled value
      fakeNow = realNow;

      // Insert an old entry directly into localStorage
      const oldKey = `gps_truck1_${twentyFiveHoursAgo}`;
      localStorageStore[oldKey] = JSON.stringify({
        truckId: "truck1",
        latitude: 9.02,
        longitude: 38.75,
        timestamp: new Date(twentyFiveHoursAgo).toISOString(),
      });

      // Insert a recent entry directly with a timestamp distinct from what enqueue will use
      const recentTs = realNow - 1000; // 1 second ago
      const recentKey = `gps_truck1_${recentTs}`;
      localStorageStore[recentKey] = JSON.stringify({
        truckId: "truck1",
        latitude: 9.03,
        longitude: 38.76,
        timestamp: new Date(recentTs).toISOString(),
      });

      // Verify both exist
      const keysBefore = Object.keys(localStorageStore).filter((k) =>
        k.startsWith("gps_")
      );
      expect(keysBefore.length).toBe(2);

      // Enqueue a new point to trigger trimQueue
      await gpsQueueService.enqueue(makePoint("truck1"));

      // The old entry should be removed, the recent one and the new one should remain
      const sizeAfter = await gpsQueueService.getQueueSize();
      expect(sizeAfter).toBe(2); // recent + newly enqueued

      // Verify the old key is gone
      expect(localStorageStore[oldKey]).toBeUndefined();
    });
  });

  describe("flush with corrupt entries", () => {
    it("should remove corrupt entries and upload valid ones", async () => {
      mockPost.mockResolvedValue({ data: { ok: true } });

      const ts = 1700000000000;

      // Insert a valid entry
      const validKey = `gps_truck1_${ts}`;
      localStorageStore[validKey] = JSON.stringify({
        truckId: "truck1",
        latitude: 9.02,
        longitude: 38.75,
        timestamp: new Date(ts).toISOString(),
      });

      // Insert a corrupt entry (invalid JSON)
      const corruptKey = `gps_truck1_${ts + 1}`;
      localStorageStore[corruptKey] = "not valid json{{{";

      const result = await gpsQueueService.flush();

      // Only the valid entry should be uploaded
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result.uploaded).toBe(1);
      expect(result.failed).toBe(0);

      // Both keys should be removed (valid uploaded, corrupt cleaned)
      const sizeAfter = await gpsQueueService.getQueueSize();
      expect(sizeAfter).toBe(0);
    });
  });
});
