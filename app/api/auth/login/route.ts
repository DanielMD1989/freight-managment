import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSession, isLoginAllowed } from "@/lib/auth";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthFailure, logAuthSuccess } from "@/lib/auditLog";
// CSRF token generated inline - generateCSRFToken imported dynamically
import {
  getClientIP,
  isIPBlocked,
  isBlockedByBruteForce,
  recordFailedAttempt,
  resetFailedAttempts,
  getRemainingBlockTime,
  blockIP,
  logSecurityEvent,
} from "@/lib/security";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Extract client IP
    const clientIp = getClientIP(request.headers);

    // Check if IP is blocked
    if (isIPBlocked(clientIp)) {
      await logSecurityEvent({
        type: 'IP_BLOCKED',
        ip: clientIp,
        details: { endpoint: '/api/auth/login', email: validatedData.email },
      });

      return NextResponse.json(
        {
          error: 'Access denied. Your IP address has been blocked.',
        },
        { status: 403 }
      );
    }

    // Check brute force protection
    const bruteForceKey = `login:${validatedData.email}`;
    if (isBlockedByBruteForce(bruteForceKey)) {
      const remainingTime = getRemainingBlockTime(bruteForceKey);

      await logSecurityEvent({
        type: 'BRUTE_FORCE',
        ip: clientIp,
        details: {
          endpoint: '/api/auth/login',
          email: validatedData.email,
          remainingBlockTime: remainingTime,
        },
      });

      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
          retryAfter: remainingTime,
        },
        { status: 429 }
      );
    }

    // Rate limiting: 5 login attempts per 15 minutes per email
    const rateLimitKey = `${validatedData.email}:${clientIp}`;
    const rateLimit = checkRateLimit(
      {
        name: 'login',
        limit: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        message: 'Too many login attempts. Please try again later.',
      },
      rateLimitKey
    );

    if (!rateLimit.allowed) {
      await logAuthFailure(validatedData.email, 'Rate limit exceeded', request);
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimit.retryAfter || 0) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.retryAfter || 0) / 1000).toString(),
          },
        }
      );
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: {
        email: validatedData.email,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true, // Sprint 2: User verification workflow
        organizationId: true,
        isActive: true,
      },
    });

    if (!user) {
      await logAuthFailure(validatedData.email, 'User not found', request);
      return NextResponse.json(
        {
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // Check user status using centralized function
    const loginCheck = isLoginAllowed(user.status);

    if (!loginCheck.allowed) {
      await logAuthFailure(validatedData.email, `Account status: ${user.status}`, request);
      return NextResponse.json(
        {
          error: loginCheck.error || "Account inactive. Please contact support.",
        },
        { status: 403 }
      );
    }

    // Legacy check (will be deprecated)
    if (!user.isActive) {
      await logAuthFailure(validatedData.email, 'Account inactive (legacy)', request);
      return NextResponse.json(
        {
          error: "Account is inactive. Please contact support.",
        },
        { status: 403 }
      );
    }

    // Determine access level based on status
    const isLimitedAccess = loginCheck.limited;

    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      // Record failed login attempt for brute force protection
      const shouldBlock = recordFailedAttempt(bruteForceKey);

      // Auto-block IP after 10 failed attempts from same IP
      const ipKey = `login:ip:${clientIp}`;
      const ipShouldBlock = recordFailedAttempt(ipKey);

      if (ipShouldBlock) {
        // Permanently block IP after too many attempts
        blockIP(clientIp, 'Excessive failed login attempts', 24 * 60 * 60 * 1000); // 24 hours
      }

      await logAuthFailure(validatedData.email, 'Invalid password', request);

      if (shouldBlock) {
        return NextResponse.json(
          {
            error: "Too many failed attempts. Account temporarily locked.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // Reset failed attempts on successful login
    resetFailedAttempts(bruteForceKey);
    resetFailedAttempts(`login:ip:${clientIp}`);

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    await setSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status, // Sprint 2: Include status in session
      organizationId: user.organizationId || undefined,
    });

    // Log successful login
    await logAuthSuccess(user.id, user.email, request);

    // Generate CSRF token for the session
    // We need to generate token first, then build response with it
    const { generateCSRFToken } = await import('@/lib/csrf');
    const csrfToken = generateCSRFToken();

    const response = NextResponse.json({
      message: isLimitedAccess
        ? "Login successful. Please complete your registration."
        : "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
      },
      limitedAccess: isLimitedAccess,
      ...(isLimitedAccess && {
        allowedActions: ['view_profile', 'upload_documents', 'complete_registration'],
        restrictedMessage: 'Your account is pending verification. Some features are restricted.',
      }),
      csrfToken, // Include token for client-side caching
    });

    // Set CSRF cookie
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
