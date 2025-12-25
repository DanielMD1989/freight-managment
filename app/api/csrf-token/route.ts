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
  generateAndSetCSRFToken,
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
 *   csrfToken: string
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

    const response = NextResponse.json({
      csrfToken: existingToken || '',
    });

    // If no existing token, generate and set new one
    if (!existingToken) {
      const newToken = generateAndSetCSRFToken(response);
      return NextResponse.json({
        csrfToken: newToken,
      }, {
        headers: response.headers,
      });
    }

    // Return existing token
    return NextResponse.json({
      csrfToken: existingToken,
    });
  } catch (error: any) {
    console.error('Error generating CSRF token:', error);

    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
