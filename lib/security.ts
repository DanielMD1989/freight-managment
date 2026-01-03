/**
 * Security Utilities
 * Sprint 9 - Security Hardening
 *
 * CSRF protection, XSS sanitization, and security headers
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
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
 * Generate secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data (one-way)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
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
  type: 'RATE_LIMIT' | 'SQL_INJECTION' | 'XSS_ATTEMPT' | 'UNAUTHORIZED_ACCESS' | 'CSRF_FAILURE';
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
