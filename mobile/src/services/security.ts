/**
 * Security Service — §14 Mobile Security Settings
 *
 * MFA management, session management, and security events.
 * Password change is already in authService.
 */
import apiClient, { getErrorMessage } from "../api/client";

// ── Types ──

export interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  deviceInfo: string;
  ipAddress: string;
  success: boolean;
  timestamp: string;
}

export interface RecoveryCodesStatus {
  totalCodes: number;
  usedCodes: number;
  remainingCodes: number;
  generatedAt: string;
  warning: string | null;
}

// ── Service ──

class SecurityService {
  // ── MFA ──

  async enableMfa(
    phone: string
  ): Promise<{ expiresIn: number; phoneLastFour: string }> {
    try {
      const response = await apiClient.post("/api/user/mfa/enable", { phone });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async verifyMfaSetup(
    otp: string
  ): Promise<{ recoveryCodes: string[]; warning: string }> {
    try {
      const response = await apiClient.post("/api/user/mfa/verify", { otp });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async disableMfa(password: string): Promise<{ revokedSessions: number }> {
    try {
      const response = await apiClient.post("/api/user/mfa/disable", {
        password,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getRecoveryCodesStatus(): Promise<RecoveryCodesStatus> {
    try {
      const response = await apiClient.get("/api/user/mfa/recovery-codes");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async regenerateRecoveryCodes(
    password: string
  ): Promise<{ recoveryCodes: string[]; warning: string }> {
    try {
      const response = await apiClient.post("/api/user/mfa/recovery-codes", {
        password,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  // ── Sessions ──

  async getSessions(): Promise<{ sessions: Session[]; count: number }> {
    try {
      const response = await apiClient.get("/api/user/sessions");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/user/sessions/${sessionId}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async revokeAllSessions(): Promise<{ revokedCount: number }> {
    try {
      const response = await apiClient.post("/api/user/sessions/revoke-all");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  // ── Security Events ──

  async getSecurityEvents(
    limit = 50
  ): Promise<{ events: SecurityEvent[]; count: number }> {
    try {
      const response = await apiClient.get("/api/user/security-events", {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const securityService = new SecurityService();
