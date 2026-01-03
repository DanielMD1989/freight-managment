/**
 * Security Utilities
 * Sprint 9 - Security Hardening
 *
 * CSRF protection, XSS sanitization, and security headers
 * Note: Uses Web Crypto API for Edge Runtime compatibility
 */

import { NextResponse } from 'next/server';

/**
 * Generate CSRF token (Edge-compatible using Web Crypto API)
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>\"']/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return entities[char] || char;
    })
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeInput(value) as T[keyof T];
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeInput(item)
          : typeof item === 'object'
          ? sanitizeObject(item)
          : item
      ) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://maps.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Content Type Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Frame Options
  response.headers.set('X-Frame-Options', 'DENY');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)'
  );

  // Strict Transport Security (HSTS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

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
  const cleanPhone = phone.replace(/[-\s]/g, '');
  return phoneRegex.test(cleanPhone);
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate secure random string (Edge-compatible)
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash sensitive data (one-way, Edge-compatible)
 * Note: For Edge runtime, uses a simple hash. For server-side,
 * you may want to use bcrypt or argon2 for password hashing.
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if IP is in allowed list
 */
export function isIPAllowed(ip: string, allowedIPs: string[]): boolean {
  return allowedIPs.includes(ip) || allowedIPs.includes('*');
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
 * Log security event
 */
export async function logSecurityEvent(event: {
  type: 'RATE_LIMIT' | 'SQL_INJECTION' | 'XSS_ATTEMPT' | 'UNAUTHORIZED_ACCESS' | 'CSRF_FAILURE' | 'BRUTE_FORCE' | 'IP_BLOCKED';
  ip: string;
  userAgent?: string;
  userId?: string;
  details?: any;
}) {
  // In production, send to logging service (DataDog, Sentry, etc.)
  console.warn('[SECURITY]', {
    timestamp: new Date().toISOString(),
    ...event,
  });

  // TODO: Store in database for audit trail
  // await db.securityEvent.create({ data: event });
}

/**
 * Brute Force Protection
 * Track failed login attempts and block IPs after threshold
 */

interface BruteForceAttempt {
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
}

const bruteForceStore = new Map<string, BruteForceAttempt>();

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
 * Record a failed login attempt
 */
export function recordFailedAttempt(
  identifier: string,
  config: BruteForceConfig = DEFAULT_BRUTE_FORCE_CONFIG
): boolean {
  const now = new Date();
  const existing = bruteForceStore.get(identifier);

  if (existing) {
    const timeSinceFirst = now.getTime() - existing.firstAttempt.getTime();

    // Reset if outside window
    if (timeSinceFirst > config.windowMs) {
      bruteForceStore.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return false;
    }

    // Increment attempt count
    existing.count++;
    existing.lastAttempt = now;
    bruteForceStore.set(identifier, existing);

    // Check if threshold exceeded
    return existing.count >= config.maxAttempts;
  } else {
    // First attempt
    bruteForceStore.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return false;
  }
}

/**
 * Check if identifier is currently blocked due to brute force
 */
export function isBlockedByBruteForce(
  identifier: string,
  config: BruteForceConfig = DEFAULT_BRUTE_FORCE_CONFIG
): boolean {
  const attempt = bruteForceStore.get(identifier);
  if (!attempt) return false;

  const now = new Date();
  const timeSinceLast = now.getTime() - attempt.lastAttempt.getTime();

  // Check if still in block period
  if (attempt.count >= config.maxAttempts && timeSinceLast < config.blockDurationMs) {
    return true;
  }

  // Block period expired, clean up
  if (timeSinceLast >= config.blockDurationMs) {
    bruteForceStore.delete(identifier);
  }

  return false;
}

/**
 * Reset failed attempts for identifier (e.g., after successful login)
 */
export function resetFailedAttempts(identifier: string): void {
  bruteForceStore.delete(identifier);
}

/**
 * Get remaining block time in seconds
 */
export function getRemainingBlockTime(
  identifier: string,
  config: BruteForceConfig = DEFAULT_BRUTE_FORCE_CONFIG
): number {
  const attempt = bruteForceStore.get(identifier);
  if (!attempt || attempt.count < config.maxAttempts) return 0;

  const now = new Date();
  const timeSinceLast = now.getTime() - attempt.lastAttempt.getTime();
  const remainingMs = config.blockDurationMs - timeSinceLast;

  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * IP Blocking System
 * Maintain a list of blocked IPs and check against it
 */

interface IPBlockEntry {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
}

const blockedIPs = new Map<string, IPBlockEntry>();

/**
 * Block an IP address
 */
export function blockIP(
  ip: string,
  reason: string,
  durationMs?: number
): void {
  const now = new Date();
  const entry: IPBlockEntry = {
    ip,
    reason,
    blockedAt: now,
    expiresAt: durationMs ? new Date(now.getTime() + durationMs) : undefined,
  };

  blockedIPs.set(ip, entry);

  logSecurityEvent({
    type: 'IP_BLOCKED',
    ip,
    details: { reason, durationMs },
  });
}

/**
 * Check if IP is blocked
 */
export function isIPBlocked(ip: string): boolean {
  const entry = blockedIPs.get(ip);
  if (!entry) return false;

  // Check if temporary block has expired
  if (entry.expiresAt) {
    const now = new Date();
    if (now > entry.expiresAt) {
      blockedIPs.delete(ip);
      return false;
    }
  }

  return true;
}

/**
 * Unblock an IP address
 */
export function unblockIP(ip: string): boolean {
  return blockedIPs.delete(ip);
}

/**
 * Get list of blocked IPs
 */
export function getBlockedIPs(): IPBlockEntry[] {
  return Array.from(blockedIPs.values());
}

/**
 * Get block details for an IP
 */
export function getIPBlockDetails(ip: string): IPBlockEntry | undefined {
  return blockedIPs.get(ip);
}

/**
 * Clean up expired IP blocks
 */
export function cleanupExpiredBlocks(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [ip, entry] of blockedIPs.entries()) {
    if (entry.expiresAt && now > entry.expiresAt) {
      blockedIPs.delete(ip);
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
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to connection IP
  return headers.get('x-vercel-forwarded-for') || 'unknown';
}
