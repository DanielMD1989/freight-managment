/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for auth service
 */
import { authService } from "../../src/services/auth";

// Mock the API client
const mockPost = jest.fn();
const mockGet = jest.fn();
jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
    get: (...args: any[]) => mockGet(...args),
    defaults: { headers: { common: {} } },
  },
  saveAuth: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
  getErrorMessage: jest.fn(
    (e: any) => e?.response?.data?.error ?? e?.message ?? "Unknown error"
  ),
}));

describe("Auth Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should call POST /api/auth/login with LoginPayload", async () => {
      mockPost.mockResolvedValue({
        data: {
          user: {
            id: "1",
            email: "test@test.com",
            role: "CARRIER",
            status: "ACTIVE",
            firstName: "John",
            lastName: "Doe",
            organizationId: null,
          },
          sessionToken: "token123",
        },
      });

      const result = await authService.login({
        email: "test@test.com",
        password: "password",
      });

      expect(mockPost).toHaveBeenCalledWith("/api/auth/login", {
        email: "test@test.com",
        password: "password",
      });
      expect(result.user.email).toBe("test@test.com");
      expect(result.sessionToken).toBe("token123");
    });

    it("should handle MFA response", async () => {
      mockPost.mockResolvedValue({
        data: {
          requiresMfa: true,
          mfaToken: "mfa-token",
        },
      });

      const result = await authService.login({
        email: "test@test.com",
        password: "password",
      });
      expect(result.requiresMfa).toBe(true);
      expect(result.mfaToken).toBe("mfa-token");
    });
  });

  describe("register", () => {
    it("should call POST /api/auth/register with payload", async () => {
      const payload = {
        email: "new@test.com",
        password: "Password123!",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+251911223344",
        role: "CARRIER" as const,
        companyName: "Test Transport",
        carrierType: "OWNER_OPERATOR",
      };

      mockPost.mockResolvedValue({
        data: {
          user: {
            id: "2",
            email: "new@test.com",
            role: "CARRIER",
            status: "REGISTERED",
            firstName: "Jane",
            lastName: "Doe",
            organizationId: null,
          },
        },
      });

      const result = await authService.register(payload);
      expect(mockPost).toHaveBeenCalledWith("/api/auth/register", payload);
      expect(result.user.email).toBe("new@test.com");
    });
  });

  describe("getCurrentUser", () => {
    it("should call GET /api/auth/me and return AuthResponse", async () => {
      const mockUser = {
        id: "1",
        email: "test@test.com",
        role: "CARRIER",
        firstName: "John",
        lastName: "Doe",
        status: "ACTIVE",
        organizationId: null,
      };
      mockGet.mockResolvedValue({ data: { user: mockUser } });

      const result = await authService.getCurrentUser();
      expect(mockGet).toHaveBeenCalledWith("/api/auth/me");
      expect(result.user.id).toBe("1");
    });

    it("should handle unwrapped response (defensive)", async () => {
      const mockUser = {
        id: "1",
        email: "test@test.com",
        role: "CARRIER",
        firstName: "John",
        lastName: "Doe",
        status: "ACTIVE",
        organizationId: null,
      };
      // No { user: ... } wrapper
      mockGet.mockResolvedValue({ data: mockUser });

      const result = await authService.getCurrentUser();
      // Should use response.data.user ?? response.data
      expect(result.user.id).toBe("1");
    });
  });

  describe("logout", () => {
    it("should call POST /api/auth/logout", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      await authService.logout();
      expect(mockPost).toHaveBeenCalledWith("/api/auth/logout");
    });

    it("should not throw on logout errors", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(authService.logout()).resolves.toBeUndefined();
    });
  });

  describe("verifyMfa", () => {
    it("should call POST /api/auth/verify-mfa with MfaPayload", async () => {
      mockPost.mockResolvedValue({
        data: {
          user: {
            id: "1",
            email: "test@test.com",
            role: "CARRIER",
            status: "ACTIVE",
            firstName: "John",
            lastName: "Doe",
            organizationId: null,
          },
          sessionToken: "token-after-mfa",
        },
      });

      const result = await authService.verifyMfa({
        mfaToken: "mfa-token",
        code: "123456",
      });
      expect(mockPost).toHaveBeenCalledWith("/api/auth/verify-mfa", {
        mfaToken: "mfa-token",
        code: "123456",
      });
      expect(result.sessionToken).toBe("token-after-mfa");
    });
  });

  describe("requestPasswordReset", () => {
    it("should call POST /api/auth/forgot-password", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      await authService.requestPasswordReset("user@test.com");
      expect(mockPost).toHaveBeenCalledWith("/api/auth/forgot-password", {
        email: "user@test.com",
      });
    });
  });

  describe("changePassword", () => {
    it("should call POST /api/auth/change-password", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      await authService.changePassword("oldPass", "newPass");
      expect(mockPost).toHaveBeenCalledWith("/api/auth/change-password", {
        currentPassword: "oldPass",
        newPassword: "newPass",
      });
    });
  });
});
