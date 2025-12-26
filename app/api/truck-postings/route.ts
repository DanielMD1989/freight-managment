/**
 * Truck Postings API
 *
 * Allows carriers to post available trucks with origin, destination,
 * availability window, and capacity details.
 *
 * Security:
 * - POST: Requires CARRIER role authentication
 * - POST: CSRF protection (double-submit cookie)
 * - POST: Rate limit: 100 postings per day per carrier
 * - POST: Validates carrierId matches session user's organization
 * - GET: Public endpoint (shows ACTIVE postings only)
 * - GET: Filter by organizationId for "my postings"
 *
 * Sprint 8 - Story 8.1: Truck Posting Infrastructure
 * Sprint 9 - Story 9.6: CSRF Protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import {
  weightSchema,
  lengthSchema,
  distanceSchema,
  validateIdFormat,
  phoneSchema,
} from '@/lib/validation';
import {
  checkRateLimit,
  RATE_LIMIT_TRUCK_POSTING,
} from '@/lib/rateLimit';
import { requireCSRF } from '@/lib/csrf';

// Validation schema for truck posting
const TruckPostingSchema = z.object({
  truckId: z.string().min(10),
  originCityId: z.string().min(10),
  destinationCityId: z.string().min(10).optional().nullable(),
  availableFrom: z.string().datetime(),
  availableTo: z.string().datetime().optional().nullable(),
  fullPartial: z.enum(['FULL', 'PARTIAL']).default('FULL'),
  availableLength: lengthSchema.optional().nullable(),
  availableWeight: weightSchema.optional().nullable(),
  preferredDhToOriginKm: distanceSchema.optional().nullable(),
  preferredDhAfterDeliveryKm: distanceSchema.optional().nullable(),
  contactName: z.string().min(2).max(100, 'Contact name too long'),
  contactPhone: phoneSchema,
  ownerName: z.string().min(2).max(100, 'Owner name too long').optional().nullable(),
  notes: z.string().max(500, 'Notes too long').optional().nullable(),
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
    // Require authentication
    const session = await requireAuth();

    // Require organization
    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to create truck postings' },
        { status: 403 }
      );
    }

    // Check CSRF token
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check rate limit: 100 postings per day per carrier
    const rateLimitResult = checkRateLimit(
      RATE_LIMIT_TRUCK_POSTING,
      session.organizationId
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Truck posting limit exceeded. Maximum 100 postings per day per carrier.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': rateLimitResult.retryAfter!.toString(),
          },
        }
      );
    }

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

    // Validate IDs format
    const truckIdValidation = validateIdFormat(data.truckId, 'Truck ID');
    if (!truckIdValidation.valid) {
      return NextResponse.json(
        { error: truckIdValidation.error },
        { status: 400 }
      );
    }

    const originIdValidation = validateIdFormat(data.originCityId, 'Origin city ID');
    if (!originIdValidation.valid) {
      return NextResponse.json(
        { error: originIdValidation.error },
        { status: 400 }
      );
    }

    if (data.destinationCityId) {
      const destIdValidation = validateIdFormat(data.destinationCityId, 'Destination city ID');
      if (!destIdValidation.valid) {
        return NextResponse.json(
          { error: destIdValidation.error },
          { status: 400 }
        );
      }
    }

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

    // Validate user's organization owns this truck
    if (truck.carrierId !== session.organizationId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You can only post trucks owned by your organization' },
        { status: 403 }
      );
    }

    const carrierId = truck.carrierId;

    // Create truck posting
    const posting = await db.truckPosting.create({
      data: {
        truckId: data.truckId,
        carrierId,
        createdById: session.userId,
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

    const response = NextResponse.json(posting, { status: 201 });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());

    return response;
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

    // If filtering by specific organization (for "my postings"), verify user has access
    if (organizationId) {
      const session = await requireAuth();

      // User can only filter by their own organization unless they're an admin
      if (organizationId !== session.organizationId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'You can only view postings for your own organization' },
          { status: 403 }
        );
      }
    }

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
