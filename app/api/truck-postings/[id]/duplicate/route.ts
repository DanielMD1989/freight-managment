/**
 * Duplicate Truck Posting Endpoint
 *
 * POST /api/truck-postings/[id]/duplicate
 * Creates a copy of an existing truck posting
 * Sprint 14 - DAT-Style UI Transformation (Phase 4)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Authenticate user
    const user = await requireActiveUser();

    const { id } = await params;

    // Fetch original truck posting
    const originalPosting = await db.truckPosting.findUnique({
      where: { id },
    });

    if (!originalPosting) {
      return NextResponse.json(
        { error: "Truck posting not found" },
        { status: 404 }
      );
    }

    // Verify role is CARRIER or ADMIN
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isCarrier = user.role === "CARRIER";

    if (!isAdmin && !isCarrier) {
      return NextResponse.json(
        { error: "Only carriers can duplicate truck postings" },
        { status: 403 }
      );
    }

    // Verify ownership (carrier must own the posting, admin can duplicate any)
    if (!isAdmin && originalPosting.carrierId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create duplicate truck posting
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      id: _,
      createdAt,
      updatedAt,
      postedAt,
      expiresAt,
      ...postingData
    } = originalPosting;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    // Fix 10c: Wrap active posting check + create in transaction to prevent race condition
    const duplicatePosting = await db.$transaction(async (tx) => {
      const existingActivePosting = await tx.truckPosting.findFirst({
        where: {
          truckId: originalPosting.truckId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (existingActivePosting) {
        throw new Error("ACTIVE_POSTING_EXISTS:" + existingActivePosting.id);
      }

      return tx.truckPosting.create({
        data: {
          ...postingData,
          status: "ACTIVE",
          postedAt: new Date(),
        },
      });
    });

    // Invalidate cache so new posting is immediately visible
    await CacheInvalidation.truck(
      duplicatePosting.truckId,
      originalPosting.carrierId
    );

    return NextResponse.json(duplicatePosting, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.startsWith("ACTIVE_POSTING_EXISTS:")
    ) {
      const existingId = error.message.split(":")[1];
      return NextResponse.json(
        {
          error: "This truck already has an active posting",
          existingPostingId: existingId,
        },
        { status: 409 }
      );
    }
    return handleApiError(error, "Duplicate truck posting error");
  }
}
