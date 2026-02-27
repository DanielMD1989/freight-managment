/**
 * Test Utilities for Security Testing
 *
 * Sprint 9 - Story 9.10: Security Testing & QA
 *
 * Provides utilities for testing authentication, authorization,
 * CSRF protection, rate limiting, and other security features.
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

/**
 * Create a mock NextRequest object
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
}): NextRequest {
  const {
    method = "GET",
    url = "http://localhost:3000",
    headers = {},
    body,
    cookies = {},
  } = options;

  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  // Add cookies
  Object.entries(cookies).forEach(([name, value]) => {
    request.cookies.set(name, value);
  });

  return request;
}

/**
 * Generate a test JWT token
 */
export async function generateTestJWT(payload: {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "test-secret"
  );

  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return token;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(data: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "CARRIER" | "SHIPPER";
  organizationId?: string;
}) {
  const hashedPassword = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash: hashedPassword,
      firstName: data.name,
      role: data.role,
      organizationId: data.organizationId || null,
      isEmailVerified: true,
    },
  });

  return user;
}

/**
 * Create a test organization
 */
export async function createTestOrganization(data: {
  name: string;
  type:
    | "SHIPPER"
    | "CARRIER_COMPANY"
    | "CARRIER_INDIVIDUAL"
    | "CARRIER_ASSOCIATION"
    | "FLEET_OWNER"
    | "LOGISTICS_AGENT";
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const org = await db.organization.create({
    data: {
      name: data.name,
      type: data.type,
      contactEmail: `${data.name.toLowerCase().replace(/\s+/g, "-")}@test.com`,
      contactPhone: "+251900000000",
    },
  });

  return org;
}

/**
 * Clean up test data
 */
export async function cleanupTestData() {
  // Delete in correct order to respect foreign key constraints
  await db.auditLog.deleteMany({});
  await db.companyDocument.deleteMany({});
  await db.truckDocument.deleteMany({});
  await db.truck.deleteMany({});
  await db.load.deleteMany({});
  await db.user.deleteMany({});
  await db.organization.deleteMany({});
}

/**
 * Create an authenticated request with JWT token
 */
export async function createAuthenticatedRequest(options: {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  method?: string;
  url?: string;
  body?: any;
  csrfToken?: string;
}): Promise<NextRequest> {
  const token = await generateTestJWT({
    userId: options.userId,
    email: options.email,
    role: options.role,
    organizationId: options.organizationId,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (options.csrfToken) {
    headers["X-CSRF-Token"] = options.csrfToken;
  }

  return createMockRequest({
    method: options.method || "GET",
    url: options.url || "http://localhost:3000",
    headers,
    body: options.body,
    cookies: options.csrfToken ? { "csrf-token": options.csrfToken } : {},
  });
}

/**
 * Test security headers in response
 */
export function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
}

/**
 * Test for SQL injection vulnerability
 */
export const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1' UNION SELECT * FROM users--",
  "admin'--",
  "' OR 1=1--",
];

/**
 * Test for XSS vulnerability
 */
export const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<svg onload=alert("XSS")>',
  '"><script>alert("XSS")</script>',
];

/**
 * Test for path traversal vulnerability
 */
export const PATH_TRAVERSAL_PAYLOADS = [
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "....//....//....//etc/passwd",
  "..%2F..%2F..%2Fetc%2Fpasswd",
];

/**
 * Create a rate limit test scenario
 */
export async function testRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  limit: number,
  windowMs: number
): Promise<{
  successCount: number;
  rateLimitedCount: number;
  passed: boolean;
}> {
  let successCount = 0;
  let rateLimitedCount = 0;

  // Make requests up to limit + 5
  for (let i = 0; i < limit + 5; i++) {
    const request = createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/test",
      headers: { "X-Forwarded-For": "192.168.1.100" },
    });

    const response = await handler(request);

    if (response.status === 429) {
      rateLimitedCount++;
    } else if (response.ok) {
      successCount++;
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return {
    successCount,
    rateLimitedCount,
    passed: successCount <= limit && rateLimitedCount > 0,
  };
}

/**
 * Test CSRF protection
 */
export async function testCSRFProtection(
  handler: (req: NextRequest) => Promise<Response>
): Promise<{
  withTokenPassed: boolean;
  withoutTokenFailed: boolean;
  mismatchedTokenFailed: boolean;
}> {
  const csrfToken = "test-csrf-token-123";

  // Test 1: Request with valid CSRF token
  const validRequest = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/test",
    headers: { "X-CSRF-Token": csrfToken },
    cookies: { "csrf-token": csrfToken },
  });
  const validResponse = await handler(validRequest);

  // Test 2: Request without CSRF token
  const noTokenRequest = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/test",
  });
  const noTokenResponse = await handler(noTokenRequest);

  // Test 3: Request with mismatched CSRF token
  const mismatchedRequest = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/test",
    headers: { "X-CSRF-Token": "wrong-token" },
    cookies: { "csrf-token": csrfToken },
  });
  const mismatchedResponse = await handler(mismatchedRequest);

  return {
    withTokenPassed: validResponse.ok,
    withoutTokenFailed: noTokenResponse.status === 403,
    mismatchedTokenFailed: mismatchedResponse.status === 403,
  };
}

/**
 * Expect error response with sanitized message
 */
export function expectSanitizedError(response: Response, expectedCode: string) {
  expect(response.ok).toBe(false);

  // Error message should not contain:
  // - File paths
  // - SQL queries
  // - Database details
  // - Stack traces
  const body = response.json();

  return body.then((data) => {
    expect(data.code).toBe(expectedCode);
    expect(data.error).toBeDefined();
    expect(data.error).not.toMatch(/\/[^\s]+\.(ts|js|tsx|jsx)/); // No file paths
    expect(data.error).not.toMatch(/SELECT|INSERT|UPDATE|DELETE/i); // No SQL
    expect(data.error).not.toMatch(/at\s+[^\s]+\s+\(/); // No stack traces
  });
}
