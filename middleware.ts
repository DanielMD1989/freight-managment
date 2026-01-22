import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { generateRequestId } from "@/lib/errorHandler";
import {
  isIPBlocked,
  addSecurityHeaders,
  logSecurityEvent,
  verifyCSRFToken,
  getClientIP,
} from "@/lib/security";

// PHASE 3: Request logging (lightweight for Edge runtime)
const LOG_REQUESTS = process.env.LOG_REQUESTS !== 'false';

/**
 * Add timing headers and log response (PHASE 3)
 */
function addTimingHeaders(
  response: NextResponse,
  startTime: number,
  requestId: string,
  method: string,
  pathname: string,
  statusCode?: number
): NextResponse {
  const durationMs = Date.now() - startTime;
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', `${durationMs}ms`);
  response.headers.set('x-request-start', startTime.toString());

  // Log response in development
  if (LOG_REQUESTS && process.env.NODE_ENV === 'development') {
    const status = statusCode || response.status || 200;
    const logLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    console.log(`[${logLevel}] ${method} ${pathname} ${status} ${durationMs}ms - ${requestId}`);
  }

  return response;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-jwt-secret"
);

const publicPaths = ["/", "/login", "/register", "/api/auth/login", "/api/auth/register"];
const adminPaths = ["/admin"];
const opsPaths = ["/ops"];
// Sprint 2: Paths that require ACTIVE status
const marketplacePaths = ["/shipper", "/carrier", "/dashboard", "/dispatcher", "/api/loads", "/api/trucks", "/api/truck-postings"];
// Paths that don't require ACTIVE status (for pending users)
const pendingAllowedPaths = ["/profile", "/verification", "/api/user"];

// Routes exempt from CSRF protection
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-mfa', // MFA verification during login (pre-auth)
  '/api/cron/',
  '/api/webhooks/',
  '/api/tracking/ingest', // GPS data ingestion (machine-to-machine)
];

// State-changing HTTP methods that require CSRF protection
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Generate request ID for all requests (for error tracking and logging)
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Extract client IP for logging
  const clientIP = getClientIP(request.headers);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // PHASE 3: Log incoming request (debug level - only in development or when enabled)
  if (LOG_REQUESTS && process.env.NODE_ENV === 'development') {
    console.log(`[REQ] ${method} ${pathname} - ${requestId} - ${clientIP}`);
  }

  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });

    // Allow all origins for development
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie, x-client-type');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }

  // Add CORS headers to all responses
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-type',
  };

  // Sprint 9: IP Blocking Check
  if (isIPBlocked(clientIP)) {
    await logSecurityEvent({
      type: 'IP_BLOCKED',
      ip: clientIP,
      details: {
        path: pathname,
        method,
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    const response = NextResponse.json(
      { error: 'Access denied. Your IP address has been blocked.', requestId },
      { status: 403 }
    );
    addTimingHeaders(response, startTime, requestId, method, pathname, 403);
    return addSecurityHeaders(response);
  }

  // Sprint 9: CSRF Protection for API routes with state-changing methods
  // Requests with Authorization header (Bearer token) are exempt since they're not vulnerable to CSRF
  const authHeader = request.headers.get('authorization');
  const hasBearerToken = authHeader?.startsWith('Bearer ');

  if (pathname.startsWith('/api') && STATE_CHANGING_METHODS.includes(method) && !hasBearerToken) {
    const isExempt = CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));

    if (!isExempt) {
      const csrfToken = request.headers.get('x-csrf-token');
      const csrfCookie = request.cookies.get('csrf_token')?.value;

      if (!csrfToken || !csrfCookie || !verifyCSRFToken(csrfToken, csrfCookie)) {
        await logSecurityEvent({
          type: 'CSRF_FAILURE',
          ip: clientIP,
          details: {
            path: pathname,
            method,
            hasToken: !!csrfToken,
            hasCookie: !!csrfCookie,
          },
        });

        const response = NextResponse.json(
          { error: 'Invalid or missing CSRF token', requestId },
          { status: 403 }
        );
        addTimingHeaders(response, startTime, requestId, method, pathname, 403);
        return addSecurityHeaders(response);
      }
    }
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    addTimingHeaders(response, startTime, requestId, method, pathname);
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return addSecurityHeaders(response);
  }

  // Get session token from cookie or Authorization header
  let token = request.cookies.get("session")?.value;

  // For mobile clients, check Authorization header (authHeader already declared above)
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith('/api')) {
      const response = NextResponse.json(
        { error: 'Authentication required', requestId },
        { status: 401 }
      );
      addTimingHeaders(response, startTime, requestId, method, pathname, 401);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return addSecurityHeaders(response);
    }
    // Redirect to login for protected routes
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  try {
    // Verify token
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Check admin access (ADMIN or SUPER_ADMIN)
    if (adminPaths.some((path) => pathname.startsWith(path))) {
      if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Admin access required", requestId },
          { status: 403, headers: { 'x-request-id': requestId } }
        );
      }
    }

    // Check ops access (legacy - now uses ADMIN or SUPER_ADMIN)
    if (opsPaths.some((path) => pathname.startsWith(path))) {
      if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Ops access required", requestId },
          { status: 403, headers: { 'x-request-id': requestId } }
        );
      }
    }

    // Sprint 2: Check user status for marketplace access
    const isMarketplacePath = marketplacePaths.some((path) => pathname.startsWith(path));
    if (isMarketplacePath) {
      const userStatus = payload.status as string | undefined;

      // Only ACTIVE users can access marketplace features
      if (userStatus !== 'ACTIVE') {
        // ADMIN and SUPER_ADMIN bypass status check
        if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
          if (userStatus === 'REGISTERED' || userStatus === 'PENDING_VERIFICATION') {
            // Redirect to verification pending page
            const url = new URL("/verification-pending", request.url);
            return NextResponse.redirect(url);
          } else if (userStatus === 'SUSPENDED') {
            return NextResponse.json(
              { error: "Your account has been suspended. Please contact support.", requestId },
              { status: 403, headers: { 'x-request-id': requestId } }
            );
          } else if (userStatus === 'REJECTED') {
            return NextResponse.json(
              { error: "Your registration has been rejected. Please contact support.", requestId },
              { status: 403, headers: { 'x-request-id': requestId } }
            );
          }
        }
      }
    }

    const response = NextResponse.next();
    addTimingHeaders(response, startTime, requestId, method, pathname);
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return addSecurityHeaders(response);
  } catch (error) {
    // PHASE 3: Log token verification failures
    if (LOG_REQUESTS) {
      console.error(`[AUTH ERROR] Token verification failed for ${method} ${pathname} - ${requestId}:`, error);
    }

    // Clear invalid token and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session");
    addTimingHeaders(response, startTime, requestId, method, pathname, 302);
    return addSecurityHeaders(response);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
