/**
 * Notification Deep Linking - Maps notification types to routes
 *
 * Server NotificationType values (from lib/notifications.ts):
 * LOAD_ASSIGNED, LOAD_STATUS_CHANGE, TRUCK_REQUEST, TRUCK_REQUEST_APPROVED,
 * TRUCK_REQUEST_REJECTED, LOAD_REQUEST, LOAD_REQUEST_APPROVED, LOAD_REQUEST_REJECTED,
 * GPS_OFFLINE, GPS_ONLINE, POD_SUBMITTED, PAYMENT_RECEIVED, PAYMENT_PENDING,
 * USER_SUSPENDED, RATING_RECEIVED, EXCEPTION_REPORTED, EXCEPTION_CREATED,
 * ESCALATION_ASSIGNED, ESCALATION_RESOLVED, MATCH_PROPOSAL, MATCH_PROPOSAL_ACCEPTED,
 * MATCH_PROPOSAL_REJECTED, TRUCK_APPROVED, TRUCK_REJECTED, SERVICE_FEE_DEDUCTED,
 * SERVICE_FEE_REFUNDED, SERVICE_FEE_RESERVED, POD_VERIFIED, SETTLEMENT_COMPLETE,
 * GEOFENCE_ALERT, NEW_LOAD_MATCHING, MARKETING, SYSTEM
 */

export interface NotificationMetadata {
  type?: string;
  tripId?: string;
  loadId?: string;
  truckId?: string;
  requestId?: string;
  postingId?: string;
  proposalId?: string;
  escalationId?: string;
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
  const isShipper = userRole === "SHIPPER";
  const isDispatcher = userRole === "DISPATCHER";
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  switch (type) {
    // ── Trip / load status ───────────────────────────────────────────────────
    case "LOAD_ASSIGNED":
    case "LOAD_STATUS_CHANGE":
    case "POD_SUBMITTED": {
      // prefer tripId, fall back to loadId (web sends loadId, not tripId)
      const entityId = metadata.tripId ?? metadata.loadId;
      if (entityId) {
        return isCarrier
          ? `/(carrier)/trips/${entityId}`
          : `/(shipper)/trips/${entityId}`;
      }
      return null;
    }

    // ── Truck approval ───────────────────────────────────────────────────────
    case "TRUCK_APPROVED":
    case "TRUCK_REJECTED":
      return metadata.truckId
        ? `/(carrier)/trucks/${metadata.truckId}`
        : `/(carrier)/trucks`;

    // ── Match proposal ───────────────────────────────────────────────────────
    case "MATCH_PROPOSAL":
      if (isCarrier) return "/(carrier)/requests";
      if (isShipper && metadata.loadId)
        return `/(shipper)/loads/${metadata.loadId}`;
      return null;

    case "MATCH_PROPOSAL_ACCEPTED":
      if (metadata.loadId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.loadId}`
          : `/(shipper)/loads/${metadata.loadId}`;
      }
      return null;

    case "MATCH_PROPOSAL_REJECTED":
      return isCarrier ? "/(carrier)/requests" : null;

    // ── Truck request flow ───────────────────────────────────────────────────
    case "TRUCK_REQUEST":
    case "TRUCK_REQUEST_APPROVED":
    case "TRUCK_REQUEST_REJECTED":
      return isCarrier ? "/(carrier)/requests" : "/(shipper)/requests";

    // ── Load request flow ────────────────────────────────────────────────────
    case "LOAD_REQUEST":
    case "LOAD_REQUEST_APPROVED":
    case "LOAD_REQUEST_REJECTED":
      return isCarrier ? "/(carrier)/requests" : "/(shipper)/requests";

    // ── Load matching ────────────────────────────────────────────────────────
    case "NEW_LOAD_MATCHING":
      return isCarrier ? "/(carrier)/matches" : "/(shipper)/matches";

    // ── Payment / wallet ─────────────────────────────────────────────────────
    case "PAYMENT_RECEIVED":
    case "PAYMENT_PENDING":
      return isCarrier ? "/(carrier)/wallet" : "/(shipper)/wallet";

    // ── Service fees ─────────────────────────────────────────────────────────
    case "SERVICE_FEE_DEDUCTED":
    case "SERVICE_FEE_REFUNDED":
    case "SERVICE_FEE_RESERVED":
      return isCarrier ? "/(carrier)/wallet" : "/(shipper)/wallet";

    // ── Settlement ───────────────────────────────────────────────────────────
    case "SETTLEMENT_COMPLETE":
      return isCarrier ? "/(carrier)/wallet" : "/(shipper)/wallet";

    // ── POD verified ─────────────────────────────────────────────────────────
    case "POD_VERIFIED":
      if (metadata.loadId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.loadId}`
          : `/(shipper)/loads/${metadata.loadId}`;
      }
      return null;

    // ── GPS events ───────────────────────────────────────────────────────────
    case "GPS_OFFLINE":
    case "GPS_ONLINE":
    case "GEOFENCE_ALERT":
      return isCarrier ? "/(carrier)/map" : "/(shipper)/map";

    // ── Rating ───────────────────────────────────────────────────────────────
    case "RATING_RECEIVED":
      return "/(shared)/profile";

    // ── Exception / escalation ───────────────────────────────────────────────
    case "EXCEPTION_CREATED":
      if (isDispatcher) return "/(dispatcher)/escalations";
      if (metadata.tripId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.tripId}`
          : `/(shipper)/trips/${metadata.tripId}`;
      }
      if (metadata.loadId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.loadId}`
          : `/(shipper)/trips/${metadata.loadId}`;
      }
      return null;

    case "EXCEPTION_REPORTED":
      if (metadata.tripId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.tripId}`
          : `/(shipper)/trips/${metadata.tripId}`;
      }
      return isCarrier ? "/(carrier)/trips" : "/(shipper)/trips";

    case "ESCALATION_ASSIGNED":
      if (isDispatcher && metadata.escalationId)
        return `/(dispatcher)/escalations/${metadata.escalationId}`;
      return isDispatcher ? "/(dispatcher)/escalations" : null;

    case "ESCALATION_RESOLVED":
      if (metadata.loadId) {
        return isCarrier
          ? `/(carrier)/trips/${metadata.loadId}`
          : `/(shipper)/trips/${metadata.loadId}`;
      }
      return null;

    // ── Admin / bypass ───────────────────────────────────────────────────────
    case "BYPASS_WARNING":
    case "ACCOUNT_FLAGGED":
      return isAdmin ? "/(admin)/users" : null;

    // ── No navigation ────────────────────────────────────────────────────────
    case "USER_SUSPENDED":
    case "MARKETING":
    case "SYSTEM":
      return null;

    default:
      return null;
  }
}
