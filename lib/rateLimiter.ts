/**
 * Rate Limiting Utility
 * Sprint 9 - Security Hardening
 *
 * Implements rate limiting to prevent abuse and DDoS attacks
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests allowed in window
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts
  },
  // API endpoints
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  // Public endpoints
  public: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  // Admin endpoints
  admin: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
} as const;

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

  // Include user agent for additional fingerprinting
  const userAgent = request.headers.get('user-agent') || '';

  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // No record or expired record
  if (!record || record.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  // Record exists and is still valid
  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(identifier, record);

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Rate limit middleware for API routes
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  const { allowed, remaining, resetTime } = checkRateLimit(identifier, config);

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Add rate limit headers to response
  return null; // Allow request to proceed
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  identifier: string,
  config: RateLimitConfig
): NextResponse {
  const { remaining, resetTime } = checkRateLimit(identifier, config);

  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetTime.toString());

  return response;
}

/**
 * Reset rate limit for a specific identifier (for testing)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status for identifier
 */
export function getRateLimitStatus(identifier: string, config: RateLimitConfig) {
  const record = rateLimitStore.get(identifier);
  const now = Date.now();

  if (!record || record.resetTime < now) {
    return {
      count: 0,
      remaining: config.maxRequests,
      resetTime: null,
    };
  }

  return {
    count: record.count,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}
