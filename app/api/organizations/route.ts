import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  type: z.enum(["SHIPPER", "CARRIER_COMPANY", "CARRIER_INDIVIDUAL", "LOGISTICS_AGENT"]),
  description: z.string().optional(),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().optional(),
  city: z.string().optional(),
  licenseNumber: z.string().optional(),
  taxId: z.string().optional(),
});

// POST /api/organizations - Create organization
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user already has an organization
    const existingUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (existingUser?.organizationId) {
      return NextResponse.json(
        { error: "User already belongs to an organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createOrganizationSchema.parse(body);

    // HIGH FIX #4: Wrap organization + financial account creation in transaction
    const accountType =
      validatedData.type === "SHIPPER" ? "SHIPPER_WALLET" : "CARRIER_WALLET";

    const organization = await db.$transaction(async (tx) => {
      // Create organization and link user to it
      const organization = await tx.organization.create({
        data: {
          ...validatedData,
          users: {
            connect: { id: session.userId },
          },
        },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      // Create financial accounts for the organization
      await tx.financialAccount.create({
        data: {
          accountType,
          organizationId: organization.id,
          balance: 0,
          currency: "ETB",
        },
      });

      return organization;
    });

    return NextResponse.json(
      {
        message: "Organization created successfully",
        organization,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create organization error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/organizations - List organizations (admin only)
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_ORGANIZATIONS);

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          contactEmail: true,
          contactPhone: true,
          city: true,
          isVerified: true,
          verifiedAt: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              trucks: true,
              loads: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.organization.count({ where }),
    ]);

    return NextResponse.json({
      organizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List organizations error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
