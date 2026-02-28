import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  setSession,
  validatePasswordPolicy,
  createSessionRecord,
  createSessionToken,
} from "@/lib/auth";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { zodErrorResponse, sanitizeText } from "@/lib/validation";
import { OrganizationType, AccountType, Prisma } from "@prisma/client";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  role: z.enum(["SHIPPER", "CARRIER", "DISPATCHER"]),
  organizationId: z.string().max(50).optional(), // Sprint 16: Story 16.4 - Assign dispatcher to organization
  // Organization fields
  companyName: z.string().max(200).optional(),
  carrierType: z
    .enum(["CARRIER_COMPANY", "CARRIER_INDIVIDUAL", "FLEET_OWNER"])
    .optional(),
  associationId: z.string().max(50).optional(), // For individual carriers joining an association
  taxId: z.string().max(50).optional(), // Organization tax ID (TIN)
});

// Map carrier type to organization type
// FIX: Return proper OrganizationType enum
function getOrganizationType(
  role: string,
  carrierType?: string
): OrganizationType {
  if (role === "SHIPPER") {
    return OrganizationType.SHIPPER;
  }
  if (role === "CARRIER") {
    switch (carrierType) {
      case "CARRIER_COMPANY":
        return OrganizationType.CARRIER_COMPANY;
      case "CARRIER_INDIVIDUAL":
        return OrganizationType.CARRIER_INDIVIDUAL;
      case "FLEET_OWNER":
        return OrganizationType.FLEET_OWNER;
      default:
        return OrganizationType.CARRIER_COMPANY;
    }
  }
  return OrganizationType.SHIPPER; // Default
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Sanitize user-provided text fields
    validatedData.firstName = sanitizeText(validatedData.firstName, 100);
    validatedData.lastName = sanitizeText(validatedData.lastName, 100);
    if (validatedData.companyName)
      validatedData.companyName = sanitizeText(validatedData.companyName, 200);

    // FIX F2: Normalize email to lowercase for case-insensitive matching
    validatedData.email = validatedData.email.toLowerCase().trim();

    // Validate password policy (uppercase, lowercase, numeric requirements)
    const passwordValidation = validatePasswordPolicy(validatedData.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: "Password does not meet security requirements",
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    // Rate limiting: 3 registrations per hour per IP
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimit = await checkRateLimit(
      {
        name: "register",
        limit: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: "Too many registration attempts. Please try again later.",
      },
      clientIp
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many registration attempts. Please try again later.",
          retryAfter: Math.ceil((rateLimit.retryAfter || 0) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
            "Retry-After": Math.ceil(
              (rateLimit.retryAfter || 0) / 1000
            ).toString(),
          },
        }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          ...(validatedData.phone ? [{ phone: validatedData.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "User with this email or phone already exists",
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Determine if we need to create an organization
    const organizationId = validatedData.organizationId;
    let invitationId: string | null = null; // FIX F1: Track invitation for ACCEPTED update

    // FIX C1: Validate organizationId — only dispatchers can join an existing org, and only with an invitation
    if (organizationId) {
      if (validatedData.role !== "DISPATCHER") {
        return NextResponse.json(
          {
            error:
              "Only dispatchers can join an existing organization during registration",
          },
          { status: 400 }
        );
      }

      const targetOrg = await db.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!targetOrg) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }

      const invitation = await db.invitation.findFirst({
        where: {
          organizationId,
          email: validatedData.email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!invitation) {
        return NextResponse.json(
          { error: "No valid invitation found for this organization" },
          { status: 403 }
        );
      }
      invitationId = invitation.id;
    }

    // User variable — set by transaction or standalone path
    let user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      status: string;
      organizationId: string | null;
    };

    const userSelect = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      organizationId: true,
    } as const;

    // CRITICAL FIX (ISSUE #1): Create organization AND wallet atomically in a transaction
    // FIX H1: User creation is now INSIDE the transaction to prevent orphan orgs/wallets
    if (
      (validatedData.role === "SHIPPER" || validatedData.role === "CARRIER") &&
      validatedData.companyName
    ) {
      const orgType = getOrganizationType(
        validatedData.role,
        validatedData.carrierType
      );

      // Determine wallet type based on organization type
      const walletType: AccountType =
        orgType === OrganizationType.SHIPPER
          ? AccountType.SHIPPER_WALLET
          : AccountType.CARRIER_WALLET;

      const result = await db.$transaction(async (tx) => {
        // 1. Create organization
        const organization = await tx.organization.create({
          data: {
            name: validatedData.companyName!,
            type: orgType,
            contactEmail: validatedData.email,
            contactPhone: validatedData.phone || "N/A",
            taxId: validatedData.taxId || null,
            isVerified: false,
            associationId:
              validatedData.carrierType === "CARRIER_INDIVIDUAL"
                ? validatedData.associationId || null
                : null,
          },
        });

        // 2. Create wallet atomically with organization
        await tx.financialAccount.create({
          data: {
            organizationId: organization.id,
            accountType: walletType,
            balance: 0,
            currency: "ETB",
            isActive: true,
          },
        });

        // 3. Create user atomically — prevents orphan org+wallet on user creation failure
        const user = await tx.user.create({
          data: {
            email: validatedData.email,
            phone: validatedData.phone,
            passwordHash,
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            role: validatedData.role,
            status: "REGISTERED",
            organizationId: organization.id,
          },
          select: userSelect,
        });

        return { organization, user };
      });

      user = result.user;
    } else {
      // No org creation needed (dispatcher joining existing org, or carrier without company)
      user = await db.user.create({
        data: {
          email: validatedData.email,
          phone: validatedData.phone,
          passwordHash,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: validatedData.role,
          status: "REGISTERED",
          organizationId,
        },
        select: userSelect,
      });

      // FIX F1: Mark invitation as ACCEPTED after successful user creation
      if (invitationId) {
        await db.invitation.update({
          where: { id: invitationId },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
      }
    }

    // Create server-side session record (reuse clientIp from rate limiting above)
    const userAgent = request.headers.get("user-agent");
    const { sessionId } = await createSessionRecord(
      user.id,
      clientIp,
      userAgent,
      {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || undefined,
      }
    );

    // Create JWT session token for mobile clients
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId || undefined,
      sessionId,
    });

    // Set the session cookie for web clients
    await setSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId || undefined,
      sessionId,
    });

    // Check if request is from mobile app
    const isMobileClient =
      request.headers.get("x-client-type") === "mobile" ||
      request.headers.get("user-agent")?.includes("Dart") ||
      request.headers.get("user-agent")?.includes("Flutter");

    return NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          organizationId: user.organizationId,
        },
        limitedAccess: true,
        allowedActions: [
          "view_profile",
          "upload_documents",
          "complete_registration",
        ],
        restrictedMessage:
          "Your account is pending verification. Some features are restricted.",
        ...(isMobileClient && { sessionToken }),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    // FIX F3: Handle race condition — concurrent registration with same email
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "User with this email or phone already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
