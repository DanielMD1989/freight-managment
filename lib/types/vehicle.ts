/**
 * Vehicle Map Data Types
 *
 * SINGLE SOURCE OF TRUTH for data shapes between API and frontend.
 * Both the API endpoint and frontend components MUST use these types.
 *
 * API: app/api/map/vehicles/route.ts
 * Frontend: app/carrier/map/page.tsx
 *
 * @see VEHICLE-TYPE-CONTRACT.md for documentation
 */

import { TruckType, GpsDeviceStatus } from "@prisma/client";

// Re-export Prisma enums for frontend use
export { TruckType, GpsDeviceStatus };

/**
 * Truck availability status for map display.
 * Derived from Truck.isAvailable boolean in database.
 */
export type TruckAvailabilityStatus = "AVAILABLE" | "IN_TRANSIT";

/**
 * GPS status for frontend display.
 * Maps from GpsDeviceStatus enum with frontend-friendly values.
 *
 * ACTIVE: GPS device is sending signals (last update < 15 min)
 * OFFLINE: GPS device exists but signal is stale (last update >= 15 min)
 * NO_DEVICE: No GPS location data available
 */
export type GpsDisplayStatus = "ACTIVE" | "OFFLINE" | "NO_DEVICE";

/**
 * Vehicle location data with optional telemetry.
 */
export interface VehicleLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  updatedAt?: string;
}

/**
 * Driver information attached to a vehicle.
 */
export interface VehicleDriver {
  id?: string;
  name: string;
  phone?: string;
}

/**
 * Carrier organization that owns the vehicle.
 */
export interface VehicleCarrier {
  id: string;
  name: string;
}

/**
 * Current trip information for a vehicle in transit.
 */
export interface VehicleCurrentTrip {
  id: string;
  loadId: string;
  origin: string;
  destination: string;
  status: string;
}

/**
 * Vehicle data for map display.
 *
 * This is the CANONICAL shape for vehicle data returned by the map API
 * and consumed by the carrier map frontend.
 */
export interface VehicleMapData {
  /** Unique truck ID (cuid) */
  id: string;

  /** License plate number */
  plateNumber: string;

  /** Truck type from Prisma enum */
  truckType: TruckType | string;

  /** Cargo capacity in kg */
  capacity: number;

  /** Availability status for display */
  status: TruckAvailabilityStatus;

  /** Whether truck is available (raw boolean from DB) */
  isAvailable: boolean;

  /** GPS status for display */
  gpsStatus: GpsDisplayStatus;

  /** Current GPS location, null if no GPS data */
  currentLocation: VehicleLocation | null;

  /** Carrier organization that owns this truck */
  carrier: VehicleCarrier;

  /** Optional driver information */
  driver?: VehicleDriver;

  /** Optional current trip if truck is in transit */
  currentTrip?: VehicleCurrentTrip;
}

/**
 * Statistics for the vehicle map display.
 *
 * Field names MUST match exactly between API response and frontend Stats interface.
 */
export interface VehicleMapStats {
  /** Total number of vehicles */
  total: number;

  /** Vehicles with active GPS signal (< 15 min old) */
  active: number;

  /** Vehicles with stale GPS signal (>= 15 min old) */
  offline: number;

  /** Vehicles with no GPS data at all */
  noDevice: number;

  /** Available trucks (isAvailable = true) */
  available: number;

  /** Trucks currently in transit (isAvailable = false) */
  inTransit: number;
}

/**
 * Complete response from GET /api/map/vehicles.
 *
 * This is the exact shape returned by the API and expected by the frontend.
 */
export interface VehicleMapResponse {
  /** Array of vehicle data for map markers */
  vehicles: VehicleMapData[];

  /** Total count (same as stats.total) */
  total: number;

  /** Aggregated statistics for sidebar display */
  stats: VehicleMapStats;
}

/**
 * Helper function to map Prisma GpsDeviceStatus to frontend GpsDisplayStatus.
 *
 * @param dbStatus - The GpsDeviceStatus from database (or null)
 * @param hasLocation - Whether the truck has GPS coordinates
 * @param isRecent - Whether the GPS update is recent (< 15 min)
 * @returns GpsDisplayStatus for frontend
 */
export function mapGpsStatus(
  dbStatus: GpsDeviceStatus | null | undefined,
  hasLocation: boolean,
  isRecent: boolean
): GpsDisplayStatus {
  if (!hasLocation) {
    return "NO_DEVICE";
  }
  if (isRecent) {
    return "ACTIVE";
  }
  return "OFFLINE";
}

/**
 * Helper function to map truck availability to status string.
 *
 * @param isAvailable - The isAvailable boolean from database
 * @returns TruckAvailabilityStatus for frontend
 */
export function mapTruckStatus(isAvailable: boolean): TruckAvailabilityStatus {
  return isAvailable ? "AVAILABLE" : "IN_TRANSIT";
}

/**
 * Type guard to check if a value is a valid GpsDisplayStatus.
 */
export function isValidGpsDisplayStatus(
  value: unknown
): value is GpsDisplayStatus {
  return value === "ACTIVE" || value === "OFFLINE" || value === "NO_DEVICE";
}

/**
 * Type guard to check if a value is a valid TruckAvailabilityStatus.
 */
export function isValidTruckStatus(
  value: unknown
): value is TruckAvailabilityStatus {
  return value === "AVAILABLE" || value === "IN_TRANSIT";
}
