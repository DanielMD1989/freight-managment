/**
 * Ethiopian Locations API
 *
 * Public read-only endpoint for location search and autocomplete.
 * Used for dropdown selection in load/truck posting forms.
 *
 * Security:
 * - Public endpoint (no auth required)
 * - Input sanitization to prevent injection
 * - Rate limiting: 1000 requests/hour per IP
 * - Read-only access (no mutations)
 *
 * Sprint 8 - Story 8.2: Ethiopian Location Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma, LocationType } from '@prisma/client';

/**
 * GET /api/locations
 *
 * Search and filter Ethiopian locations for autocomplete dropdowns.
 *
 * Query parameters:
 * - q: Search query (name, nameEthiopic, or aliases)
 * - region: Filter by region
 * - type: Filter by LocationType (CITY, TOWN, VILLAGE, LANDMARK)
 * - limit: Max results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Returns:
 * {
 *   locations: [
 *     {
 *       id: string,
 *       name: string,
 *       nameEthiopic: string | null,
 *       region: string,
 *       zone: string | null,
 *       latitude: number,
 *       longitude: number,
 *       type: string,
 *       population: number | null
 *     }
 *   ],
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract and sanitize query parameters
    const searchQuery = searchParams.get('q')?.trim() || '';
    const region = searchParams.get('region')?.trim();
    const type = searchParams.get('type')?.trim();
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate and set pagination
    const limit = Math.min(
      parseInt(limitParam || '50', 10),
      100 // Max 100 results per request
    );
    const offset = Math.max(parseInt(offsetParam || '0', 10), 0);

    // Validate limit and offset are valid numbers
    if (isNaN(limit) || isNaN(offset)) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Build WHERE clause with filters
    const where: Prisma.EthiopianLocationWhereInput = {
      isActive: true, // Only return active locations
    };

    // Search filter: name, nameEthiopic, or aliases (case-insensitive)
    if (searchQuery) {
      // Sanitize search query to prevent injection
      const sanitizedQuery = searchQuery.replace(/[^\w\s\u1200-\u137F-]/g, '');

      where.OR = [
        {
          name: {
            contains: sanitizedQuery,
            mode: 'insensitive',
          },
        },
        {
          nameEthiopic: {
            contains: sanitizedQuery,
            mode: 'insensitive',
          },
        },
        {
          aliases: {
            hasSome: [sanitizedQuery],
          },
        },
      ];
    }

    // Region filter
    if (region) {
      where.region = {
        equals: region,
        mode: 'insensitive',
      };
    }

    // Type filter (CITY, TOWN, VILLAGE, LANDMARK)
    // FIX: Use proper enum type instead of any
    if (type) {
      const validTypes = Object.values(LocationType);
      const upperType = type.toUpperCase() as LocationType;
      if (validTypes.includes(upperType)) {
        where.type = upperType;
      } else {
        return NextResponse.json(
          { error: 'Invalid location type. Must be one of: CITY, TOWN, VILLAGE, LANDMARK' },
          { status: 400 }
        );
      }
    }

    // Execute queries in parallel
    const [locations, total] = await Promise.all([
      db.ethiopianLocation.findMany({
        where,
        select: {
          id: true,
          name: true,
          nameEthiopic: true,
          region: true,
          zone: true,
          latitude: true,
          longitude: true,
          type: true,
          population: true,
        },
        orderBy: [
          { type: 'asc' }, // Cities first, then towns
          { population: 'desc' }, // Larger cities first
          { name: 'asc' }, // Alphabetical
        ],
        skip: offset,
        take: limit,
      }),
      db.ethiopianLocation.count({ where }),
    ]);

    // Convert Decimal to number for JSON response
    const locationsFormatted = locations.map((loc) => ({
      ...loc,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
    }));

    return NextResponse.json({
      locations: locationsFormatted,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching locations:', error);

    // Don't expose internal errors to client
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
