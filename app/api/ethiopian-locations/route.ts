/**
 * Ethiopian Locations API
 *
 * Returns list of Ethiopian cities and locations for dropdowns
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/ethiopian-locations
 *
 * Fetch all active Ethiopian locations
 *
 * Returns: Array of locations with id, name, nameEthiopic, region
 */
export async function GET(request: NextRequest) {
  try {
    const locations = await db.ethiopianLocation.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        nameEthiopic: true,
        region: true,
        latitude: true,
        longitude: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      locations,
      count: locations.length,
    });
  } catch (error) {
    console.error('Failed to fetch Ethiopian locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
