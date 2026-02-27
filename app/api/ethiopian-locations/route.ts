/**
 * Ethiopian Locations API
 *
 * Returns list of Ethiopian cities and locations for dropdowns
 *
 * PHASE 4: Added caching - locations rarely change, cache for 1 hour
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheAside, CacheKeys } from "@/lib/cache";

// Cache TTL: 1 hour (locations rarely change)
const LOCATIONS_CACHE_TTL = 60 * 60;

// FIX: Use proper types - Prisma Decimal is compatible with any
interface Location {
  id: string;
  name: string;
  nameEthiopic: string | null;
  region: string;
  // Prisma returns Decimal objects which are compatible with number operations
  latitude: unknown;
  longitude: unknown;
}

/**
 * GET /api/ethiopian-locations
 *
 * Fetch all active Ethiopian locations (cached)
 *
 * Returns: Array of locations with id, name, nameEthiopic, region
 */
export async function GET(request: NextRequest) {
  try {
    // PHASE 4: Use cache-aside pattern for locations
    const locations = await cacheAside<Location[]>(
      CacheKeys.locations(),
      async () => {
        return db.ethiopianLocation.findMany({
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
            name: "asc",
          },
        });
      },
      LOCATIONS_CACHE_TTL
    );

    return NextResponse.json({
      locations,
      count: locations.length,
    });
  } catch (error) {
    console.error("Failed to fetch Ethiopian locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}
