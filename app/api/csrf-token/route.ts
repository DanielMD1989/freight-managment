/**
 * CSRF Token API
 *
 * GET /api/csrf-token
 *
 * Provides CSRF tokens for authenticated clients.
 *
 * The client should:
 * 1. Call this endpoint to get a CSRF token
 * 2. Include the token in X-CSRF-Token header for state-changing requests
 * 3. The token cookie will be automatically included by the browser
 *
 * Security:
 * - Requires authentication
 * - Returns existing token if present, generates new one if not
 * - Token stored in httpOnly cookie (cannot be read by JavaScript)
 * - Token also returned in response body (for header inclusion)
 *
 * Sprint 9 - Story 9.6: CSRF Protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getCSRFTokenFromCookie,
  CSRF_COOKIE_NAME,
} from '@/lib/csrf';

/**
 * GET /api/csrf-token
 *
 * Get or generate a CSRF token.
 *
 * Returns:
 * {
 *   csrfToken: string,
 *   expiresIn: number (seconds until expiry)
 * }
 *
 * Also sets csrf_token cookie (httpOnly, sameSite: lax)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();

    // Check if token already exists in cookie
    const existingToken = getCSRFTokenFromCookie(request);

    if (existingToken) {
      // Return existing token with approximate expiry
      // We don't know exact expiry, so estimate 23 hours remaining
      return NextResponse.json({
        csrfToken: existingToken,
        expiresIn: 23 * 60 * 60, // 23 hours in seconds
        fresh: false,
      });
    }

    // Generate new token
    const { generateCSRFToken } = await import('@/lib/csrf');
    const newToken = generateCSRFToken();

    // Create response with the token
    const response = NextResponse.json({
      csrfToken: newToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
      fresh: true,
    });

    // Set the CSRF cookie
    response.cookies.set(CSRF_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error('Error generating CSRF token:', error);

    // Check if it's an auth error
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
