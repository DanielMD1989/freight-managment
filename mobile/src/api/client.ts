/**
 * API Client - Axios instance with interceptors
 * Ported from Flutter's api_client.dart
 *
 * Features:
 * - Bearer token auth from secure storage
 * - CSRF header for mutations
 * - x-client-type: mobile header
 * - 401 auto-logout handler
 * - Wrapped/unwrapped response handling
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Storage keys (match Flutter StorageKeys)
export const STORAGE_KEYS = {
  SESSION_TOKEN: "session_token",
  CSRF_TOKEN: "csrf_token",
  USER_ID: "user_id",
  USER_ROLE: "user_role",
} as const;

// API base URL - configurable via Expo Constants
const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  (process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000");

/** Callback invoked on 401 to notify auth state */
let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

// Create Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---- Storage helpers (platform-aware) ----

async function readSecure(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    // On web, use localStorage (not encrypted but acceptable - see Flutter notes)
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeSecure(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage may be unavailable in some contexts
    }
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function deleteSecure(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

// ---- Request interceptor: add auth + CSRF headers ----

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Add Bearer token
    const token = await readSecure(STORAGE_KEYS.SESSION_TOKEN);
    if (token && token !== "authenticated") {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Mark as mobile client
    config.headers["x-client-type"] = "mobile";

    // Add CSRF token for state-changing requests
    if (["post", "put", "patch", "delete"].includes(config.method ?? "")) {
      const csrfToken = await readSecure(STORAGE_KEYS.CSRF_TOKEN);
      if (csrfToken) {
        config.headers["x-csrf-token"] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Response interceptor: extract tokens, handle 401 ----

apiClient.interceptors.response.use(
  async (response) => {
    // Extract CSRF token from cookies (native only - browser handles cookies)
    if (Platform.OS !== "web") {
      const setCookie = response.headers["set-cookie"];
      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const cookie of cookies) {
          if (cookie.startsWith("csrf_token=")) {
            const token = cookie.split(";")[0].split("=")[1];
            await writeSecure(STORAGE_KEYS.CSRF_TOKEN, token);
          }
          if (cookie.startsWith("session=")) {
            const token = cookie.split(";")[0].split("=")[1];
            await writeSecure(STORAGE_KEYS.SESSION_TOKEN, token);
          }
        }
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    // Handle 401 - clear tokens and notify auth state
    if (error.response?.status === 401) {
      const path = error.config?.url ?? "";
      const isAuthEndpoint =
        path.includes("/auth/login") ||
        path.includes("/auth/register") ||
        path.includes("/auth/verify-mfa");

      if (!isAuthEndpoint) {
        await clearAuth();
        onUnauthorizedCallback?.();
      }
    }
    return Promise.reject(error);
  }
);

// ---- Auth token management ----

export async function saveAuth(params: {
  sessionToken: string;
  csrfToken?: string;
  userId: string;
  userRole: string;
}): Promise<void> {
  await writeSecure(STORAGE_KEYS.SESSION_TOKEN, params.sessionToken);
  if (params.csrfToken) {
    await writeSecure(STORAGE_KEYS.CSRF_TOKEN, params.csrfToken);
  }
  await writeSecure(STORAGE_KEYS.USER_ID, params.userId);
  await writeSecure(STORAGE_KEYS.USER_ROLE, params.userRole);
}

export async function clearAuth(): Promise<void> {
  await deleteSecure(STORAGE_KEYS.SESSION_TOKEN);
  await deleteSecure(STORAGE_KEYS.CSRF_TOKEN);
  await deleteSecure(STORAGE_KEYS.USER_ID);
  await deleteSecure(STORAGE_KEYS.USER_ROLE);
}

export async function isAuthenticated(): Promise<boolean> {
  if (Platform.OS === "web") {
    const userId = await readSecure(STORAGE_KEYS.USER_ID);
    return !!userId;
  }
  const token = await readSecure(STORAGE_KEYS.SESSION_TOKEN);
  return !!token;
}

export async function getCurrentUserId(): Promise<string | null> {
  return readSecure(STORAGE_KEYS.USER_ID);
}

export async function getCurrentUserRole(): Promise<string | null> {
  return readSecure(STORAGE_KEYS.USER_ROLE);
}

// ---- Error helpers ----

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "error" in data) {
      return String(data.error);
    }
    switch (error.code) {
      case "ECONNABORTED":
        return "Connection timed out. Please check your internet.";
      case "ERR_NETWORK":
        return Platform.OS === "web"
          ? "Connection failed. This may be a CORS issue."
          : "No internet connection.";
      case "ERR_CANCELED":
        return "Request cancelled.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

export default apiClient;
