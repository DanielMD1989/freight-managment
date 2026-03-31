export const dynamic = "force-dynamic";
/**
 * Saved Searches API
 *
 * GET /api/saved-searches - List user's saved searches
 * POST /api/saved-searches - Create new saved search
 * Sprint 14 - DAT-Style UI Transformation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { zodErrorResponse } from "@/lib/validation";
import { z } from "zod";

const createSavedSearchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["LOADS", "TRUCKS"], {
    message: "Type must be LOADS or TRUCKS",
  }),
  criteria: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/saved-searches
 * List all saved searches for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireActiveUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // LOADS or TRUCKS

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      userId: user.userId,
    };

    if (type) {
      where.type = type;
    }

    const searches = await db.savedSearch.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ searches });
  } catch (error: unknown) {
    console.error("Get saved searches error:", error);
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch saved searches" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-searches
 * Create a new saved search
 */
export async function POST(request: NextRequest) {
  try {
    // C2 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const user = await requireActiveUser();
    const body = await request.json();
    const result = createSavedSearchSchema.safeParse(body);
    if (!result.success) {
      return zodErrorResponse(result.error);
    }

    const { name, type, criteria } = result.data;

    // Create saved search
    const search = await db.savedSearch.create({
      data: {
        name,
        type,
        criteria: criteria || {},
        userId: user.userId,
      },
    });

    return NextResponse.json({ search }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create saved search error:", error);
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
