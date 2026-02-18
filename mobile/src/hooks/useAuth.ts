/**
 * Auth hooks - convenience wrappers around the auth store
 */
import { useAuthStore } from "../stores/auth";

/** Get current user from auth store */
export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

/** Check if user is authenticated */
export function useIsAuthenticated() {
  return useAuthStore((s) => !!s.user);
}

/** Get user role */
export function useUserRole() {
  return useAuthStore((s) => s.user?.role ?? null);
}

/** Check if auth is initialized */
export function useIsAuthInitialized() {
  return useAuthStore((s) => s.isInitialized);
}

/** Check if auth is loading */
export function useIsAuthLoading() {
  return useAuthStore((s) => s.isLoading);
}
