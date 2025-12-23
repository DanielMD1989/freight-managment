import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/organizations/me - Get current user's organization
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "User does not belong to an organization" },
        { status: 404 }
      );
    }

    const organization = await db.organization.findUnique({
      where: { id: session.organizationId },
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
        financialAccounts: {
          select: {
            id: true,
            accountType: true,
            balance: true,
            currency: true,
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
    console.error("Get my organization error:", error);

    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
