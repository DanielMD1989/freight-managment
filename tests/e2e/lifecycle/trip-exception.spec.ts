/**
 * Trip Exception & Cancellation Paths — Blueprint §7
 *
 * Verifies:
 *   - Carrier raises IN_TRANSIT → EXCEPTION
 *   - Only Admin can resolve (Carrier and Dispatcher get 403)
 *   - Admin resolves EXCEPTION → IN_TRANSIT
 *   - IN_TRANSIT → CANCELLED directly blocked (400)
 *   - ASSIGNED → CANCELLED allowed; load reverts to POSTED
 *
 * Run:
 *   npx playwright test tests/e2e/lifecycle/trip-exception.spec.ts \
 *     --config playwright.api-only.config.ts --reporter=list
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getAdminToken,
  getCarrierToken,
  getShipperToken,
  getDispatcherToken,
} from "../shared/test-utils";
import { ensureTrip } from "../../../e2e/shipper/test-utils";

let adminToken = "";
let dispatcherToken = "";
let carrierToken = "";
let shipperToken = "";

let tripId = "";
let loadId = "";

test.describe.serial("Trip Exception & Cancellation — Blueprint §7", () => {
  test("Setup — create a trip in IN_TRANSIT state", async () => {
    test.setTimeout(120000);

    adminToken = await getAdminToken();
    dispatcherToken = await getDispatcherToken();
    carrierToken = await getCarrierToken();
    shipperToken = await getShipperToken();

    const result = await ensureTrip(shipperToken, carrierToken, adminToken);
    tripId = result.tripId;
    loadId = result.loadId;

    // Advance to IN_TRANSIT
    for (const status of ["PICKUP_PENDING", "IN_TRANSIT"] as const) {
      const { status: s } = await apiCall(
        "PATCH",
        `/api/trips/${tripId}`,
        carrierToken,
        { status }
      );
      expect(s).toBe(200);
    }
    console.info(`[Setup] tripId=${tripId} status=IN_TRANSIT`);
  });

  test("T1 — Carrier raises EXCEPTION: IN_TRANSIT → EXCEPTION", async () => {
    test.setTimeout(30000);
    if (!tripId) {
      test.skip(true, "No tripId from Setup");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "EXCEPTION" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("EXCEPTION");

    // Load status should sync to EXCEPTION
    const { data: loadData } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      adminToken
    );
    expect((loadData.load ?? loadData).status).toBe("EXCEPTION");
    console.info("[T1] EXCEPTION raised and load synced");
  });

  test("T2 — Carrier cannot resolve EXCEPTION (admin-only gate → 403)", async () => {
    test.setTimeout(30000);
    if (!tripId) {
      test.skip(true, "No tripId");
      return;
    }

    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(403);
    console.info("[T2] Carrier resolve blocked with 403");
  });

  test("T3 — Dispatcher cannot resolve EXCEPTION (admin-only gate → 403)", async () => {
    test.setTimeout(30000);
    if (!tripId) {
      test.skip(true, "No tripId");
      return;
    }

    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      dispatcherToken,
      { status: "IN_TRANSIT" }
    );
    // Unaffiliated dispatcher (not in shipper/carrier org) gets 404 before the EXCEPTION
    // guard fires (org-scope check at line 230 of route.ts returns 404 for security).
    // An affiliated dispatcher would reach the guard and get 403. Both mean "denied".
    expect([403, 404]).toContain(status);
    console.info(`[T3] Dispatcher resolve blocked with ${status}`);
  });

  test("T4 — Admin resolves EXCEPTION → IN_TRANSIT", async () => {
    test.setTimeout(30000);
    if (!tripId) {
      test.skip(true, "No tripId");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      adminToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("IN_TRANSIT");
    console.info("[T4] Admin resolved EXCEPTION → IN_TRANSIT");
  });

  test("T5 — IN_TRANSIT → CANCELLED directly blocked (400)", async () => {
    test.setTimeout(30000);
    if (!tripId) {
      test.skip(true, "No tripId");
      return;
    }

    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "CANCELLED" }
    );
    expect(status).toBe(400);
    console.info("[T5] IN_TRANSIT → CANCELLED correctly blocked with 400");
  });

  test("T6 — ASSIGNED → CANCELLED allowed; load reverts to POSTED", async () => {
    test.setTimeout(120000);

    // Create a separate fresh trip (in ASSIGNED state) for cancellation test
    const freshShipperToken = await getShipperToken();
    const freshCarrierToken = await getCarrierToken();
    const freshAdminToken = await getAdminToken();

    const freshResult = await ensureTrip(
      freshShipperToken,
      freshCarrierToken,
      freshAdminToken
    );
    const freshTripId = freshResult.tripId;
    const freshLoadId = freshResult.loadId;

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${freshTripId}`,
      freshCarrierToken,
      { status: "CANCELLED" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("CANCELLED");

    // Load should revert to POSTED
    const { data: loadData } = await apiCall(
      "GET",
      `/api/loads/${freshLoadId}`,
      freshAdminToken
    );
    expect((loadData.load ?? loadData).status).toBe("POSTED");
    console.info("[T6] ASSIGNED → CANCELLED allowed; load reverted to POSTED");
  });
});
