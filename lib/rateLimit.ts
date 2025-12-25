/**
 * Rate Limiting Utility
 *
 * Sprint 9 - Story 9.5: Rate Limiting
 *
 * Implements sliding window rate limiting to prevent:
 * - API abuse
 * - DoS attacks
 * - Excessive resource usage
 *
 * IMPORTANT: This uses in-memory storage for MVP.
 * For production, replace with Redis or similar distributed cache.
 */

import { NextRequest, NextResponse } from 'next/server';

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
}

/**
 * Rate limit record
 */
interface RateLimitRecord {
  /** Array of request timestamps */
  requests: number[];
  /** First request timestamp in current window */
  resetTime: number;
}

/**
 * In-memory rate limit store
 * Key format: "limitName:identifier"
 * Value: RateLimitRecord
 *
 * TODO: Replace with Redis for production to support:
 * - Distributed rate limiting across multiple servers
 * - Persistent storage
 * - Automatic TTL/expiration
 */
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Cleanup old entries every 5 minutes to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    // Remove entries older than 24 hours
    if (now - record.resetTime > 24 * 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Check if request exceeds rate limit
 *
 * @param config Rate limit configuration
 * @param identifier Unique identifier (userId, orgId, IP, etc.)
 * @returns Object with rate limit status and headers
 */
export function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const key = `${config.name}:${identifier}`;
  const now = Date.now();

  // Get or create record
  let record = rateLimitStore.get(key);

  if (!record) {
    record = {
      requests: [],
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, record);
  }

  // Remove requests outside the current window (sliding window)
  const windowStart = now - config.windowMs;
  record.requests = record.requests.filter((timestamp) => timestamp > windowStart);

  // Update reset time if window has passed
  if (now > record.resetTime) {
    record.resetTime = now + config.windowMs;
  }

  // Check if limit exceeded
  const requestCount = record.requests.length;
  const allowed = requestCount < config.limit;

  if (allowed) {
    // Add current request
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

/**
 * Rate limit middleware wrapper
 *
 * @param config Rate limit configuration
 * @param handler API route handler
 * @param getUserId Function to extract user/org ID from request
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit<T>(
  config: RateLimitConfig,
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  getUserId: (request: NextRequest) => Promise<{ userId?: string; orgId?: string }>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // Get user/org identifier
      const { userId, orgId } = await getUserId(request);

      // Generate rate limit key
      const identifier = config.keyGenerator
        ? config.keyGenerator(request, userId, orgId)
        : userId || request.ip || 'anonymous';

      // Check rate limit
      const rateLimitResult = checkRateLimit(config, identifier);

      // Add rate limit headers
      const headers = {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
      };

      // If rate limit exceeded, return 429
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: config.message || 'Too many requests. Please try again later.',
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              ...headers,
              'Retry-After': rateLimitResult.retryAfter!.toString(),
            },
          }
        );
      }

      // Call original handler
      const response = await handler(request, ...args);

      // Add rate limit headers to successful response
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }

      return response;
    } catch (error) {
      // If rate limiting fails, allow request but log error
      console.error('[Rate Limit] Error:', error);
      return handler(request, ...args);
    }
  };
}

/**
 * Predefined rate limit configurations
 */

/**
 * Document upload rate limit: 10 uploads per hour per user
 */
export const RATE_LIMIT_DOCUMENT_UPLOAD: RateLimitConfig = {
  name: 'document_upload',
  limit: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Document upload limit exceeded. Maximum 10 uploads per hour.',
};

/**
 * Truck posting rate limit: 100 postings per day per carrier
 */
export const RATE_LIMIT_TRUCK_POSTING: RateLimitConfig = {
  name: 'truck_posting',
  limit: 100,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  keyGenerator: (req, userId, orgId) => orgId || userId || 'anonymous',
  message: 'Truck posting limit exceeded. Maximum 100 postings per day per carrier.',
};

/**
 * File download rate limit: 100 downloads per hour per user
 */
export const RATE_LIMIT_FILE_DOWNLOAD: RateLimitConfig = {
  name: 'file_download',
  limit: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'File download limit exceeded. Maximum 100 downloads per hour.',
};

/**
 * Load posting rate limit: 100 postings per day per shipper
 */
export const RATE_LIMIT_LOAD_POSTING: RateLimitConfig = {
  name: 'load_posting',
  limit: 100,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  keyGenerator: (req, userId, orgId) => orgId || userId || 'anonymous',
  message: 'Load posting limit exceeded. Maximum 100 postings per day per shipper.',
};

/**
 * API general rate limit: 1000 requests per hour per user
 */
export const RATE_LIMIT_API_GENERAL: RateLimitConfig = {
  name: 'api_general',
  limit: 1000,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'API rate limit exceeded. Maximum 1000 requests per hour.',
};

/**
 * Authentication rate limit: 5 login attempts per 15 minutes per IP
 */
export const RATE_LIMIT_AUTH: RateLimitConfig = {
  name: 'auth_attempt',
  limit: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (req) => req.ip || req.headers.get('x-forwarded-for') || 'anonymous',
  message: 'Too many login attempts. Please try again in 15 minutes.',
};

/**
 * Password reset rate limit: 3 attempts per hour per email
 */
export const RATE_LIMIT_PASSWORD_RESET: RateLimitConfig = {
  name: 'password_reset',
  limit: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many password reset attempts. Please try again later.',
};

/**
 * Helper: Get user session info for rate limiting
 */
export async function getRateLimitIdentifier(request: NextRequest): Promise<{
  userId?: string;
  orgId?: string;
}> {
  try {
    // Try to get from custom header (set by auth middleware)
    const userId = request.headers.get('x-user-id');
    const orgId = request.headers.get('x-org-id');

    if (userId) {
      return { userId, orgId: orgId || undefined };
    }

    // Fallback to IP
    return { userId: request.ip || 'anonymous' };
  } catch (error) {
    console.error('[Rate Limit] Error getting identifier:', error);
    return { userId: 'anonymous' };
  }
}

/**
 * Simple rate limit check without middleware wrapper
 * Useful for inline rate limiting
 */
export async function enforceRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<NextResponse | null> {
  const result = checkRateLimit(config, identifier);

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

  return null; // Allowed
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: {
    limit: number;
    remaining: number;
    resetTime: number;
  }
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
  return response;
}

/**
 * Clear rate limit for a specific identifier (admin function)
 * Useful for testing or manual overrides
 */
export function clearRateLimit(limitName: string, identifier: string): boolean {
  const key = `${limitName}:${identifier}`;
  return rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(limitName: string, identifier: string): {
  requests: number;
  limit: number;
  resetTime: number;
} | null {
  const key = `${limitName}:${identifier}`;
  const record = rateLimitStore.get(key);

  if (!record) {
    return null;
  }

  // Find the config (this is a simplified lookup)
  const configs = [
    RATE_LIMIT_DOCUMENT_UPLOAD,
    RATE_LIMIT_TRUCK_POSTING,
    RATE_LIMIT_FILE_DOWNLOAD,
    RATE_LIMIT_LOAD_POSTING,
    RATE_LIMIT_API_GENERAL,
    RATE_LIMIT_AUTH,
    RATE_LIMIT_PASSWORD_RESET,
  ];

  const config = configs.find((c) => c.name === limitName);

  if (!config) {
    return null;
  }

  return {
    requests: record.requests.length,
    limit: config.limit,
    resetTime: record.resetTime,
  };
}
