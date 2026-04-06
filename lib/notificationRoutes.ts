/**
 * Notification Route Helper — single source of truth.
 *
 * Replaces the duplicated `getNotificationRoute()` switches that lived in
 * components/NotificationBell.tsx and app/notifications/NotificationsPageClient.tsx.
 *
 * Item 18 / G18-1..G18-4: previously, 17 notification types were emitted by
 * the backend but had no routing case in either UI. Clicking those
 * notifications did nothing. This module fills those gaps and prevents
 * future drift between the two web surfaces.
 *
 * Mobile has its own router at mobile/src/utils/notificationRouting.ts which
 * mirrors the same coverage but uses native Expo Router paths.
 */

export interface NotificationRouteMetadata {
  loadId?: string;
  tripId?: string;
  truckId?: string;
  proposalId?: string;
  escalationId?: string;
  loadRequestId?: string;
  requestId?: string;
  disputeId?: string;
  settlementId?: string;
  depositId?: string;
  savedSearchId?: string;
  searchId?: string;
  conversationId?: string;
  // Allow additional unknown keys without losing type-safety on the known set
  [key: string]: unknown;
}

export type NotificationRole =
  | "SHIPPER"
  | "CARRIER"
  | "DISPATCHER"
  | "ADMIN"
  | "SUPER_ADMIN"
  | string;

/**
 * Resolve the navigation target for a notification, role-aware.
 * Returns `null` only when no sensible target exists for the (type, role) pair.
 */
