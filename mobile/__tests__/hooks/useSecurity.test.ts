/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for security hooks — §14 Mobile Security Settings
 */
import { securityService } from "../../src/services/security";
import { authService } from "../../src/services/auth";

let capturedOptions: any = null;
let capturedMutationOptions: any = null;
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
  useMutation: (options: any) => {
    capturedMutationOptions = options;
    return { mutate: jest.fn(), isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock("../../src/services/security", () => ({
  securityService: {
    enableMfa: jest.fn(),
    verifyMfaSetup: jest.fn(),
    disableMfa: jest.fn(),
    getRecoveryCodesStatus: jest.fn(),
    regenerateRecoveryCodes: jest.fn(),
    getSessions: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllSessions: jest.fn(),
    getSecurityEvents: jest.fn(),
  },
}));

jest.mock("../../src/services/auth", () => ({
  authService: {
    changePassword: jest.fn(),
  },
}));

import {
  useChangePassword,
  useEnableMfa,
  useVerifyMfaSetup,
  useDisableMfa,
  useRecoveryCodesStatus,
  useRegenerateRecoveryCodes,
  useSessions,
  useRevokeSession,
  useRevokeAllSessions,
  useSecurityEvents,
} from "../../src/hooks/useSecurity";

describe("Security Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ── Password ──

  describe("useChangePassword", () => {
    it("should call authService.changePassword", () => {
      useChangePassword();
      capturedMutationOptions.mutationFn({
        currentPassword: "old",
        newPassword: "new",
      });
      expect(authService.changePassword).toHaveBeenCalledWith("old", "new");
    });
  });

  // ── MFA ──

  describe("useEnableMfa", () => {
    it("should call securityService.enableMfa with phone", () => {
      useEnableMfa();
      capturedMutationOptions.mutationFn("+251911001234");
      expect(securityService.enableMfa).toHaveBeenCalledWith("+251911001234");
    });
  });

  describe("useVerifyMfaSetup", () => {
    it("should call securityService.verifyMfaSetup with otp", () => {
      useVerifyMfaSetup();
      capturedMutationOptions.mutationFn("123456");
      expect(securityService.verifyMfaSetup).toHaveBeenCalledWith("123456");
    });

    it("should invalidate recovery codes on success", () => {
      useVerifyMfaSetup();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["security", "recovery-codes"],
      });
    });
  });

  describe("useDisableMfa", () => {
    it("should call securityService.disableMfa with password", () => {
      useDisableMfa();
      capturedMutationOptions.mutationFn("mypassword");
      expect(securityService.disableMfa).toHaveBeenCalledWith("mypassword");
    });

    it("should invalidate sessions and recovery codes on success", () => {
      useDisableMfa();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["security", "sessions"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["security", "recovery-codes"],
      });
    });
  });

  describe("useRecoveryCodesStatus", () => {
    it('should use queryKey ["security", "recovery-codes"]', () => {
      useRecoveryCodesStatus();
      expect(capturedOptions.queryKey).toEqual(["security", "recovery-codes"]);
    });

    it("should call securityService.getRecoveryCodesStatus as queryFn", () => {
      useRecoveryCodesStatus();
      capturedOptions.queryFn();
      expect(securityService.getRecoveryCodesStatus).toHaveBeenCalled();
    });
  });

  describe("useRegenerateRecoveryCodes", () => {
    it("should call securityService.regenerateRecoveryCodes with password", () => {
      useRegenerateRecoveryCodes();
      capturedMutationOptions.mutationFn("mypassword");
      expect(securityService.regenerateRecoveryCodes).toHaveBeenCalledWith(
        "mypassword"
      );
    });

    it("should invalidate recovery codes on success", () => {
      useRegenerateRecoveryCodes();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["security", "recovery-codes"],
      });
    });
  });

  // ── Sessions ──

  describe("useSessions", () => {
    it('should use queryKey ["security", "sessions"]', () => {
      useSessions();
      expect(capturedOptions.queryKey).toEqual(["security", "sessions"]);
    });

    it("should call securityService.getSessions as queryFn", () => {
      useSessions();
      capturedOptions.queryFn();
      expect(securityService.getSessions).toHaveBeenCalled();
    });
  });

  describe("useRevokeSession", () => {
    it("should call securityService.revokeSession with sessionId", () => {
      useRevokeSession();
      capturedMutationOptions.mutationFn("session-1");
      expect(securityService.revokeSession).toHaveBeenCalledWith("session-1");
    });

    it("should invalidate sessions on success", () => {
      useRevokeSession();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["security", "sessions"],
      });
    });
  });

  describe("useRevokeAllSessions", () => {
    it("should call securityService.revokeAllSessions", () => {
      useRevokeAllSessions();
      capturedMutationOptions.mutationFn();
      expect(securityService.revokeAllSessions).toHaveBeenCalled();
    });

    it("should invalidate sessions on success", () => {
      useRevokeAllSessions();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["security", "sessions"],
      });
    });
  });

  // ── Security Events ──

  describe("useSecurityEvents", () => {
    it('should use queryKey ["security", "events", limit]', () => {
      useSecurityEvents(25);
      expect(capturedOptions.queryKey).toEqual(["security", "events", 25]);
    });

    it("should default limit to 50", () => {
      useSecurityEvents();
      expect(capturedOptions.queryKey).toEqual(["security", "events", 50]);
    });

    it("should call securityService.getSecurityEvents as queryFn", () => {
      useSecurityEvents(10);
      capturedOptions.queryFn();
      expect(securityService.getSecurityEvents).toHaveBeenCalledWith(10);
    });
  });
});
