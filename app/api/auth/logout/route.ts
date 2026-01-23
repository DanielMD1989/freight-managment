import { NextResponse } from "next/server";
import { clearSession, getSession, revokeAllSessions } from "@/lib/auth";
import { clearCSRFToken } from "@/lib/csrf";

export async function POST() {
  try {
    // Get session before clearing to revoke all sessions for cross-device logout
    const session = await getSession();

    // Revoke all sessions for this user (security: cross-device logout)
    if (session?.userId) {
      await revokeAllSessions(session.userId);
    }

    await clearSession();

    const response = NextResponse.json({
      message: "Logout successful",
    });

    // Clear CSRF token
    clearCSRFToken(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
