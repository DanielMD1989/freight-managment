import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { SessionCache, UserCache, CacheInvalidation, cache as globalCache } from "@/lib/cache";

/**
 * Production-Ready JWT Authentication
 *
 * Features:
 * - Signed JWT (HS256) - Ensures integrity (can't be tampered)
 * - Encrypted JWT (A256GCM) - Ensures confidentiality (payload hidden)
 * - HttpOnly + Secure + SameSite cookies
 * - Configurable expiration
 *
 * Security: Even if cookie is intercepted, payload cannot be read without secret
 */

// Signing key (32+ bytes recommended for HS256)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-jwt-secret-min-32-chars!"
);

// Encryption key (must be exactly 32 bytes for A256GCM)
// Pad or truncate to ensure exactly 32 bytes
function getEncryptionKey(): Uint8Array {
  const keyString = process.env.JWT_ENCRYPTION_KEY || "dev-encrypt-key-32bytes-padding!";
  const encoded = new TextEncoder().encode(keyString);
  const key = new Uint8Array(32);
  key.set(encoded.slice(0, 32));
  // If key is shorter than 32 bytes, remaining bytes are 0 (padded)
  return key;
}
const JWT_ENCRYPTION_KEY = getEncryptionKey();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Feature flag: Enable encryption (disable for debugging if needed)
const ENABLE_ENCRYPTION = process.env.JWT_ENABLE_ENCRYPTION !== "false";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
  status?: string;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  sessionId?: string; // Sprint 19: Server-side session ID for session management
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Create a signed and optionally encrypted JWT token
 *
 * When encrypted (production):
 * - Payload is completely hidden from inspection
 * - Even base64 decoding reveals nothing
 * - Only server with encryption key can read contents
 */
export async function createToken(payload: SessionPayload): Promise<string> {
  // First, create a signed JWT
  const signedToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);

  // In production, encrypt the signed token
  if (ENABLE_ENCRYPTION) {
    const encryptedToken = await new EncryptJWT({ token: signedToken })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRES_IN)
      .encrypt(JWT_ENCRYPTION_KEY);

    return encryptedToken;
  }

  return signedToken;
}

/**
 * Verify and decrypt JWT token
 *
 * Process:
 * 1. Decrypt outer JWE layer (if encrypted)
 * 2. Verify inner JWS signature
 * 3. Return payload if valid
 */
export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    let signedToken = token;

    // If encryption is enabled, decrypt first
    if (ENABLE_ENCRYPTION) {
      try {
        const { payload: encryptedPayload } = await jwtDecrypt(token, JWT_ENCRYPTION_KEY);
        signedToken = encryptedPayload.token as string;
      } catch {
        // Fallback: Try as unencrypted token (migration support)
        signedToken = token;
      }
    }

    // Verify the signed token
    const { payload } = await jwtVerify(signedToken, JWT_SECRET);
    return payload as SessionPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  return await verifyToken(token);
}

/**
 * Get session from Authorization header (for mobile/API clients)
 * Use this when you need to support Bearer token auth
 */
export async function getSessionFromHeader(authHeader: string | null): Promise<SessionPayload | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  if (!token) {
    return null;
  }

  // For Bearer tokens, we use the signed (non-encrypted) token format
  // created by createSessionToken()
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch (error) {
    console.error("Bearer token verification failed:", error);
    return null;
  }
}

/**
 * Get session from either cookies or Authorization header
 * Checks cookies first, then falls back to Authorization header
 * If no authHeader provided, automatically reads from request headers
 */
export async function getSessionAny(authHeader?: string | null): Promise<SessionPayload | null> {
  // Try cookies first
  const cookieSession = await getSession();
  if (cookieSession) {
    return cookieSession;
  }

  // Get auth header from parameter or from request context
  let authorizationHeader = authHeader;
  if (authorizationHeader === undefined) {
    try {
      const headerStore = await headers();
      authorizationHeader = headerStore.get('authorization');
    } catch {
    }
  }

  // Fall back to Authorization header
  if (authorizationHeader) {
    return await getSessionFromHeader(authorizationHeader);
  }

  return null;
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await createToken(payload);
  const cookieStore = await cookies();

  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  // PHASE 4: Cache session data in Redis for fast lookups
  // This eliminates DB lookups on every request
  if (payload.sessionId) {
    await SessionCache.set(payload.sessionId, {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    });
  }

  // Also cache user profile for fast access
  // SECURITY: Do NOT default to ACTIVE - if status is missing, treat as PENDING_VERIFICATION
  // This prevents unauthorized access if JWT is malformed or tampered with
  const validStatuses = ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'REJECTED'];
  const userStatus = payload.status && validStatuses.includes(payload.status)
    ? payload.status
    : 'PENDING_VERIFICATION';

  if (!payload.status || !validStatuses.includes(payload.status)) {
    console.warn(`[AUTH] Invalid or missing status in JWT for user ${payload.userId}. Defaulting to PENDING_VERIFICATION.`);
  }

  await UserCache.set(payload.userId, {
    id: payload.userId,
    email: payload.email,
    firstName: payload.firstName || "",
    lastName: payload.lastName || "",
    role: payload.role,
    status: userStatus,
    organizationId: payload.organizationId,
  });
}

