import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-jwt-secret"
);

const publicPaths = ["/", "/login", "/register", "/api/auth/login", "/api/auth/register"];
const adminPaths = ["/admin"];
const opsPaths = ["/ops"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
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

    // Check admin access
    if (adminPaths.some((path) => pathname.startsWith(path))) {
      if (payload.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 }
        );
      }
    }

    // Check ops access
    if (opsPaths.some((path) => pathname.startsWith(path))) {
      if (payload.role !== "PLATFORM_OPS" && payload.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Ops access required" },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Token verification failed:", error);

    // Clear invalid token and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session");
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
