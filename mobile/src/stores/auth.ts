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
import { saveAuth, clearAuth, setOnUnauthorized } from "../api/client";

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

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  verifyMfa: (code: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: "SHIPPER" | "CARRIER" | "DISPATCHER";
    companyName: string;
    carrierType?: string;
    associationId?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Set up 401 handler to auto-logout
  setOnUnauthorized(() => {
    set({ user: null, isLoading: false, mfaPending: false, mfaToken: null });
  });

  return {
    user: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    mfaPending: false,
    mfaToken: null,

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
          set({
            isLoading: false,
            mfaPending: true,
            mfaToken: response.mfaToken ?? null,
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
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "MFA verification failed.";
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
  };
});
