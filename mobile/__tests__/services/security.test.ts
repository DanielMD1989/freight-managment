/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for security service — §14 Mobile Security Settings
 */
import { securityService } from "../../src/services/security";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Security Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── MFA ──

  describe("enableMfa", () => {
    it("should call POST /api/user/mfa/enable with phone", async () => {
      mockPost.mockResolvedValue({
        data: { expiresIn: 300, phoneLastFour: "1234" },
      });

      const result = await securityService.enableMfa("+251911001234");
      expect(mockPost).toHaveBeenCalledWith("/api/user/mfa/enable", {
        phone: "+251911001234",
      });
      expect(result.expiresIn).toBe(300);
      expect(result.phoneLastFour).toBe("1234");
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Invalid phone"));

      await expect(securityService.enableMfa("bad")).rejects.toThrow(
        "Invalid phone"
      );
    });
  });

  describe("verifyMfaSetup", () => {
    it("should call POST /api/user/mfa/verify with otp", async () => {
      mockPost.mockResolvedValue({
        data: { recoveryCodes: ["code1", "code2"], warning: "Save these" },
      });

      const result = await securityService.verifyMfaSetup("123456");
      expect(mockPost).toHaveBeenCalledWith("/api/user/mfa/verify", {
        otp: "123456",
      });
      expect(result.recoveryCodes).toHaveLength(2);
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Invalid OTP"));

      await expect(securityService.verifyMfaSetup("000000")).rejects.toThrow(
        "Invalid OTP"
      );
    });
  });

  describe("disableMfa", () => {
    it("should call POST /api/user/mfa/disable with password", async () => {
      mockPost.mockResolvedValue({ data: { revokedSessions: 3 } });

      const result = await securityService.disableMfa("mypassword");
      expect(mockPost).toHaveBeenCalledWith("/api/user/mfa/disable", {
        password: "mypassword",
      });
      expect(result.revokedSessions).toBe(3);
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Wrong password"));

      await expect(securityService.disableMfa("wrong")).rejects.toThrow(
        "Wrong password"
      );
    });
  });

  describe("getRecoveryCodesStatus", () => {
    it("should call GET /api/user/mfa/recovery-codes", async () => {
      const mockData = {
        totalCodes: 10,
        usedCodes: 2,
        remainingCodes: 8,
        generatedAt: "2026-01-01",
        warning: null,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await securityService.getRecoveryCodesStatus();
      expect(mockGet).toHaveBeenCalledWith("/api/user/mfa/recovery-codes");
      expect(result.remainingCodes).toBe(8);
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("MFA not enabled"));

      await expect(securityService.getRecoveryCodesStatus()).rejects.toThrow(
        "MFA not enabled"
      );
    });
  });

  describe("regenerateRecoveryCodes", () => {
    it("should call POST /api/user/mfa/recovery-codes with password", async () => {
      mockPost.mockResolvedValue({
        data: { recoveryCodes: ["new1"], warning: "Save these" },
      });

      const result =
        await securityService.regenerateRecoveryCodes("mypassword");
      expect(mockPost).toHaveBeenCalledWith("/api/user/mfa/recovery-codes", {
        password: "mypassword",
      });
      expect(result.recoveryCodes).toHaveLength(1);
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Unauthorized"));

      await expect(
        securityService.regenerateRecoveryCodes("bad")
      ).rejects.toThrow("Unauthorized");
    });
  });

  // ── Sessions ──

  describe("getSessions", () => {
    it("should call GET /api/user/sessions", async () => {
      const mockData = {
        sessions: [
          {
            id: "s1",
            deviceInfo: "Chrome",
            ipAddress: "1.2.3.4",
            isCurrent: true,
          },
        ],
        count: 1,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await securityService.getSessions();
      expect(mockGet).toHaveBeenCalledWith("/api/user/sessions");
      expect(result.sessions).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("Server error"));

      await expect(securityService.getSessions()).rejects.toThrow(
        "Server error"
      );
    });
  });

  describe("revokeSession", () => {
    it("should call DELETE /api/user/sessions/:id", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await securityService.revokeSession("s1");
      expect(mockDelete).toHaveBeenCalledWith("/api/user/sessions/s1");
    });

    it("should throw on error", async () => {
      mockDelete.mockRejectedValue(new Error("Cannot revoke current session"));

      await expect(securityService.revokeSession("s1")).rejects.toThrow(
        "Cannot revoke current session"
      );
    });
  });

  describe("revokeAllSessions", () => {
    it("should call POST /api/user/sessions/revoke-all", async () => {
      mockPost.mockResolvedValue({ data: { revokedCount: 5 } });

      const result = await securityService.revokeAllSessions();
      expect(mockPost).toHaveBeenCalledWith("/api/user/sessions/revoke-all");
      expect(result.revokedCount).toBe(5);
    });

    it("should throw on error", async () => {
      mockPost.mockRejectedValue(new Error("Failed"));

      await expect(securityService.revokeAllSessions()).rejects.toThrow(
        "Failed"
      );
    });
  });

  // ── Security Events ──

  describe("getSecurityEvents", () => {
    it("should call GET /api/user/security-events with default limit", async () => {
      const mockData = {
        events: [{ id: "e1", type: "LOGIN", success: true }],
        count: 1,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await securityService.getSecurityEvents();
      expect(mockGet).toHaveBeenCalledWith("/api/user/security-events", {
        params: { limit: 50 },
      });
      expect(result.events).toHaveLength(1);
    });

    it("should pass custom limit", async () => {
      mockGet.mockResolvedValue({ data: { events: [], count: 0 } });

      await securityService.getSecurityEvents(10);
      expect(mockGet).toHaveBeenCalledWith("/api/user/security-events", {
        params: { limit: 10 },
      });
    });

    it("should throw on error", async () => {
      mockGet.mockRejectedValue(new Error("Unauthorized"));

      await expect(securityService.getSecurityEvents()).rejects.toThrow(
        "Unauthorized"
      );
    });
  });
});
