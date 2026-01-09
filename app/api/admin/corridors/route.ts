/**
 * Corridor Management API
 *
 * Service Fee Implementation - Task 1: Corridor Pricing Module
 *
 * Allows admins to manage corridor pricing configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { CorridorDirection } from '@prisma/client';

// Ethiopian regions for validation
const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'Southern Nations, Nationalities, and Peoples',
  'Southwest Ethiopia',
  'Tigray',
  // Djibouti region for cross-border
  'Djibouti',
] as const;

const createCorridorSchema = z.object({
  name: z.string().min(3).max(100),
  originRegion: z.string().refine((val) => ETHIOPIAN_REGIONS.includes(val as typeof ETHIOPIAN_REGIONS[number]), {
    message: 'Invalid origin region',
  }),
  destinationRegion: z.string().refine((val) => ETHIOPIAN_REGIONS.includes(val as typeof ETHIOPIAN_REGIONS[number]), {
    message: 'Invalid destination region',
  }),
  distanceKm: z.number().positive().max(5000),
  pricePerKm: z.number().positive().max(100),
  direction: z.nativeEnum(CorridorDirection).default('ONE_WAY'),
  promoFlag: z.boolean().default(false),
  promoDiscountPct: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/admin/corridors
 *
 * List all corridors with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only admins can view corridors
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const originRegion = searchParams.get('originRegion');
    const destinationRegion = searchParams.get('destinationRegion');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: {
      isActive?: boolean;
      originRegion?: string;
      destinationRegion?: string;
    } = {};

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
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
      orderBy: [
        { originRegion: 'asc' },
        { destinationRegion: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      corridors: corridors.map((corridor) => ({
        id: corridor.id,
        name: corridor.name,
        originRegion: corridor.originRegion,
        destinationRegion: corridor.destinationRegion,
        distanceKm: Number(corridor.distanceKm),
        pricePerKm: Number(corridor.pricePerKm),
        direction: corridor.direction,
        promoFlag: corridor.promoFlag,
        promoDiscountPct: corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null,
        isActive: corridor.isActive,
        createdAt: corridor.createdAt,
        updatedAt: corridor.updatedAt,
        createdBy: corridor.createdBy,
        loadsCount: corridor._count.loads,
        // Calculate service fee preview
        serviceFeePreview: calculateServiceFeePreview(
          Number(corridor.distanceKm),
          Number(corridor.pricePerKm),
          corridor.promoFlag,
          corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null
        ),
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
    console.error('Get corridors error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/corridors
 *
 * Create a new corridor
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only admins can create corridors
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
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
          error: 'Corridor already exists',
          message: `A corridor from ${validatedData.originRegion} to ${validatedData.destinationRegion} (${validatedData.direction}) already exists`,
        },
        { status: 409 }
      );
    }

    // Create corridor
    const corridor = await db.corridor.create({
      data: {
        name: validatedData.name,
        originRegion: validatedData.originRegion,
        destinationRegion: validatedData.destinationRegion,
        distanceKm: new Decimal(validatedData.distanceKm),
        pricePerKm: new Decimal(validatedData.pricePerKm),
        direction: validatedData.direction,
        promoFlag: validatedData.promoFlag,
        promoDiscountPct: validatedData.promoDiscountPct
          ? new Decimal(validatedData.promoDiscountPct)
          : null,
        isActive: validatedData.isActive,
        createdById: session.userId,
      },
    });

    return NextResponse.json({
      message: 'Corridor created successfully',
      corridor: {
        id: corridor.id,
        name: corridor.name,
        originRegion: corridor.originRegion,
        destinationRegion: corridor.destinationRegion,
        distanceKm: Number(corridor.distanceKm),
        pricePerKm: Number(corridor.pricePerKm),
        direction: corridor.direction,
        promoFlag: corridor.promoFlag,
        promoDiscountPct: corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null,
        isActive: corridor.isActive,
        serviceFeePreview: calculateServiceFeePreview(
          Number(corridor.distanceKm),
          Number(corridor.pricePerKm),
          corridor.promoFlag,
          corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null
        ),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create corridor error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate service fee preview
 */
function calculateServiceFeePreview(
  distanceKm: number,
  pricePerKm: number,
  promoFlag: boolean,
  promoDiscountPct: number | null
): {
  baseFee: number;
  discount: number;
  finalFee: number;
} {
  const baseFee = distanceKm * pricePerKm;
  let discount = 0;

  if (promoFlag && promoDiscountPct && promoDiscountPct > 0) {
    discount = baseFee * (promoDiscountPct / 100);
  }

  return {
    baseFee: Math.round(baseFee * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    finalFee: Math.round((baseFee - discount) * 100) / 100,
  };
}