export async function clearSession(): Promise<void> {
  // Get session before clearing to invalidate cache
  const session = await getSession();

  const cookieStore = await cookies();
  cookieStore.delete("session");

  // PHASE 4: Invalidate Redis cache on logout
  if (session) {
    if (session.sessionId) {
      await CacheInvalidation.session(session.sessionId, session.userId);
    }
    // Also clear user status cache
    userStatusCache.delete(session.userId);
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSessionAny();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

/**
 * Require authenticated user with ACTIVE status
 * Checks database to ensure user is still active (real-time enforcement)
 * Use this for protected actions that require verified active users
 */
/**
 * PHASE 4: Scalability - Cache user status in Redis for distributed caching
 * Primary: Redis (5 minute TTL)
 * Fallback: In-memory Map (5 second TTL)
 * At 10K DAU: reduces DB queries by 95%+ for status checks
 */
const userStatusCache = new Map<string, { status: string; isActive: boolean; cachedAt: number }>();
const USER_STATUS_CACHE_TTL_MS = 5000; // 5 seconds for in-memory fallback

export async function requireActiveUser(): Promise<SessionPayload & { dbStatus: string }> {
  const session = await getSessionAny();

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Import db here to avoid circular dependencies
  const { db } = await import("./db");

  let userStatus: { status: string; isActive: boolean };
  const now = Date.now();

  // PHASE 4: Check Redis cache first (distributed)
  const cachedUser = await UserCache.get(session.userId);
  if (cachedUser && cachedUser.status) {
    userStatus = { status: cachedUser.status, isActive: cachedUser.status === 'ACTIVE' };
  } else {
    // Fallback: Check in-memory cache (local)
    const memoryCached = userStatusCache.get(session.userId);
    if (memoryCached && (now - memoryCached.cachedAt) < USER_STATUS_CACHE_TTL_MS) {
      userStatus = { status: memoryCached.status, isActive: memoryCached.isActive };
    } else {
      // Cache miss: Fetch from database
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isActive: true,
          organizationId: true,
        },
      });

      if (!user) {
        throw new Error("Unauthorized: User not found");
      }

      userStatus = { status: user.status, isActive: user.isActive };

      // Cache in both Redis and in-memory
      userStatusCache.set(session.userId, { ...userStatus, cachedAt: now });
      await UserCache.set(session.userId, {
        id: user.id,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: user.role,
        status: user.status,
        organizationId: user.organizationId || undefined,
      });
    }
  }

  // Check user status - only ACTIVE users can perform actions
  if (userStatus.status !== 'ACTIVE') {
    if (userStatus.status === 'SUSPENDED') {
      throw new Error("Forbidden: Account suspended");
    }
    if (userStatus.status === 'REJECTED') {
      throw new Error("Forbidden: Account rejected");
    }
    if (userStatus.status === 'REGISTERED' || userStatus.status === 'PENDING_VERIFICATION') {
      throw new Error("Forbidden: Account pending verification");
    }
    throw new Error("Forbidden: Account inactive");
  }

  // Legacy check
  if (!userStatus.isActive) {
    throw new Error("Forbidden: Account inactive");
  }

  return { ...session, dbStatus: userStatus.status };
}

/**
 * Invalidate user status cache (call when user status changes)
 * PHASE 4: Clears both Redis and in-memory cache
 */
export async function invalidateUserStatusCache(userId: string): Promise<void> {
  userStatusCache.delete(userId);
  await CacheInvalidation.user(userId);
}

export async function requireRole(
  allowedRoles: string[]
): Promise<SessionPayload> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return session;
}

/**
 * Require active user with specific role
 * Combines role check with active status verification
 */
