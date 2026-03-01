/**
 * Corridor Management API
 *
 * Service Fee Implementation - Task 1: Corridor Pricing Module
 *
 * Allows admins to manage corridor pricing configurations
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { calculateFeePreview } from "@/lib/serviceFeeCalculation";
import { handleApiError } from "@/lib/apiErrors";
// M3 FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";

// Use centralized fee preview functions
const calculatePartyFeePreview = calculateFeePreview;
const calculateServiceFeePreview = calculateFeePreview;

// Define the enum values directly to avoid Prisma import issues at module load time
const CORRIDOR_DIRECTIONS = ["ONE_WAY", "ROUND_TRIP", "BIDIRECTIONAL"] as const;

// Ethiopian regions for validation
const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "Southern Nations, Nationalities, and Peoples",
  "Southwest Ethiopia",
  "Tigray",
  // Djibouti region for cross-border
  "Djibouti",
] as const;

const createCorridorSchema = z.object({
  name: z.string().min(3).max(100),
  originRegion: z
    .string()
    .refine(
      (val) =>
        ETHIOPIAN_REGIONS.includes(val as (typeof ETHIOPIAN_REGIONS)[number]),
      {
        message: "Invalid origin region",
      }
    ),
  destinationRegion: z
    .string()
    .refine(
      (val) =>
        ETHIOPIAN_REGIONS.includes(val as (typeof ETHIOPIAN_REGIONS)[number]),
      {
        message: "Invalid destination region",
      }
    ),
  distanceKm: z.number().positive().max(5000),
  direction: z.enum(CORRIDOR_DIRECTIONS).default("ONE_WAY"),
  isActive: z.boolean().default(true),

  // Shipper pricing
  shipperPricePerKm: z.number().min(0).max(100).optional(),
  shipperPromoFlag: z.boolean().default(false),
  shipperPromoPct: z.number().min(0).max(100).nullable().optional(),

  // Carrier pricing
  carrierPricePerKm: z.number().min(0).max(100).optional(),
  carrierPromoFlag: z.boolean().default(false),
  carrierPromoPct: z.number().min(0).max(100).nullable().optional(),

  // Legacy fields (for backward compatibility)
  pricePerKm: z.number().min(0).max(100).optional(),
  promoFlag: z.boolean().default(false),
  promoDiscountPct: z.number().min(0).max(100).nullable().optional(),
});

/**
 * GET /api/admin/corridors
 *
 * List all corridors with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-corridors",
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

    const session = await requireActiveUser();

    // Only admins can view corridors
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const originRegion = searchParams.get("originRegion");
    const destinationRegion = searchParams.get("destinationRegion");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    const where: {
      isActive?: boolean;
      originRegion?: string;
      destinationRegion?: string;
    } = {};

    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true";
    }
    if (originRegion) {
      where.originRegion = originRegion;
    }
    if (destinationRegion) {
      where.destinationRegion = destinationRegion;
    }

    // Get total count
    const totalCount = await db.corridor.count({ where });

    // Get corridors with pagination
    const corridors = await db.corridor.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            loads: true,
          },
        },
      },
      orderBy: [{ originRegion: "asc" }, { destinationRegion: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      corridors: corridors
        .map((corridor) => {
          // Get shipper and carrier prices (with fallback to legacy fields)
          const shipperPricePerKm = corridor.shipperPricePerKm
            ? Number(corridor.shipperPricePerKm)
            : Number(corridor.pricePerKm);
          const carrierPricePerKm = corridor.carrierPricePerKm
            ? Number(corridor.carrierPricePerKm)
            : 0;

          return {
            id: corridor.id,
            name: corridor.name,
            originRegion: corridor.originRegion,
            destinationRegion: corridor.destinationRegion,
            distanceKm: Number(corridor.distanceKm),
            direction: corridor.direction,
            isActive: corridor.isActive,
            createdAt: corridor.createdAt,
            updatedAt: corridor.updatedAt,
            createdBy: corridor.createdBy,
            loadsCount: corridor._count.loads,

            // Shipper pricing
            shipperPricePerKm,
            shipperPromoFlag: corridor.shipperPromoFlag || corridor.promoFlag,
            shipperPromoPct: corridor.shipperPromoPct
              ? Number(corridor.shipperPromoPct)
              : corridor.promoDiscountPct
                ? Number(corridor.promoDiscountPct)
                : null,

            // Carrier pricing
            carrierPricePerKm,
            carrierPromoFlag: corridor.carrierPromoFlag,
            carrierPromoPct: corridor.carrierPromoPct
              ? Number(corridor.carrierPromoPct)
              : null,

            // Legacy fields
            pricePerKm: Number(corridor.pricePerKm),
            promoFlag: corridor.promoFlag,
            promoDiscountPct: corridor.promoDiscountPct
              ? Number(corridor.promoDiscountPct)
              : null,

            // Fee previews for both parties
            feePreview: {
              shipper: calculatePartyFeePreview(
                Number(corridor.distanceKm),
                shipperPricePerKm,
                corridor.shipperPromoFlag || corridor.promoFlag,
                corridor.shipperPromoPct
                  ? Number(corridor.shipperPromoPct)
                  : corridor.promoDiscountPct
                    ? Number(corridor.promoDiscountPct)
                    : null
              ),
              carrier: calculatePartyFeePreview(
                Number(corridor.distanceKm),
                carrierPricePerKm,
                corridor.carrierPromoFlag,
                corridor.carrierPromoPct
                  ? Number(corridor.carrierPromoPct)
                  : null
              ),
              totalPlatformFee: 0, // Will be calculated below
            },

            // Legacy preview
            serviceFeePreview: calculateServiceFeePreview(
              Number(corridor.distanceKm),
              Number(corridor.pricePerKm),
              corridor.promoFlag,
              corridor.promoDiscountPct
                ? Number(corridor.promoDiscountPct)
                : null
            ),
          };
        })
        .map((c) => ({
          ...c,
          feePreview: {
            ...c.feePreview,
            totalPlatformFee:
              c.feePreview.shipper.finalFee + c.feePreview.carrier.finalFee,
          },
        })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      regions: ETHIOPIAN_REGIONS,
    });
  } catch (error) {
    return handleApiError(error, "Get corridors error");
  }
}

/**
 * POST /api/admin/corridors
 *
 * Create a new corridor
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-corridors",
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

    // M3 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();

    // Only admins can create corridors
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createCorridorSchema.parse(body);

    // Check for duplicate corridor
    const existing = await db.corridor.findUnique({
      where: {
        originRegion_destinationRegion_direction: {
          originRegion: validatedData.originRegion,
          destinationRegion: validatedData.destinationRegion,
          direction: validatedData.direction,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "Corridor already exists",
          message: `A corridor from ${validatedData.originRegion} to ${validatedData.destinationRegion} (${validatedData.direction}) already exists`,
        },
        { status: 409 }
      );
    }

    // Determine shipper price (use new field or legacy)
    const shipperPrice =
      validatedData.shipperPricePerKm ?? validatedData.pricePerKm ?? 0;
    const carrierPrice = validatedData.carrierPricePerKm ?? 0;

    // Create corridor
    const corridor = await db.corridor.create({
      data: {
        name: validatedData.name,
        originRegion: validatedData.originRegion,
        destinationRegion: validatedData.destinationRegion,
        distanceKm: new Decimal(validatedData.distanceKm),
        direction: validatedData.direction,
        isActive: validatedData.isActive,
        createdById: session.userId,

        // Shipper pricing
        pricePerKm: new Decimal(shipperPrice), // Legacy field
        shipperPricePerKm: new Decimal(shipperPrice),
        shipperPromoFlag:
          validatedData.shipperPromoFlag || validatedData.promoFlag,
        shipperPromoPct: validatedData.shipperPromoPct
          ? new Decimal(validatedData.shipperPromoPct)
          : validatedData.promoDiscountPct
            ? new Decimal(validatedData.promoDiscountPct)
            : null,

        // Carrier pricing
        carrierPricePerKm: new Decimal(carrierPrice),
        carrierPromoFlag: validatedData.carrierPromoFlag,
        carrierPromoPct: validatedData.carrierPromoPct
          ? new Decimal(validatedData.carrierPromoPct)
          : null,

        // Legacy fields
        promoFlag: validatedData.promoFlag,
        promoDiscountPct: validatedData.promoDiscountPct
          ? new Decimal(validatedData.promoDiscountPct)
          : null,
      },
    });

    const shipperFee = calculatePartyFeePreview(
      Number(corridor.distanceKm),
      shipperPrice,
      validatedData.shipperPromoFlag || validatedData.promoFlag,
      validatedData.shipperPromoPct ?? validatedData.promoDiscountPct ?? null
    );

    const carrierFee = calculatePartyFeePreview(
      Number(corridor.distanceKm),
      carrierPrice,
      validatedData.carrierPromoFlag,
      validatedData.carrierPromoPct ?? null
    );

    return NextResponse.json(
      {
        message: "Corridor created successfully",
        corridor: {
          id: corridor.id,
          name: corridor.name,
          originRegion: corridor.originRegion,
          destinationRegion: corridor.destinationRegion,
          distanceKm: Number(corridor.distanceKm),
          direction: corridor.direction,
          isActive: corridor.isActive,

          // Shipper pricing
          shipperPricePerKm: shipperPrice,
          shipperPromoFlag:
            validatedData.shipperPromoFlag || validatedData.promoFlag,
          shipperPromoPct:
            validatedData.shipperPromoPct ??
            validatedData.promoDiscountPct ??
            null,

          // Carrier pricing
          carrierPricePerKm: carrierPrice,
          carrierPromoFlag: validatedData.carrierPromoFlag,
          carrierPromoPct: validatedData.carrierPromoPct ?? null,

          // Fee preview
          feePreview: {
            shipper: shipperFee,
            carrier: carrierFee,
            totalPlatformFee: shipperFee.finalFee + carrierFee.finalFee,
          },

          // Legacy fields
          pricePerKm: shipperPrice,
          promoFlag: validatedData.promoFlag,
          promoDiscountPct: validatedData.promoDiscountPct ?? null,
          serviceFeePreview: shipperFee,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Create corridor error");
  }
}

// Fee preview functions imported from lib/serviceFeeCalculation.ts
// See import at top of file
