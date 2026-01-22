/**
 * Redis Client Configuration
 *
 * PHASE 4: Critical Architecture - Distributed Rate Limiting
 *
 * Provides a singleton Redis client for:
 * - Distributed rate limiting across multiple servers
 * - Session storage
 * - Caching
 * - Pub/Sub messaging
 *
 * Architecture:
 * ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 * │  Server 1   │  │  Server 2   │  │  Server N   │
 * │  (Next.js)  │  │  (Next.js)  │  │  (Next.js)  │
 * └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
 *        │                │                │
 *        └────────────────┼────────────────┘
 *                         │
 *                  ┌──────▼──────┐
 *                  │    Redis    │
 *                  │  (Shared)   │
 *                  └─────────────┘
 */

import Redis, { RedisOptions } from 'ioredis';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Redis connection options
 */
function getRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse Redis URL (redis://user:pass@host:port/db)
    return {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[Redis] Max retries exceeded, giving up');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 200, 2000);
        console.log(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    };
  }

  // Default local Redis configuration
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('[Redis] Max retries exceeded, giving up');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      console.log(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
  };
}

// =============================================================================
// REDIS CLIENT SINGLETON
// =============================================================================

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisConnected: boolean;
};

/**
 * Check if Redis is enabled
 */
export function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED === 'true' || !!process.env.REDIS_URL;
}

/**
 * Create or return existing Redis client
 */
function createRedisClient(): Redis | null {
  if (!isRedisEnabled()) {
    console.log('[Redis] Disabled - using in-memory fallback');
    return null;
  }

  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const config = getRedisConfig();
  const client = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, config)
    : new Redis(config);

  // Event handlers
  client.on('connect', () => {
    console.log('[Redis] Connected');
    globalForRedis.redisConnected = true;
  });

  client.on('ready', () => {
    console.log('[Redis] Ready');
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Error:', err.message);
    globalForRedis.redisConnected = false;
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
    globalForRedis.redisConnected = false;
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  globalForRedis.redis = client;

  return client;
}

/**
 * Get Redis client (may be null if disabled)
 */
export const redis = createRedisClient();

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return globalForRedis.redisConnected || false;
}

/**
 * Connect to Redis (call on app startup)
 */
export async function connectRedis(): Promise<boolean> {
  if (!redis) {
    return false;
  }

  try {
    await redis.connect();
    return true;
  } catch (error) {
    console.error('[Redis] Connection failed:', error);
    return false;
  }
}

/**
 * Disconnect from Redis (call on app shutdown)
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!redis) {
    return { connected: false, latencyMs: 0, error: 'Redis not enabled' };
  }

  const start = Date.now();

  try {
    await redis.ping();
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// REDIS KEY PREFIXES
// =============================================================================

/**
 * Key prefixes for different data types
 */
export const RedisKeys = {
  // Rate limiting
  rateLimit: (name: string, identifier: string) => `rl:${name}:${identifier}`,
  rateLimitRps: (endpoint: string, identifier: string) => `rps:${endpoint}:${identifier}`,

  // Brute force protection
  bruteForce: (type: string, identifier: string) => `bf:${type}:${identifier}`,
  ipBlock: (ip: string) => `block:ip:${ip}`,

  // Sessions
  session: (sessionId: string) => `session:${sessionId}`,
  userSessions: (userId: string) => `user:sessions:${userId}`,

  // Token blacklist
  tokenBlacklist: (tokenHash: string) => `token:blacklist:${tokenHash}`,

  // Cache
  cache: (key: string) => `cache:${key}`,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Set a key with TTL (seconds)
 */
export async function setWithTTL(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.setex(key, ttlSeconds, value);
    return true;
  } catch (error) {
    console.error('[Redis] setWithTTL error:', error);
    return false;
  }
}

/**
 * Get a key
 */
export async function get(key: string): Promise<string | null> {
  if (!redis) return null;

  try {
    return await redis.get(key);
  } catch (error) {
    console.error('[Redis] get error:', error);
    return null;
  }
}

/**
 * Delete a key
 */
export async function del(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('[Redis] del error:', error);
    return false;
  }
}

/**
 * Increment a counter with TTL
 */
export async function incrWithTTL(
  key: string,
  ttlSeconds: number
): Promise<number | null> {
  if (!redis) return null;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    const results = await pipeline.exec();

    if (results && results[0] && results[0][1]) {
      return results[0][1] as number;
    }
    return null;
  } catch (error) {
    console.error('[Redis] incrWithTTL error:', error);
    return null;
  }
}

/**
 * Get TTL of a key
 */
export async function getTTL(key: string): Promise<number> {
  if (!redis) return -1;

  try {
    return await redis.ttl(key);
  } catch (error) {
    console.error('[Redis] getTTL error:', error);
    return -1;
  }
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    console.error('[Redis] exists error:', error);
    return false;
  }
}

/**
 * Delete keys matching a pattern
 */
export async function deletePattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    const result = await redis.del(...keys);
    return result;
  } catch (error) {
    console.error('[Redis] deletePattern error:', error);
    return 0;
  }
}
