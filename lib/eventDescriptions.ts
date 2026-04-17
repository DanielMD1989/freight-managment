/**
 * Role-aware event description renderer.
 *
 * LoadEvents store static `description` strings at creation time, e.g.
 * "Carrier Acme Co requested this load with truck HW-001". That reads
 * well for the shipper, but when the carrier views their OWN trip it
 * sounds like a third-party narration.
 *
 * This module produces context-aware descriptions:
 *   Carrier viewer → "You requested this load with truck HW-001"
 *   Shipper viewer → "Carrier Acme Co requested this load with truck HW-001"
 *   Neutral viewer → unchanged (dispatcher, admin)
 *
 * Falls back to the raw `description` for any unrecognised eventType.
 */

interface EventInput {
  eventType: string;
  description: string;
  metadata?: Record<string, unknown> | null;
}

interface ViewerContext {
  /** The organisation ID of the viewer (carrier or shipper). Null for neutral roles. */
  organizationId: string | null;
  /** Carrier and shipper org names from the trip, so we can substitute them. */
  carrierName?: string;
  carrierId?: string;
  shipperName?: string;
  shipperId?: string;
}

/**
 * Return a viewer-aware description for an event.
 *
 * The function first tries to generate a structured description from the
 * eventType + metadata. If the eventType isn't handled, it falls back to
 * the stored description — but still applies pronoun substitution (replacing
 * the carrier/shipper org name with "you" when the viewer matches).
 */
