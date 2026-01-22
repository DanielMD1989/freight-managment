import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSession, validatePasswordPolicy } from "@/lib/auth";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum([
    "SHIPPER",
    "CARRIER",
    "DISPATCHER",
    "ADMIN",
    "SUPER_ADMIN",
  ]),
  organizationId: z.string().optional(), // Sprint 16: Story 16.4 - Assign dispatcher to organization
  // Organization fields
  companyName: z.string().optional(),
  carrierType: z.enum(["CARRIER_COMPANY", "CARRIER_INDIVIDUAL", "FLEET_OWNER"]).optional(),
  associationId: z.string().optional(), // For individual carriers joining an association
});

// Map carrier type to organization type
function getOrganizationType(role: string, carrierType?: string): string {
  if (role === "SHIPPER") {
    return "SHIPPER";
  }
  if (role === "CARRIER") {
    switch (carrierType) {
      case "CARRIER_COMPANY":
        return "CARRIER_COMPANY";
      case "CARRIER_INDIVIDUAL":
        return "CARRIER_INDIVIDUAL";
      case "FLEET_OWNER":
        return "FLEET_OWNER";
      default:
        return "CARRIER_COMPANY";
    }
  }
  return "SHIPPER"; // Default
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
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(
      {
        name: 'register',
        limit: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: 'Too many registration attempts. Please try again later.',
      },
      clientIp
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimit.retryAfter || 0) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.retryAfter || 0) / 1000).toString(),
          },
        }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          ...(validatedData.phone
            ? [{ phone: validatedData.phone }]
            : []),
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

    // Create organization for shippers and carriers with company name
    if ((validatedData.role === "SHIPPER" || validatedData.role === "CARRIER") && validatedData.companyName) {
      const orgType = getOrganizationType(validatedData.role, validatedData.carrierType);

      const organization = await db.organization.create({
        data: {
          name: validatedData.companyName,
          type: orgType as any,
          contactEmail: validatedData.email, // Use user's email as contact
          contactPhone: validatedData.phone || "N/A",
          isVerified: false, // Pending verification
          // For individual carriers joining an association
          associationId: validatedData.carrierType === "CARRIER_INDIVIDUAL" ? validatedData.associationId || null : null,
        },
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
        status: 'REGISTERED', // Sprint 2: User verification workflow
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

    // Create session
    await setSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status, // Sprint 2: Include status in session
      organizationId: user.organizationId || undefined,
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.issues,
        },
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
