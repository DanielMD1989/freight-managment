/**
 * Distributed Rate Limiting with Redis
 *
 * PHASE 4: Critical Architecture - Rate Limiting for 10K+ DAU
 *
 * Features:
 * - Redis-backed sliding window rate limiting
 * - Automatic fallback to in-memory when Redis unavailable
 * - IP + User + Device + Organization based limits
 * - RPS (requests per second) limiting for high-traffic endpoints
 * - Multi-key compound rate limiting
 *
 * Architecture:
 * ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 * │  Server 1   │  │  Server 2   │  │  Server N   │
 * │  Rate Check │  │  Rate Check │  │  Rate Check │
 * └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
 *        │                │                │
 *        └────────────────┼────────────────┘
 *                         │
 *                  ┌──────▼──────┐
 *                  │    Redis    │
 *                  │  Counters   │
 *                  └─────────────┘
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis, RedisKeys, isRedisEnabled } from './redis';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Unique identifier for this rate limit rule */
  name: string;
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom key generator (default: uses userId) */
  keyGenerator?: (request: NextRequest, userId?: string, orgId?: string) => string;
  /** Custom error message */
  message?: string;
  /** Enable multi-key limiting (IP + User + Org) */
  multiKey?: boolean;
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * RPS (Requests Per Second) configuration
 */
export interface RpsConfig {
  /** Endpoint pattern (e.g., '/api/loads') */
  endpoint: string;
  /** Maximum requests per second */
  rps: number;
  /** Burst allowance (extra requests allowed in short burst) */
  burst?: number;
}

// =============================================================================
// IN-MEMORY FALLBACK STORE
// =============================================================================

interface RateLimitRecord {
  requests: number[];
  resetTime: number;
}

const inMemoryStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of inMemoryStore.entries()) {
      if (now - record.resetTime > 24 * 60 * 60 * 1000) {
        inMemoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// =============================================================================
// REDIS-BASED RATE LIMITING
// =============================================================================

/**
 * Check rate limit using Redis (sliding window counter)
 */
async function checkRateLimitRedis(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const key = RedisKeys.rateLimit(config.name, identifier);
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  try {
    if (!redis) {
      throw new Error('Redis not available');
    }

    // Use Redis sorted set for sliding window
    const pipeline = redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    pipeline.zcard(key);

    // Add current request if within limit (we'll check after)
    pipeline.zadd(key, now, `${now}:${Math.random()}`);

    // Set TTL on the key
    pipeline.expire(key, windowSeconds + 1);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Pipeline execution failed');
    }

    // Get current count (before adding new request)
    const currentCount = (results[1]?.[1] as number) || 0;
    const allowed = currentCount < config.limit;

    // If not allowed, remove the request we just added
    if (!allowed) {
      await redis.zremrangebyscore(key, now, now + 1);
    }

    const resetTime = now + config.windowMs;

    return {
      allowed,
      limit: config.limit,
      remaining: Math.max(0, config.limit - currentCount - (allowed ? 1 : 0)),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000),
    };
  } catch (error) {
    console.error('[Rate Limit Redis] Error:', error);
    // Fallback to in-memory
    return checkRateLimitInMemory(config, identifier);
  }
}

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkRateLimitInMemory(
  config: RateLimitConfig,
  identifier: string
): RateLimitResult {
  const key = `${config.name}:${identifier}`;
  const now = Date.now();

  let record = inMemoryStore.get(key);

  if (!record) {
    record = {
      requests: [],
      resetTime: now + config.windowMs,
    };
    inMemoryStore.set(key, record);
  }

  // Sliding window: remove old requests
  const windowStart = now - config.windowMs;
  record.requests = record.requests.filter((ts) => ts > windowStart);

  if (now > record.resetTime) {
    record.resetTime = now + config.windowMs;
  }

  const requestCount = record.requests.length;
  const allowed = requestCount < config.limit;

  if (allowed) {
    record.requests.push(now);
  }

  return {
    allowed,
    limit: config.limit,
    remaining: Math.max(0, config.limit - requestCount - (allowed ? 1 : 0)),
    resetTime: record.resetTime,
    retryAfter: allowed ? undefined : Math.ceil((record.resetTime - now) / 1000),
  };
}

