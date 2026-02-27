/**
 * Global Caching Layer
 *
 * PHASE 3: Critical Architecture - Caching for 10K+ DAU
 *
 * Features:
 * - Redis-backed distributed caching (production)
 * - In-memory LRU fallback (development/single-server)
 * - Automatic cache invalidation on writes
 * - Hit/miss monitoring with 70%+ target hit rate
 * - Domain-specific caching for common entities
 *
 * Cache Hierarchy:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      Application Layer                       │
 * │  Sessions │ Users │ RBAC │ Loads │ Trucks │ Trips │ Geodata │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *              ┌───────────────┴───────────────┐
 *              │                               │
 *       ┌──────▼──────┐                 ┌──────▼──────┐
 *       │    Redis    │                 │  In-Memory  │
 *       │ (Production)│                 │  (Fallback) │
 *       └─────────────┘                 └─────────────┘
 *
 * TTL Strategy:
 * - Sessions: 24h (long-lived, user-bound)
 * - User profiles: 5min (frequently updated)
 * - Permissions: 10min (RBAC changes rare)
 * - Load/Truck lists: 30s (high churn, needs freshness)
 * - Individual loads/trucks: 2min (balance freshness/performance)
 * - Geodata: 24h (rarely changes)
 * - Active trips: 1min (real-time updates)
 */

import { redis, isRedisEnabled } from "./redis";

// =============================================================================
// CACHE METRICS & MONITORING
// =============================================================================

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  lastReset: number;
}

const metrics: Record<string, CacheMetrics> = {};

function getOrCreateMetrics(namespace: string): CacheMetrics {
  if (!metrics[namespace]) {
    metrics[namespace] = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      lastReset: Date.now(),
    };
  }
  return metrics[namespace];
}

function recordHit(namespace: string): void {
  getOrCreateMetrics(namespace).hits++;
}

function recordMiss(namespace: string): void {
  getOrCreateMetrics(namespace).misses++;
}

function recordSet(namespace: string): void {
  getOrCreateMetrics(namespace).sets++;
}

function recordDelete(namespace: string): void {
  getOrCreateMetrics(namespace).deletes++;
}

/**
 * Get cache metrics for monitoring
 */
export function getCacheMetrics(): {
  overall: { hitRate: number; totalHits: number; totalMisses: number };
  byNamespace: Record<
    string,
    { hitRate: number; hits: number; misses: number }
  >;
} {
  let totalHits = 0;
  let totalMisses = 0;
  const byNamespace: Record<
    string,
    { hitRate: number; hits: number; misses: number }
  > = {};

  for (const [ns, m] of Object.entries(metrics)) {
    totalHits += m.hits;
    totalMisses += m.misses;
    const total = m.hits + m.misses;
    byNamespace[ns] = {
      hitRate: total > 0 ? Math.round((m.hits / total) * 100) : 0,
      hits: m.hits,
      misses: m.misses,
    };
  }

  const total = totalHits + totalMisses;
  return {
    overall: {
      hitRate: total > 0 ? Math.round((totalHits / total) * 100) : 0,
      totalHits,
      totalMisses,
    },
    byNamespace,
  };
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
  for (const key of Object.keys(metrics)) {
    delete metrics[key];
  }
}

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
  /** Maximum number of items in cache (for LRU, default: 5000) */
  maxSize?: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

// =============================================================================
// LRU CACHE IMPLEMENTATION (In-Memory Fallback)
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
  accessedAt: number;
}

class LRUCache implements CacheAdapter {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 5000;
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
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
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

    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return allKeys.filter((key) => regex.test(key));
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

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// =============================================================================
// REDIS CACHE IMPLEMENTATION
// =============================================================================

class RedisCache implements CacheAdapter {
  private defaultTtl: number;
  private keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.defaultTtl = options.defaultTtlSeconds || 300;
    this.keyPrefix = options.keyPrefix || "cache:";
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;