export function renderEventDescription(
  event: EventInput,
  viewer: ViewerContext
): string {
  const isCarrierViewer =
    viewer.organizationId != null &&
    viewer.carrierId != null &&
    viewer.organizationId === viewer.carrierId;

  const isShipperViewer =
    viewer.organizationId != null &&
    viewer.shipperId != null &&
    viewer.organizationId === viewer.shipperId;

  const carrierLabel = isCarrierViewer
    ? "You"
    : viewer.carrierName || "Carrier";
  const carrierLabelLower = isCarrierViewer
    ? "you"
    : viewer.carrierName || "the carrier";
  const shipperLabel = isShipperViewer
    ? "You"
    : viewer.shipperName || "Shipper";
  const shipperLabelLower = isShipperViewer
    ? "you"
    : viewer.shipperName || "the shipper";

  const meta = event.metadata ?? {};
  const plate = (meta.licensePlate as string) || "";

  // ── Structured rendering per eventType ──────────────────────────
  switch (event.eventType) {
    case "CREATED":
      return "Load created as draft";

    case "POSTED":
      return isShipperViewer
        ? "You posted this load to the marketplace"
        : `${shipperLabel} posted this load to the marketplace`;

    case "EDITED":
      return "Load details updated";

    case "UNPOSTED":
      return isShipperViewer
        ? "You removed this load from the marketplace"
        : "Load removed from marketplace";

    case "LOAD_REQUESTED":
      return isCarrierViewer
        ? `You requested this load${plate ? ` with truck ${plate}` : ""}`
        : `${carrierLabel} requested this load${plate ? ` with truck ${plate}` : ""}`;

    case "LOAD_REQUEST_ACCEPTED":
      return isShipperViewer
        ? `You accepted the load request from ${carrierLabelLower} — awaiting carrier confirmation`
        : isCarrierViewer
          ? `${shipperLabel} accepted your load request — awaiting your confirmation`
          : `${shipperLabel} accepted load request from ${carrierLabelLower}`;

    case "LOAD_REQUEST_REJECTED":
      return isShipperViewer
        ? `You rejected the load request from ${carrierLabelLower}`
        : isCarrierViewer
          ? `${shipperLabel} rejected your load request`
          : `Load request from ${carrierLabelLower} was rejected`;

    case "LOAD_REQUEST_CANCELLED":
      return isCarrierViewer
        ? "You declined to confirm the booking"
        : `${carrierLabel} declined to confirm the booking`;

    case "ASSIGNED":
      return isCarrierViewer
        ? "Load assigned to you — booking confirmed"
        : `Load assigned to ${carrierLabelLower} — booking confirmed`;

    case "UNASSIGNED":
      return "Truck unassigned from this load";

    case "TRUCK_REQUESTED":
      return isShipperViewer
        ? `You requested a truck for this load${plate ? ` (${plate})` : ""}`
        : `Truck${plate ? ` ${plate}` : ""} requested for this load`;

    case "REQUEST_CANCELLED":
      return "Truck request cancelled";

    case "REQUEST_REJECTED":
      return isCarrierViewer
        ? `You rejected the truck request${plate ? ` for ${plate}` : ""}`
        : `Truck request rejected${plate ? ` (${plate})` : ""}`;

    case "TRIP_CREATED":
      return isCarrierViewer
        ? "Trip created — ready to start"
        : "Trip created for this load";

    case "TRIP_STATUS_UPDATED": {
      const status = (meta.newStatus as string) || "";
      const statusMap: Record<string, string> = {
        PICKUP_PENDING: "Trip started — heading to pickup",
        IN_TRANSIT: "Pickup confirmed — in transit",
        DELIVERED: "Delivery completed",
        COMPLETED: "Trip completed",
        EXCEPTION: "Exception reported",
      };
      return (
        statusMap[status] || `Trip status changed to ${status || "unknown"}`
      );
    }

    case "TRIP_STATUS_SYNCED": {
      const newStatus = (meta.newTripStatus as string) || "";
      return `Trip synced to ${newStatus}`;
    }

    case "TRIP_CANCELLED": {
      const reason = (meta.reason as string) || "";
      return `Trip cancelled${reason ? `: ${reason}` : ""}`;
    }

    case "TRIP_REASSIGNED":
      return "Truck reassigned to this trip";

    case "STATUS_CHANGED":
      // Generic load-status change — fall through to substitution
      break;

    case "POD_SUBMITTED":
      return "Proof of Delivery uploaded by driver";

    case "POD_VERIFIED":
      return isShipperViewer
        ? "You verified the Proof of Delivery"
        : "Proof of Delivery verified by shipper";

    case "DELIVERY_CONFIRMED":
      return isShipperViewer
        ? "You confirmed the delivery"
        : `Delivery confirmed by ${shipperLabelLower}`;

    case "SETTLEMENT_COMPLETED":
      return "Settlement processed — fees applied";

    case "SETTLEMENT_APPROVED":
      return "Settlement manually approved by administrator";

    case "SERVICE_FEE_DEDUCTED":
      return "Service fee deducted";

    case "ESCALATION_CREATED":
      return `Escalation created: ${(meta.title as string) || "issue reported"}`;

    case "ESCALATION_UPDATED":
      return "Escalation updated";

    case "TRUCK_AVAILABILITY_RESET":
      return "Truck availability restored";

    case "DUPLICATED":
      return "Load duplicated from another load";

    case "CONTACT_VIEWED":
      return "Contact information viewed";

    case "BYPASS_REPORTED":
      return "Potential marketplace bypass flagged";
  }

  // ── Fallback: pronoun substitution on the raw description ──────
  if (!event.description) return event.eventType;

  let text = event.description;

  // Replace the carrier org name with "you" / "your" when viewer is carrier
  if (isCarrierViewer && viewer.carrierName) {
    const name = viewer.carrierName;
    // "Carrier Acme Co requested" → "You requested"
    text = text.replace(
      new RegExp(`Carrier ${escapeRegex(name)}`, "gi"),
      "You"
    );
    // "load request from Acme Co" → "load request from you"
    text = text.replace(
      new RegExp(`from ${escapeRegex(name)}`, "gi"),
      "from you"
    );
    // "assigned to Acme Co" → "assigned to you"
    text = text.replace(new RegExp(`to ${escapeRegex(name)}`, "gi"), "to you");
  }

  // Same for shipper
  if (isShipperViewer && viewer.shipperName) {
    const name = viewer.shipperName;
    text = text.replace(
      new RegExp(`Shipper ${escapeRegex(name)}`, "gi"),
      "You"
    );
    text = text.replace(new RegExp(`by ${escapeRegex(name)}`, "gi"), "by you");
  }

  return text;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
