/**
 * Shared token-cache for E2E tests.
 *
 * Single source of truth for file-based JWT caching across all role
 * test-utils (shipper, carrier, admin, dispatcher). Changing the cache
 * format here propagates to all consumers automatically.
 */

import fs from "fs";
import path from "path";

const TOKEN_CACHE_DIR = path.join(__dirname, "../.auth");
const TOKEN_CACHE_FILE = path.join(TOKEN_CACHE_DIR, "token-cache.json");
export const TOKEN_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export interface TokenCache {
  [email: string]: { token: string; timestamp: number };
}

export function readTokenCache(): TokenCache {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf-8"));
    }
  } catch {
    /* ignore parse errors — return empty cache */
  }
  return {};
}

export function writeTokenCache(cache: TokenCache): void {
  fs.mkdirSync(TOKEN_CACHE_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache));
}

/** Invalidate a single user's cached token (e.g. after revoke test). */
export function invalidateTokenCache(email: string): void {
  const cache = readTokenCache();
  delete cache[email];
  writeTokenCache(cache);
}