    try {
      const data = await redis.get(this.prefixKey(key));
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error("[Cache Redis] get error:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!redis) return;

    try {
      const ttl = ttlSeconds ?? this.defaultTtl;
      const data = JSON.stringify(value);

      if (ttl > 0) {
        await redis.setex(this.prefixKey(key), ttl, data);
      } else {
        await redis.set(this.prefixKey(key), data);
      }
    } catch (error) {
      console.error("[Cache Redis] set error:", error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const result = await redis.del(this.prefixKey(key));
      return result > 0;
    } catch (error) {
      console.error("[Cache Redis] delete error:", error);
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!redis) return 0;

    try {
      const keys = await redis.keys(this.prefixKey(pattern));
      if (keys.length === 0) return 0;
      return await redis.del(...keys);
    } catch (error) {
      console.error("[Cache Redis] deletePattern error:", error);
      return 0;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const exists = await redis.exists(this.prefixKey(key));
      return exists > 0;
    } catch (error) {
      console.error("[Cache Redis] has error:", error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!redis) return;

    try {
      const keys = await redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error("[Cache Redis] clear error:", error);
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    if (!redis) return [];

    try {
      const searchPattern = pattern
        ? this.prefixKey(pattern)
        : `${this.keyPrefix}*`;
      return await redis.keys(searchPattern);
    } catch (error) {
      console.error("[Cache Redis] keys error:", error);
      return [];
    }
  }
}

// =============================================================================
// CACHE INSTANCE (Auto-select Redis or In-Memory)
// =============================================================================

const inMemoryCache = new LRUCache({
  maxSize: 5000,
  defaultTtlSeconds: 300,
});

const redisCache = new RedisCache({
  defaultTtlSeconds: 300,
  keyPrefix: "cache:",
});

/**
 * Get the appropriate cache adapter based on Redis availability
 */
function getCacheAdapter(): CacheAdapter {
  if (isRedisEnabled() && redis) {
    return redisCache;
  }
  return inMemoryCache;
}

/**
 * Global cache instance (auto-selects Redis or in-memory)
 */
export const cache: CacheAdapter = {
  async get<T>(key: string): Promise<T | null> {
    const namespace = key.split(":")[0] || "default";
    const adapter = getCacheAdapter();
    const result = await adapter.get<T>(key);

    if (result !== null) {
      recordHit(namespace);
    } else {
      recordMiss(namespace);
    }

    return result;
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const namespace = key.split(":")[0] || "default";
    const adapter = getCacheAdapter();
    await adapter.set(key, value, ttlSeconds);
    recordSet(namespace);
  },

  async delete(key: string): Promise<boolean> {
    const namespace = key.split(":")[0] || "default";
    const adapter = getCacheAdapter();
    const result = await adapter.delete(key);
    recordDelete(namespace);
    return result;
  },

  async deletePattern(pattern: string): Promise<number> {
    const adapter = getCacheAdapter();
    return adapter.deletePattern(pattern);
  },

  async has(key: string): Promise<boolean> {
    const adapter = getCacheAdapter();
    return adapter.has(key);
  },

  async clear(): Promise<void> {
    const adapter = getCacheAdapter();
    return adapter.clear();
  },

  async keys(pattern?: string): Promise<string[]> {
    const adapter = getCacheAdapter();
    return adapter.keys(pattern);
  },
};

// =============================================================================
// TTL CONSTANTS (Optimized for 70%+ hit rate)
// =============================================================================

export const CacheTTL = {
  /** Sessions: 24 hours - long-lived, user-bound */
  SESSION: 24 * 60 * 60,
  /** User profiles: 5 minutes - frequently updated */
  USER_PROFILE: 5 * 60,
  /** Permissions/RBAC: 10 minutes - rarely changes */
  PERMISSIONS: 10 * 60,
  /** Load/Truck listings: 30 seconds - high churn */
  LISTINGS: 30,
  /** Individual load/truck: 2 minutes - balance freshness */
  ENTITY: 2 * 60,
  /** Geodata/distances: 24 hours - static data */
  GEODATA: 24 * 60 * 60,
  /** Active trips: 1 minute - real-time updates */
  ACTIVE_TRIP: 60,
  /** Corridors: 1 hour - semi-static */
  CORRIDOR: 60 * 60,
  /** Locations: 24 hours - static reference data */
  LOCATIONS: 24 * 60 * 60,
} as const;

// =============================================================================
// CACHE KEYS
// =============================================================================

export const CacheKeys = {
  // Session cache keys
  session: (sessionId: string) => `session:${sessionId}`,
  userSessions: (userId: string) => `session:user:${userId}`,

  // User cache keys
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userPermissions: (userId: string) => `permissions:user:${userId}`,

  // Organization cache keys
  organization: (id: string) => `org:${id}`,
  orgPermissions: (orgId: string) => `permissions:org:${orgId}`,

  // Load cache keys
  load: (id: string) => `load:${id}`,
  loadList: (filters: string) => `loads:list:${filters}`,
  loadsByStatus: (status: string) => `loads:status:${status}`,
  loadsByShipper: (shipperId: string) => `loads:shipper:${shipperId}`,
  loadsByOrg: (orgId: string) => `loads:org:${orgId}`,

  // Truck cache keys
  truck: (id: string) => `truck:${id}`,
  truckList: (filters: string) => `trucks:list:${filters}`,
  truckPostings: (carrierId: string) => `trucks:postings:${carrierId}`,
  trucksByOrg: (orgId: string) => `trucks:org:${orgId}`,

  // Trip cache keys
  trip: (id: string) => `trip:${id}`,
  tripsByCarrier: (carrierId: string) => `trips:carrier:${carrierId}`,
  tripsByShipper: (shipperId: string) => `trips:shipper:${shipperId}`,
  activeTrips: () => "trips:active",
  activeTripsByOrg: (orgId: string) => `trips:active:org:${orgId}`,

  // Geodata cache keys
  locations: () => "geodata:locations",
  location: (id: string) => `geodata:location:${id}`,
  distance: (originId: string, destId: string) =>
    `geodata:distance:${originId}:${destId}`,
  corridor: (originId: string, destId: string) =>
    `geodata:corridor:${originId}:${destId}`,
  corridors: () => "geodata:corridors",
  route: (originId: string, destId: string) =>
    `geodata:route:${originId}:${destId}`,
};

// =============================================================================
// CACHE HELPERS
// =============================================================================

/**
 * Cache-aside pattern: Try cache first, fallback to fetcher
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

/**
 * Memoize an async function with caching
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    ttlSeconds?: number;
    keyPrefix?: string;
    keyGenerator?: (...args: TArgs) => string;
  } = {}
): (...args: TArgs) => Promise<TResult> {
  const { ttlSeconds = 60, keyPrefix = "memo", keyGenerator } = options;

  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator
      ? `${keyPrefix}:${keyGenerator(...args)}`
      : `${keyPrefix}:${JSON.stringify(args)}`;

    const cached = await cache.get<TResult>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    await cache.set(key, result, ttlSeconds);

    return result;
  };
}

// =============================================================================
// CACHE INVALIDATION
// =============================================================================

/**
 * Invalidate cache for a specific entity
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
 */
export async function invalidateEntityType(entityType: string): Promise<void> {
  await cache.deletePattern(`${entityType}:*`);
}

/**
 * Invalidation helpers for specific entity types
 */
export const CacheInvalidation = {
  /** Invalidate user and their related caches */
  async user(userId: string): Promise<void> {
    await Promise.all([
      cache.deletePattern(`user:${userId}*`),
      cache.deletePattern(`permissions:user:${userId}*`),
      cache.deletePattern(`session:user:${userId}*`),
    ]);
  },

  /** Invalidate organization and related caches */
  async organization(orgId: string): Promise<void> {
    await Promise.all([
      cache.deletePattern(`org:${orgId}*`),
      cache.deletePattern(`permissions:org:${orgId}*`),
      cache.deletePattern(`loads:org:${orgId}*`),
      cache.deletePattern(`trucks:org:${orgId}*`),
      cache.deletePattern(`trips:*:org:${orgId}*`),
    ]);
  },

  /** Invalidate load and listing caches */
  async load(
    loadId: string,
    shipperId?: string,
    orgId?: string
  ): Promise<void> {
    const promises = [
      cache.delete(CacheKeys.load(loadId)),
      cache.deletePattern("loads:list:*"),
      cache.deletePattern("loads:status:*"),
    ];
    if (shipperId) {
      promises.push(cache.delete(CacheKeys.loadsByShipper(shipperId)));
    }
    if (orgId) {
      promises.push(cache.delete(CacheKeys.loadsByOrg(orgId)));
    }
    await Promise.all(promises);
  },

  /** Invalidate truck and posting caches - P1-001 FIX: Also invalidate matching caches */
  async truck(
    truckId: string,
    carrierId?: string,
    orgId?: string
  ): Promise<void> {
    const promises = [
      cache.delete(CacheKeys.truck(truckId)),
      cache.deletePattern("trucks:list:*"),
      // P1-001 FIX: Invalidate matching caches to ensure new trucks are visible immediately
      cache.deletePattern("matching:*"),
      cache.deletePattern("truck-postings:*"),
    ];
    if (carrierId) {
      promises.push(cache.delete(CacheKeys.truckPostings(carrierId)));
    }
    if (orgId) {
      promises.push(cache.delete(CacheKeys.trucksByOrg(orgId)));
    }
    await Promise.all(promises);
  },

  /** Invalidate trip caches */
  async trip(
    tripId: string,
    carrierId?: string,
    shipperId?: string,
    orgId?: string
  ): Promise<void> {
    const promises = [
      cache.delete(CacheKeys.trip(tripId)),
      cache.delete(CacheKeys.activeTrips()),
    ];
    if (carrierId) {
      promises.push(cache.delete(CacheKeys.tripsByCarrier(carrierId)));
    }
    if (shipperId) {
      promises.push(cache.delete(CacheKeys.tripsByShipper(shipperId)));
    }
    if (orgId) {
      promises.push(cache.delete(CacheKeys.activeTripsByOrg(orgId)));
    }
    await Promise.all(promises);
  },

  /** Invalidate session cache */
  async session(sessionId: string, userId?: string): Promise<void> {
    const promises = [cache.delete(CacheKeys.session(sessionId))];
    if (userId) {
      promises.push(cache.delete(CacheKeys.userSessions(userId)));
    }
    await Promise.all(promises);
  },

  /** Invalidate all listing caches (after bulk operations) */
  async allListings(): Promise<void> {
    await Promise.all([
      cache.deletePattern("loads:list:*"),
      cache.deletePattern("loads:status:*"),
      cache.deletePattern("trucks:list:*"),
      cache.deletePattern("trips:active*"),
    ]);
  },
};

// =============================================================================
// DOMAIN-SPECIFIC CACHING FUNCTIONS
// =============================================================================

/**
 * Session caching
 */
export const SessionCache = {
  async get(sessionId: string): Promise<{
    userId: string;
    email: string;
    role: string;
    organizationId?: string;
  } | null> {
    return cache.get(CacheKeys.session(sessionId));
  },

  async set(
    sessionId: string,
    session: {
      userId: string;
      email: string;
      role: string;
      organizationId?: string;
    }
  ): Promise<void> {
    await cache.set(CacheKeys.session(sessionId), session, CacheTTL.SESSION);
  },

  async delete(sessionId: string): Promise<void> {
    await cache.delete(CacheKeys.session(sessionId));
  },
};

/**
 * User profile caching
 */
export const UserCache = {
  async get(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    organizationId?: string;
  } | null> {
    return cache.get(CacheKeys.user(userId));
  },

  async set(
    userId: string,
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      status: string;
      organizationId?: string;
    }
  ): Promise<void> {
    await cache.set(CacheKeys.user(userId), user, CacheTTL.USER_PROFILE);
  },

  async getByEmail(email: string): Promise<{ id: string } | null> {
    return cache.get(CacheKeys.userByEmail(email));
  },

  async setByEmail(email: string, user: { id: string }): Promise<void> {
    await cache.set(CacheKeys.userByEmail(email), user, CacheTTL.USER_PROFILE);
  },

  async invalidate(userId: string): Promise<void> {
    await CacheInvalidation.user(userId);
  },
};

/**
 * Permissions (RBAC) caching
 */
export const PermissionsCache = {
  async get(userId: string): Promise<{
    role: string;
    permissions: string[];
    organizationId?: string;
    organizationType?: string;
  } | null> {
    return cache.get(CacheKeys.userPermissions(userId));
  },

  async set(
    userId: string,
    permissions: {
      role: string;
      permissions: string[];
      organizationId?: string;
      organizationType?: string;
    }
  ): Promise<void> {
    await cache.set(
      CacheKeys.userPermissions(userId),
      permissions,
      CacheTTL.PERMISSIONS
    );
  },

  async invalidate(userId: string): Promise<void> {
    await cache.delete(CacheKeys.userPermissions(userId));
  },
};

/**
 * Load list caching
 */
export const LoadCache = {
  async getById(loadId: string): Promise<unknown | null> {
    return cache.get(CacheKeys.load(loadId));
  },

  async setById(loadId: string, load: unknown): Promise<void> {
    await cache.set(CacheKeys.load(loadId), load, CacheTTL.ENTITY);
  },

  async getList(filters: Record<string, unknown>): Promise<unknown[] | null> {
    const filterKey = JSON.stringify(filters);
    return cache.get(CacheKeys.loadList(filterKey));
  },

  async setList(
    filters: Record<string, unknown>,
    loads: unknown[]
  ): Promise<void> {
    const filterKey = JSON.stringify(filters);
    await cache.set(CacheKeys.loadList(filterKey), loads, CacheTTL.LISTINGS);
  },

  async invalidate(
    loadId: string,
    shipperId?: string,
    orgId?: string
  ): Promise<void> {
    await CacheInvalidation.load(loadId, shipperId, orgId);
  },
};

/**
 * Truck list caching
 */
export const TruckCache = {
  async getById(truckId: string): Promise<unknown | null> {
    return cache.get(CacheKeys.truck(truckId));
  },

  async setById(truckId: string, truck: unknown): Promise<void> {
    await cache.set(CacheKeys.truck(truckId), truck, CacheTTL.ENTITY);
  },

  async getList(filters: Record<string, unknown>): Promise<unknown[] | null> {
    const filterKey = JSON.stringify(filters);
    return cache.get(CacheKeys.truckList(filterKey));
  },

  async setList(
    filters: Record<string, unknown>,
    trucks: unknown[]
  ): Promise<void> {
    const filterKey = JSON.stringify(filters);
    await cache.set(CacheKeys.truckList(filterKey), trucks, CacheTTL.LISTINGS);
  },

  async invalidate(
    truckId: string,
    carrierId?: string,
    orgId?: string
  ): Promise<void> {
    await CacheInvalidation.truck(truckId, carrierId, orgId);
  },
};

/**
 * Trip caching
 */
export const TripCache = {
  async getById(tripId: string): Promise<unknown | null> {
    return cache.get(CacheKeys.trip(tripId));
  },

  async setById(tripId: string, trip: unknown): Promise<void> {
    await cache.set(CacheKeys.trip(tripId), trip, CacheTTL.ACTIVE_TRIP);
  },

  async getActiveTrips(): Promise<unknown[] | null> {
    return cache.get(CacheKeys.activeTrips());
  },

  async setActiveTrips(trips: unknown[]): Promise<void> {
    await cache.set(CacheKeys.activeTrips(), trips, CacheTTL.ACTIVE_TRIP);
  },

  async getByOrg(orgId: string): Promise<unknown[] | null> {
    return cache.get(CacheKeys.activeTripsByOrg(orgId));
  },

  async setByOrg(orgId: string, trips: unknown[]): Promise<void> {
    await cache.set(
      CacheKeys.activeTripsByOrg(orgId),
      trips,
      CacheTTL.ACTIVE_TRIP
    );
  },

  async invalidate(
    tripId: string,
    carrierId?: string,
    shipperId?: string,
    orgId?: string
  ): Promise<void> {
    await CacheInvalidation.trip(tripId, carrierId, shipperId, orgId);
  },
};

/**
 * Geodata caching (distances, locations, corridors)
 */
export const GeoCache = {
  async getLocations(): Promise<unknown[] | null> {
    return cache.get(CacheKeys.locations());
  },

  async setLocations(locations: unknown[]): Promise<void> {
    await cache.set(CacheKeys.locations(), locations, CacheTTL.LOCATIONS);
  },

  async getDistance(
    originId: string,
    destId: string
  ): Promise<{ distanceKm: number; durationMinutes?: number } | null> {
    return cache.get(CacheKeys.distance(originId, destId));
  },

  async setDistance(
    originId: string,
    destId: string,
    data: { distanceKm: number; durationMinutes?: number }
  ): Promise<void> {
    await cache.set(
      CacheKeys.distance(originId, destId),
      data,
      CacheTTL.GEODATA
    );
  },

  async getCorridor(originId: string, destId: string): Promise<unknown | null> {
    return cache.get(CacheKeys.corridor(originId, destId));
  },

  async setCorridor(
    originId: string,
    destId: string,
    corridor: unknown
  ): Promise<void> {
    await cache.set(
      CacheKeys.corridor(originId, destId),
      corridor,
      CacheTTL.CORRIDOR
    );
  },

  async getAllCorridors(): Promise<unknown[] | null> {
    return cache.get(CacheKeys.corridors());
  },

  async setAllCorridors(corridors: unknown[]): Promise<void> {
    await cache.set(CacheKeys.corridors(), corridors, CacheTTL.CORRIDOR);
  },

  async getRoute(originId: string, destId: string): Promise<unknown | null> {
    return cache.get(CacheKeys.route(originId, destId));
  },

  async setRoute(
    originId: string,
    destId: string,
    route: unknown
  ): Promise<void> {
    await cache.set(CacheKeys.route(originId, destId), route, CacheTTL.GEODATA);
  },
};

// =============================================================================
// CACHE STATISTICS
// =============================================================================

/**
 * Get comprehensive cache statistics for monitoring
 */
export function getCacheStats(): {
  adapter: "redis" | "memory";
  metrics: ReturnType<typeof getCacheMetrics>;
  memoryStats?: { size: number; maxSize: number };
} {
  const isUsingRedis = isRedisEnabled() && redis;

  return {
    adapter: isUsingRedis ? "redis" : "memory",
    metrics: getCacheMetrics(),
    memoryStats: !isUsingRedis ? inMemoryCache.getStats() : undefined,
  };
}

// =============================================================================
// CACHE WARMING
// =============================================================================

/**
 * Warm cache with frequently accessed data
 * Call this on application startup or periodically
 */
export async function warmCache(fetchers: {
  locations?: () => Promise<unknown[]>;
  corridors?: () => Promise<unknown[]>;
}): Promise<void> {
  const promises: Promise<void>[] = [];

  if (fetchers.locations) {
    promises.push(
      fetchers.locations().then(async (locations) => {
        await GeoCache.setLocations(locations);
      })
    );
  }

  if (fetchers.corridors) {
    promises.push(
      fetchers.corridors().then(async (corridors) => {
        await GeoCache.setAllCorridors(corridors);
      })
    );
  }

  await Promise.all(promises);
}
