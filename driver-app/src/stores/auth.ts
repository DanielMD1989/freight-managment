/**
 * Auth Store - Zustand (Driver App)
 *
 * Adapted from mobile/src/stores/auth.ts for DRIVER-only usage:
 * - No register action (drivers use acceptInvite flow)
 * - Adds acceptInvite action via driverService
 * - Login, logout, MFA, checkAuth identical to mobile
 */
import { create } from "zustand";
import type { AuthResponse, AcceptInviteResponse } from "../types";
import { authService } from "../services/auth";
import { driverService } from "../services/driver";
import {
  saveAuth,
  clearAuth,
  setOnUnauthorized,
  setOnForbidden,
} from "../api/client";
import type { AcceptInvitePayload } from "../types";

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  organizationId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // MFA state
  mfaPending: boolean;
  mfaToken: string | null;
  phoneLastFour: string | null;
  mfaExpiresAt: number | null;
  mfaEmail: string | null;
  mfaPassword: string | null;

  // Session expired
  sessionExpiredMessage: string | null;
  clearSessionExpired: () => void;

  // MFA cleanup
  clearMfaState: () => void;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  verifyMfa: (code: string) => Promise<void>;
  resendMfa: () => Promise<void>;
  acceptInvite: (payload: AcceptInvitePayload) => Promise<AcceptInviteResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  setOnUnauthorized(() => {
    set({
      user: null,
      isLoading: false,
      mfaPending: false,
      mfaToken: null,
      phoneLastFour: null,
      mfaExpiresAt: null,
      mfaEmail: null,
      mfaPassword: null,
      sessionExpiredMessage: "Your session has expired. Please log in again.",
    });
  });

  setOnForbidden(() => {
    get().checkAuth();
  });

  return {
    user: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    sessionExpiredMessage: null,
    mfaPending: false,
    mfaToken: null,
    phoneLastFour: null,
    mfaExpiresAt: null,
    mfaEmail: null,
    mfaPassword: null,

    initialize: async () => {
      if (get().isInitialized) return;
      set({ isLoading: true });
      try {
        const response = await authService.getCurrentUser();
        set({ user: response.user, isInitialized: true, isLoading: false });
      } catch {
        set({ user: null, isInitialized: true, isLoading: false });
      }
    },

    login: async (email: string, password: string) => {
      set({ isLoading: true, error: null, mfaPending: false, mfaToken: null });
      try {
        const response = await authService.login({ email, password });

        if (response.requiresMfa) {
          const expiresIn = response.expiresIn ?? 300;
          set({
            isLoading: false,
            mfaPending: true,
            mfaToken: response.mfaToken ?? null,
            phoneLastFour: response.phoneLastFour ?? null,
            mfaExpiresAt: Date.now() + expiresIn * 1000,
            mfaEmail: email,
            mfaPassword: password,
          });
          return response;
        }

        if (response.sessionToken) {
          await saveAuth({
            sessionToken: response.sessionToken,
            csrfToken: response.csrfToken,
            userId: response.user.id,
            userRole: response.user.role,
          });
        }

        set({ user: response.user, isLoading: false });
        return response;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Login failed. Please try again.";
        set({ isLoading: false, error: message });
        throw err;
      }
    },

    verifyMfa: async (code: string) => {
      const mfaToken = get().mfaToken;
      if (!mfaToken) throw new Error("No MFA session");

      set({ isLoading: true, error: null });
      try {
        const response = await authService.verifyMfa({ mfaToken, code });

        if (response.sessionToken) {
          await saveAuth({
            sessionToken: response.sessionToken,
            csrfToken: response.csrfToken,
            userId: response.user.id,
            userRole: response.user.role,
          });
        }

        set({
          user: response.user,
          isLoading: false,
          mfaPending: false,
          mfaToken: null,
          phoneLastFour: null,
          mfaExpiresAt: null,
          mfaEmail: null,
          mfaPassword: null,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "MFA verification failed.";
        set({ isLoading: false, error: message });
        throw err;
      }
    },

    resendMfa: async () => {
      const email = get().mfaEmail;
      const password = get().mfaPassword;
      if (!email || !password) throw new Error("No MFA session to resend");

      set({ isLoading: true, error: null });
      try {
        const response = await authService.login({ email, password });
        if (response.requiresMfa) {
          const expiresIn = response.expiresIn ?? 300;
          set({
            isLoading: false,
            mfaToken: response.mfaToken ?? null,
            phoneLastFour: response.phoneLastFour ?? null,
            mfaExpiresAt: Date.now() + expiresIn * 1000,
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to resend code.";
        set({ isLoading: false, error: message });
        throw err;
      }
    },

    acceptInvite: async (payload: AcceptInvitePayload) => {
      set({ isLoading: true, error: null });
      try {
        const result = await driverService.acceptInvite(payload);
        set({ isLoading: false });
        return result;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to accept invitation.";
        set({ isLoading: false, error: message });
        throw err;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await authService.logout();
      } catch {
        // Ignore logout errors
      }
      await clearAuth();
      set({
        user: null,
        isLoading: false,
        mfaPending: false,
        mfaToken: null,
        phoneLastFour: null,
        mfaExpiresAt: null,
        mfaEmail: null,
        mfaPassword: null,
        error: null,
      });
    },

    checkAuth: async () => {
      try {
        const response = await authService.getCurrentUser();
        set({ user: response.user });
      } catch {
        await clearAuth();
        set({ user: null });
      }
    },

    clearError: () => set({ error: null }),
    clearSessionExpired: () => set({ sessionExpiredMessage: null }),
    clearMfaState: () =>
      set({
        mfaPending: false,
        mfaToken: null,
        phoneLastFour: null,
        mfaExpiresAt: null,
        mfaEmail: null,
        mfaPassword: null,
      }),
  };
});
