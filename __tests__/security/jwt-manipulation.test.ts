/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * JWT Manipulation Tests
 *
 * Tests JWT token validation, tampering detection, expiration handling,
 * and role claim verification.
 */

import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const TEST_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "test-jwt-secret-key-for-testing-only"
);
const WRONG_SECRET = new TextEncoder().encode("wrong-secret-key");

describe("JWT Manipulation Tests", () => {
  // Helper to create a valid JWT
  async function createValidJWT(payload: Record<string, any> = {}) {
    return new SignJWT({
      userId: "user-123",
      email: "test@example.com",
      role: "CARRIER",
      organizationId: "org-123",
      ...payload,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(TEST_SECRET);
  }

  // ─── Valid Token Handling ────────────────────────────────────────────────

  describe("Valid token handling", () => {
    it("should verify a properly signed token", async () => {
      const token = await createValidJWT();
      const { payload } = await jwtVerify(token, TEST_SECRET);

      expect(payload.userId).toBe("user-123");
      expect(payload.email).toBe("test@example.com");
      expect(payload.role).toBe("CARRIER");
    });

    it("should include all expected claims", async () => {
      const token = await createValidJWT({
        userId: "claim-test",
        email: "claims@test.com",
        role: "SHIPPER",
        organizationId: "org-claims",
      });

      const { payload } = await jwtVerify(token, TEST_SECRET);
      expect(payload.userId).toBe("claim-test");
      expect(payload.organizationId).toBe("org-claims");
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });
  });

  // ─── Malformed Tokens ───────────────────────────────────────────────────

  describe("Malformed tokens", () => {
    it("should reject token with only 2 parts", async () => {
      const twoPartToken = "header.payload"; // Missing signature

      await expect(jwtVerify(twoPartToken, TEST_SECRET)).rejects.toThrow();
    });

    it("should reject empty string as token", async () => {
      await expect(jwtVerify("", TEST_SECRET)).rejects.toThrow();
    });

    it("should reject garbage token", async () => {
      await expect(
        jwtVerify("not.a.valid-jwt-at-all", TEST_SECRET)
      ).rejects.toThrow();
    });

    it("should reject token with invalid base64 payload", async () => {
      const token = "valid-header.!!!invalid-base64!!!.signature";

      await expect(jwtVerify(token, TEST_SECRET)).rejects.toThrow();
    });
  });

  // ─── Signature Tampering ─────────────────────────────────────────────────

  describe("Signature tampering", () => {
    it("should reject token signed with wrong secret", async () => {
      const token = await new SignJWT({
        userId: "tamper-1",
        email: "tamper@test.com",
        role: "ADMIN", // Trying to claim admin
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(WRONG_SECRET);

      await expect(jwtVerify(token, TEST_SECRET)).rejects.toThrow(
        "Invalid signature"
      );
    });

    it("should reject token with modified payload", async () => {
      const token = await createValidJWT({ role: "CARRIER" });
      const parts = token.split(".");

      // Modify payload to claim ADMIN role
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      payload.role = "ADMIN";
      const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64url"
      );

      const tamperedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

      await expect(jwtVerify(tamperedToken, TEST_SECRET)).rejects.toThrow(
        "Invalid signature"
      );
    });

    it("should reject token with swapped signature from another token", async () => {
      const token1 = await createValidJWT({ userId: "user-A" });
      const token2 = await createValidJWT({ userId: "user-B" });

      const parts1 = token1.split(".");
      const parts2 = token2.split(".");

      // Use payload from token1 with signature from token2
      const frankenToken = `${parts1[0]}.${parts1[1]}.${parts2[2]}`;

      // Signatures are different because payloads differ
      if (parts1[1] !== parts2[1]) {
        await expect(jwtVerify(frankenToken, TEST_SECRET)).rejects.toThrow();
      }
    });
  });

  // ─── Token Expiration ────────────────────────────────────────────────────

  describe("Token expiration", () => {
    it("should reject expired token", async () => {
      // Create token that's already expired
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" })
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          userId: "expired-user",
          email: "expired@test.com",
          role: "CARRIER",
          iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        })
      ).toString("base64url");

      const signature = crypto
        .createHmac(
          "sha256",
          process.env.JWT_SECRET || "test-jwt-secret-key-for-testing-only"
        )
        .update(`${header}.${payload}`)
        .digest("base64url");

      const expiredToken = `${header}.${payload}.${signature}`;

      await expect(jwtVerify(expiredToken, TEST_SECRET)).rejects.toThrow(
        "Token expired"
      );
    });

    it("should accept token that is not yet expired", async () => {
      const token = await createValidJWT();
      const { payload } = await jwtVerify(token, TEST_SECRET);

      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  // ─── Role Claim Verification ─────────────────────────────────────────────

  describe("Role claim verification", () => {
    it("should preserve role claim through sign/verify cycle", async () => {
      const roles = [
        "SHIPPER",
        "CARRIER",
        "DISPATCHER",
        "ADMIN",
        "SUPER_ADMIN",
      ];

      for (const role of roles) {
        const token = await createValidJWT({ role });
        const { payload } = await jwtVerify(token, TEST_SECRET);
        expect(payload.role).toBe(role);
      }
    });

    it("should detect role tampering in token", async () => {
      const carrierToken = await createValidJWT({ role: "CARRIER" });
      const parts = carrierToken.split(".");

      // Tamper: change role to ADMIN
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      payload.role = "ADMIN";
      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64url"
      );
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(jwtVerify(tamperedToken, TEST_SECRET)).rejects.toThrow();
    });
  });

  // ─── Token Structure ─────────────────────────────────────────────────────

  describe("Token structure", () => {
    it("should produce 3-part dot-separated token", async () => {
      const token = await createValidJWT();
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    it("should have valid base64url parts", async () => {
      const token = await createValidJWT();
      const parts = token.split(".");

      // Each part should be valid base64url
      parts.forEach((part) => {
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      });
    });

    it("should contain algorithm in header", async () => {
      const token = await createValidJWT();
      const header = JSON.parse(
        Buffer.from(token.split(".")[0], "base64url").toString()
      );

      expect(header.alg).toBe("HS256");
    });
  });
});