export async function requireActiveRole(
  allowedRoles: string[]
): Promise<SessionPayload & { dbStatus: string }> {
  const session = await requireActiveUser();

  if (!allowedRoles.includes(session.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return session;
}

/**
 * Allow access for users in registration flow
 * Permits REGISTERED and PENDING_VERIFICATION users for limited actions
 * (e.g., document upload, profile completion)
 */
export async function requireRegistrationAccess(): Promise<SessionPayload & { dbStatus: string }> {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const { db } = await import("./db");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { status: true, isActive: true },
  });

  if (!user) {
    throw new Error("Unauthorized: User not found");
  }

  // Allow REGISTERED, PENDING_VERIFICATION, and ACTIVE users
  const allowedStatuses = ['REGISTERED', 'PENDING_VERIFICATION', 'ACTIVE'];
  if (!allowedStatuses.includes(user.status)) {
    if (user.status === 'SUSPENDED') {
      throw new Error("Forbidden: Account suspended");
    }
    if (user.status === 'REJECTED') {
      throw new Error("Forbidden: Account rejected");
    }
    throw new Error("Forbidden: Account inactive");
  }

  return { ...session, dbStatus: user.status };
}

/**
 * Check if user status allows login
 * SUSPENDED and REJECTED users cannot login
 * REGISTERED and PENDING_VERIFICATION get limited access
 */
export function isLoginAllowed(status: string): { allowed: boolean; limited: boolean; error?: string } {
  switch (status) {
    case 'ACTIVE':
      return { allowed: true, limited: false };
    case 'REGISTERED':
    case 'PENDING_VERIFICATION':
      return { allowed: true, limited: true };
    case 'SUSPENDED':
      return { allowed: false, limited: false, error: 'Account suspended. Please contact support.' };
    case 'REJECTED':
      return { allowed: false, limited: false, error: 'Registration rejected. Please contact support.' };
    default:
      return { allowed: false, limited: false, error: 'Account inactive.' };
  }
}

/**
 * Get current user from session
 * Returns user object with full details from database
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  // Import db here to avoid circular dependencies
  const { db } = await import("./db");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      isActive: true,
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return user;
}

// ============================================================================
// SPRINT 19: SESSION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Generate a session token (32 bytes of random data)
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a session token for storage
 * We store hashed tokens to prevent token theft if DB is compromised
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Parse user agent string to extract device info
 */
export function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  // Simple parsing - extract browser and OS
  let browser = "Unknown browser";
  let os = "Unknown OS";

  // Detect browser
  if (userAgent.includes("Firefox/")) browser = "Firefox";
  else if (userAgent.includes("Edg/")) browser = "Edge";
  else if (userAgent.includes("Chrome/")) browser = "Chrome";
  else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) browser = "Safari";
  else if (userAgent.includes("Opera") || userAgent.includes("OPR/")) browser = "Opera";

  // Detect OS
  if (userAgent.includes("Windows NT 10")) os = "Windows 10";
  else if (userAgent.includes("Windows NT 11") || userAgent.includes("Windows NT 10.0; Win64; x64")) os = "Windows";
  else if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS X")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

/**
 * Create a session record in the database
 * Returns the session token (to be stored in cookie)
 * PHASE 4: Also caches session in Redis for fast lookups
 */
export async function createSessionRecord(
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null,
  userDetails?: { email: string; role: string; organizationId?: string }
): Promise<{ sessionId: string; token: string }> {
  const { db } = await import("./db");

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const deviceInfo = parseUserAgent(userAgent || null);

  // Session expires in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      deviceInfo,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
    },
  });

  // PHASE 4: Cache session in Redis for fast lookups
  if (userDetails) {
    await SessionCache.set(session.id, {
      userId,
      email: userDetails.email,
      role: userDetails.role,
      organizationId: userDetails.organizationId,
    });
  }

  return { sessionId: session.id, token };
}

/**
 * Validate a session by its token hash
 * Returns session if valid, null if invalid/revoked/expired
 * PHASE 4: Uses Redis cache for faster lookups
 */
