import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canManageOrganization } from "@/lib/rbac";
import { z } from "zod";

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(10).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  licenseNumber: z.string().optional(),
  taxId: z.string().optional(),
});

// GET /api/organizations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
    console.error("Get organization error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAuth();

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

    return NextResponse.json({
      message: "Organization updated successfully",
      organization,
    });
  } catch (error) {
    console.error("Update organization error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
