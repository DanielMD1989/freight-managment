export const dynamic = "force-dynamic";
/**
 * User Sessions API
 *
 * Sprint 19 - Session Management
 *
 * Allows users to view their active sessions.
 */

import { NextResponse } from "next/server";
import { requireAuth, getUserSessions } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/user/sessions
 * Retrieve user's active sessions
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const sessions = await getUserSessions(session.userId);

    // Format sessions for response
    const formattedSessions = sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo || "Unknown device",
      ipAddress: s.ipAddress || "Unknown location",
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      // We can't reliably determine current session without session tracking in JWT
      // For now, mark most recent as current
      isCurrent: false,
    }));

    // Mark the most recently seen session as potentially current
    if (formattedSessions.length > 0) {
      formattedSessions[0].isCurrent = true;
    }

    return NextResponse.json({
      sessions: formattedSessions,
      count: formattedSessions.length,
    });
  } catch (error) {
    return handleApiError(error, "Get sessions error");
  }
}
