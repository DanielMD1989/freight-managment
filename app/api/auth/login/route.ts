import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  setSession,
  isLoginAllowed,
  createSessionRecord,
  generateOTP,
  hashPassword,
} from "@/lib/auth";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthFailure, logAuthSuccess } from "@/lib/auditLog";
import {
  addCorsHeaders as addSecureCorsHeaders,
  isOriginAllowed,
} from "@/lib/cors";
import { zodErrorResponse } from "@/lib/validation";

// Helper to add CORS headers to response (uses secure origin validation)
function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  return addSecureCorsHeaders(response, request);
}
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
import { sendMFAOTP, isAfroMessageConfigured } from "@/lib/sms/afromessage";
import { SignJWT } from "jose";

// MFA temporary token secret (for pre-auth tokens)
if (
  !process.env.MFA_TOKEN_SECRET &&
  !process.env.JWT_SECRET &&
  process.env.NODE_ENV === "production"
) {
  throw new Error("MFA_TOKEN_SECRET or JWT_SECRET must be set in production");
}
const MFA_TOKEN_SECRET = new TextEncoder().encode(
  process.env.MFA_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    "mfa-temp-token-secret-32chars!"
);

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

// Handle CORS preflight requests (uses secure origin validation)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });

  // Only set CORS headers if origin is in the allowed list
  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-client-type, x-csrf-token, Accept"
    );
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Extract client IP
    const clientIp = getClientIP(request.headers);

    // Check if IP is blocked
    if (await isIPBlocked(clientIp)) {
      await logSecurityEvent({
        type: "IP_BLOCKED",
        ip: clientIp,
        details: { endpoint: "/api/auth/login", email: validatedData.email },
      });

      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Access denied. Your IP address has been blocked.",
          },
          { status: 403 }
        ),
        request
      );
    }

    // Check brute force protection
    const bruteForceKey = `login:${validatedData.email}`;
    if (await isBlockedByBruteForce(bruteForceKey)) {
      const remainingTime = await getRemainingBlockTime(bruteForceKey);

      await logSecurityEvent({
        type: "BRUTE_FORCE",
        ip: clientIp,
        details: {
          endpoint: "/api/auth/login",
          email: validatedData.email,
          remainingBlockTime: remainingTime,
        },
      });

      return addCorsHeaders(
        NextResponse.json(
          {
            error: `Too many failed login attempts. Account temporarily locked. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
            retryAfter: remainingTime,
          },
          { status: 429 }
        ),
        request
      );
    }

    // Rate limiting: 5 login attempts per 15 minutes per email
    const rateLimitKey = `${validatedData.email}:${clientIp}`;
    const rateLimit = await checkRateLimit(
      {
        name: "login",
        limit: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        message: "Too many login attempts. Please try again later.",
      },
      rateLimitKey
    );

    if (!rateLimit.allowed) {
      await logAuthFailure(validatedData.email, "Rate limit exceeded", request);
      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Too many login attempts. Please try again later.",
            retryAfter: Math.ceil((rateLimit.retryAfter || 0) / 1000),
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": rateLimit.limit.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
              "Retry-After": Math.ceil(
                (rateLimit.retryAfter || 0) / 1000
              ).toString(),
            },
          }
        ),
        request
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
      await logAuthFailure(validatedData.email, "User not found", request);
      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Invalid email or password",
          },
          { status: 401 }
        ),
        request
      );
    }

    // Check user status using centralized function
    const loginCheck = isLoginAllowed(user.status);

    if (!loginCheck.allowed) {
      await logAuthFailure(
        validatedData.email,
        `Account status: ${user.status}`,
        request
      );
      return addCorsHeaders(
        NextResponse.json(
          {
            error:
              loginCheck.error || "Account inactive. Please contact support.",
          },
          { status: 403 }
        ),
        request
      );
    }

    // Legacy check (will be deprecated)
    if (!user.isActive) {
      await logAuthFailure(
        validatedData.email,
        "Account inactive (legacy)",
        request
      );
      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Account is inactive. Please contact support.",
          },
          { status: 403 }
        ),
        request
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
      const shouldBlock = await recordFailedAttempt(bruteForceKey);

      // Auto-block IP after 10 failed attempts from same IP
      const ipKey = `login:ip:${clientIp}`;
      const ipShouldBlock = await recordFailedAttempt(ipKey);

      if (ipShouldBlock) {
        // Permanently block IP after too many attempts
        await blockIP(
          clientIp,
          "Excessive failed login attempts",
          24 * 60 * 60 * 1000
        ); // 24 hours
      }

      await logAuthFailure(validatedData.email, "Invalid password", request);

      if (shouldBlock) {
        return addCorsHeaders(
          NextResponse.json(
            {
              error: "Too many failed attempts. Account temporarily locked.",
            },
            { status: 429 }
          ),
          request
        );
      }

      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Invalid email or password",
          },
          { status: 401 }
        ),
        request
      );
    }

    // Reset failed attempts on successful login
    await resetFailedAttempts(bruteForceKey);
    await resetFailedAttempts(`login:ip:${clientIp}`);

    // Check if user has MFA enabled
    const userMFA = await db.userMFA.findUnique({
      where: { userId: user.id },
      select: { enabled: true, phone: true },
    });

    if (userMFA?.enabled && userMFA.phone) {
      // MFA is enabled - send OTP and return mfaRequired response
      const otp = generateOTP();
      const hashedOTP = await hashPassword(otp);

      // Create temporary MFA token (valid for 5 minutes)
      const mfaToken = await new SignJWT({
        userId: user.id,
        email: user.email,
        purpose: "mfa_verification",
        otpHash: hashedOTP,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(MFA_TOKEN_SECRET);

      // Send OTP via SMS
      if (isAfroMessageConfigured()) {
        const result = await sendMFAOTP(userMFA.phone, otp);
        if (!result.success) {
          console.error("[Login MFA] Failed to send OTP:", result.error);
          // Still allow login if SMS fails - fallback to recovery codes
        }
      }
      // SECURITY: OTP is never logged - use SMS service for delivery

      return addCorsHeaders(
        NextResponse.json({
          mfaRequired: true,
          message: "Two-factor authentication required",
          mfaToken: mfaToken,
          phoneLastFour: userMFA.phone.slice(-4),
          expiresIn: 300, // 5 minutes
        }),
        request
      );
    }

    // No MFA - proceed with normal login

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create server-side session record for session management
    // PHASE 4: Pass user details for Redis caching
    const userAgent = request.headers.get("user-agent");
    const { sessionId } = await createSessionRecord(
      user.id,
      clientIp,
      userAgent,
      {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || undefined,
      }
    );

    // Create JWT session with sessionId for session validation
    // Also get the raw token for mobile clients
    const { createSessionToken } = await import("@/lib/auth");
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId || undefined,
      sessionId,
    });

    // Set the session cookie for web clients
    // PHASE 4: Include firstName/lastName for Redis caching
    await setSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status, // Sprint 2: Include status in session
      organizationId: user.organizationId || undefined,
      sessionId, // Sprint 19: Include sessionId for session management
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    });

    // Log successful login
    await logAuthSuccess(user.id, user.email, request);

    // Generate CSRF token for the session
    // We need to generate token first, then build response with it
    const { generateCSRFToken } = await import("@/lib/csrf");
    const csrfToken = generateCSRFToken();

    // Check if request is from mobile app (via header or user-agent)
    const isMobileClient =
      request.headers.get("x-client-type") === "mobile" ||
      request.headers.get("user-agent")?.includes("Dart") ||
      request.headers.get("user-agent")?.includes("Flutter");

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
        allowedActions: [
          "view_profile",
          "upload_documents",
          "complete_registration",
        ],
        restrictedMessage:
          "Your account is pending verification. Some features are restricted.",
      }),
      // Include session token for mobile clients (for Authorization header)
      ...(isMobileClient && { sessionToken }),
    });

    // Set CSRF cookie
    response.cookies.set("csrf_token", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Add CORS headers
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Login error:", error);
    console.error(
      "Login error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    if (error instanceof z.ZodError) {
      return addCorsHeaders(zodErrorResponse(error), request);
    }

    return addCorsHeaders(
      NextResponse.json(
        {
          error: "Internal server error",
          details:
            process.env.NODE_ENV !== "production" ? String(error) : undefined,
        },
        { status: 500 }
      ),
      request
    );
  }
}
