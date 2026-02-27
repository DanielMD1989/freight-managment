/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Sprint 9 - Story 9.6: CSRF Protection
 *
 * Implements double-submit cookie pattern to protect against CSRF attacks.
 *
 * How it works:
 * 1. Server generates random CSRF token
 * 2. Token sent in both httpOnly cookie AND response body
 * 3. Client includes token in X-CSRF-Token header for mutations
 * 4. Server validates header token matches cookie token
 *
 * This prevents CSRF because:
 * - Attacker can't read the token (httpOnly cookie)
 * - Attacker can't set custom headers cross-domain (CORS)
 * - SameSite cookie attribute provides additional protection
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * CSRF token cookie name
 */
export const CSRF_COOKIE_NAME = "csrf_token";

/**
 * CSRF token header name
 */
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * CSRF token length in bytes (32 bytes = 256 bits)
 */
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 *
 * @returns Random token as hex string
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

/**
 * Set CSRF token cookie
 *
 * @param response NextResponse to set cookie on
 * @param token CSRF token value
 */
export function setCSRFCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Prevents CSRF while allowing normal navigation
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Get CSRF token from cookies
 *
 * @param request NextRequest to read cookie from
 * @returns CSRF token or null if not found
 */
export function getCSRFTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Get CSRF token from request header
 *
 * @param request NextRequest to read header from
 * @returns CSRF token or null if not found
 */
export function getCSRFTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME) || null;
}

/**
 * Validate CSRF token
 *
 * Compares token from header with token from cookie using timing-safe comparison.
 *
 * @param request NextRequest to validate
 * @returns true if valid, false otherwise
 */
export function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = getCSRFTokenFromCookie(request);
  const headerToken = getCSRFTokenFromHeader(request);

  // Both tokens must be present
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Tokens must match (timing-safe comparison)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch {
    // Tokens have different lengths, definitely not equal
    return false;
  }
}

/**
 * Require CSRF token validation
 *
 * Call this at the start of state-changing endpoints (POST, PATCH, DELETE).
 * Returns error response if validation fails, null if valid.
 *
 * @param request NextRequest to validate
 * @returns NextResponse with 403 error if invalid, null if valid
 */
export function requireCSRF(request: NextRequest): NextResponse | null {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  const method = request.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // Validate CSRF token
  if (!validateCSRFToken(request)) {
    return NextResponse.json(
      {
        error: "CSRF token validation failed",
        code: "CSRF_TOKEN_INVALID",
      },
      { status: 403 }
    );
  }

  return null; // Valid
}

/**
 * CSRF protection middleware wrapper
 *
 * Wraps an API route handler to automatically validate CSRF tokens.
 *
 * @param handler API route handler
 * @returns Wrapped handler with CSRF protection
 */
export function withCSRFProtection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler wrapper accepts any route arguments
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler wrapper accepts any route arguments
    ...args: any[]
  ): Promise<NextResponse> => {
    // Check CSRF token
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Call original handler
    return handler(request, ...args);
  };
}

/**
 * Generate and set CSRF token
 *
 * Helper function to generate token and set cookie in one call.
 * Use this in login/session endpoints.
 *
 * @param response NextResponse to set cookie on
 * @returns Generated CSRF token
 */
export function generateAndSetCSRFToken(response: NextResponse): string {
  const token = generateCSRFToken();
  setCSRFCookie(response, token);
  return token;
}

/**
 * Refresh CSRF token
 *
 * Generates a new token and sets it in the cookie.
 * Use this periodically or after sensitive operations.
 *
 * @param response NextResponse to set cookie on
 * @returns New CSRF token
 */
export function refreshCSRFToken(response: NextResponse): string {
  return generateAndSetCSRFToken(response);
}

/**
 * Clear CSRF token
 *
 * Removes CSRF token cookie.
 * Use this on logout.
 *
 * @param response NextResponse to clear cookie on
 */
export function clearCSRFToken(response: NextResponse): void {
  response.cookies.delete(CSRF_COOKIE_NAME);
}

/**
 * Check if CSRF token exists
 *
 * @param request NextRequest to check
 * @returns true if CSRF token cookie exists
 */
export function hasCSRFToken(request: NextRequest): boolean {
  return getCSRFTokenFromCookie(request) !== null;
}

/**
 * Get or create CSRF token
 *
 * Returns existing token from cookie, or generates new one if not found.
 * Useful for GET endpoints that need to provide token to client.
 *
 * @param request NextRequest to check for existing token
 * @returns CSRF token
 */
export async function getOrCreateCSRFToken(
  request: NextRequest
): Promise<string> {
  const existingToken = getCSRFTokenFromCookie(request);

  if (existingToken) {
    return existingToken;
  }

  // Generate new token
  return generateCSRFToken();
}

/**
 * CSRF protection configuration
 */
export interface CSRFConfig {
  /** Exempt paths (no CSRF check) */
  exemptPaths?: string[];
  /** Custom error message */
  errorMessage?: string;
  /** Custom error code */
  errorCode?: string;
}

/**
 * Create CSRF middleware with configuration
 *
 * @param config CSRF configuration
 * @returns Middleware function
 */
export function createCSRFMiddleware(config: CSRFConfig = {}) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler wrapper accepts any route arguments
    handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
  ) => {
    return async (
      request: NextRequest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler wrapper accepts any route arguments
      ...args: any[]
    ): Promise<NextResponse> => {
      const method = request.method;
      const pathname = new URL(request.url).pathname;

      // Skip CSRF check for safe methods
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return handler(request, ...args);
      }

      // Skip CSRF check for exempt paths
      if (config.exemptPaths?.some((path) => pathname.startsWith(path))) {
        return handler(request, ...args);
      }

      // Validate CSRF token
      if (!validateCSRFToken(request)) {
        return NextResponse.json(
          {
            error: config.errorMessage || "CSRF token validation failed",
            code: config.errorCode || "CSRF_TOKEN_INVALID",
          },
          { status: 403 }
        );
      }

      return handler(request, ...args);
    };
  };
}

/**
 * Validate CSRF with Mobile Client Bypass
 *
 * Consolidated helper for state-changing endpoints that handles:
 * - Mobile clients: MUST have Bearer token authentication
 * - Web clients: MUST have valid CSRF token
 *
 * Usage:
 * ```typescript
 * const csrfError = await validateCSRFWithMobile(request);
 * if (csrfError) return csrfError;
 * ```
 *
 * @param request NextRequest to validate
 * @returns NextResponse with error if invalid, null if valid
 */
export async function validateCSRFWithMobile(
  request: NextRequest
): Promise<NextResponse | null> {
  const isMobileClient = request.headers.get("x-client-type") === "mobile";
  const hasBearerAuth = request.headers
    .get("authorization")
    ?.startsWith("Bearer ");

  // Mobile clients MUST have Bearer authentication (inherently CSRF-safe)
  if (isMobileClient && !hasBearerAuth) {
    return NextResponse.json(
      { error: "Mobile clients require Bearer authentication" },
      { status: 401 }
    );
  }

  // Web clients (and mobile with Bearer) need CSRF check
  // Bearer auth is inherently CSRF-safe, so we can skip for those
  if (!isMobileClient && !hasBearerAuth) {
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }
  }

  return null; // Valid
}

/**
 * Inline CSRF validation
 *
 * Use this for inline CSRF checks within route handlers.
 *
 * @param request NextRequest to validate
 * @throws Error if CSRF validation fails
 */
export function assertCSRFValid(request: NextRequest): void {
  if (!validateCSRFToken(request)) {
    throw new Error("CSRF token validation failed");
  }
}
