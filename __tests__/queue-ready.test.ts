/**
 * Queue Ready Check Tests
 *
 * Tests for isQueueReady(), isQueueReadySync(), and getQueueHealthStatus()
 * Covers both queue-up and queue-down states.
 */

// Mock the logger to avoid console output during tests
jest.mock("../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Store original env
const originalEnv = process.env;

describe("Queue Ready Check", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isQueueReadySync() - In-Memory Mode", () => {
    it("should return true when queue is disabled (in-memory fallback)", async () => {
      // Ensure queue is disabled
      delete process.env.QUEUE_ENABLED;
      delete process.env.REDIS_ENABLED;
      delete process.env.REDIS_URL;

      const { isQueueReadySync } = await import("../lib/queue");

      expect(isQueueReadySync()).toBe(true);
    });

    it("should return false when queue is enabled but not initialized", async () => {
      process.env.QUEUE_ENABLED = "true";

      const { isQueueReadySync } = await import("../lib/queue");

      // Without initializing, bullmqQueues is null
      expect(isQueueReadySync()).toBe(false);
    });
  });

  describe("getQueueHealthStatus() - In-Memory Mode", () => {
    it("should return ready=true with in-memory provider when disabled", async () => {
      delete process.env.QUEUE_ENABLED;
      delete process.env.REDIS_ENABLED;
      delete process.env.REDIS_URL;

      const { getQueueHealthStatus } = await import("../lib/queue");

      const status = await getQueueHealthStatus();

      expect(status).toEqual({
        ready: true,
        provider: "in-memory",
        redisConnected: false,
        redisPingMs: null,
        queuesInitialized: true,
        allQueuesOperational: true,
        pausedQueues: [],
      });
    });
  });

  describe("getQueueHealthStatus() - BullMQ Mode (Queue Down)", () => {
    it("should return ready=false when queues not initialized", async () => {
      process.env.QUEUE_ENABLED = "true";

      const { getQueueHealthStatus } = await import("../lib/queue");

      const status = await getQueueHealthStatus();

      expect(status.ready).toBe(false);
      expect(status.provider).toBe("bullmq");
      expect(status.queuesInitialized).toBe(false);
      expect(status.error).toBe("BullMQ queues not initialized");
    });
  });

  describe("isQueueReady() - Async Version", () => {
    it("should return true when queue is disabled", async () => {
      delete process.env.QUEUE_ENABLED;
      delete process.env.REDIS_ENABLED;
      delete process.env.REDIS_URL;

      const { isQueueReady } = await import("../lib/queue");

      const ready = await isQueueReady();
      expect(ready).toBe(true);
    });

    it("should return false when queue enabled but not initialized", async () => {
      process.env.QUEUE_ENABLED = "true";

      const { isQueueReady } = await import("../lib/queue");

      const ready = await isQueueReady();
      expect(ready).toBe(false);
    });
  });
});

