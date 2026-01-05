import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-jwt-secret"
);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
  status?: string; // Sprint 2: User verification workflow
  organizationId?: string;
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

export async function createToken(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();

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
export async function requireActiveUser(): Promise<SessionPayload & { dbStatus: string }> {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Import db here to avoid circular dependencies
  const { db } = await import("./db");

  // Fetch current user status from database (real-time check)
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { status: true, isActive: true },
  });

  if (!user) {
    throw new Error("Unauthorized: User not found");
  }

  // Check user status - only ACTIVE users can perform actions
  if (user.status !== 'ACTIVE') {
    if (user.status === 'SUSPENDED') {
      throw new Error("Forbidden: Account suspended");
    }
    if (user.status === 'REJECTED') {
      throw new Error("Forbidden: Account rejected");
    }
    if (user.status === 'REGISTERED' || user.status === 'PENDING_VERIFICATION') {
      throw new Error("Forbidden: Account pending verification");
    }
    throw new Error("Forbidden: Account inactive");
  }

  // Legacy check
  if (!user.isActive) {
    throw new Error("Forbidden: Account inactive");
  }

  return { ...session, dbStatus: user.status };
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
