/**
 * Security Utilities
 * Sprint 9 - Security Hardening
 * Phase 4 - Scalability: Redis-backed security stores for horizontal scaling
 *
 * CSRF protection, XSS sanitization, and security headers
 * Note: Uses Web Crypto API for Edge Runtime compatibility
 *
 * CRITICAL FIX: Migrated brute force and IP blocking stores to Redis
 * for multi-instance deployment support.
 *
 * Edge Runtime Compatibility: The redis module now handles Edge Runtime
 * detection and provides stub implementations. This module can safely
 * import from redis.ts.
 */

import { NextResponse } from "next/server";
import {
  redis,
  isRedisEnabled,
  RedisKeys,
  setWithTTL,
  get,
  del,
} from "./redis";

/**
 * Generate CSRF token (Edge-compatible using Web Crypto API)
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Verify CSRF token (Edge-compatible constant-time comparison)
 */
export function verifyCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken || token.length !== expectedToken.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .replace(/[<>\"']/g, (char) => {
      const entities: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      };
      return entities[char] || char;
    })
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      (sanitized as Record<string, unknown>)[key] = sanitizeInput(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>
      );
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizeInput(item)
          : typeof item === "object" && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  return sanitized;
}

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateCSPNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Get allowed connect-src domains from environment
 * Format: comma-separated list (e.g., "https://api.example.com,wss://ws.example.com")
 */
function getConnectSrcDomains(): string {
  const domains = process.env.CSP_CONNECT_SRC || "";
  const baseDomains =
    "'self' https://maps.googleapis.com https://maps.google.com";

  if (domains) {
    return `${baseDomains} ${domains
      .split(",")
      .map((d) => d.trim())
      .join(" ")}`;
  }

  return baseDomains;
}

/**
 * Add security headers to response
 *
 * SECURITY FIX v4:
 * - Removed 'unsafe-inline' from script-src (use nonces instead)
 * - Removed 'unsafe-eval' from script-src
 * - Added 'strict-dynamic' for trusted script loading
 * - Improved connect-src with WebSocket support
 */
