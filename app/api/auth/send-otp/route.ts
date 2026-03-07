/**
 * Send OTP API (G-A1-1)
 *
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit OTP, hashes it, and stores it on the user record.
 * Sends via email (email channel) or logs to console (sms — no SMS provider yet).
 * Rate limited to 3 sends per hour per user.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, hashPassword } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { checkRateLimit, RATE_LIMIT_OTP_SEND } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { zodErrorResponse } from "@/lib/validation";

const sendOtpSchema = z.object({
  channel: z.enum(["email", "sms"]),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    // Rate limit: 3 OTP sends per hour per user
    const rateLimitResult = await checkRateLimit(
      RATE_LIMIT_OTP_SEND,
      `otp:${session.userId}`,
      request
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error:
            RATE_LIMIT_OTP_SEND.message ||
            "Too many OTP requests. Please wait before requesting another code.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { channel } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, firstName: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await hashPassword(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.user.update({
      where: { id: session.userId },
      data: {
        otpCode: hashedCode,
        otpExpiresAt: expiresAt,
        otpChannel: channel,
      },
    });

    if (channel === "email") {
      await sendEmail({
        to: user.email,
        subject: "Your verification code",
        html: `<p>Hi ${user.firstName ?? "there"},</p><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
        text: `Your verification code is: ${code}. Expires in 10 minutes.`,
      });
    } else {
      // SMS channel — no provider configured; log for development
      console.log(`[OTP/SMS] User ${session.userId} code: ${code}`);
    }

    return NextResponse.json({ message: "OTP sent", expiresIn: 600 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Send OTP error:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
