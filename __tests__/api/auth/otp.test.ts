/**
 * OTP Send/Verify API Tests (G-A1-1)
 *
 * Tests for:
 *   POST /api/auth/send-otp
 *   POST /api/auth/verify-otp
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createRequest,
  parseResponse,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockStorage,
  mockLogger,
  createMockSession,
} from "../../utils/routeTestUtils";

mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockStorage();
mockLogger();

// Mock email to avoid real SMTP calls
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({
    success: true,
    messageId: "mock-email-id",
  })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

const { POST: sendOtp } = require("@/app/api/auth/send-otp/route");
const { POST: verifyOtp } = require("@/app/api/auth/verify-otp/route");

describe("OTP API (G-A1-1)", () => {
  let otpUser: any;

  beforeAll(async () => {
    otpUser = await db.user.create({
      data: {
        id: "otp-user-1",
        email: "otp@test.com",
        passwordHash: "hash",
        firstName: "OTP",
        lastName: "Tester",
        phone: "+251911007000",
        role: "SHIPPER",
        status: "REGISTERED",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  function useOtpUserSession() {
    setAuthSession(
      createMockSession({
        userId: otpUser.id,
        role: "SHIPPER",
        status: "REGISTERED",
        organizationId: undefined,
      })
    );
  }

  // T-OTP-1: send-otp email channel → 200, otpCode stored on user
  it("T-OTP-1: send-otp email channel → 200 and OTP stored on user", async () => {
    useOtpUserSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/send-otp",
      {
        body: { channel: "email" },
      }
    );
    const res = await sendOtp(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.message).toContain("OTP sent");
    expect(body.expiresIn).toBe(600);

    const user = await db.user.findUnique({ where: { id: otpUser.id } });
    expect(user.otpCode).toBeTruthy(); // stored hashed
    expect(user.otpExpiresAt).toBeTruthy();
    expect(user.otpChannel).toBe("email");
  });

  // T-OTP-2: verify-otp with correct code → 200, isEmailVerified=true, otpCode cleared
  it("T-OTP-2: verify-otp with correct code → 200, isEmailVerified=true, OTP cleared", async () => {
    // Plant a known OTP (mock hashPassword produces `hashed_${pw}`)
    await db.user.update({
      where: { id: otpUser.id },
      data: {
        otpCode: "hashed_123456",
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpChannel: "email",
      },
    });

    useOtpUserSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/verify-otp",
      {
        body: { code: "123456" },
      }
    );
    const res = await verifyOtp(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.message).toBe("Verified");
    expect(body.isEmailVerified).toBe(true);

    const user = await db.user.findUnique({ where: { id: otpUser.id } });
    expect(user.otpCode).toBeNull();
    expect(user.otpExpiresAt).toBeNull();
    expect(user.isEmailVerified).toBe(true);
  });

  // T-OTP-3: verify-otp with wrong code → 400
  it("T-OTP-3: verify-otp with wrong code → 400", async () => {
    await db.user.update({
      where: { id: otpUser.id },
      data: {
        otpCode: "hashed_654321",
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpChannel: "email",
      },
    });

    useOtpUserSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/verify-otp",
      {
        body: { code: "000000" },
      }
    );
    const res = await verifyOtp(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid OTP");
  });

  // T-OTP-4: verify-otp with expired OTP → 400
  it("T-OTP-4: verify-otp with expired OTP → 400", async () => {
    await db.user.update({
      where: { id: otpUser.id },
      data: {
        otpCode: "hashed_123456",
        otpExpiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
        otpChannel: "email",
      },
    });

    useOtpUserSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/verify-otp",
      {
        body: { code: "123456" },
      }
    );
    const res = await verifyOtp(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("expired");
  });

  // T-OTP-5: verify-otp with no OTP pending → 400
  it("T-OTP-5: verify-otp with no OTP pending → 400", async () => {
    await db.user.update({
      where: { id: otpUser.id },
      data: { otpCode: null, otpExpiresAt: null, otpChannel: null },
    });

    useOtpUserSession();
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/verify-otp",
      {
        body: { code: "123456" },
      }
    );
    const res = await verifyOtp(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("No OTP pending");
  });

  // T-OTP-6: send-otp rate limit exceeded → 429
  it("T-OTP-6: send-otp rate limit exceeded → 429", async () => {
    useOtpUserSession();

    // Override checkRateLimit to block this call
    const { checkRateLimit } = require("@/lib/rateLimit");
    (checkRateLimit as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      limit: 3,
      remaining: 0,
      retryAfter: 3600,
      resetTime: Date.now() + 3600000,
    });

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/send-otp",
      {
        body: { channel: "email" },
      }
    );
    const res = await sendOtp(req);

    expect(res.status).toBe(429);
  });

  // G-M4-2: SUSPENDED user → 403 on send-otp
  it("G-M4-2a: SUSPENDED user cannot send OTP → 403", async () => {
    setAuthSession(
      createMockSession({
        userId: otpUser.id,
        role: "SHIPPER",
        status: "SUSPENDED",
        organizationId: undefined,
      })
    );
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/send-otp",
      { body: { channel: "email" } }
    );
    const res = await sendOtp(req);
    expect(res.status).toBe(403);
  });

  // G-M4-2: SUSPENDED user → 403 on verify-otp
  it("G-M4-2b: SUSPENDED user cannot verify OTP → 403", async () => {
    setAuthSession(
      createMockSession({
        userId: otpUser.id,
        role: "SHIPPER",
        status: "SUSPENDED",
        organizationId: undefined,
      })
    );
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/verify-otp",
      { body: { code: "123456" } }
    );
    const res = await verifyOtp(req);
    expect(res.status).toBe(403);
  });

  // T-OTP-7: verify-otp unauthenticated → 401
  it("T-OTP-7: verify-otp unauthenticated → 401", async () => {
    setAuthSession(null);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/auth/verify-otp",
      {
        body: { code: "123456" },
      }
    );
    const res = await verifyOtp(req);
    expect(res.status).toBe(401);
  });
});
