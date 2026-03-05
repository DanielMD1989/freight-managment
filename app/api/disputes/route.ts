/**
 * Disputes API
 * Sprint 6 - Story 6.4: Dispute Management
 *
 * Create and manage disputes for loads
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { sanitizeText } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";
import { CacheInvalidation } from "@/lib/cache";

const createDisputeSchema = z.object({
  loadId: z.string().max(50),
  type: z.enum(["PAYMENT_ISSUE", "DAMAGE", "LATE_DELIVERY", "OTHER"]),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  evidence: z.string().max(5000).optional(),
});

/**
 * POST /api/disputes
 * Create a new dispute
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "disputes",
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

    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const body = await request.json();
    const validatedData = createDisputeSchema.parse(body);

    // Sanitize user-provided text fields
    validatedData.description = sanitizeText(validatedData.description, 5000);
    if (validatedData.evidence)
      validatedData.evidence = sanitizeText(validatedData.evidence, 5000);

    // Verify load exists and user has access
    const load = await db.load.findUnique({
      where: { id: validatedData.loadId },
      include: {
        shipper: { select: { id: true } },
        assignedTruck: {
          select: {
            carrier: { select: { id: true } },
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Only allow disputes for loads in a disputable state
    // DRAFT/POSTED/UNPOSTED loads have no carrier party to dispute against
    const disputableStatuses = [
      "ASSIGNED",
      "PICKUP_PENDING",
      "IN_TRANSIT",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ];
    if (!disputableStatuses.includes(load.status)) {
      return NextResponse.json(
        {
          error: `Cannot create dispute for load in ${load.status} status`,
          hint: "Disputes can only be filed for loads that have been assigned to a carrier",
        },
        { status: 400 }
      );
    }

    // Check if user is shipper or carrier for this load
    // BUG-R3-1 FIX: Add role check alongside org check to prevent DISPATCHER bypass
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isShipper =
      session.role === "SHIPPER" && load.shipper?.id === session.organizationId;
    const isCarrier =
      session.role === "CARRIER" &&
      load.assignedTruck?.carrier?.id === session.organizationId;

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // C3 FIX: Set disputedOrgId to the OTHER party, not the filer
    const disputedOrgId = isShipper
      ? load.assignedTruck?.carrier?.id // Shipper filing → dispute against carrier
      : load.shipper?.id; // Carrier filing → dispute against shipper

    if (!disputedOrgId) {
      return NextResponse.json(
        { error: "Cannot determine the other party for this dispute" },
        { status: 400 }
      );
    }

    // Create dispute
    const dispute = await db.dispute.create({
      data: {
        loadId: validatedData.loadId,
        createdById: session.userId,
        disputedOrgId,
        type: validatedData.type,
        description: validatedData.description,
        evidenceUrls: validatedData.evidence ? [validatedData.evidence] : [],
        status: "OPEN",
      },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Invalidate load cache after dispute creation
    await CacheInvalidation.load(validatedData.loadId);

    return NextResponse.json({
      message: "Dispute created successfully",
      dispute,
    });
  } catch (error: unknown) {
    return handleApiError(error, "Error creating dispute");
  }
}

/**
 * GET /api/disputes
 * Get disputes for current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const loadId = searchParams.get("loadId");
    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20"), 1),
      100
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.DisputeWhereInput = {
      OR: [
        { disputedOrgId: session.organizationId },
        {
          load: {
            OR: [
              { shipperId: session.organizationId },
              {
                assignedTruck: {
                  carrierId: session.organizationId,
                },
              },
            ],
          },
        },
      ],
    };

    if (status) {
      where.status = status as Prisma.EnumDisputeStatusFilter;
    }

    if (loadId) {
      where.loadId = loadId;
    }

    const [disputes, total] = await Promise.all([
      db.dispute.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
              status: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          disputedOrg: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      db.dispute.count({ where }),
    ]);

    return NextResponse.json({
      disputes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "Error fetching disputes");
  }
}
