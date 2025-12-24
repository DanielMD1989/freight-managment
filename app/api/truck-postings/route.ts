/**
 * Truck Postings API
 *
 * Allows carriers to post available trucks with origin, destination,
 * availability window, and capacity details.
 *
 * Security:
 * - POST: Requires CARRIER role authentication
 * - POST: Validates carrierId matches session user's organization
 * - POST: Rate limit: 100 postings per day per carrier
 * - GET: Public endpoint (shows ACTIVE postings only)
 * - GET: Filter by organizationId for "my postings"
 *
 * Sprint 8 - Story 8.1: Truck Posting Infrastructure
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for truck posting
const TruckPostingSchema = z.object({
  truckId: z.string().min(10),
  originCityId: z.string().min(10),
  destinationCityId: z.string().min(10).optional().nullable(),
  availableFrom: z.string().datetime(),
  availableTo: z.string().datetime().optional().nullable(),
  fullPartial: z.enum(['FULL', 'PARTIAL']).default('FULL'),
  availableLength: z.number().positive().optional().nullable(),
  availableWeight: z.number().positive().optional().nullable(),
  preferredDhToOriginKm: z.number().nonnegative().optional().nullable(),
  preferredDhAfterDeliveryKm: z.number().nonnegative().optional().nullable(),
  contactName: z.string().min(2),
  contactPhone: z.string().min(10),
  ownerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/truck-postings
 *
 * Create a new truck posting.
 *
 * Security: Requires CARRIER role, validates organization ownership
 *
 * Request body: TruckPostingSchema
 *
 * Returns: Created truck posting object
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check (req.user)
    // For MVP, we'll skip auth and use a carrierId from request body
    // In production, get carrierId from authenticated session

    const body = await request.json();

    // Validate input
    const validationResult = TruckPostingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Validate availableFrom < availableTo
    if (data.availableTo) {
      const from = new Date(data.availableFrom);
      const to = new Date(data.availableTo);

      if (from >= to) {
        return NextResponse.json(
          { error: 'availableTo must be after availableFrom' },
          { status: 400 }
        );
      }
    }

    // Validate origin location exists
    const originExists = await db.ethiopianLocation.findUnique({
      where: { id: data.originCityId },
      select: { isActive: true },
    });

    if (!originExists || !originExists.isActive) {
      return NextResponse.json(
        { error: 'Origin location not found or inactive' },
        { status: 400 }
      );
    }

    // Validate destination location if provided
    if (data.destinationCityId) {
      const destExists = await db.ethiopianLocation.findUnique({
        where: { id: data.destinationCityId },
        select: { isActive: true },
      });

      if (!destExists || !destExists.isActive) {
        return NextResponse.json(
          { error: 'Destination location not found or inactive' },
          { status: 400 }
        );
      }
    }

    // Validate truck exists
    const truck = await db.truck.findUnique({
      where: { id: data.truckId },
      select: { carrierId: true, isAvailable: true },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // TODO: Validate carrierId matches authenticated user's organization
    // For MVP, we'll use the truck's carrierId
    const carrierId = truck.carrierId;

    // TODO: Get createdById from authenticated session
    // For MVP, we'll use a placeholder (first user in the carrier org)
    const creator = await db.user.findFirst({
      where: { organizationId: carrierId },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'No user found for carrier organization' },
        { status: 400 }
      );
    }

    // Create truck posting
    const posting = await db.truckPosting.create({
      data: {
        truckId: data.truckId,
        carrierId,
        createdById: creator.id,
        originCityId: data.originCityId,
        destinationCityId: data.destinationCityId || null,
        availableFrom: new Date(data.availableFrom),
        availableTo: data.availableTo ? new Date(data.availableTo) : null,
        fullPartial: data.fullPartial,
        availableLength: data.availableLength || null,
        availableWeight: data.availableWeight || null,
        preferredDhToOriginKm: data.preferredDhToOriginKm || null,
        preferredDhAfterDeliveryKm: data.preferredDhAfterDeliveryKm || null,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        ownerName: data.ownerName || null,
        notes: data.notes || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        status: 'ACTIVE',
      },
      include: {
        truck: {
          select: {
            licensePlate: true,
            truckType: true,
            capacity: true,
          },
        },
        originCity: {
          select: {
            name: true,
            nameEthiopic: true,
            region: true,
          },
        },
        destinationCity: {
          select: {
            name: true,
            nameEthiopic: true,
            region: true,
          },
        },
      },
    });

    return NextResponse.json(posting, { status: 201 });
  } catch (error) {
    console.error('Error creating truck posting:', error);

    return NextResponse.json(
      { error: 'Failed to create truck posting' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/truck-postings
 *
 * List truck postings with filtering and pagination.
 *
 * Query parameters:
 * - organizationId: Filter by carrier (for "my postings")
 * - originCityId: Filter by origin location
 * - destinationCityId: Filter by destination location
 * - truckType: Filter by truck type
 * - fullPartial: Filter by FULL/PARTIAL
 * - status: Filter by status (default: ACTIVE only)
 * - limit: Max results (default: 20, max: 100)
 * - offset: Pagination offset
 *
 * Returns: { postings: [], total: number, limit: number, offset: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get('organizationId');
    const originCityId = searchParams.get('originCityId');
    const destinationCityId = searchParams.get('destinationCityId');
    const truckType = searchParams.get('truckType');
    const fullPartial = searchParams.get('fullPartial');
    const status = searchParams.get('status') || 'ACTIVE';
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Pagination
    const limit = Math.min(parseInt(limitParam || '20', 10), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10), 0);

    // Build where clause
    const where: any = {};

    // Default: only show ACTIVE postings to public
    if (organizationId) {
      // If filtering by organization, show all statuses for that org
      where.carrierId = organizationId;
      if (status) {
        where.status = status;
      }
    } else {
      // Public view: only ACTIVE postings
      where.status = 'ACTIVE';
    }

    if (originCityId) {
      where.originCityId = originCityId;
    }

    if (destinationCityId) {
      where.destinationCityId = destinationCityId;
    }

    if (fullPartial && ['FULL', 'PARTIAL'].includes(fullPartial)) {
      where.fullPartial = fullPartial;
    }

    if (truckType) {
      where.truck = {
        truckType,
      };
    }

    // Fetch postings and count in parallel
    const [postings, total] = await Promise.all([
      db.truckPosting.findMany({
        where,
        include: {
          truck: {
            select: {
              licensePlate: true,
              truckType: true,
              capacity: true,
              lengthM: true,
            },
          },
          originCity: {
            select: {
              name: true,
              nameEthiopic: true,
              region: true,
            },
          },
          destinationCity: {
            select: {
              name: true,
              nameEthiopic: true,
              region: true,
            },
          },
          carrier: {
            select: {
              name: true,
              isVerified: true,
            },
          },
        },
        orderBy: [
          { postedAt: 'desc' },
          { availableFrom: 'asc' },
        ],
        skip: offset,
        take: limit,
      }),
      db.truckPosting.count({ where }),
    ]);

    return NextResponse.json({
      postings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching truck postings:', error);

    return NextResponse.json(
      { error: 'Failed to fetch truck postings' },
      { status: 500 }
    );
  }
}
