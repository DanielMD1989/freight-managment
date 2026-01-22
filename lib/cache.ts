/**
 * Caching Layer
 *
 * PHASE 4: Performance Optimization
 *
 * Provides a unified caching interface with:
 * - In-memory LRU cache for development/single-server deployments
 * - Redis-compatible interface for production (swap adapter when ready)
 * - TTL support
 * - Cache invalidation patterns
 * - Memoization helpers
 *
 * Usage:
 * ```typescript
 * import { cache, memoize } from '@/lib/cache';
 *
 * // Simple get/set
 * await cache.set('user:123', userData, 300); // 5 min TTL
 * const user = await cache.get('user:123');
 *
 * // Memoize expensive functions
 * const getCachedUser = memoize(
 *   (id: string) => db.user.findUnique({ where: { id } }),
 *   { ttlSeconds: 60, keyPrefix: 'user' }
 * );
 * ```
 */

// =============================================================================
// CACHE INTERFACE
// =============================================================================

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  deletePattern(pattern: string): Promise<number>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export interface CacheOptions {
  /** Default TTL in seconds (default: 300 = 5 minutes) */
  defaultTtlSeconds?: number;
  /** Maximum number of items in cache (for LRU, default: 1000) */
  maxSize?: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

// =============================================================================
// LRU CACHE IMPLEMENTATION (In-Memory)
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
  accessedAt: number;
}

/**
 * Simple LRU (Least Recently Used) cache implementation
 * Suitable for development and single-server deployments
 */
class LRUCache implements CacheAdapter {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.defaultTtlSeconds || 300;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttl = ttlSeconds ?? this.defaultTtl;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
      accessedAt: Date.now(),
    };

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Also evict expired entries
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return;
      }

      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /** Get cache statistics */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// =============================================================================
// REDIS ADAPTER (Placeholder for production)
// =============================================================================

/**
 * Redis cache adapter placeholder
 *
 * To enable Redis:
 * 1. Install: npm install ioredis
 * 2. Set REDIS_URL environment variable
 * 3. Uncomment and configure this adapter
 */
/*
import Redis from 'ioredis';

class RedisCache implements CacheAdapter {
  private client: Redis;
  private defaultTtl: number;
  private keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.defaultTtl = options.defaultTtlSeconds || 300;
    this.keyPrefix = options.keyPrefix || 'freight:';
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(this.prefixKey(key));
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const data = JSON.stringify(value);

    if (ttl > 0) {
      await this.client.setex(this.prefixKey(key), ttl, data);
    } else {
      await this.client.set(this.prefixKey(key), data);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(this.prefixKey(key));
    return result > 0;
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(this.prefixKey(pattern));
    if (keys.length === 0) return 0;
    return await this.client.del(...keys);
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(this.prefixKey(key));
    return exists > 0;
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.keyPrefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    const searchPattern = pattern
      ? this.prefixKey(pattern)
      : `${this.keyPrefix}*`;
    return await this.client.keys(searchPattern);
  }
}
*/

// =============================================================================
// CACHE INSTANCE
// =============================================================================

/**
 * Global cache instance
 *
 * Uses in-memory LRU cache by default.
 * To switch to Redis, uncomment RedisCache and update this line.
 */
export const cache: CacheAdapter = new LRUCache({
  maxSize: 2000,
  defaultTtlSeconds: 300, // 5 minutes default
});

// =============================================================================
// MEMOIZATION HELPERS
// =============================================================================

export interface MemoizeOptions {
  /** TTL in seconds (default: 60) */
  ttlSeconds?: number;
  /** Key prefix for cache keys */
  keyPrefix?: string;
  /** Custom key generator */
  keyGenerator?: (...args: any[]) => string;
}

/**
 * Memoize an async function with caching
 *
 * @param fn The async function to memoize
 * @param options Memoization options
 * @returns Memoized function
 *
 * @example
 * ```typescript
 * const getCachedUser = memoize(
 *   (id: string) => db.user.findUnique({ where: { id } }),
 *   { ttlSeconds: 60, keyPrefix: 'user' }
 * );
 * ```
 */
