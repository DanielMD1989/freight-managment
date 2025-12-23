/**
 * Load Utility Functions
 *
 * Utility functions for load board grid:
 * - Age calculation from posted/created timestamps
 * - RPM/tRPM computed metrics
 * - Privacy masking for company and contact information
 */

// Type for Prisma Decimal - can be Decimal object or number
type DecimalLike = { toString(): string } | number;

/**
 * Calculate age in minutes from posted or created timestamp
 * @param postedAt - Timestamp when load was posted
 * @param createdAt - Timestamp when load was created
 * @returns Age in minutes
 */
export function calculateAge(postedAt: Date | null, createdAt: Date): number {
  const referenceDate = postedAt || createdAt;
  const now = new Date();
  const ageInMs = now.getTime() - referenceDate.getTime();
  return Math.floor(ageInMs / (1000 * 60)); // Convert to minutes
}

/**
 * Format age minutes into human-readable string
 * @param ageMinutes - Age in minutes
 * @returns Formatted string: "Xm", "Xh Ym", or "Xd"
 */
export function formatAge(ageMinutes: number): string {
  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  } else if (ageMinutes < 1440) {
    // Less than 24 hours
    const hours = Math.floor(ageMinutes / 60);
    const mins = ageMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } else {
    // 24 hours or more
    const days = Math.floor(ageMinutes / 1440);
    return `${days}d`;
  }
}

/**
 * Calculate RPM (Rate Per Mile/Kilometer)
 * @param rate - Load rate in ETB
 * @param tripKm - Trip distance in km
 * @returns RPM or null if cannot calculate
 */
export function calculateRPM(
  rate: DecimalLike | number,
  tripKm: DecimalLike | number | null
): number | null {
  if (!tripKm || Number(tripKm) <= 0) {
    return null;
  }

  const rateNum = typeof rate === "number" ? rate : Number(rate);
  const tripNum = typeof tripKm === "number" ? tripKm : Number(tripKm);

  return Number((rateNum / tripNum).toFixed(2));
}

/**
 * Calculate tRPM (Total Rate Per Mile/Kilometer) including deadhead
 * @param rate - Load rate in ETB
 * @param tripKm - Trip distance in km
 * @param dhToOriginKm - Deadhead to origin in km
 * @param dhAfterDeliveryKm - Deadhead after delivery in km
 * @returns tRPM or null if cannot calculate
 */
export function calculateTRPM(
  rate: DecimalLike | number,
  tripKm: DecimalLike | number | null,
  dhToOriginKm: DecimalLike | number | null,
  dhAfterDeliveryKm: DecimalLike | number | null
): number | null {
  const tripNum = tripKm ? Number(tripKm) : 0;
  const dhOriginNum = dhToOriginKm ? Number(dhToOriginKm) : 0;
  const dhAfterNum = dhAfterDeliveryKm ? Number(dhAfterDeliveryKm) : 0;

  const totalKm = tripNum + dhOriginNum + dhAfterNum;

  if (totalKm <= 0) {
    return null;
  }

  const rateNum = typeof rate === "number" ? rate : Number(rate);

  return Number((rateNum / totalKm).toFixed(2));
}

/**
 * Mask company name if anonymous
 * @param isAnonymous - Whether the shipper is posting anonymously
 * @param companyName - Original company name
 * @returns Company name or "Anonymous Shipper"
 */
export function maskCompany(
  isAnonymous: boolean,
  companyName: string | null
): string {
  if (isAnonymous) {
    return "Anonymous Shipper";
  }
  return companyName || "Unknown Company";
}

/**
 * Mask contact information based on assignment and viewer role
 * @param isAssigned - Whether the load is assigned to a truck
 * @param viewerRole - Role of the viewer (ADMIN, PLATFORM_OPS, etc.)
 * @param contact - Contact information (name or phone)
 * @returns Contact info or null if should be hidden
 */
export function maskContact(
  isAssigned: boolean,
  viewerRole: string,
  contact: string | null
): string | null {
  // Reveal contact if viewer is admin/ops OR load is assigned
  if (viewerRole === "ADMIN" || viewerRole === "PLATFORM_OPS" || isAssigned) {
    return contact;
  }

  // Hide contact for everyone else
  return null;
}

/**
 * Check if user can see contact information
 * @param loadAssignedTruckId - ID of assigned truck (null if unassigned)
 * @param userOrgId - Organization ID of the viewer
 * @param assignedTruckCarrierId - Organization ID that owns the assigned truck
 * @param viewerRole - Role of the viewer
 * @returns True if user can see contact info
 */
export function canSeeContact(
  loadAssignedTruckId: string | null,
  userOrgId: string | null,
  assignedTruckCarrierId: string | null,
  viewerRole: string
): boolean {
  // Admin and Ops can always see contact
  if (viewerRole === "ADMIN" || viewerRole === "PLATFORM_OPS") {
    return true;
  }

  // If load is assigned and viewer is from the carrier organization
  if (
    loadAssignedTruckId &&
    userOrgId &&
    assignedTruckCarrierId &&
    userOrgId === assignedTruckCarrierId
  ) {
    return true;
  }

  // Everyone else cannot see contact
  return false;
}
