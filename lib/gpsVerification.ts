/**
 * GPS Verification Utilities
 *
 * Sprint 16 - Story 16.2: Vehicle Registration with GPS IMEI
 *
 * Provides utilities for verifying GPS devices and checking signal freshness.
 *
 * MVP Implementation:
 * - Basic IMEI validation
 * - Freshness calculation
 * - Placeholder for actual GPS device communication
 *
 * Phase 2: Integrate with actual GPS providers (Teltonika, Queclink, Coban)
 */

import { db } from "@/lib/db";
import { GpsDeviceStatus } from "@prisma/client";

/**
 * GPS Position data structure
 */
export interface GpsPosition {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Date;
}

/**
 * GPS verification result
 */
export interface GpsVerificationResult {
  success: boolean;
  message: string;
  provider?: string;
  lastSeen?: Date;
}

/**
 * Validate IMEI format
 * IMEI must be exactly 15 digits
 *
 * @param imei - IMEI string to validate
 * @returns true if valid, false otherwise
 */
export function validateImeiFormat(imei: string): boolean {
  // IMEI must be exactly 15 digits
  const imeiRegex = /^\d{15}$/;
  return imeiRegex.test(imei);
}

/**
 * Calculate Luhn checksum for IMEI validation
 * IMEI uses Luhn algorithm (mod 10)
 *
 * @param imei - 15-digit IMEI string
 * @returns true if checksum is valid
 */
export function validateImeiChecksum(imei: string): boolean {
  if (!validateImeiFormat(imei)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i]);

    // Double every second digit (from right to left, so odd positions from left)
    if (i % 2 === 1) {
      digit *= 2;
      // If result is two digits, add them together
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }

    sum += digit;
  }

  // Sum should be divisible by 10
  return sum % 10 === 0;
}

/**
 * Verify GPS device by pinging it
 *
 * MVP: Returns success for valid IMEI format (placeholder)
 * Phase 2: Actually ping the GPS device via provider API
 *
 * @param imei - GPS device IMEI
 * @returns Verification result
 */
export async function verifyGpsDevice(
  imei: string
): Promise<GpsVerificationResult> {
  // Validate IMEI format
  if (!validateImeiFormat(imei)) {
    return {
      success: false,
      message: "Invalid IMEI format. Must be 15 digits.",
    };
  }

  // Validate IMEI checksum
  if (!validateImeiChecksum(imei)) {
    return {
      success: false,
      message: "Invalid IMEI checksum. Please verify the IMEI is correct.",
    };
  }

  // Check if IMEI is already registered to another truck
  const existingTruck = await db.truck.findFirst({
    where: { imei },
    select: { id: true, licensePlate: true },
  });

  if (existingTruck) {
    return {
      success: false,
      message: `IMEI already registered to truck ${existingTruck.licensePlate}`,
    };
  }

  // MVP: For now, just validate format and return success
  // Phase 2: Add actual GPS device ping via provider API
  // Example providers:
  // - Teltonika: Use their API to verify device status
  // - Queclink: Query their platform
  // - Coban: Check device connectivity

  return {
    success: true,
    message: "GPS device verified successfully",
    provider: "Unknown", // Phase 2: Detect provider from IMEI prefix
    lastSeen: new Date(), // Phase 2: Get actual last seen timestamp
  };
}

/**
 * Get latest GPS position for a device
 *
 * MVP: Returns null (placeholder)
 * Phase 2: Query actual GPS provider API
 *
 * @param imei - GPS device IMEI
 * @returns Latest position or null
 */
export async function getLatestPosition(
  imei: string
): Promise<GpsPosition | null> {
  // Check if truck exists with this IMEI
  const truck = await db.truck.findFirst({
    where: { imei },
    select: {
      id: true,
      gpsLastSeenAt: true,
      gpsPositions: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  if (!truck) {
    return null;
  }

  // Return latest position from database if available
  if (truck.gpsPositions.length > 0) {
    const pos = truck.gpsPositions[0];
    return {
      latitude: pos.latitude.toNumber(),
      longitude: pos.longitude.toNumber(),
      speed: pos.speed?.toNumber(),
      heading: pos.heading?.toNumber(),
      altitude: pos.altitude?.toNumber(),
      accuracy: pos.accuracy?.toNumber(),
      timestamp: pos.timestamp,
    };
  }

  // MVP: No position data yet
  // Phase 2: Query GPS provider API for latest position
  return null;
}

/**
 * Check GPS signal freshness and return human-readable string
 *
 * Examples:
 * - "2 min ago" (< 5 min = online, green)
 * - "15 min ago" (5-30 min = stale, yellow)
 * - "1 hour ago" (> 30 min = offline, red)
 *
 * @param lastSeenAt - Last GPS signal timestamp
 * @returns Human-readable freshness string
 */
export function checkGpsFreshness(lastSeenAt: Date | null): string {
  if (!lastSeenAt) {
    return "never";
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSeenAt.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) {
    return "just now";
  } else if (diffMin < 60) {
    return `${diffMin} min ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  } else {
    return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  }
}

/**
 * Determine GPS status based on last seen timestamp
 *
 * Rules:
 * - ACTIVE: Signal within last 5 minutes
 * - SIGNAL_LOST: Signal between 5-30 minutes ago
 * - INACTIVE: Signal older than 30 minutes or never seen
 *
 * @param lastSeenAt - Last GPS signal timestamp
 * @returns GPS device status
 */
export function determineGpsStatus(lastSeenAt: Date | null): GpsDeviceStatus {
  if (!lastSeenAt) {
    return "INACTIVE";
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSeenAt.getTime();
  const diffMin = diffMs / (1000 * 60);

  if (diffMin < 5) {
    return "ACTIVE";
  } else if (diffMin < 30) {
    return "SIGNAL_LOST";
  } else {
    return "INACTIVE";
  }
}

/**
 * Get GPS status color for UI display
 *
 * @param status - GPS device status
 * @returns Tailwind color class
 */
export function getGpsStatusColor(status: GpsDeviceStatus | null): string {
  switch (status) {
    case "ACTIVE":
      return "text-green-600"; // Green dot: online (< 5 min)
    case "SIGNAL_LOST":
      return "text-yellow-600"; // Yellow dot: stale (5-30 min)
    case "INACTIVE":
    case "MAINTENANCE":
    default:
      return "text-red-600"; // Red dot: offline (> 30 min)
  }
}

/**
 * Get GPS status badge color for UI display
 *
 * @param status - GPS device status
 * @returns Tailwind background color class
 */
export function getGpsStatusBadgeColor(status: GpsDeviceStatus | null): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 border-green-300";
    case "SIGNAL_LOST":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "INACTIVE":
    case "MAINTENANCE":
    default:
      return "bg-red-100 text-red-800 border-red-300";
  }
}

/**
 * Detect GPS provider from IMEI prefix (Phase 2)
 *
 * Common IMEI prefixes:
 * - Teltonika: 35XXXX
 * - Queclink: 86XXXX
 * - Coban: Various
 *
 * @param imei - GPS device IMEI
 * @returns Detected provider name or "Unknown"
 */
export function detectGpsProvider(imei: string): string {
  if (!validateImeiFormat(imei)) {
    return "Unknown";
  }

  const tac = imei.substring(0, 6); // Type Allocation Code

  // Teltonika devices (common TAC prefixes)
  if (tac.startsWith("35")) {
    return "Teltonika";
  }

  // Queclink devices
  if (tac.startsWith("86")) {
    return "Queclink";
  }

  // Add more providers as needed
  // Phase 2: Maintain database of TAC → Provider mappings

  return "Unknown";
}