// =============================================================================
// =============================================================================

/**
 * Check RPS limit using Redis (token bucket algorithm)
 */
export async function checkRpsLimit(
  endpoint: string,
  identifier: string,
  rps: number,
  burst: number = 0
): Promise<RateLimitResult> {
  const key = RedisKeys.rateLimitRps(endpoint, identifier);
  const maxTokens = rps + burst;
  const now = Date.now();

  try {
    if (!redis) {
      throw new Error('Redis not available');
    }

    // Use a simple counter with 1-second TTL
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, 1);
    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Pipeline execution failed');
    }

    const currentCount = (results[0]?.[1] as number) || 0;
    const allowed = currentCount <= maxTokens;

    return {
      allowed,
      limit: maxTokens,
      remaining: Math.max(0, maxTokens - currentCount),
      resetTime: now + 1000,
      retryAfter: allowed ? undefined : 1,
    };
  } catch (error) {
    console.error('[RPS Limit] Error:', error);
    // Fallback: allow the request (fail open for availability)
    return {
      allowed: true,
      limit: maxTokens,
      remaining: maxTokens,
      resetTime: now + 1000,
    };
  }
}

// =============================================================================
// MULTI-KEY RATE LIMITING
// =============================================================================

/**
 * Extract multiple identifiers from request
 */
function extractIdentifiers(request: NextRequest, userId?: string, orgId?: string): {
  ip: string;
  userId: string;
  orgId: string;
  deviceId: string;
} {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const deviceId =
    request.headers.get('x-device-id') ||
    request.headers.get('user-agent')?.slice(0, 50) ||
    'unknown';

  return {
    ip,
    userId: userId || 'anonymous',
    orgId: orgId || 'none',
    deviceId,
  };
}

/**
 * Check rate limit across multiple keys (IP + User + Org)
 * All keys must be within limits for the request to be allowed
 */
async function checkMultiKeyRateLimit(
  config: RateLimitConfig,
  request: NextRequest,
  userId?: string,
  orgId?: string
): Promise<RateLimitResult> {
  const ids = extractIdentifiers(request, userId, orgId);

  // Check each key with appropriate limits
  const checks = await Promise.all([
    // IP-based limit (most restrictive for anonymous)
    checkRateLimit(
      { ...config, name: `${config.name}:ip`, limit: config.limit },
      ids.ip
    ),
    // User-based limit (if authenticated)
    userId
      ? checkRateLimit(
          { ...config, name: `${config.name}:user`, limit: config.limit * 2 },
          ids.userId
        )
      : null,
    // Org-based limit (shared across org members)
    orgId
      ? checkRateLimit(
          { ...config, name: `${config.name}:org`, limit: config.limit * 10 },
          ids.orgId
        )
      : null,
  ]);

  // Find the most restrictive result
  const results = checks.filter((r): r is RateLimitResult => r !== null);
  const blockedResult = results.find((r) => !r.allowed);

  if (blockedResult) {
    return blockedResult;
  }

  // Return the result with lowest remaining
  return results.reduce((min, curr) =>
    curr.remaining < min.remaining ? curr : min
  );
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Check rate limit (auto-selects Redis or in-memory)
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  if (isRedisEnabled() && redis) {
    return checkRateLimitRedis(config, identifier);
  }
  return checkRateLimitInMemory(config, identifier);
}

/**
 * Enforce rate limit and return error response if exceeded
 */
export async function enforceRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<NextResponse | null> {
  const result = await checkRateLimit(config, identifier);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: config.message || 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'Retry-After': result.retryAfter!.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit middleware wrapper
 */
export function withRateLimit<T>(
  config: RateLimitConfig,
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  getUserId: (request: NextRequest) => Promise<{ userId?: string; orgId?: string }>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // Check skip condition
      if (config.skip && config.skip(request)) {
        return handler(request, ...args);
      }

      const { userId, orgId } = await getUserId(request);

      let result: RateLimitResult;

      if (config.multiKey) {
        result = await checkMultiKeyRateLimit(config, request, userId, orgId);
      } else {
        const identifier = config.keyGenerator
          ? config.keyGenerator(request, userId, orgId)
          : userId ||
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'anonymous';

        result = await checkRateLimit(config, identifier);
      }

      // Rate limit headers
      const headers = {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      };

      if (!result.allowed) {
        return NextResponse.json(
          {
            error: config.message || 'Too many requests. Please try again later.',
            retryAfter: result.retryAfter,
          },
          {
            status: 429,
            headers: {
              ...headers,
              'Retry-After': result.retryAfter!.toString(),
            },
          }
        );
      }

      const response = await handler(request, ...args);

      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }

      return response;
    } catch (error) {
      console.error('[Rate Limit] Error:', error);
      return handler(request, ...args);
    }
  };
}

