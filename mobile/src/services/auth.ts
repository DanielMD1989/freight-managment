/**
 * Auth Service - API calls for authentication
 * Ported from Flutter's auth_service.dart (466 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type {
  AuthResponse,
  LoginPayload,
  MfaPayload,
  RegisterPayload,
} from "../types";

class AuthService {
  /** Login with email/password */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    try {
      const response = await apiClient.post("/api/auth/login", payload);
      const data = response.data;

      // Handle MFA required
      if (data.requiresMfa) {
        return {
          user: {
            id: "",
            email: payload.email,
            firstName: null,
            lastName: null,
            role: "",
            status: "",
            organizationId: null,
          },
          requiresMfa: true,
          mfaToken: data.mfaToken,
        };
      }

      return {
        user: data.user,
        sessionToken: data.sessionToken,
        csrfToken: data.csrfToken,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Verify MFA code */
  async verifyMfa(payload: MfaPayload): Promise<AuthResponse> {
    try {
      const response = await apiClient.post("/api/auth/verify-mfa", payload);
      return {
        user: response.data.user,
        sessionToken: response.data.sessionToken,
        csrfToken: response.data.csrfToken,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Register new user */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    try {
      const response = await apiClient.post("/api/auth/register", payload);
      return {
        user: response.data.user,
        sessionToken: response.data.sessionToken,
        csrfToken: response.data.csrfToken,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get current authenticated user */
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const response = await apiClient.get("/api/auth/me");
      return {
        user: response.data.user ?? response.data,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Logout - invalidate session */
  async logout(): Promise<void> {
    try {
      await apiClient.post("/api/auth/logout");
    } catch {
      // Ignore logout errors - we clear local state regardless
    }
  }

  /** Request password reset */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post("/api/auth/forgot-password", { email });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Reset password with token */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post("/api/auth/reset-password", {
        token,
        password: newPassword,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Change password (authenticated)
   * TODO: API endpoint POST /api/auth/change-password does not exist yet.
   * This method will throw until the endpoint is implemented on the server.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      await apiClient.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Update profile
   * TODO: API endpoint PATCH /api/users/me does not exist yet.
   * This method will throw until the endpoint is implemented on the server.
   */
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<unknown> {
    try {
      const response = await apiClient.patch("/api/users/me", data);
      return response.data.user ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const authService = new AuthService();
