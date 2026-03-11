/**
 * Verify OTP API (G-A1-1)
 *
 * POST /api/auth/verify-otp
 *
 * Verifies the 6-digit OTP submitted by the user.
 * On success: sets isEmailVerified or isPhoneVerified and clears OTP fields.
 * Enforcement (requiring verification before marketplace access) is deferred.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRegistrationAccess, verifyPassword } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { zodErrorResponse } from "@/lib/validation";

const verifyOtpSchema = z.object({
  code: z.string().length(6, "OTP must be exactly 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // G-M4-2: Use requireRegistrationAccess — blocks SUSPENDED while allowing
    // REGISTERED, PENDING_VERIFICATION, ACTIVE, and REJECTED users
    const session = await requireRegistrationAccess();

    const body = await request.json().catch(() => ({}));
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { code } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        otpCode: true,
        otpExpiresAt: true,
        otpChannel: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.otpCode) {
      return NextResponse.json({ error: "No OTP pending" }, { status: 400 });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return NextResponse.json({ error: "OTP expired" }, { status: 400 });
    }

    const isValid = await verifyPassword(code, user.otpCode);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    const updateData: Record<string, boolean | null | Date> = {
      otpCode: null,
      otpExpiresAt: null,
      otpChannel: null,
    };

    if (user.otpChannel === "email") {
      updateData.isEmailVerified = true;
    } else if (user.otpChannel === "sms") {
      updateData.isPhoneVerified = true;
    }

    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: updateData,
      select: { isEmailVerified: true, isPhoneVerified: true },
    });

    return NextResponse.json({
      message: "Verified",
      isEmailVerified: updatedUser.isEmailVerified,
      isPhoneVerified: updatedUser.isPhoneVerified,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Unauthorized" ||
        error.message === "Unauthorized: User not found"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
