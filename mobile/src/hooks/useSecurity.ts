/**
 * Security Hooks — §14 Mobile Security Settings
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { securityService } from "../services/security";
import { authService } from "../services/auth";

const SESSIONS_KEY = ["security", "sessions"] as const;
const EVENTS_KEY = ["security", "events"] as const;
const RECOVERY_KEY = ["security", "recovery-codes"] as const;

// ── Password ──

export function useChangePassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => authService.changePassword(currentPassword, newPassword),
  });
}

// ── MFA ──

export function useEnableMfa() {
  return useMutation({
    mutationFn: (phone: string) => securityService.enableMfa(phone),
  });
}

export function useVerifyMfaSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (otp: string) => securityService.verifyMfaSetup(otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOVERY_KEY });
    },
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => securityService.disableMfa(password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: RECOVERY_KEY });
    },
  });
}

export function useRecoveryCodesStatus() {
  return useQuery({
    queryKey: [...RECOVERY_KEY],
    queryFn: () => securityService.getRecoveryCodesStatus(),
  });
}

export function useRegenerateRecoveryCodes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      securityService.regenerateRecoveryCodes(password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOVERY_KEY });
    },
  });
}

// ── Sessions ──

export function useSessions() {
  return useQuery({
    queryKey: [...SESSIONS_KEY],
    queryFn: () => securityService.getSessions(),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => securityService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => securityService.revokeAllSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

// ── Security Events ──

export function useSecurityEvents(limit = 50) {
  return useQuery({
    queryKey: [...EVENTS_KEY, limit],
    queryFn: () => securityService.getSecurityEvents(limit),
  });
}
