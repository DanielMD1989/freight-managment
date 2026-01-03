/**
 * CSRF-Aware Fetch Utility
 *
 * Automatically includes CSRF tokens in state-changing requests
 * Sprint 9 - Story 9.6: CSRF Protection Enhancement
 */

/** CSRF token header name (must match server-side) */
const CSRF_HEADER_NAME = 'x-csrf-token';

/** Global CSRF token cache */
let csrfTokenCache: string | null = null;

/**
 * Fetch and cache CSRF token from server
 *
 * @returns CSRF token or null if failed
 */
async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const data = await response.json();
      csrfTokenCache = data.csrfToken;
      return data.csrfToken;
    }
  } catch (error) {
    console.warn('Failed to fetch CSRF token:', error);
  }

  return null;
}

/**
 * Get CSRF token (from cache or fetch fresh)
 *
 * @param forceFresh Force fetching a new token
 * @returns CSRF token or null
 */
export async function getCSRFToken(forceFresh = false): Promise<string | null> {
  if (!forceFresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  return await fetchCSRFToken();
}

/**
 * Clear cached CSRF token
 * Call this on logout
 */
export function clearCSRFToken(): void {
  csrfTokenCache = null;
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
  const method = options.method?.toUpperCase() || 'GET';

  // Only include CSRF token for state-changing requests
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    // Get CSRF token
    let token = csrfTokenCache;
    if (!token) {
      token = await fetchCSRFToken();
    }

    // If we still don't have a token, try one more time
    if (!token) {
      console.warn('CSRF token not available, request may fail');
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
    options.credentials = 'include';
  }

  // Make the request
  try {
    const response = await fetch(url, options);

    // If we get 403 with CSRF error, token might be stale
    if (response.status === 403) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.code === 'CSRF_TOKEN_INVALID') {
        // Clear cache and retry once
        csrfTokenCache = null;
        const freshToken = await fetchCSRFToken();

        if (freshToken) {
          options.headers = {
            ...options.headers,
            [CSRF_HEADER_NAME]: freshToken,
          };
          return fetch(url, options);
        }
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Initialize CSRF token on app load
 * Call this when user logs in or on app initialization
 */
export async function initializeCSRFToken(): Promise<void> {
  await fetchCSRFToken();
}
