/**
 * Shared trip-cleanup helper used at the start of serial/workflow specs
 * so they don't get blocked by "Truck is currently on an active trip"
 * errors left over from earlier tests in the full suite.
 *
 * Uses admin to walk every non-terminal trip on a carrier to a TERMINAL
 * state (COMPLETED or CANCELLED). Admin can cancel ASSIGNED/PICKUP_PENDING
 * directly, push IN_TRANSIT through EXCEPTION → CANCELLED, confirm
 * DELIVERED, and cancel EXCEPTION.
 */

const BASE_URL = "http://localhost:3000";

async function api(
  method: string,
  path: string,
  token: string,
  body?: object
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-client-type": "mobile",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/**
 * Walk every non-terminal trip for the given carrier to a terminal state.
 * Safe to call at the start of any serial workflow spec. Swallows errors.
 */
export async function freeUpCarrierTrucks(
  carrierToken: string,
  adminToken: string
): Promise<void> {
  if (!carrierToken || !adminToken) return;

  const { data } = await api("GET", "/api/trips?limit=500", carrierToken);
  const trips = (data.trips as Array<{ id: string; status: string }>) ?? [];

  for (const trip of trips) {
    if (trip.status === "COMPLETED" || trip.status === "CANCELLED") continue;

    // Fastest path — cancel directly (works for ASSIGNED, PICKUP_PENDING, EXCEPTION)
    const { status: cancelStatus } = await api(
      "POST",
      `/api/trips/${trip.id}/cancel`,
      adminToken,
      { reason: "e2e suite cleanup" }
    );
    if (cancelStatus === 200) continue;

    // IN_TRANSIT can't be cancelled directly — push through EXCEPTION first.
    if (trip.status === "IN_TRANSIT") {
      await api("PATCH", `/api/trips/${trip.id}`, adminToken, {
        status: "EXCEPTION",
        exceptionReason: "cleanup",
      }).catch(() => {});
      await api("POST", `/api/trips/${trip.id}/cancel`, adminToken, {
        reason: "e2e suite cleanup",
      }).catch(() => {});
      continue;
    }

    // DELIVERED can't be cancelled — confirm to COMPLETED instead.
    if (trip.status === "DELIVERED") {
      await api("POST", `/api/trips/${trip.id}/confirm`, adminToken, {}).catch(
        () => {}
      );
      continue;
    }

    // Fallback: last-ditch PATCH to CANCELLED (state machine will reject
    // anything that doesn't allow it — safe no-op on failure).
    await api("PATCH", `/api/trips/${trip.id}`, adminToken, {
      status: "CANCELLED",
      cancelReason: "cleanup",
    }).catch(() => {});
  }
}
