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
import { zodErrorResponse } from "@/lib/validation";
import { OrganizationType, AccountType } from "@prisma/client";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["SHIPPER", "CARRIER", "DISPATCHER"]),
  organizationId: z.string().optional(), // Sprint 16: Story 16.4 - Assign dispatcher to organization
  // Organization fields
  companyName: z.string().optional(),
  carrierType: z
    .enum(["CARRIER_COMPANY", "CARRIER_INDIVIDUAL", "FLEET_OWNER"])
    .optional(),
  associationId: z.string().optional(), // For individual carriers joining an association
  taxId: z.string().optional(), // Organization tax ID (TIN)
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
    let organizationId = validatedData.organizationId;

    // CRITICAL FIX (ISSUE #1): Create organization AND wallet atomically in a transaction
    // This ensures that every organization has a wallet from the start
    if (
      (validatedData.role === "SHIPPER" || validatedData.role === "CARRIER") &&
      validatedData.companyName
    ) {
      const orgType = getOrganizationType(
        validatedData.role,
        validatedData.carrierType
      );

      // Determine wallet type based on organization type
      // FIX: Use proper enum type
      const walletType: AccountType =
        orgType === OrganizationType.SHIPPER
          ? AccountType.SHIPPER_WALLET
          : AccountType.CARRIER_WALLET;

      const { organization } = await db.$transaction(async (tx) => {
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

        return { organization };
      });

      organizationId = organization.id;
    }

    // Create user
    const user = await db.user.create({
      data: {
        email: validatedData.email,
        phone: validatedData.phone,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
        status: "REGISTERED", // Sprint 2: User verification workflow
        organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true, // Sprint 2: Include status in response
        organizationId: true,
      },
    });

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

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
