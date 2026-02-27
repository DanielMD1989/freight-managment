/**
 * CSRF-Aware Fetch Utility
 *
 * Automatically includes CSRF tokens in state-changing requests.
 * Handles token caching, expiry, deduplication, and automatic refresh.
 *
 * Sprint 9 - Story 9.6: CSRF Protection Enhancement
 * Updated: Comprehensive fix for intermittent token errors
 */

/** CSRF token header name (must match server-side) */
const CSRF_HEADER_NAME = "x-csrf-token";

/** Token cache with expiry tracking */
interface TokenCache {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

/** Global CSRF token cache */
let csrfTokenCache: TokenCache | null = null;

/** Promise for in-flight token fetch (prevents duplicate requests) */
let fetchingTokenPromise: Promise<string | null> | null = null;

/** Buffer time before expiry to proactively refresh (5 minutes) */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Check if cached token is valid and not near expiry
 */
function isCacheValid(): boolean {
  if (!csrfTokenCache) return false;
  // Token is valid if we have more than EXPIRY_BUFFER_MS before expiry
  return Date.now() < csrfTokenCache.expiresAt - EXPIRY_BUFFER_MS;
}

/**
 * Check if cached token is usable (even if near expiry)
 */
function isCacheUsable(): boolean {
  if (!csrfTokenCache) return false;
  return Date.now() < csrfTokenCache.expiresAt;
}

/**
 * Fetch CSRF token from server
 * Uses request deduplication to prevent race conditions
 */
async function fetchCSRFTokenInternal(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf-token", {
      credentials: "include",
      cache: "no-store", // Don't cache this request
    });

    if (response.ok) {
      const data = await response.json();
      const expiresIn = data.expiresIn || 24 * 60 * 60; // Default 24 hours

      csrfTokenCache = {
        token: data.csrfToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      return data.csrfToken;
    }

    // If we get 401, user is not authenticated - clear cache
    if (response.status === 401) {
      csrfTokenCache = null;
    }
  } catch (error) {
    console.warn("Failed to fetch CSRF token:", error);
  }

  return null;
}

/**
 * Fetch CSRF token with deduplication
 * Multiple simultaneous calls will share the same fetch
 */
async function fetchCSRFToken(): Promise<string | null> {
  // If there's already a fetch in progress, wait for it
  if (fetchingTokenPromise) {
    return fetchingTokenPromise;
  }

  // Start new fetch
  fetchingTokenPromise = fetchCSRFTokenInternal();

  try {
    return await fetchingTokenPromise;
  } finally {
    fetchingTokenPromise = null;
  }
}

/**
 * Get CSRF token (from cache or fetch fresh)
 *
 * @param forceFresh Force fetching a new token
 * @returns CSRF token or null
 */
export async function getCSRFToken(forceFresh = false): Promise<string | null> {
  // If force fresh, clear cache and fetch
  if (forceFresh) {
    csrfTokenCache = null;
    return await fetchCSRFToken();
  }

  // If cache is valid (not near expiry), use it
  if (isCacheValid()) {
    return csrfTokenCache!.token;
  }

  // If cache is usable but near expiry, use it but trigger background refresh
  if (isCacheUsable()) {
    // Trigger background refresh
    fetchCSRFToken().catch(() => {}); // Fire and forget
    return csrfTokenCache!.token;
  }

  // Cache not usable, fetch new token
  return await fetchCSRFToken();
}

/**
 * Clear cached CSRF token
 * Call this on logout
 */
export function clearCSRFToken(): void {
  csrfTokenCache = null;
  fetchingTokenPromise = null;
}

/**
 * Set CSRF token directly (used when login returns token)
 *
 * @param token CSRF token value
 * @param expiresIn Seconds until expiry (default 24 hours)
 */
export function setCSRFToken(token: string, expiresIn = 24 * 60 * 60): void {
  csrfTokenCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Fetch with automatic CSRF token inclusion
 *
 * Works like standard fetch(), but automatically includes CSRF token
 * for state-changing requests (POST, PUT, PATCH, DELETE)
 *
 * @param url Request URL
 * @param options Fetch options
 * @returns Fetch response
 */
export async function csrfFetch(
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";

  // Only include CSRF token for state-changing requests
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    // Get CSRF token
    const token = await getCSRFToken();

    if (!token) {
      console.warn("CSRF token not available, request may fail");
    }

    // Add CSRF token to headers
    if (token) {
      options.headers = {
        ...options.headers,
        [CSRF_HEADER_NAME]: token,
      };
    }
  }

  // Include credentials by default
  if (!options.credentials) {
    options.credentials = "include";
  }

  // Make the request
  const response = await fetch(url, options);

  // If we get 403 with CSRF error, token might be stale - retry once
  if (response.status === 403) {
    const clonedResponse = response.clone();
    try {
      const data = await clonedResponse.json();
      if (data.code === "CSRF_TOKEN_INVALID" || data.error?.includes("CSRF")) {
        // Clear cache and get fresh token
        clearCSRFToken();
        const freshToken = await getCSRFToken(true);

        if (freshToken) {
          // Retry with fresh token
          options.headers = {
            ...options.headers,
            [CSRF_HEADER_NAME]: freshToken,
          };
          return fetch(url, options);
        }
      }
    } catch {
      // Not JSON or parse error, return original response
    }
  }

  return response;
}

/**
 * Initialize CSRF token on app load
 * Call this when user logs in or on app initialization for authenticated users
 */
export async function initializeCSRFToken(): Promise<void> {
  await getCSRFToken();
}

/**
 * Check if CSRF token is currently cached
 */
export function hasCSRFToken(): boolean {
  return isCacheUsable();
}
