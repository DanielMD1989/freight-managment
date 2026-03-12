/**
 * Edge Middleware — Global Status Guard
 *
 * Intercepts web requests and redirects users based on JWT status:
 * - REJECTED → /account-rejected
 * - SUSPENDED → /account-suspended
 * - REGISTERED | PENDING_VERIFICATION → /verification-pending
 * - ACTIVE → pass through
 *
 * Uses jose directly (Edge-compatible — cannot import lib/auth.ts which pulls in bcryptjs).
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtDecrypt, jwtVerify } from "jose";

// Mirror lib/auth.ts key derivation (Edge-compatible)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-jwt-secret-min-32-chars!"
);

function getEncryptionKey(): Uint8Array {
  const keyString =
    process.env.JWT_ENCRYPTION_KEY || "dev-encrypt-key-32bytes-padding!";
  const encoded = new TextEncoder().encode(keyString);
  const key = new Uint8Array(32);
  key.set(encoded.slice(0, 32));
  return key;
}

const JWT_ENCRYPTION_KEY = getEncryptionKey();
const ENABLE_ENCRYPTION = process.env.JWT_ENABLE_ENCRYPTION !== "false";

interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  status?: string;
}

async function extractSession(token: string): Promise<SessionPayload | null> {
  try {
    let signedToken = token;

    if (ENABLE_ENCRYPTION) {
      try {
        const { payload: encryptedPayload } = await jwtDecrypt(
          token,
          JWT_ENCRYPTION_KEY
        );
        signedToken = encryptedPayload.token as string;
      } catch {
        // In production, reject tokens that fail decryption
        if (process.env.NODE_ENV === "production") {
          return null;
        }
        // Dev fallback: try as unencrypted
        signedToken = token;
      }
    }

    const { payload } = await jwtVerify(signedToken, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

const STATUS_REDIRECTS: Record<string, string> = {
  REJECTED: "/account-rejected",
  SUSPENDED: "/account-suspended",
  REGISTERED: "/verification-pending",
  PENDING_VERIFICATION: "/verification-pending",
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.next();
  }

  const session = await extractSession(token);
  if (!session || !session.status) {
    // No valid session or no status — let page-level auth handle it
    return NextResponse.next();
  }

  // ACTIVE users pass through
  if (session.status === "ACTIVE") {
    return NextResponse.next();
  }

  // G-M8-6: Allow non-ACTIVE users to access document pages for upload/resubmit
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/shipper/documents") ||
    pathname.startsWith("/carrier/documents")
  ) {
    return NextResponse.next();
  }

  const redirectPath = STATUS_REDIRECTS[session.status];
  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  // Unknown status — pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /account-rejected, /account-suspended, /verification-pending (prevent loops)
     * - /login, /register, /forgot-password (auth pages)
     * - /api/ (API routes have their own guards)
     * - /_next/ (Next.js internals)
     * - /favicon.ico, static assets
     */
    "/((?!account-rejected|account-suspended|verification-pending|login|register|forgot-password|api/|_next/|favicon\\.ico|.*\\.).*)",
  ],
};
