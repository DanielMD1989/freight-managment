import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { canManageOrganization } from "@/lib/rbac";
import { z } from "zod";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { CacheInvalidation } from "@/lib/cache";

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(10).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  licenseNumber: z.string().optional(),
  taxId: z.string().optional(),
  allowNameDisplay: z.boolean().optional(), // Phase 2: Privacy setting
});

// GET /api/organizations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "organizations",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const { id } = await params;

    // C1 FIX: Require authentication to prevent unauthenticated enumeration
    const session = await requireActiveUser();

    // Authorization: user must be member of org, or admin
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    const isMember = user?.organizationId === id;

    if (!isAdmin && !isMember) {
      return NextResponse.json(
        { error: "You do not have permission to view this organization" },
        { status: 403 }
      );
    }

    const organization = await db.organization.findUnique({
      where: { id },
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
        _count: {
          select: {
            trucks: true,
            loads: true,
            disputesAgainst: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error, "Get organization error");
  }
}

// PATCH /api/organizations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "organizations",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    // H23 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id } = await params;
    await requireActiveUser();

    // Check if user can manage this organization
    const canManage = await canManageOrganization(id);
    if (!canManage) {
      return NextResponse.json(
        { error: "You do not have permission to manage this organization" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateOrganizationSchema.parse(body);

    const organization = await db.organization.update({
      where: { id },
      data: validatedData,
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

    // Invalidate organization cache after update
    await CacheInvalidation.organization(id);

    return NextResponse.json({
      message: "Organization updated successfully",
      organization,
    });
  } catch (error) {
    return handleApiError(error, "Update organization error");
  }
}
