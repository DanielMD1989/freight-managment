export const dynamic = "force-dynamic";
/**
 * Driver Accept-Invite API — Task 13
 *
 * POST /api/drivers/accept-invite
 *
 * Unauthenticated endpoint — driver doesn't have an account yet. The invite
 * code + phone pair binds the request to a pre-created INVITED user row; the
 * driver supplies their password and (optional) CDL info, and the flow
 * promotes the user to PENDING_VERIFICATION for carrier approval.
 *
 * Rate limited to 5 attempts per 15 minutes per IP to make brute-force
 * guessing of 6-char invite codes impractical.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth";
import { notifyOrganization } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";
import { zodErrorResponse } from "@/lib/validation";

const acceptInviteSchema = z.object({
  inviteCode: z.string().length(6, "Invite code must be 6 characters"),
  phone: z.string().min(1, "Phone is required").max(20),
  password: z.string().min(8).max(128),
  cdlNumber: z.string().max(50).optional(),
  cdlExpiry: z.string().datetime().optional(),
  medicalCertExp: z.string().datetime().optional(),
});

// 5 attempts per 15 minutes per IP — same window as auth login.
const ACCEPT_INVITE_RATE_LIMIT = {
  name: "driver-accept-invite",
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req: NextRequest) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown",
  message: "Too many invite attempts. Please try again in 15 minutes.",
};

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP first — this endpoint is unauthenticated, so we can't
    // scope by userId. IP-based limiting is sufficient to thwart casual
    // brute-force attempts against the 31^6 code space.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateResult = await checkRateLimit(ACCEPT_INVITE_RATE_LIMIT, ip);
    if (!rateResult.allowed) {
      return NextResponse.json(
        {
          error: ACCEPT_INVITE_RATE_LIMIT.message,
          retryAfter: rateResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateResult.limit.toString(),
            "X-RateLimit-Remaining": rateResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateResult.resetTime).toISOString(),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const data = parsed.data;

    // Validate the driver's chosen password against the canonical policy
    // (same rules as /api/auth/register).
    const pwCheck = validatePasswordPolicy(data.password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        {
          error: "Password does not meet requirements",
          details: pwCheck.errors,
        },
        { status: 400 }
      );
    }

    // Invite codes are stored uppercase; accept any case and normalize.
    const normalizedCode = data.inviteCode.toUpperCase();

    const invitation = await db.invitation.findFirst({
      where: {
        token: normalizedCode,
        status: "PENDING",
      },
      select: {
        id: true,
        phone: true,
        expiresAt: true,
        organizationId: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite code has expired" },
        { status: 400 }
      );
    }

    if (invitation.phone !== data.phone) {
      return NextResponse.json(
        { error: "Phone number does not match invitation" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        phone: data.phone,
        role: "DRIVER",
        organizationId: invitation.organizationId,
        status: "INVITED",
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No matching driver account found" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(data.password);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          status: "PENDING_VERIFICATION",
        },
      });

      await tx.driverProfile.create({
        data: {
          userId: user.id,
          cdlNumber: data.cdlNumber || null,
          cdlExpiry: data.cdlExpiry ? new Date(data.cdlExpiry) : null,
          medicalCertExp: data.medicalCertExp
            ? new Date(data.medicalCertExp)
            : null,
          isAvailable: true,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });
    });

    // Notify the carrier org that a driver has completed registration and is
    // awaiting approval. notifyOrganization defaults exclude DRIVER from the
    // fan-out so the newly-accepted driver does not receive this notification.
    const fullName =
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "New driver";
    notifyOrganization({
      organizationId: invitation.organizationId,
      type: "DRIVER_REGISTERED",
      title: "New driver registered",
      message: `Driver ${fullName} has accepted the invitation and is pending approval.`,
      metadata: { driverId: user.id, invitationId: invitation.id },
    }).catch((err) =>
      console.warn("DRIVER_REGISTERED notification failed:", err?.message)
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Registration successful. Your account is pending carrier approval.",
        driverId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Driver accept-invite error");
  }
}