export async function validateSessionByToken(token: string): Promise<{
  valid: boolean;
  session: { id: string; userId: string; email?: string; role?: string; organizationId?: string } | null;
  reason?: string;
}> {
  const { db } = await import("./db");

  const tokenHash = hashSessionToken(token);

  // First, lookup session in database (needed to validate token hash)
  const session = await db.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!session) {
    return { valid: false, session: null, reason: "Session not found" };
  }

  if (session.revokedAt) {
    // PHASE 4: Ensure cache is invalidated for revoked sessions
    await CacheInvalidation.session(session.id, session.userId);
    return { valid: false, session: null, reason: "Session revoked" };
  }

  if (new Date() > session.expiresAt) {
    // PHASE 4: Clean up expired session from cache
    await CacheInvalidation.session(session.id, session.userId);
    return { valid: false, session: null, reason: "Session expired" };
  }

  // PHASE 4: Try to get extended session data from cache
  const cachedSession = await SessionCache.get(session.id);
  if (cachedSession) {
    // Refresh TTL on successful validation
    await SessionCache.set(session.id, cachedSession);
    return {
      valid: true,
      session: {
        id: session.id,
        userId: session.userId,
        email: cachedSession.email,
        role: cachedSession.role,
        organizationId: cachedSession.organizationId,
      },
    };
  }

  return { valid: true, session: { id: session.id, userId: session.userId } };
}

/**
 * Update session last seen timestamp
 * PHASE 4: Also refreshes Redis cache TTL
 */
export async function updateSessionLastSeen(sessionId: string): Promise<void> {
  const { db } = await import("./db");

  await db.session.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });

  // PHASE 4: Refresh Redis cache TTL on activity
  // Re-cache the session to extend its TTL
  const cached = await SessionCache.get(sessionId);
  if (cached) {
    await SessionCache.set(sessionId, cached);
  }
}

/**
 * PHASE 4: Refresh session cache TTL without DB write
 * Call this on each request to extend cache validity
 * Lightweight operation - only updates Redis TTL
 */
export async function refreshSessionCacheTTL(sessionId: string): Promise<void> {
  const cached = await SessionCache.get(sessionId);
  if (cached) {
    await SessionCache.set(sessionId, cached);
  }
}

/**
 * Revoke a specific session
 * PHASE 4: Also invalidates Redis cache
 */
export async function revokeSession(sessionId: string, userId?: string): Promise<void> {
  const { db } = await import("./db");

  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  // PHASE 4: Invalidate Redis cache
  await CacheInvalidation.session(sessionId, userId);
}

/**
 * Revoke all sessions for a user
 * Optionally exclude a specific session (current session)
 * PHASE 4: Also invalidates all Redis session caches for user
 */
export async function revokeAllSessions(
  userId: string,
  excludeSessionId?: string
): Promise<number> {
  const { db } = await import("./db");

  // Get all active sessions to invalidate cache
  const sessions = await db.session.findMany({
    where: {
      userId,
      revokedAt: null,
      ...(excludeSessionId && { id: { not: excludeSessionId } }),
    },
    select: { id: true },
  });

  const result = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(excludeSessionId && { id: { not: excludeSessionId } }),
    },
    data: { revokedAt: new Date() },
  });

  // PHASE 4: Invalidate Redis cache for all revoked sessions
  await Promise.all(
    sessions.map(session => CacheInvalidation.session(session.id, userId))
  );

  // Also clear user status cache
  userStatusCache.delete(userId);

  return result.count;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string) {
  const { db } = await import("./db");

  return db.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { db } = await import("./db");

  // Delete sessions that expired more than 30 days ago
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const result = await db.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: cutoffDate } },
        { revokedAt: { lt: cutoffDate } },
      ],
    },
  });

  return result.count;
}

// ============================================================================
// PASSWORD POLICY
// ============================================================================

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password against policy
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 */
export function validatePasswordPolicy(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least 1 uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least 1 lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least 1 number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// MFA HELPERS
// ============================================================================

/**
 * Generate recovery codes for MFA
 * Returns array of 10 random 8-character codes
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes confusing chars (0/O, 1/I)

  for (let i = 0; i < 10; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      const randomIndex = randomBytes(1)[0] % charset.length;
      code += charset[randomIndex];
    }
    // Format: XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hash recovery codes for storage
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(code => bcrypt.hash(code.replace("-", ""), 10)));
}

/**
 * Verify a recovery code against hashed codes
 * Returns the index if found, -1 if not found
 */
export async function verifyRecoveryCode(
  code: string,
  hashedCodes: string[]
): Promise<number> {
  const normalizedCode = code.replace("-", "").toUpperCase();

  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalizedCode, hashedCodes[i]);
    if (match) {
      return i;
    }
  }

  return -1;
}

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  const otp = randomBytes(3).readUIntBE(0, 3) % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Create a session token for mobile clients (unencrypted, signed JWT)
 * This token is sent in Authorization header instead of cookies
 * for mobile apps that can't easily handle cross-origin cookies
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  // Create a signed JWT (not encrypted) for mobile clients
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);

  return token;
}
