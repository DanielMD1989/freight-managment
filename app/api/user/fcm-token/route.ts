/**
 * FCM Device Token Registration API
 *
 * POST - Register a device token for push notifications
 * DELETE - Unregister the current device token
 *
 * Mobile clients call this after obtaining an FCM/Expo push token.
 * Tokens are stored in the DeviceToken model for server-side push delivery.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { db } from "@/lib/db";

const registerSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().max(50).optional(),
});

/**
 * POST /api/user/fcm-token — Register a device push token
 */
export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, platform, appVersion } = parsed.data;

    // Upsert — same user+token pair gets updated, new pair gets created
    await db.deviceToken.upsert({
      where: {
        userId_token: {
          userId: session.userId,
          token,
        },
      },
      update: {
        platform,
        appVersion: appVersion ?? null,
        lastActive: new Date(),
      },
      create: {
        userId: session.userId,
        token,
        platform,
        appVersion: appVersion ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("FCM token registration failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/fcm-token — Unregister device token(s) for current user
 */
export async function DELETE(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    // If a specific token is provided in the body, delete only that one
    try {
      const body = await request.json();
      if (body?.token) {
        await db.deviceToken.deleteMany({
          where: {
            userId: session.userId,
            token: body.token,
          },
        });
        return NextResponse.json({ success: true });
      }
    } catch {
      // No body / invalid JSON — delete all tokens for this user
    }

    // Delete all tokens for this user (full logout)
    await db.deviceToken.deleteMany({
      where: { userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("FCM token deletion failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