export function addSecurityHeaders(
  response: NextResponse,
  nonce?: string
): NextResponse {
  // Generate nonce if not provided
  const cspNonce = nonce || generateCSPNonce();

  // Build Content Security Policy
  // Note: 'strict-dynamic' allows scripts loaded by trusted scripts
  // In production, use nonces for inline scripts
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${cspNonce}' 'strict-dynamic' https://maps.googleapis.com`
      : `'self' 'nonce-${cspNonce}' https://maps.googleapis.com`; // Dev: no strict-dynamic for easier debugging

  // Style-src: Use nonce for inline styles in production
  const styleSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${cspNonce}' https://fonts.googleapis.com`
      : `'self' 'unsafe-inline' https://fonts.googleapis.com`; // Dev: allow inline for hot reload

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      `connect-src ${getConnectSrcDomains()}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  );

  // Set the nonce header for the app to use
  response.headers.set("X-CSP-Nonce", cspNonce);

  // XSS Protection (legacy, but still useful for older browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Content Type Options - Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Frame Options - Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Referrer Policy - Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy - Disable unnecessary features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(), usb=()"
  );

  // Strict Transport Security (HSTS) - Force HTTPS
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Cross-Origin policies for additional isolation
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return response;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Ethiopian format)
 */
export function isValidEthiopianPhone(phone: string): boolean {
  // Ethiopian phone: +251-XXX-XXX-XXX or 09XX-XXX-XXX
  const phoneRegex = /^(\+251|0)[79]\d{8}$/;
  const cleanPhone = phone.replace(/[-\s]/g, "");
  return phoneRegex.test(cleanPhone);
}

/**
 * Generate secure random string (Edge-compatible)
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Hash sensitive data (one-way, Edge-compatible)
 * Note: For Edge runtime, uses a simple hash. For server-side,
 * you may want to use bcrypt or argon2 for password hashing.
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Check if IP is in allowed list
 */
export function isIPAllowed(ip: string, allowedIPs: string[]): boolean {
  return allowedIPs.includes(ip) || allowedIPs.includes("*");
}

/**
 * Detect SQL injection patterns
 */
export function hasSQLInjectionPattern(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION.*SELECT)/i,
    /(--|\#|\/\*)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /(';|";)/,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Security event type mapping to database event types
 */
const SECURITY_EVENT_TYPE_MAP: Record<string, string> = {
  RATE_LIMIT: "SECURITY_RATE_LIMIT",
  SQL_INJECTION: "SECURITY_SQL_INJECTION",
  XSS_ATTEMPT: "SECURITY_XSS_ATTEMPT",
  UNAUTHORIZED_ACCESS: "SECURITY_UNAUTHORIZED_ACCESS",
  CSRF_FAILURE: "SECURITY_CSRF_FAILURE",
  BRUTE_FORCE: "SECURITY_BRUTE_FORCE",
  IP_BLOCKED: "SECURITY_IP_BLOCKED",
};

/**
 * Log security event
 * Stores in database for audit trail when userId is available
 */
export async function logSecurityEvent(event: {
  type:
    | "RATE_LIMIT"
    | "SQL_INJECTION"
    | "XSS_ATTEMPT"
    | "UNAUTHORIZED_ACCESS"
    | "CSRF_FAILURE"
    | "BRUTE_FORCE"
    | "IP_BLOCKED";
  ip: string;
  userAgent?: string;
  userId?: string;
  details?: Record<string, unknown>;
}) {
  const timestamp = new Date().toISOString();

  // Always log to console (for log aggregation services like DataDog, Sentry)
  console.warn("[SECURITY]", {
    timestamp,
    ...event,
  });

  // Store in database for audit trail when userId is available
  // SecurityEvent model requires a valid userId foreign key
  if (event.userId) {
    try {
      // Dynamic import to avoid circular dependencies
      const { db } = await import("./db");

      await db.securityEvent.create({
        data: {
          userId: event.userId,
          eventType: SECURITY_EVENT_TYPE_MAP[event.type] || event.type,
          ipAddress: event.ip,
          userAgent: event.userAgent || null,
          success: false, // Security events are typically failures/threats
          metadata: event.details
            ? JSON.parse(JSON.stringify(event.details))
            : undefined,
        },
      });
    } catch (error) {
      // Don't let audit trail failures break the application
      console.error("[SECURITY] Failed to store audit event:", error);
    }
  }
}

/**
 * Brute Force Protection
 * Track failed login attempts and block IPs after threshold
 *
 * PHASE 4: Redis-backed for horizontal scaling
 * Falls back to in-memory when Redis is unavailable
 */

interface BruteForceAttempt {
  count: number;
  firstAttempt: number; // Unix timestamp
  lastAttempt: number; // Unix timestamp
}

// In-memory fallback store (used when Redis unavailable)
const bruteForceStoreFallback = new Map<string, BruteForceAttempt>();

export interface BruteForceConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // How long to block after threshold
}

export const DEFAULT_BRUTE_FORCE_CONFIG: BruteForceConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Record a failed login attempt (Redis-backed)
 */
export async function recordFailedAttempt(
  identifier: string,
  config: BruteForceConfig = DEFAULT_BRUTE_FORCE_CONFIG
): Promise<boolean> {
  const now = Date.now();
  const key = RedisKeys.bruteForce("login", identifier);

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      const existingData = await get(key);
      let attempt: BruteForceAttempt;

      if (existingData) {
        attempt = JSON.parse(existingData);
        const timeSinceFirst = now - attempt.firstAttempt;

        // Reset if outside window
        if (timeSinceFirst > config.windowMs) {
          attempt = { count: 1, firstAttempt: now, lastAttempt: now };
        } else {
          attempt.count++;
          attempt.lastAttempt = now;
        }
      } else {
        attempt = { count: 1, firstAttempt: now, lastAttempt: now };
      }

      // Store with TTL equal to block duration
      const ttlSeconds = Math.ceil(config.blockDurationMs / 1000);
      await setWithTTL(key, JSON.stringify(attempt), ttlSeconds);

      return attempt.count >= config.maxAttempts;
    } catch (error) {
      console.error("[Security] Redis brute force error:", error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const existing = bruteForceStoreFallback.get(identifier);
  if (existing) {
    const timeSinceFirst = now - existing.firstAttempt;

    if (timeSinceFirst > config.windowMs) {
      bruteForceStoreFallback.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return false;
    }

    existing.count++;
    existing.lastAttempt = now;
    bruteForceStoreFallback.set(identifier, existing);
    return existing.count >= config.maxAttempts;
  } else {
    bruteForceStoreFallback.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return false;
  }
}

/**
 * Check if identifier is currently blocked due to brute force (Redis-backed)
 */
export async function isBlockedByBruteForce(
  identifier: string,
  config: BruteForceConfig = DEFAULT_BRUTE_FORCE_CONFIG
): Promise<boolean> {
  const now = Date.now();
  const key = RedisKeys.bruteForce("login", identifier);

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      const data = await get(key);
      if (!data) return false;

      const attempt: BruteForceAttempt = JSON.parse(data);
      const timeSinceLast = now - attempt.lastAttempt;

      if (
        attempt.count >= config.maxAttempts &&
        timeSinceLast < config.blockDurationMs
      ) {
        return true;
      }

      // Block period expired, clean up
      if (timeSinceLast >= config.blockDurationMs) {
        await del(key);
      }
      return false;
    } catch (error) {
      console.error("[Security] Redis brute force check error:", error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const attempt = bruteForceStoreFallback.get(identifier);
  if (!attempt) return false;

  const timeSinceLast = now - attempt.lastAttempt;

  if (
    attempt.count >= config.maxAttempts &&
    timeSinceLast < config.blockDurationMs
  ) {
    return true;
  }

  if (timeSinceLast >= config.blockDurationMs) {
    bruteForceStoreFallback.delete(identifier);
  }

  return false;
}

/**
 * Reset failed attempts for identifier (e.g., after successful login)
 */
export async function resetFailedAttempts(identifier: string): Promise<void> {
  const key = RedisKeys.bruteForce("login", identifier);

  if (isRedisEnabled() && redis) {
    try {
      await del(key);
    } catch (error) {
      console.error("[Security] Redis reset error:", error);
    }
  }

  bruteForceStoreFallback.delete(identifier);
}

/**
 * Get remaining block time in seconds (Redis-backed)
 */
export async function getRemainingBlockTime(
  identifier: string,
  config: BruteForceConfig = DEFAULT_BRUTE_FORCE_CONFIG
): Promise<number> {
  const now = Date.now();
  const key = RedisKeys.bruteForce("login", identifier);

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      const data = await get(key);
      if (!data) return 0;

      const attempt: BruteForceAttempt = JSON.parse(data);
      if (attempt.count < config.maxAttempts) return 0;

      const timeSinceLast = now - attempt.lastAttempt;
      const remainingMs = config.blockDurationMs - timeSinceLast;

      return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
    } catch (error) {
      console.error("[Security] Redis remaining time error:", error);
    }
  }

  // In-memory fallback
  const attempt = bruteForceStoreFallback.get(identifier);
  if (!attempt || attempt.count < config.maxAttempts) return 0;

  const timeSinceLast = now - attempt.lastAttempt;
  const remainingMs = config.blockDurationMs - timeSinceLast;

  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * IP Blocking System
 * Maintain a list of blocked IPs and check against it
 *
 * PHASE 4: Redis-backed for horizontal scaling
 * Falls back to in-memory when Redis is unavailable
 */

interface IPBlockEntry {
  ip: string;
  reason: string;
  blockedAt: number; // Unix timestamp
  expiresAt?: number; // Unix timestamp
}

// In-memory fallback store
const blockedIPsFallback = new Map<string, IPBlockEntry>();

/**
 * Block an IP address (Redis-backed)
 */
export async function blockIP(
  ip: string,
  reason: string,
  durationMs?: number
): Promise<void> {
  const now = Date.now();
  const entry: IPBlockEntry = {
    ip,
    reason,
    blockedAt: now,
    expiresAt: durationMs ? now + durationMs : undefined,
  };

  const key = RedisKeys.ipBlock(ip);

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      // If no duration, use a very long TTL (1 year)
      const ttlSeconds = durationMs
        ? Math.ceil(durationMs / 1000)
        : 365 * 24 * 60 * 60;
      await setWithTTL(key, JSON.stringify(entry), ttlSeconds);
    } catch (error) {
      console.error("[Security] Redis IP block error:", error);
    }
  }

  // Also store in fallback for single-instance scenarios
  blockedIPsFallback.set(ip, entry);

  logSecurityEvent({
    type: "IP_BLOCKED",
    ip,
    details: { reason, durationMs },
  });
}

/**
 * Check if IP is blocked (Redis-backed)
 */
export async function isIPBlocked(ip: string): Promise<boolean> {
  const key = RedisKeys.ipBlock(ip);
  const now = Date.now();

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      const data = await get(key);
      if (data) {
        const entry: IPBlockEntry = JSON.parse(data);

        // Check if temporary block has expired
        if (entry.expiresAt && now > entry.expiresAt) {
          await del(key);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error("[Security] Redis IP block check error:", error);
    }
  }

  // In-memory fallback
  const entry = blockedIPsFallback.get(ip);
  if (!entry) return false;

  if (entry.expiresAt && now > entry.expiresAt) {
    blockedIPsFallback.delete(ip);
    return false;
  }

  return true;
}

/**
 * Unblock an IP address (Redis-backed)
 */
export async function unblockIP(ip: string): Promise<boolean> {
  const key = RedisKeys.ipBlock(ip);
  let deleted = false;

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      await del(key);
      deleted = true;
    } catch (error) {
      console.error("[Security] Redis IP unblock error:", error);
    }
  }

  // Also remove from fallback
  const localDeleted = blockedIPsFallback.delete(ip);
  return deleted || localDeleted;
}

/**
 * Get list of blocked IPs (from fallback only - Redis doesn't support scanning in this implementation)
 * Note: This returns in-memory blocked IPs. For full list, query Redis directly.
 */
export function getBlockedIPs(): IPBlockEntry[] {
  const now = Date.now();
  const validEntries: IPBlockEntry[] = [];

  for (const [ip, entry] of blockedIPsFallback.entries()) {
    if (!entry.expiresAt || now <= entry.expiresAt) {
      validEntries.push(entry);
    } else {
      blockedIPsFallback.delete(ip);
    }
  }

  return validEntries;
}

/**
 * Get block details for an IP (Redis-backed)
 */
export async function getIPBlockDetails(
  ip: string
): Promise<IPBlockEntry | undefined> {
  const key = RedisKeys.ipBlock(ip);

  // Try Redis first
  if (isRedisEnabled() && redis) {
    try {
      const data = await get(key);
      if (data) {
        return JSON.parse(data) as IPBlockEntry;
      }
    } catch (error) {
      console.error("[Security] Redis IP block details error:", error);
    }
  }

  // In-memory fallback
  return blockedIPsFallback.get(ip);
}

/**
 * Clean up expired IP blocks (in-memory only - Redis handles TTL automatically)
 */
export function cleanupExpiredBlocks(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [ip, entry] of blockedIPsFallback.entries()) {
    if (entry.expiresAt && now > entry.expiresAt) {
      blockedIPsFallback.delete(ip);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Extract IP from request headers
 */
export function getClientIP(headers: Headers): string {
  // Try common proxy headers first
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to connection IP
  return headers.get("x-vercel-forwarded-for") || "unknown";
}
