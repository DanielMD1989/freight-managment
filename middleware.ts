/**
 * Next.js Middleware
 *
 * Handles:
 * - User verification status check (redirect non-ACTIVE users)
 * - Protected route access control
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Routes that require ACTIVE status to access
const PROTECTED_ROUTES = ["/carrier", "/shipper", "/dispatcher", "/admin"];

// Routes that pending users CAN access
const ALLOWED_ROUTES_FOR_PENDING = [
  "/verification-pending",
  "/profile",
  "/settings",
  "/api/user/verification-status",
  "/api/user/profile",
  "/api/documents",
  "/api/auth",
  "/api/csrf-token",
  "/login",
  "/register",
  "/forgot-password",
];

// Public routes (no auth required)
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/_next",
  "/favicon.ico",
  "/api/health",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes and static files
  if (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const sessionToken = request.cookies.get("session")?.value;

  // If no session, let the route handler deal with it
  if (!sessionToken) {
    return NextResponse.next();
  }

  try {
    // Verify the JWT token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "your-secret-key-min-32-chars-long!"
    );
    const { payload } = await jwtVerify(sessionToken, secret);

    const userStatus = payload.status as string | undefined;
    const userRole = payload.role as string | undefined;

    // If user is not ACTIVE and trying to access protected routes
    if (userStatus && userStatus !== "ACTIVE") {
      // Check if the current path is a protected route
      const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
        pathname.startsWith(route)
      );

      // Check if the current path is allowed for pending users
      const isAllowedForPending = ALLOWED_ROUTES_FOR_PENDING.some((route) =>
        pathname.startsWith(route)
      );

      // If trying to access protected route and NOT allowed for pending
      if (isProtectedRoute && !isAllowedForPending) {
        // Redirect to verification pending page
        const url = request.nextUrl.clone();
        url.pathname = "/verification-pending";
        return NextResponse.redirect(url);
      }
    }

    // If user IS active and trying to access verification-pending, redirect to their portal
    if (userStatus === "ACTIVE" && pathname === "/verification-pending") {
      const url = request.nextUrl.clone();
      if (userRole === "CARRIER") {
        url.pathname = "/carrier";
      } else if (userRole === "SHIPPER") {
        url.pathname = "/shipper";
      } else if (userRole === "DISPATCHER") {
        url.pathname = "/dispatcher";
      } else if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
        url.pathname = "/admin";
      } else {
        url.pathname = "/";
      }
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    // If token verification fails, let the route handler deal with it
    // (it will redirect to login if needed)
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
