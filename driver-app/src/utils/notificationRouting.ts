/**
 * Driver-specific notification routing
 * Maps notification types to driver app screen paths.
 */

export interface NotificationMetadata {
  type?: string;
  tripId?: string;
  loadId?: string;
  [key: string]: unknown;
}

export function getNotificationRoute(
  type: string | undefined,
  metadata: NotificationMetadata
): string | null {
  if (!type) return null;
  const tripId = metadata.tripId || metadata.loadId;

  switch (type) {
    case "TRIP_DRIVER_ASSIGNED":
    case "TRIP_DRIVER_UNASSIGNED":
    case "DELIVERY_CONFIRMED":
    case "TRIP_REASSIGNED":
      return tripId ? `/(driver)/trips/${tripId}` : "/(driver)";
    case "TRUCK_AT_PICKUP":
    case "TRUCK_AT_DELIVERY":
      return tripId ? `/(driver)/trips/${tripId}` : "/(driver)";
    case "GPS_OFFLINE":
    case "GPS_BACK_ONLINE":
      return "/(driver)";
    case "DRIVER_APPROVED":
      return "/(driver)";
    case "DRIVER_REJECTED":
    case "USER_STATUS_CHANGED":
      return "/(shared)/profile";
    case "NEW_MESSAGE":
      return tripId ? `/(shared)/chat/${tripId}` : null;
    default:
      return null;
  }
}
