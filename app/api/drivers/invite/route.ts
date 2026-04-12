export const dynamic = "force-dynamic";
/**
 * Driver Invite API — Task 13
 *
 * POST /api/drivers/invite
 *
 * Carrier generates a 6-character invite code for a driver. Creates both
 * an Invitation row and an INVITED User row in a single transaction; the
 * driver later claims the code via POST /api/drivers/accept-invite.
 *
 * Blueprint §2 (driver additions): drivers do NOT self-register. They are
 * always invited by a carrier, so the carrier-side CSRF+auth stack applies
 * to this endpoint, and the accept-invite endpoint is unauthenticated.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { zodErrorResponse } from "@/lib/validation";

// 6-char uppercase alphanumeric, excluding ambiguous chars (0/O, 1/I/L).
// Matches the convention used by generateRecoveryCodes() in lib/auth.ts.
const INVITE_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 6;
const INVITE_TTL_DAYS = 7;

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    // crypto.randomInt avoids the modulo bias of randomBytes(n) % len.
    const idx = crypto.randomInt(0, INVITE_CODE_CHARSET.length);
    code += INVITE_CODE_CHARSET[idx];
  }
  return code;
}

const inviteSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().min(1, "Phone is required").max(20),
  email: z.string().email("Invalid email address").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();

    // Only carriers can invite drivers.
    if (session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only carriers can invite drivers" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to a carrier organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const data = parsed.data;

    // Reject if a driver with this phone already exists in this carrier org.
    const existingDriver = await db.user.findFirst({
      where: {
        phone: data.phone,
        role: "DRIVER",
        organizationId: session.organizationId,
      },
      select: { id: true },
    });
    if (existingDriver) {
      return NextResponse.json(
        { error: "A driver with this phone already exists" },
        { status: 400 }
      );
    }

    // Reject if there's already a pending invitation for this phone in this org.
    const existingInvite = await db.invitation.findFirst({
      where: {
        phone: data.phone,
        role: "DRIVER",
        organizationId: session.organizationId,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (existingInvite) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this phone" },
        { status: 400 }
      );
    }

    // Split the name into firstName / lastName. First whitespace-separated
    // token becomes firstName; everything after that joins into lastName.
    const trimmedName = data.name.trim();
    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const inviteCode = generateInviteCode();
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    // Placeholder email keeps the User.email @unique constraint happy when the
    // carrier didn't supply a real one. Driver can update on accept if desired.
    const placeholderEmail = `driver_${inviteCode.toLowerCase()}@placeholder.freight`;

    const result = await db.$transaction(async (tx) => {
      const invitation = await tx.invitation.create({
        data: {
          email: data.email || "",
          phone: data.phone,
          role: "DRIVER",
          organizationId: session.organizationId!,
          token: inviteCode,
          expiresAt,
          invitedById: session.userId,
        },
        select: { id: true, expiresAt: true },
      });

      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          phone: data.phone,
          email: data.email || placeholderEmail,
          passwordHash: "", // empty — driver sets password on accept
          role: "DRIVER",
          organizationId: session.organizationId!,
          status: "INVITED",
          createdById: session.userId,
        },
        select: { id: true },
      });

      return { invitation, user };
    });

    return NextResponse.json(
      {
        success: true,
        inviteCode,
        driverName: data.name,
        phone: data.phone,
        expiresAt: result.invitation.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Driver invite error");
  }
}