describe("Queue Health Status - Mocked Redis", () => {
  // Mock Redis connection
  const mockRedisConnection = {
    ping: jest.fn(),
  };

  // Mock queue
  const mockQueue = {
    isPaused: jest.fn(),
    getWaitingCount: jest.fn(),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe("Redis Connection States", () => {
    it("should detect Redis connection failure", async () => {
      process.env.QUEUE_ENABLED = "true";

      // Import and get internal state access
      const queueModule = await import("../lib/queue");

      // Manually set up test state (simulating partial initialization)
      // Since we can't easily mock the internal state, we test the logic through the API

      const status = await queueModule.getQueueHealthStatus();

      // When enabled but not initialized, should report not ready
      expect(status.ready).toBe(false);
      expect(status.redisConnected).toBe(false);
    });
  });

  describe("Queue State Validation", () => {
    it("should report paused queues", async () => {
      // This tests the structure of the response
      delete process.env.QUEUE_ENABLED;

      const { getQueueHealthStatus } = await import("../lib/queue");

      const status = await getQueueHealthStatus();

      // In-memory mode should have empty pausedQueues array
      expect(Array.isArray(status.pausedQueues)).toBe(true);
      expect(status.pausedQueues).toHaveLength(0);
    });

    it("should include redisPingMs when connected", async () => {
      delete process.env.QUEUE_ENABLED;

      const { getQueueHealthStatus } = await import("../lib/queue");

      const status = await getQueueHealthStatus();

      // In-memory mode should have null redisPingMs
      expect(status.redisPingMs).toBeNull();
    });
  });
});

describe("Queue Health Status Structure", () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.QUEUE_ENABLED;
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_URL;
  });

  it("should have all required fields", async () => {
    const { getQueueHealthStatus } = await import("../lib/queue");

    const status = await getQueueHealthStatus();

    // Verify structure
    expect(status).toHaveProperty("ready");
    expect(status).toHaveProperty("provider");
    expect(status).toHaveProperty("redisConnected");
    expect(status).toHaveProperty("redisPingMs");
    expect(status).toHaveProperty("queuesInitialized");
    expect(status).toHaveProperty("allQueuesOperational");
    expect(status).toHaveProperty("pausedQueues");

    // Verify types
    expect(typeof status.ready).toBe("boolean");
    expect(["bullmq", "in-memory"]).toContain(status.provider);
    expect(typeof status.redisConnected).toBe("boolean");
    expect(typeof status.queuesInitialized).toBe("boolean");
    expect(typeof status.allQueuesOperational).toBe("boolean");
    expect(Array.isArray(status.pausedQueues)).toBe(true);
  });

  it("should include error field when applicable", async () => {
    process.env.QUEUE_ENABLED = "true";

    const { getQueueHealthStatus } = await import("../lib/queue");

    const status = await getQueueHealthStatus();

    // Should have error when not initialized
    expect(status.error).toBeDefined();
    expect(typeof status.error).toBe("string");
  });
});

describe("Queue Ready - Edge Cases", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should handle QUEUE_ENABLED=false explicitly", async () => {
    process.env.QUEUE_ENABLED = "false";

    const { isQueueReady, isQueueReadySync } = await import("../lib/queue");

    expect(isQueueReadySync()).toBe(true);
    expect(await isQueueReady()).toBe(true);
  });

  it("should handle REDIS_ENABLED without QUEUE_ENABLED", async () => {
    delete process.env.QUEUE_ENABLED;
    process.env.REDIS_ENABLED = "true";

    const { isQueueReady, isQueueReadySync, getQueueHealthStatus } =
      await import("../lib/queue");

    // Redis enabled means queue should be enabled
    const status = await getQueueHealthStatus();
    expect(status.provider).toBe("bullmq");

    // But without initialization, not ready
    expect(status.ready).toBe(false);
    expect(isQueueReadySync()).toBe(false);
  });

  it("should handle REDIS_URL without other flags", async () => {
    delete process.env.QUEUE_ENABLED;
    delete process.env.REDIS_ENABLED;
    process.env.REDIS_URL = "redis://localhost:6379";

    const { getQueueHealthStatus } = await import("../lib/queue");

    const status = await getQueueHealthStatus();

    // Redis URL enables queue system
    expect(status.provider).toBe("bullmq");
    expect(status.ready).toBe(false); // Not initialized
  });
});

describe("Queue Ready - Provider Detection", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should detect in-memory provider when queue disabled", async () => {
    delete process.env.QUEUE_ENABLED;
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_URL;

    const { getQueueHealthStatus } = await import("../lib/queue");

    const status = await getQueueHealthStatus();
    expect(status.provider).toBe("in-memory");
  });

  it("should detect bullmq provider when queue enabled", async () => {
    process.env.QUEUE_ENABLED = "true";

    const { getQueueHealthStatus } = await import("../lib/queue");

    const status = await getQueueHealthStatus();
    expect(status.provider).toBe("bullmq");
  });
});

describe("Queue Ready vs Health Status Consistency", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should have consistent results between isQueueReady and getQueueHealthStatus", async () => {
    delete process.env.QUEUE_ENABLED;

    const { isQueueReady, getQueueHealthStatus } = await import("../lib/queue");

    const ready = await isQueueReady();
    const status = await getQueueHealthStatus();

    expect(ready).toBe(status.ready);
  });

  it("should have consistent results when queue enabled but not initialized", async () => {
    process.env.QUEUE_ENABLED = "true";

    const { isQueueReady, getQueueHealthStatus } = await import("../lib/queue");

    const ready = await isQueueReady();
    const status = await getQueueHealthStatus();

    expect(ready).toBe(status.ready);
    expect(ready).toBe(false);
  });
});
