/**
 * Auth Store - Zustand
 * Ported from Flutter's auth_provider.dart
 *
 * Manages user session state, auth actions (login/register/logout),
 * and exposes auth status for routing guards.
 */
import { create } from "zustand";
import type { AuthResponse } from "../types";
import { authService } from "../services/auth";
import {
  saveAuth,
  clearAuth,
  setOnUnauthorized,
  setOnForbidden,
  setOnPaymentRequired,
} from "../api/client";

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

  // Wallet gate (402)
  walletGateMessage: string | null;
  clearWalletGate: () => void;

  // Session expired (G-TOKEN-2)
  sessionExpiredMessage: string | null;
  clearSessionExpired: () => void;

  // MFA cleanup (G-TOKEN-6)
  clearMfaState: () => void;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  verifyMfa: (code: string) => Promise<void>;
  resendMfa: () => Promise<void>;
  // DRIVER role not included — drivers register via acceptInvite
  // in driver-app/src/stores/auth.ts, not this register flow.
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: "SHIPPER" | "CARRIER" | "DISPATCHER";
    companyName?: string;
    carrierType?: string;
    associationId?: string;
    organizationId?: string;
    taxId?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Set up 401 handler to auto-logout
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
      walletGateMessage: null, // G-TOKEN-7: clear stale wallet gate
      sessionExpiredMessage: "Your session has expired. Please log in again.", // G-TOKEN-2
    });
  });

  // Set up 403 handler — refresh user status (AuthGuard routes REJECTED/SUSPENDED)
  setOnForbidden(() => {
    get().checkAuth();
  });

  // Set up 402 handler — store wallet gate message for Alert display
  setOnPaymentRequired((message: string) => {
    set({ walletGateMessage: message });
  });

  return {
    user: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    walletGateMessage: null,
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
        // Not authenticated - that's fine
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

        // Save tokens
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

    register: async (payload) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authService.register(payload);

        if (response.sessionToken) {
          await saveAuth({
            sessionToken: response.sessionToken,
            csrfToken: response.csrfToken,
            userId: response.user.id,
            userRole: response.user.role,
          });
        }

        set({ user: response.user, isLoading: false });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Registration failed.";
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
    clearWalletGate: () => set({ walletGateMessage: null }),
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
