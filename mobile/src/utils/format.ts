/**
 * Formatting utilities for display values
 */

/** Format weight in kg to display string (e.g., "12.5 tons") */
export function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return "N/A";
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)} tons`;
  }
  return `${kg.toFixed(0)} kg`;
}

/** Format distance in km */
export function formatDistance(km: number | null | undefined): string {
  if (km == null) return "N/A";
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(0)} km`;
}

/** Format age from a date to human-readable string (e.g., "2h", "3d") */
export function formatAge(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  return `${diffDays}d`;
}

/** Format currency amount */
export function formatCurrency(amount: number, currency = "ETB"): string {
  return `${amount.toLocaleString()} ${currency}`;
}

/** Format truck type enum to display string */
export function formatTruckType(type: string | null | undefined): string {
  if (!type) return "N/A";
  const map: Record<string, string> = {
    FLATBED: "Flatbed",
    REFRIGERATED: "Refrigerated",
    TANKER: "Tanker",
    CONTAINER: "Container",
    DRY_VAN: "Dry Van",
    LOWBOY: "Lowboy",
    DUMP_TRUCK: "Dump Truck",
    BOX_TRUCK: "Box Truck",
  };
  return map[type] ?? type;
}

/** Format load status to display string */
export function formatLoadStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    POSTED: "Posted",
    SEARCHING: "Searching",
    OFFERED: "Offered",
    ASSIGNED: "Assigned",
    PICKUP_PENDING: "Pickup Pending",
    IN_TRANSIT: "In Transit",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    EXCEPTION: "Exception",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    UNPOSTED: "Unposted",
  };
  return map[status] ?? status;
}

/** Format trip status to display string */
export function formatTripStatus(status: string): string {
  const map: Record<string, string> = {
    ASSIGNED: "Assigned",
    PICKUP_PENDING: "En Route to Pickup",
    IN_TRANSIT: "In Transit",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return map[status] ?? status;
}

/** Format heading degrees to cardinal direction */
export function formatHeading(heading: number | null | undefined): string {
  if (heading == null) return "N/A";
  if (heading >= 337.5 || heading < 22.5) return "N";
  if (heading >= 22.5 && heading < 67.5) return "NE";
  if (heading >= 67.5 && heading < 112.5) return "E";
  if (heading >= 112.5 && heading < 157.5) return "SE";
  if (heading >= 157.5 && heading < 202.5) return "S";
  if (heading >= 202.5 && heading < 247.5) return "SW";
  if (heading >= 247.5 && heading < 292.5) return "W";
  return "NW";
}

/** Format date for display */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format date with time */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
