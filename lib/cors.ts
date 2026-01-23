import { NextRequest, NextResponse } from "next/server";

/**
 * CORS Configuration - Security Fix v4
 *
 * This module provides secure CORS handling with origin whitelisting.
 * Configure allowed origins via ALLOWED_ORIGINS environment variable.
 */

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

// Allowed origins for CORS requests
// Configure via ALLOWED_ORIGINS env var (comma-separated)
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

/**
 * Check if an origin is allowed for CORS
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // In development, allow localhost origins
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }

  return ALLOWED_ORIGINS.has(origin);
}

/**
 * Get list of allowed origins (for WebSocket server)
 */
export function getAllowedOrigins(): string[] {
  const origins = Array.from(ALLOWED_ORIGINS);

  // In development, add localhost patterns
  if (process.env.NODE_ENV === 'development') {
    // These are handled dynamically by isOriginAllowed
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return [...new Set(origins)]; // Dedupe
}

/**
 * Add CORS headers to a response for allowed origins only
 */
export function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');

  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, x-client-type');
  }

  return response;
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonWithCors(
  data: unknown,
  request: NextRequest,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(data, init);
  return addCorsHeaders(response, request);
}

/**
 * Handle OPTIONS preflight request
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse | null {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin');
    const response = new NextResponse(null, { status: 204 });

    if (origin && isOriginAllowed(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, x-client-type');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    return response;
  }
  return null;
}