export function getNotificationRoute(
  type: string,
  role: NotificationRole,
  metadata?: NotificationRouteMetadata | null
): string | null {
  const m = metadata ?? {};
  const isCarrier = role === "CARRIER";
  const isShipper = role === "SHIPPER";
  const isDispatcher = role === "DISPATCHER";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  switch (type) {
    // ── Truck status ────────────────────────────────────────────────────────
    case "TRUCK_APPROVED":
    case "TRUCK_REJECTED":
      return m.truckId
        ? `/carrier/trucks?highlight=${m.truckId}`
        : `/carrier/trucks`;

    // ── Match proposals ─────────────────────────────────────────────────────
    case "MATCH_PROPOSAL":
      if (isCarrier)
        return `/carrier/proposals?highlight=${m.proposalId ?? ""}`;
      if (isShipper && m.loadId)
        return `/shipper/loads/${m.loadId}?tab=proposals`;
      if (isShipper) return `/shipper/proposals`;
      return null;

    case "MATCH_PROPOSAL_ACCEPTED":
      if (m.loadId) {
        return isCarrier
          ? `/carrier/trips/${m.loadId}`
          : `/shipper/loads/${m.loadId}`;
      }
      return null;

    case "MATCH_PROPOSAL_REJECTED":
      return isCarrier ? `/carrier/proposals` : null;

    // ── Exceptions & escalations ────────────────────────────────────────────
    case "EXCEPTION_CREATED":
      if (isDispatcher)
        return m.escalationId
          ? `/dispatcher/escalations/${m.escalationId}`
          : `/dispatcher/escalations`;
      if (m.loadId) {
        return isCarrier
          ? `/carrier/trips/${m.loadId}`
          : `/shipper/loads/${m.loadId}`;
      }
      return null;

    case "ESCALATION_ASSIGNED":
      if (isDispatcher && m.escalationId)
        return `/dispatcher/escalations/${m.escalationId}`;
      return isDispatcher ? `/dispatcher/escalations` : null;

    case "ESCALATION_RESOLVED":
    case "EXCEPTION_RESOLVED":
      if (m.loadId) {
        if (isCarrier) return `/carrier/trips/${m.loadId}`;
        if (isShipper) return `/shipper/loads/${m.loadId}`;
        if (isAdmin) return `/admin/trips`;
      }
      return null;

    // ── Service fees & wallet ───────────────────────────────────────────────
    case "SERVICE_FEE_DEDUCTED":
    case "SERVICE_FEE_REFUNDED":
    case "SERVICE_FEE_RESERVED":
    case "PARTIAL_FEE_COLLECTION":
      return isCarrier ? `/carrier/wallet` : `/shipper/wallet`;

    case "SERVICE_FEE_FAILED":
      return isAdmin ? `/admin/settlement/review` : null;

    case "WALLET_TOPUP_CONFIRMED":
      if (isCarrier) return `/carrier/wallet`;
      if (isShipper) return `/shipper/wallet`;
      return `/admin/users`;

    case "WITHDRAWAL_APPROVED":
    case "WITHDRAWAL_REJECTED":
    case "LOW_BALANCE_WARNING":
      return isCarrier ? `/carrier/wallet` : `/shipper/wallet`;

    // ── Self-service deposits (G18-1) ───────────────────────────────────────
    case "DEPOSIT_REQUESTED":
      return isAdmin ? `/admin/wallet-deposits` : null;

    // ── Return loads ────────────────────────────────────────────────────────
    case "RETURN_LOAD_AVAILABLE":
    case "RETURN_LOAD_MATCHED":
      return `/carrier/loads`;

    // ── Bypass / admin ──────────────────────────────────────────────────────
    case "BYPASS_WARNING":
    case "ACCOUNT_FLAGGED":
      return isAdmin ? `/admin/users` : null;

    case "DOCUMENTS_SUBMITTED":
      return isAdmin ? `/admin/verification` : null;

    // ── Carrier request flow ────────────────────────────────────────────────
    case "LOAD_REQUEST_APPROVED":
      return m.loadId ? `/carrier/trips/${m.loadId}` : null;
    case "LOAD_REQUEST_REJECTED":
      return m.loadRequestId
        ? `/carrier/load-requests?highlight=${m.loadRequestId}`
        : null;
    case "TRUCK_REQUEST_RECEIVED":
      return m.requestId
        ? `/carrier/requests?highlight=${m.requestId}`
        : `/carrier/requests`;

    // ── Shipper request flow ────────────────────────────────────────────────
    case "LOAD_REQUEST_RECEIVED":
      return m.loadRequestId
        ? `/shipper/requests?highlight=${m.loadRequestId}`
        : `/shipper/requests`;
    case "TRUCK_REQUEST_APPROVED":
      return m.loadId ? `/shipper/trips/${m.loadId}` : null;
    case "TRUCK_REQUEST_REJECTED":
      return m.requestId
        ? `/shipper/requests?tab=my-requests&highlight=${m.requestId}`
        : `/shipper/requests`;

    // ── Bare request types (G18-1) ──────────────────────────────────────────
    case "TRUCK_REQUEST":
      // Emitted by notifyTruckRequest() to the carrier — recipient is carrier
      return m.requestId
        ? `/carrier/requests?highlight=${m.requestId}`
        : `/carrier/requests`;
    case "LOAD_REQUEST":
      // Emitted by notifyLoadRequest() to the shipper — recipient is shipper
      return m.loadRequestId
        ? `/shipper/requests?highlight=${m.loadRequestId}`
        : `/shipper/requests`;
    case "REQUEST_REJECTED":
      // Generic — route by role
      if (isCarrier) return `/carrier/requests`;
      if (isShipper) return `/shipper/requests`;
      return null;

    // ── Trip events ─────────────────────────────────────────────────────────
    case "TRIP_STARTED":
    case "TRIP_COMPLETED":
      return m.loadId ? `/carrier/trips/${m.loadId}` : null;

    case "TRIP_CANCELLED":
      if (isCarrier) return `/carrier/trips`;
      if (isShipper) return `/shipper/trips`;
      if (isAdmin || isDispatcher) return `/admin/trips`;
      return null;

    case "DELIVERY_CONFIRMED": {
      const entityId = m.tripId ?? m.loadId;
      if (entityId) {
        return isCarrier
          ? `/carrier/trips/${entityId}`
          : `/shipper/trips/${entityId}`;
      }
      return isCarrier ? `/carrier/trips` : `/shipper/trips`;
    }

    case "TRIP_REASSIGNED":
      if (isCarrier) return `/carrier/trips`;
      if (isDispatcher) return `/dispatcher/trips`;
      if (isAdmin) return `/admin/trips`;
      return null;

    case "TRIP_DELIVERED":
      if (isShipper && m.loadId) return `/shipper/loads/${m.loadId}`;
      if (isCarrier && m.loadId) return `/carrier/trips/${m.loadId}`;
      return null;

    case "TRIP_IN_TRANSIT":
      if (isShipper && m.loadId) return `/shipper/loads/${m.loadId}`;
      if (isCarrier && m.loadId) return `/carrier/trips/${m.loadId}`;
      return null;

    case "TRIP_PROGRESS_80":
      if (isCarrier && m.loadId) return `/carrier/trips/${m.loadId}`;
      return null;

    case "POD_SUBMITTED":
      if (isShipper && m.loadId) return `/shipper/loads/${m.loadId}`;
      if (isAdmin) return `/admin/loads`;
      return null;

    case "POD_VERIFIED":
      return m.loadId ? `/carrier/trips/${m.loadId}` : null;

    case "POD_UPLOADED":
      return m.loadId ? `/shipper/loads/${m.loadId}` : null;

    case "LOAD_ASSIGNED":
      if (isShipper && m.loadId) return `/shipper/loads/${m.loadId}`;
      if (isCarrier && m.loadId) return `/carrier/trips/${m.loadId}`;
      return null;

    case "SETTLEMENT_COMPLETE":
      if (m.settlementId) {
        return isCarrier
          ? `/carrier/wallet?settlement=${m.settlementId}`
          : `/shipper/wallet`;
      }
      return isCarrier ? `/carrier/wallet` : `/shipper/wallet`;

    // ── GPS ─────────────────────────────────────────────────────────────────
    case "GPS_OFFLINE":
    case "TRUCK_AT_PICKUP":
    case "TRUCK_AT_DELIVERY":
      return m.loadId ? `/carrier/trips/${m.loadId}` : null;

    case "GPS_NO_DATA":
      // Recipient is the carrier whose truck stopped reporting
      if (isCarrier && m.loadId) return `/carrier/trips/${m.loadId}`;
      if (isShipper && m.loadId) return `/shipper/loads/${m.loadId}/tracking`;
      return null;

    // ── User / verification ─────────────────────────────────────────────────
    case "USER_STATUS_CHANGED":
      return `/settings`;

    case "ACCOUNT_APPROVED":
      return isShipper ? `/shipper` : `/carrier/trucks`;

    case "REGISTRATION_RESUBMITTED":
      return isAdmin ? `/admin/verification` : null;

    case "TRUCK_RESUBMITTED":
      return isAdmin ? `/admin/trucks` : null;

    // ── Disputes (G18-1) ────────────────────────────────────────────────────
    case "DISPUTE_FILED":
    case "DISPUTE_STATUS_CHANGED":
    case "DISPUTE_RESOLVED":
      if (m.disputeId) {
        if (isAdmin) return `/admin/disputes/${m.disputeId}`;
        if (isShipper) return `/shipper/disputes/${m.disputeId}`;
        if (isCarrier) return `/carrier/disputes/${m.disputeId}`;
      }
      if (isAdmin) return `/admin/disputes`;
      if (isShipper) return `/shipper/disputes`;
      if (isCarrier) return `/carrier/disputes`;
      return null;

    // ── Saved-search alerts (G18-1) ─────────────────────────────────────────
    case "SAVED_SEARCH_MATCH": {
      const sid = m.savedSearchId ?? m.searchId;
      if (isCarrier)
        return sid ? `/carrier/loads?searchId=${sid}` : `/carrier/loads`;
      if (isShipper)
        return sid
          ? `/shipper/loadboard?searchId=${sid}`
          : `/shipper/loadboard`;
      return null;
    }

    // ── Insurance lifecycle (G18-1) ─────────────────────────────────────────
    case "INSURANCE_EXPIRING_SOON":
    case "INSURANCE_EXPIRING_URGENT":
    case "INSURANCE_EXPIRING_FINAL":
    case "INSURANCE_EXPIRED":
    case "INSURANCE_RENEWED":
      if (isCarrier) return `/carrier/documents`;
      if (isShipper) return `/shipper/documents`;
      if (isAdmin) return `/admin/verification`;
      return null;

    // ── Ratings (G18-1) ─────────────────────────────────────────────────────
    case "RATING_REQUESTED":
    case "RATING_RECEIVED": {
      const entityId = m.tripId ?? m.loadId;
      if (entityId) {
        if (isShipper) return `/shipper/trips/${entityId}`;
        if (isCarrier) return `/carrier/trips/${entityId}`;
      }
      if (isShipper) return `/shipper/trips`;
      if (isCarrier) return `/carrier/trips`;
      return null;
    }

    // ── In-app messaging (G18-1) ────────────────────────────────────────────
    case "NEW_MESSAGE": {
      const entityId = m.tripId ?? m.loadId ?? m.conversationId;
      if (entityId) {
        if (isShipper) return `/shipper/trips/${entityId}?tab=messages`;
        if (isCarrier) return `/carrier/trips/${entityId}?tab=messages`;
      }
      return null;
    }

    default:
      return null;
  }
}
