import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { generateRequestId } from "@/lib/errorHandler";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate request ID for all requests (for error tracking and logging)
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);
    return response;
  }

  // Get session token
  const token = request.cookies.get("session")?.value;

  if (!token) {
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
    response.headers.set('x-request-id', requestId);
    return response;
  } catch (error) {
    console.error("Token verification failed:", error);

    // Clear invalid token and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session");
    response.headers.set('x-request-id', requestId);
    return response;
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
