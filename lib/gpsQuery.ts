/**
 * GPS Position Query Utility
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Utilities for querying GPS position data
 */

import { db } from "./db";
import { Decimal } from "decimal.js";
import { calculateDistanceKm } from "./geo";

export interface GpsPosition {
  id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  accuracy: number | null;
  timestamp: Date;
  truckId: string;
  loadId: string | null;
}

/**
 * Get latest GPS position for a truck
 *
 * @param truckId - Truck ID
 * @returns Latest GPS position or null
 */
export async function getLatestPosition(
  truckId: string
): Promise<GpsPosition | null> {
  const position = await db.gpsPosition.findFirst({
    where: { truckId },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      speed: true,
      heading: true,
      altitude: true,
      accuracy: true,
      timestamp: true,
      truckId: true,
      loadId: true,
    },
  });

  if (!position) {
    return null;
  }

  return formatPosition(position);
}

/**
 * Get position history for a truck within a date range
 *
 * @param truckId - Truck ID
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param limit - Maximum number of positions to return (default: 1000)
 * @returns Array of GPS positions
 */
export async function getPositionHistory(
  truckId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 1000
): Promise<GpsPosition[]> {
  const positions = await db.gpsPosition.findMany({
    where: {
      truckId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
    take: limit,
    select: {
      id: true,
      latitude: true,
      longitude: true,
      speed: true,
      heading: true,
      altitude: true,
      accuracy: true,
      timestamp: true,
      truckId: true,
      loadId: true,
    },
  });

  return positions.map(formatPosition);
}

/**
 * Get all GPS positions for a load
 *
 * Returns the complete GPS tracking history for a delivered load
 *
 * @param loadId - Load ID
 * @returns Array of GPS positions
 */
export async function getLoadPositions(loadId: string): Promise<GpsPosition[]> {
  const positions = await db.gpsPosition.findMany({
    where: { loadId },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      speed: true,
      heading: true,
      altitude: true,
      accuracy: true,
      timestamp: true,
      truckId: true,
      loadId: true,
    },
  });

  return positions.map(formatPosition);
}

/**
 * Calculate total trip distance from GPS positions
 *
 * Uses Haversine formula to calculate distance between consecutive points
 *
 * @param positions - Array of GPS positions
 * @returns Total distance in kilometers
 */
export function calculateTripDistance(positions: GpsPosition[]): number {
  if (positions.length < 2) {
    return 0;
  }

  let totalDistance = 0;

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];

    const distance = haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    totalDistance += distance;
  }

  return Math.round(totalDistance * 100) / 100; // Round to 2 decimal places
}

/**
 * COLLAPSED TO SINGLE SOURCE OF TRUTH (2026-02-06)
 * Now delegates to lib/geo.ts:calculateDistanceKm
 * Wrapper kept for backward compatibility with existing callers.
 *
 * Calculate distance between two GPS coordinates using Haversine formula
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Delegates to single source of truth
  return calculateDistanceKm(lat1, lon1, lat2, lon2);
}

/** Position data from Prisma query - Decimal fields that need conversion */
interface RawGpsPosition {
  id: string;
  latitude: { toNumber(): number } | number;
  longitude: { toNumber(): number } | number;
  speed: { toNumber(): number } | number | null;
  heading: { toNumber(): number } | number | null;
  altitude: { toNumber(): number } | number | null;
  accuracy: { toNumber(): number } | number | null;
  timestamp: Date;
  truckId: string;
  loadId: string | null;
}

/**
 * Format GPS position from database to API format
 *
 * Converts Decimal fields to numbers
 *
 * @param position - Raw position from database
 * @returns Formatted GPS position
 */
function formatPosition(position: RawGpsPosition): GpsPosition {
  return {
    id: position.id,
    latitude: Number(position.latitude),
    longitude: Number(position.longitude),
    speed: position.speed ? Number(position.speed) : null,
    heading: position.heading ? Number(position.heading) : null,
    altitude: position.altitude ? Number(position.altitude) : null,
    accuracy: position.accuracy ? Number(position.accuracy) : null,
    timestamp: position.timestamp,
    truckId: position.truckId,
    loadId: position.loadId,
  };
}

/**
 * Get GPS position count for a truck
 *
 * @param truckId - Truck ID
 * @param startDate - Start date (optional)
 * @param endDate - End date (optional)
 * @returns Number of GPS positions
 */
export async function getPositionCount(
  truckId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const where: { truckId: string; timestamp?: { gte?: Date; lte?: Date } } = {
    truckId,
  };

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  return await db.gpsPosition.count({ where });
}

/**
 * Delete old GPS positions (data retention)
 *
 * Deletes positions older than the specified number of days
 *
 * @param daysToKeep - Number of days to keep (default: 90)
 * @returns Number of deleted positions
 */
export async function deleteOldPositions(
  daysToKeep: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await db.gpsPosition.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
