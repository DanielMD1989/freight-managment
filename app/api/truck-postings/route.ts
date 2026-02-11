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
 *
 * PHASE 2 UPDATE - Foundation Rules:
 * - ONE_ACTIVE_POST_PER_TRUCK: Each truck can only have one active posting
 * - POSTING_IS_AVAILABILITY: Posting expresses availability, not ownership
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, requireActiveUser } from '@/lib/auth';
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
import { findMatchingLoads } from '@/lib/matchingEngine';
import { canViewAllTrucks, hasElevatedPermissions } from '@/lib/dispatcherPermissions';
import { UserRole } from '@prisma/client';
import {
  RULE_ONE_ACTIVE_POST_PER_TRUCK,
  validateOneActivePostPerTruck,
} from '@/lib/foundation-rules';
// P1-001 FIX: Import CacheInvalidation for post-creation cache clearing
import { CacheInvalidation } from '@/lib/cache';

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
    // Require ACTIVE user status for posting trucks
    const session = await requireActiveUser();

    // CSRF protection for state-changing operation
    // Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
    // Web clients MUST provide CSRF token
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (isMobileClient && !hasBearerAuth) {
      return NextResponse.json(
        { error: 'Mobile clients require Bearer authentication' },
        { status: 401 }
      );
    }

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    // Require organization
    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to create truck postings' },
        { status: 403 }
      );
    }

    // Check rate limit: 100 postings per day per carrier
    const rateLimitResult = await checkRateLimit(
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

    // PHASE 4: Run validation queries in parallel (N+1 fix)
    const [originExists, destExists, truck, existingActivePost] = await Promise.all([
      // Validate origin location exists
      db.ethiopianLocation.findUnique({
        where: { id: data.originCityId },
        select: { isActive: true },
      }),
      // Validate destination location if provided
      data.destinationCityId
        ? db.ethiopianLocation.findUnique({
            where: { id: data.destinationCityId },
            select: { isActive: true },
          })
        : Promise.resolve(null),
      // Validate truck exists and is approved
      db.truck.findUnique({
        where: { id: data.truckId },
        select: { carrierId: true, isAvailable: true, approvalStatus: true },
      }),
      // PHASE 2: Check for existing active posting (ONE_ACTIVE_POST_PER_TRUCK rule)
      db.truckPosting.findFirst({
        where: {
          truckId: data.truckId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ]);

    if (!originExists || !originExists.isActive) {
      return NextResponse.json(
        { error: 'Origin location not found or inactive' },
        { status: 400 }
      );
    }

    if (data.destinationCityId && (!destExists || !destExists.isActive)) {
      return NextResponse.json(
        { error: 'Destination location not found or inactive' },
        { status: 400 }
      );
    }

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // P0-002 FIX: Validate truck approval status before allowing posting
    // Only approved trucks can be posted to the loadboard
    if (truck.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          error: 'Only approved trucks can be posted to the loadboard',
          currentStatus: truck.approvalStatus,
          hint: 'Please wait for admin approval before posting this truck',
        },
        { status: 403 }
      );
    }

    const oneActivePostValidation = validateOneActivePostPerTruck({
      truckId: data.truckId,
      hasActivePost: !!existingActivePost,
      activePostId: existingActivePost?.id,
    });

    if (!oneActivePostValidation.valid) {
      return NextResponse.json(
        {
          error: oneActivePostValidation.error,
          existingPostId: existingActivePost?.id,
          rule: RULE_ONE_ACTIVE_POST_PER_TRUCK.id,
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Validate user's organization owns this truck
    // Sprint 16: Allow dispatcher, platform ops, and admin to post any truck
    const hasElevatedPerms = hasElevatedPermissions({
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId
    });

    if (truck.carrierId !== session.organizationId && !hasElevatedPerms) {
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
            id: true,
            licensePlate: true,
            truckType: true,
            capacity: true,
            approvalStatus: true,
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

    // P1-001 FIX: Cache invalidation after posting creation
    // Ensures new postings appear immediately in searches and matching
    await CacheInvalidation.truck(data.truckId, carrierId);

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
    const origin = searchParams.get('origin'); // City name search
    const destination = searchParams.get('destination'); // City name search
    const truckType = searchParams.get('truckType');
    const fullPartial = searchParams.get('fullPartial');
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const includeMatchCount = searchParams.get('includeMatchCount') === 'true';

    // Valid PostingStatus values from Prisma schema
    const validStatuses = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'MATCHED'] as const;

    // Validate status BEFORE using it - fail fast on invalid input
    if (statusParam && !validStatuses.includes(statusParam as typeof validStatuses[number])) {
      return NextResponse.json(
        {
          error: `Invalid status '${statusParam}'. Valid values: ${validStatuses.join(', ')}`,
          hint: 'For trucks without active postings, use /api/trucks?hasActivePosting=false'
        },
        { status: 400 }
      );
    }

    // Default to ACTIVE only after validation passes
    const status = statusParam || 'ACTIVE';
    const validatedStatus = status || 'ACTIVE';

    // If filtering by specific organization (for "my postings"), verify user has access
    if (organizationId) {
      const session = await requireAuth();

      // Sprint 16: Allow dispatcher, platform ops, and admin to view all trucks
      const hasElevatedPerms = hasElevatedPermissions({
        role: session.role as UserRole,
        organizationId: session.organizationId,
        userId: session.userId
      });

      // User can only filter by their own organization unless they have elevated permissions
      if (organizationId !== session.organizationId && !hasElevatedPerms) {
        return NextResponse.json(
          { error: 'You can only view postings for your own organization' },
          { status: 403 }
        );
      }
    }

    // Pagination with NaN handling
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

    // PHASE 4: Convert city names to IDs in parallel (N+1 fix)
    let resolvedOriginCityId = originCityId;
    let resolvedDestinationCityId = destinationCityId;

    // Run city lookups in parallel if needed
    // Escape LIKE wildcards to prevent injection
    const escapeLikeWildcards = (str: string) => str.replace(/[%_]/g, '\\$&');
    const cityLookups = [];
    if (origin && !originCityId) {
      cityLookups.push(
        db.ethiopianLocation.findFirst({
          where: { name: { contains: escapeLikeWildcards(origin), mode: 'insensitive' } },
          select: { id: true },
        }).then(city => ({ type: 'origin', city }))
      );
    }
    if (destination && !destinationCityId) {
      cityLookups.push(
        db.ethiopianLocation.findFirst({
          where: { name: { contains: escapeLikeWildcards(destination), mode: 'insensitive' } },
          select: { id: true },
        }).then(city => ({ type: 'destination', city }))
      );
    }

    if (cityLookups.length > 0) {
      const results = await Promise.all(cityLookups);
      for (const result of results) {
        if (result.type === 'origin' && result.city) {
          resolvedOriginCityId = result.city.id;
        } else if (result.type === 'destination' && result.city) {
          resolvedDestinationCityId = result.city.id;
        }
      }
    }

    // Build where clause
    const where: any = {};

    // Default: only show ACTIVE postings to public
    if (organizationId) {
      // If filtering by organization, show all statuses for that org
      where.carrierId = organizationId;
      // Use validated status to prevent invalid enum errors
      where.status = validatedStatus;
    } else {
      // Public view: only ACTIVE postings
      where.status = 'ACTIVE';
    }

    if (resolvedOriginCityId) {
      where.originCityId = resolvedOriginCityId;
    }

    if (resolvedDestinationCityId) {
      where.destinationCityId = resolvedDestinationCityId;
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
              id: true,
              licensePlate: true,
              truckType: true,
              capacity: true,
              lengthM: true,
              approvalStatus: true,
              // Sprint 16: GPS fields
              imei: true,
              gpsProvider: true,
              gpsStatus: true,
              gpsVerifiedAt: true,
              gpsLastSeenAt: true,
              // Check if truck is assigned to any load
              assignedLoad: {
                where: {
                  OR: [
                    { status: 'ASSIGNED' },
                    { status: 'IN_TRANSIT' },
                  ],
                },
                select: {
                  id: true,
                  trackingEnabled: true,
                  trackingUrl: true,
                  trackingStartedAt: true,
                  pickupCity: true,
                  deliveryCity: true,
                },
              },
            },
          },
          originCity: {
            select: {
              name: true,
              nameEthiopic: true,
              region: true,
              latitude: true,
              longitude: true,
            },
          },
          destinationCity: {
            select: {
              name: true,
              nameEthiopic: true,
              region: true,
              latitude: true,
              longitude: true,
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

    // Transform postings to flatten nested fields for UI consumption
    const transformedPostings = postings.map((posting: any) => ({
      ...posting,
      // Flatten city names
      currentCity: posting.originCity?.name || '',
      destinationCity: posting.destinationCity?.name || null,
      // Add availableDate for compatibility
      availableDate: posting.availableFrom,
      // Flatten truck info
      truckType: posting.truck?.truckType || '',
      lengthM: posting.truck?.lengthM || posting.availableLength,
      maxWeight: posting.truck?.capacity || posting.availableWeight,
      // Flatten carrier info
      carrierContactPhone: posting.contactPhone,
    }));

    // Calculate match counts if requested
    let postingsWithMatchCount = transformedPostings;
    if (includeMatchCount) {
      // Fetch all posted loads for matching
      // Performance limit: Only fetch recent 1000 posted loads for matching
      // This is intentional to prevent slow queries on large datasets
      // For more matches, use dedicated /api/matches endpoint with pagination
      const loads = await db.load.findMany({
        where: { status: 'POSTED' },
        select: {
          id: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          truckType: true,
          weight: true,
          lengthM: true,
          fullPartial: true,
        },
        take: 1000,
        orderBy: { createdAt: 'desc' }, // Most recent loads first
      });

      postingsWithMatchCount = postings.map((posting: any) => {
        const truckCriteria = {
          currentCity: posting.originCity?.name || '',
          destinationCity: posting.destinationCity?.name || null,
          availableDate: posting.availableFrom,
          truckType: posting.truck?.truckType || '',
          maxWeight: posting.availableWeight ? Number(posting.availableWeight) : null,
          lengthM: posting.availableLength ? Number(posting.availableLength) : null,
          fullPartial: posting.fullPartial,
        };

        const loadsCriteria = loads
          .filter(load => load.pickupCity && load.deliveryCity && load.truckType)
          .map(load => ({
            pickupCity: load.pickupCity!,
            deliveryCity: load.deliveryCity!,
            pickupDate: load.pickupDate,
            truckType: load.truckType,
            weight: load.weight ? Number(load.weight) : null,
            lengthM: load.lengthM ? Number(load.lengthM) : null,
            fullPartial: load.fullPartial,
          }));

        const matches = findMatchingLoads(truckCriteria, loadsCriteria, 50);

        return {
          ...posting,
          matchCount: matches.length,
        };
      });
    }

    return NextResponse.json({
      truckPostings: postingsWithMatchCount,
      postings: postingsWithMatchCount, // Keep for backward compatibility
      pagination: {
        total,
        limit,
        offset,
      },
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
