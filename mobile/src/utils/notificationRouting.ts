/**
 * Notification Deep Linking - Maps notification types to routes
 *
 * Server NotificationType values (from lib/notifications.ts and prisma schema):
 * LOAD_ASSIGNED, LOAD_STATUS_CHANGE, TRUCK_REQUEST, TRUCK_REQUEST_APPROVED,
 * TRUCK_REQUEST_REJECTED, LOAD_REQUEST, LOAD_REQUEST_APPROVED, LOAD_REQUEST_REJECTED,
 * GPS_OFFLINE, GPS_ONLINE, POD_SUBMITTED, PAYMENT_RECEIVED, PAYMENT_PENDING,
 * USER_SUSPENDED, RATING_RECEIVED, EXCEPTION_REPORTED, GEOFENCE_ALERT,
 * NEW_LOAD_MATCHING, MARKETING, SYSTEM
 */

export interface NotificationMetadata {
  type?: string;
  tripId?: string;
  loadId?: string;
  truckId?: string;
  requestId?: string;
  postingId?: string;
  [key: string]: unknown;
}

/**
 * Get the route to navigate to based on notification type and metadata.
 * Only uses real server NotificationType enum values.
 */
export function getNotificationRoute(
  type: string | undefined,
  metadata: NotificationMetadata,
  userRole: string
): string | null {
  if (!type) return null;

  const isCarrier = userRole === "CARRIER";

  switch (type) {
    // Trip-related: navigate to trip detail if tripId available
    case "LOAD_ASSIGNED":
    case "LOAD_STATUS_CHANGE":
    case "POD_SUBMITTED":
      if (metadata.tripId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.tripId}`
          : `/(shipper)/trips/${metadata.tripId}`;
      }
      return null;

    // Truck request related: navigate to requests screen
    case "TRUCK_REQUEST":
    case "TRUCK_REQUEST_APPROVED":
    case "TRUCK_REQUEST_REJECTED":
      return isCarrier ? "/(carrier)/requests" : "/(shipper)/requests";

    // Load request related: navigate to requests screen
    case "LOAD_REQUEST":
    case "LOAD_REQUEST_APPROVED":
    case "LOAD_REQUEST_REJECTED":
      return isCarrier ? "/(carrier)/requests" : "/(shipper)/requests";

    // Load matching: navigate to matches screen
    case "NEW_LOAD_MATCHING":
      return isCarrier ? "/(carrier)/matches" : "/(shipper)/matches";

    // Payment related: navigate to wallet
    case "PAYMENT_RECEIVED":
    case "PAYMENT_PENDING":
      return isCarrier ? "/(carrier)/wallet" : "/(shipper)/wallet";

    // GPS events: navigate to map screen
    case "GPS_OFFLINE":
    case "GPS_ONLINE":
    case "GEOFENCE_ALERT":
      return isCarrier ? "/(carrier)/map" : "/(shipper)/map";

    // Rating: navigate to profile
    case "RATING_RECEIVED":
      return "/(shared)/profile";

    // Exception: navigate to trip detail if tripId available, else trips list
    case "EXCEPTION_REPORTED":
      if (metadata.tripId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.tripId}`
          : `/(shipper)/trips/${metadata.tripId}`;
      }
      return isCarrier ? "/(carrier)/trips" : "/(shipper)/trips";

    // No navigation for these types
    case "USER_SUSPENDED":
    case "MARKETING":
    case "SYSTEM":
      return null;

    default:
      return null;
  }
}