/**
 * RPS middleware for high-traffic endpoints
 */
export function withRpsLimit(
  rpsConfig: RpsConfig,
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const result = await checkRpsLimit(
      rpsConfig.endpoint,
      ip,
      rpsConfig.rps,
      rpsConfig.burst
    );

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please slow down.',
          retryAfter: 1,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'Retry-After': '1',
          },
        }
      );
    }

    return handler(request, ...args);
  };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
  return response;
}

/**
 * Clear rate limit for testing/admin purposes
 */
export async function clearRateLimit(
  limitName: string,
  identifier: string
): Promise<boolean> {
  const key = RedisKeys.rateLimit(limitName, identifier);

  if (isRedisEnabled() && redis) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('[Rate Limit] Clear error:', error);
    }
  }

  inMemoryStore.delete(`${limitName}:${identifier}`);
  return true;
}

/**
 * Get rate limit status for an identifier
 */
export async function getRateLimitStatus(
  config: RateLimitConfig,
  identifier: string
): Promise<{
  requests: number;
  limit: number;
  remaining: number;
  resetTime: number;
} | null> {
  const result = await checkRateLimit(
    { ...config, limit: config.limit + 1 }, // Don't consume a request
    identifier
  );

  return {
    requests: config.limit - result.remaining,
    limit: config.limit,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

// =============================================================================
// PREDEFINED RATE LIMIT CONFIGURATIONS
// =============================================================================

/**
 * Authentication rate limit: 5 attempts per 15 minutes per IP
 */
export const RATE_LIMIT_AUTH: RateLimitConfig = {
  name: 'auth',
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) =>
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown',
  message: 'Too many login attempts. Please try again in 15 minutes.',
};

/**
 * Password reset: 3 attempts per hour per email/IP
 */
export const RATE_LIMIT_PASSWORD_RESET: RateLimitConfig = {
  name: 'password_reset',
  limit: 3,
  windowMs: 60 * 60 * 1000,
  message: 'Too many password reset attempts. Please try again later.',
};

/**
 * API general: 1000 requests per hour per user
 */
export const RATE_LIMIT_API_GENERAL: RateLimitConfig = {
  name: 'api_general',
  limit: 1000,
  windowMs: 60 * 60 * 1000,
  multiKey: true,
  message: 'API rate limit exceeded. Maximum 1000 requests per hour.',
};

/**
 * Load posting: 100 per day per shipper
 */
export const RATE_LIMIT_LOAD_POSTING: RateLimitConfig = {
  name: 'load_posting',
  limit: 100,
  windowMs: 24 * 60 * 60 * 1000,
  keyGenerator: (req, userId, orgId) => orgId || userId || 'anonymous',
  message: 'Load posting limit exceeded. Maximum 100 postings per day.',
};

/**
 * Truck posting: 100 per day per carrier
 */
export const RATE_LIMIT_TRUCK_POSTING: RateLimitConfig = {
  name: 'truck_posting',
  limit: 100,
  windowMs: 24 * 60 * 60 * 1000,
  keyGenerator: (req, userId, orgId) => orgId || userId || 'anonymous',
  message: 'Truck posting limit exceeded. Maximum 100 postings per day.',
};

/**
 * Document upload: 10 per hour per user
 */
export const RATE_LIMIT_DOCUMENT_UPLOAD: RateLimitConfig = {
  name: 'document_upload',
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Document upload limit exceeded. Maximum 10 uploads per hour.',
};

/**
 * File download: 100 per hour per user
 */
export const RATE_LIMIT_FILE_DOWNLOAD: RateLimitConfig = {
  name: 'file_download',
  limit: 100,
  windowMs: 60 * 60 * 1000,
  message: 'File download limit exceeded. Maximum 100 downloads per hour.',
};

/**
 * GPS update: 12 per hour per truck (1 every 5 minutes)
 */
export const RATE_LIMIT_GPS_UPDATE: RateLimitConfig = {
  name: 'gps_update',
  limit: 12,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (req) => {
    const truckId = req.headers.get('x-truck-id') || 'unknown';
    return `truck:${truckId}`;
  },
  message: 'GPS update rate limited. Maximum 1 update per 5 minutes per truck.',
};

/**
 * Notifications: 60 per minute per user
 */
export const RATE_LIMIT_NOTIFICATIONS: RateLimitConfig = {
  name: 'notifications',
  limit: 60,
  windowMs: 60 * 1000,
  message: 'Notification fetch rate limited. Please slow down.',
};

/**
 * Search: 30 per minute per user (expensive queries)
 */
export const RATE_LIMIT_SEARCH: RateLimitConfig = {
  name: 'search',
  limit: 30,
  windowMs: 60 * 1000,
  multiKey: true,
  message: 'Search rate limited. Please slow down.',
};

// =============================================================================
// RPS CONFIGURATIONS FOR KEY ENDPOINTS
// =============================================================================

/**
 * RPS limits for high-traffic endpoints
 */
export const RPS_CONFIGS: Record<string, RpsConfig> = {
  // Health check - very high limit
  health: {
    endpoint: '/api/health',
    rps: 100,
    burst: 50,
  },
  // Loads listing - moderate limit
  loads: {
    endpoint: '/api/loads',
    rps: 50,
    burst: 20,
  },
  // Used for GET /api/loads, GET /api/loads/{id}, POST /api/loads, PATCH /api/loads/{id}
  marketplace: {
    endpoint: '/api/loads',
    rps: 50,
    burst: 20,
  },
  // Trucks listing - moderate limit
  trucks: {
    endpoint: '/api/trucks',
    rps: 50,
    burst: 20,
  },
  // Used for GET /api/trucks, GET /api/trucks/{id}, POST /api/trucks, PATCH /api/trucks/{id}, DELETE /api/trucks/{id}
  fleet: {
    endpoint: '/api/trucks',
    rps: 50,
    burst: 20,
  },
  // GPS updates - high throughput for fleet tracking
  gps: {
    endpoint: '/api/gps',
    rps: 100,
    burst: 20,
  },
  // Notifications - moderate limit
  notifications: {
    endpoint: '/api/notifications',
    rps: 30,
    burst: 10,
  },
  // Auth endpoints - strict limit
  auth: {
    endpoint: '/api/auth',
    rps: 10,
    burst: 5,
  },
  // Dashboard endpoints - moderate limit (60/min = 1/sec)
  dashboard: {
    endpoint: '/api/*/dashboard',
    rps: 1,
    burst: 5,
  },
  // Write operations (POST/PATCH/DELETE) - strict limit
  write: {
    endpoint: '/api/*',
    rps: 0.5, // 30 per minute = 0.5 per second
    burst: 5,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get user info for rate limiting from request
 */
export async function getRateLimitIdentifier(request: NextRequest): Promise<{
  userId?: string;
  orgId?: string;
}> {
  try {
    const userId = request.headers.get('x-user-id');
    const orgId = request.headers.get('x-org-id');

    if (userId) {
      return { userId, orgId: orgId || undefined };
    }

    return {
      userId:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'anonymous',
    };
  } catch (error) {
    console.error('[Rate Limit] Error getting identifier:', error);
    return { userId: 'anonymous' };
  }
}

/**
 * Get metrics about rate limiting (for monitoring)
 */
export async function getRateLimitMetrics(): Promise<{
  redisEnabled: boolean;
  redisConnected: boolean;
  inMemoryKeys: number;
}> {
  const { isRedisConnected } = await import('./redis');

  return {
    redisEnabled: isRedisEnabled(),
    redisConnected: isRedisConnected(),
    inMemoryKeys: inMemoryStore.size,
  };
}
