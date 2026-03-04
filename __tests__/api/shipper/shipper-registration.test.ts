// @jest-environment node
/**
 * Shipper Registration Tests
 *
 * Tests for POST /api/auth/register covering:
 * - Successful SHIPPER registration → 201, status: REGISTERED
 * - ADMIN/SUPER_ADMIN registration blocked by Zod schema → 400
 * - Missing required field (email) → 400 Zod error
 * - Duplicate email → 400
 * - Rate limit exceeded (4th attempt) → 429
 *
 * Notes from reading the route:
 * - Successful registration returns status "REGISTERED" (not PENDING_VERIFICATION)
 * - ADMIN/SUPER_ADMIN are not in the role enum so Zod rejects them with 400
 * - Duplicate email returns 400 (not 409) per the route implementation
 * - Rate limit: 3 per hour per IP, 4th → 429 with retryAfter
 */

import {
  createRequest,
  callHandler,
  parseResponse,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
} from "../../utils/routeTestUtils";

// All mocks BEFORE require()
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// mockAuth() (called above) already mocks validatePasswordPolicy → { valid: true, errors: [] },
// hashPassword, setSession, createSessionRecord, and createSessionToken.
// No additional auth mock needed.

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

// Route handler AFTER mocks
const { POST: register } = require("@/app/api/auth/register/route");

// ─── Valid base payload ───────────────────────────────────────────────────────

const validShipperPayload = {
  email: "newshipper@example.com",
  password: "SecurePass1!",
  firstName: "Alice",
  lastName: "Freight",
  phone: "+251911111111",
  role: "SHIPPER",
  companyName: "Alice Freight Co",
};

describe("Shipper Registration — POST /api/auth/register", () => {
  beforeEach(() => {
    clearAllStores();
  });

  afterEach(clearAllStores);

  it("registers a SHIPPER successfully and returns 201 with status REGISTERED", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: validShipperPayload,
    });

    const response = await callHandler(register, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(201);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("newshipper@example.com");
    expect(body.user.role).toBe("SHIPPER");
    // Route sets status to "REGISTERED" on creation (admin approval moves it to PENDING_VERIFICATION)
    expect(body.user.status).toBe("REGISTERED");
    expect(body.message).toBe("Registration successful");
  });

  it("blocks ADMIN registration — role not in schema enum → 400", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...validShipperPayload,
        email: "admin@example.com",
        role: "ADMIN",
      },
    });

    const response = await callHandler(register, req);
    const body = await parseResponse(response);

    // Zod rejects ADMIN (not in enum ["SHIPPER","CARRIER","DISPATCHER"]) → 400
    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("blocks SUPER_ADMIN registration — role not in schema enum → 400", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...validShipperPayload,
        email: "superadmin@example.com",
        role: "SUPER_ADMIN",
      },
    });

    const response = await callHandler(register, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when email is missing (Zod validation)", async () => {
    const { email: _omit, ...withoutEmail } = validShipperPayload;

    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: withoutEmail,
    });

    const response = await callHandler(register, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when the same email is registered twice (duplicate)", async () => {
    // First registration
    const req1 = createRequest("POST", "http://localhost/api/auth/register", {
      body: validShipperPayload,
    });
    const first = await callHandler(register, req1);
    expect(first.status).toBe(201);

    // Second registration with same email — route returns 400 (not 409)
    const req2 = createRequest("POST", "http://localhost/api/auth/register", {
      body: validShipperPayload,
    });
    const response = await callHandler(register, req2);
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/already exists/i);
  });

  it("returns 429 after 3 registrations from the same IP (rate limit)", async () => {
    // Set up checkRateLimit to allow first 3 calls then block the 4th.
    // Use mockResolvedValueOnce to queue exact responses in order.
    const { checkRateLimit } = require("@/lib/rateLimit");
    const rateLimitAllowed = {
      allowed: true,
      success: true,
      limit: 3,
      remaining: 2,
      retryAfter: 0,
      resetTime: Date.now() + 3600000,
    };
    const rateLimitBlocked = {
      allowed: false,
      success: false,
      limit: 3,
      remaining: 0,
      retryAfter: 3600000,
      resetTime: Date.now() + 3600000,
    };
    (checkRateLimit as jest.Mock)
      .mockResolvedValueOnce(rateLimitAllowed)
      .mockResolvedValueOnce(rateLimitAllowed)
      .mockResolvedValueOnce(rateLimitAllowed)
      .mockResolvedValueOnce(rateLimitBlocked);

    // Use unique phone numbers per registration to avoid phone collision
    // (the register route checks email OR phone for duplicates)
    const registrations = [
      { email: "a1@example.com", phone: "+251911001001" },
      { email: "a2@example.com", phone: "+251911001002" },
      { email: "a3@example.com", phone: "+251911001003" },
    ];
    for (const { email, phone } of registrations) {
      const req = createRequest("POST", "http://localhost/api/auth/register", {
        body: { ...validShipperPayload, email, phone },
      });
      const res = await callHandler(register, req);
      expect(res.status).toBe(201);
    }

    // 4th attempt → 429
    const req4 = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...validShipperPayload,
        email: "a4@example.com",
        phone: "+251911001004",
      },
    });
    const response = await callHandler(register, req4);
    const body = await parseResponse(response);

    expect(response.status).toBe(429);
    expect(body.error).toMatch(/too many/i);
    expect(body.retryAfter).toBeDefined();
  });
});