export function memoize<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: MemoizeOptions = {}
): (...args: TArgs) => Promise<TResult> {
  const { ttlSeconds = 60, keyPrefix = 'memo', keyGenerator } = options;

  return async (...args: TArgs): Promise<TResult> => {
    // Generate cache key
    const key = keyGenerator
      ? `${keyPrefix}:${keyGenerator(...args)}`
      : `${keyPrefix}:${JSON.stringify(args)}`;

    // Try to get from cache
    const cached = await cache.get<TResult>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(key, result, ttlSeconds);

    return result;
  };
}

/**
 * Cache-aside pattern helper
 *
 * Tries cache first, falls back to fetcher, caches result
 *
 * @param key Cache key
 * @param fetcher Function to fetch data if not in cache
 * @param ttlSeconds TTL for cached data
 * @returns Cached or freshly fetched data
 *
 * @example
 * ```typescript
 * const user = await cacheAside(
 *   `user:${userId}`,
 *   () => db.user.findUnique({ where: { id: userId } }),
 *   300
 * );
 * ```
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const result = await fetcher();
  if (result !== null && result !== undefined) {
    await cache.set(key, result, ttlSeconds);
  }

  return result;
}

// =============================================================================
// CACHE INVALIDATION HELPERS
// =============================================================================

/**
 * Invalidate cache entries for an entity
 *
 * @param entityType Entity type (e.g., 'user', 'load', 'truck')
 * @param entityId Entity ID
 *
 * @example
 * ```typescript
 * // After updating a user
 * await invalidateEntity('user', userId);
 * ```
 */
export async function invalidateEntity(
  entityType: string,
  entityId: string
): Promise<void> {
  await cache.deletePattern(`${entityType}:${entityId}*`);
  await cache.deletePattern(`*:${entityType}:${entityId}*`);
}

/**
 * Invalidate all cache entries for an entity type
 *
 * @param entityType Entity type (e.g., 'user', 'load', 'truck')
 *
 * @example
 * ```typescript
 * // After bulk update
 * await invalidateEntityType('load');
 * ```
 */
export async function invalidateEntityType(entityType: string): Promise<void> {
  await cache.deletePattern(`${entityType}:*`);
}

// =============================================================================
// PREDEFINED CACHE KEYS
// =============================================================================

/**
 * Cache key generators for common entities
 */
export const CacheKeys = {
  // User cache keys
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userSession: (sessionId: string) => `session:${sessionId}`,

  // Organization cache keys
  organization: (id: string) => `org:${id}`,
  organizationTrucks: (orgId: string) => `org:${orgId}:trucks`,

  // Load cache keys
  load: (id: string) => `load:${id}`,
  loadsByStatus: (status: string) => `loads:status:${status}`,
  loadsByShipper: (shipperId: string) => `loads:shipper:${shipperId}`,

  // Truck cache keys
  truck: (id: string) => `truck:${id}`,
  truckPostings: (carrierId: string) => `truck-postings:carrier:${carrierId}`,

  // Trip cache keys
  trip: (id: string) => `trip:${id}`,
  tripsByCarrier: (carrierId: string) => `trips:carrier:${carrierId}`,

  // Location cache keys
  locations: () => 'ethiopian-locations:all',
  location: (id: string) => `location:${id}`,

  // Distance cache keys
  distance: (origin: string, dest: string) => `distance:${origin}:${dest}`,

  // Corridor cache keys
  corridor: (origin: string, dest: string) => `corridor:${origin}:${dest}`,
  corridors: () => 'corridors:all',
};

// =============================================================================
// CACHE STATISTICS (for monitoring)
// =============================================================================

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number } {
  if (cache instanceof LRUCache) {
    return (cache as any).getStats();
  }
  return { size: 0, maxSize: 0 };
}

// =============================================================================
// CLEANUP
// =============================================================================

// Periodic cleanup of expired entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(async () => {
    if (cache instanceof LRUCache) {
      // LRU cache handles expiration on access
      // This is just a placeholder for any additional cleanup
    }
  }, 5 * 60 * 1000);
}
