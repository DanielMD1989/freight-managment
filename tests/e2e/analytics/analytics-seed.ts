/**
 * Analytics E2E Seed Helper — Sprint 3
 *
 * Exports `seedAnalyticsData(tokens)` → `SeedResult`
 *
 * Seeds deterministic data for exact numeric assertions:
 *   - 1 analytics corridor (distanceKm=100, shipperRate=10, carrierRate=8)
 *   - Per-org rate overrides (10/8 ETB/km)
 *   - Wallet topups (2000 ETB each)
 *   - 3 trucks (1 APPROVED, 1 PENDING, 1 REJECTED)
 *   - 4 trips (ASSIGNED, IN_TRANSIT, CANCELLED, COMPLETED)
 *   - Captures wallet snapshots before fee deduction for P1 arithmetic tests
 *
 * Cleanup: call `cleanupAnalyticsData(tokens, result)` in afterAll to
 * reset per-org rate overrides.
 */

import { apiCall, BASE_URL, ensureTrip } from "../../../e2e/shipper/test-utils";

// ── Constants ─────────────────────────────────────────────────────────────────

export const ANALYTICS_DISTANCE_KM = 100;
export const ANALYTICS_SHIPPER_RATE = 10.0; // ETB / km
export const ANALYTICS_CARRIER_RATE = 8.0; // ETB / km
export const ANALYTICS_EXPECTED_SHIPPER_FEE =
  ANALYTICS_DISTANCE_KM * ANALYTICS_SHIPPER_RATE; // 1000 ETB
export const ANALYTICS_EXPECTED_CARRIER_FEE =
  ANALYTICS_DISTANCE_KM * ANALYTICS_CARRIER_RATE; // 800 ETB
export const ANALYTICS_EXPECTED_TOTAL_FEE =
  ANALYTICS_EXPECTED_SHIPPER_FEE + ANALYTICS_EXPECTED_CARRIER_FEE; // 1800 ETB
export const FEE_TOLERANCE = 1; // ±1 ETB rounding tolerance

const CORRIDOR_NAME = "Analytics E2E Corridor";
const ORIGIN_REGION = "Addis Ababa";
const DEST_REGION = "Dire Dawa";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnalyticsTokens {
  adminToken: string;
  shipperToken: string;
  carrierToken: string;
  dispatcherToken: string;
}

export interface SeedResult {
  orgIds: { shipperOrgId: string; carrierOrgId: string };
  userIds: { shipperUserId: string; carrierUserId: string };
  corridorId: string | null;
  seededTrucks: {
    approvedId: string | null;
    pendingId: string | null;
    rejectedId: string | null;
  };
  seededTrips: {
    assignedId: string | null;
    inTransitId: string | null;
    cancelledId: string | null;
    completedId: string | null;
  };
  completedLoadId: string | null;
  fees: {
    expectedShipperFee: number;
    expectedCarrierFee: number;
    expectedRevenue: number;
  };
  wallets: {
    shipperBalanceBefore: number;
    carrierBalanceBefore: number;
  };
  baseline: {
    truckTotal: number;
    truckApproved: number;
    truckPending: number;
    tripTotal: number;
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchOrgAndUserId(
  token: string
): Promise<{ orgId: string | null; userId: string | null }> {
  const { data } = await apiCall("GET", "/api/auth/me", token);
  const orgId = data.user?.organizationId ?? data.organizationId ?? null;
  const userId = data.user?.id ?? data.id ?? null;
  return { orgId, userId };
}

async function getBaselineCounts(adminToken: string) {
  const { data: analyticsData } = await apiCall(
    "GET",
    "/api/admin/analytics?period=year",
    adminToken
  );
  const summary = analyticsData.summary ?? {};
  const trucks = (summary.trucks as Record<string, number>) ?? {};
  const trips = (summary.trips as Record<string, number>) ?? {};
  return {
    truckTotal: Number(trucks.total ?? 0),
    truckApproved: Number(trucks.approved ?? 0),
    truckPending: Number(trucks.pending ?? 0),
    tripTotal: Number(trips.total ?? 0),
  };
}

async function createOrFindCorridor(
  adminToken: string
): Promise<string | null> {
  const corridorPayload = {
    name: CORRIDOR_NAME,
    originRegion: ORIGIN_REGION,
    destinationRegion: DEST_REGION,
    distanceKm: ANALYTICS_DISTANCE_KM,
    shipperPricePerKm: ANALYTICS_SHIPPER_RATE,
    carrierPricePerKm: ANALYTICS_CARRIER_RATE,
    direction: "ONE_WAY",
    isActive: true,
  };

  const { status: postStatus, data: postData } = await apiCall(
    "POST",
    "/api/admin/corridors",
    adminToken,
    corridorPayload
  );

  if (postStatus === 201) {
    return (postData.corridor ?? postData).id ?? null;
  }

  if (postStatus === 409) {
    // Corridor exists — find by name
    const { data: listData } = await apiCall(
      "GET",
      `/api/admin/corridors?originRegion=${encodeURIComponent(ORIGIN_REGION)}&destinationRegion=${encodeURIComponent(DEST_REGION)}`,
      adminToken
    );
    const corridors: Array<{ id: string; name: string }> =
      listData.corridors ?? listData.data ?? [];
    const found = corridors.find((c) => c.name === CORRIDOR_NAME);
    return found?.id ?? corridors[0]?.id ?? null;
  }

  console.warn(`analytics-seed: corridor create returned ${postStatus}`);
  return null;
}

async function applyOrgRateOverrides(
  adminToken: string,
  shipperOrgId: string,
  carrierOrgId: string
) {
  await Promise.all([
    apiCall(
      "PATCH",
      `/api/admin/organizations/${shipperOrgId}/rates`,
      adminToken,
      { shipperRatePerKm: ANALYTICS_SHIPPER_RATE }
    ),
    apiCall(
      "PATCH",
      `/api/admin/organizations/${carrierOrgId}/rates`,
      adminToken,
      { carrierRatePerKm: ANALYTICS_CARRIER_RATE }
    ),
  ]);
}

async function topupWallets(
  adminToken: string,
  shipperUserId: string,
  carrierUserId: string
) {
  for (const userId of [shipperUserId, carrierUserId]) {
    await apiCall(
      "POST",
      `/api/admin/users/${userId}/wallet/topup`,
      adminToken,
      {
        amount: 2000,
        paymentMethod: "MANUAL",
        notes: "Analytics E2E topup",
      }
    );
  }
}

async function seedTrucks(
  adminToken: string,
  carrierToken: string
): Promise<{
  approvedId: string | null;
  pendingId: string | null;
  rejectedId: string | null;
}> {
  const ts = Date.now().toString(36).toUpperCase();

  const createTruck = async (plate: string) => {
    const { status, data } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: plate,
        capacity: 10000,
        volume: 40,
        currentCity: "Addis Ababa",
        currentRegion: "Addis Ababa",
        isAvailable: true,
      }
    );
    if (status !== 201) {
      console.warn(
        `analytics-seed: truck create failed (${status}) plate=${plate}`
      );
      return null;
    }
    return (data.truck ?? data).id as string;
  };

  const [approvedId, pendingId, rejectedId] = await Promise.all([
    createTruck(`ANA-APR-${ts}`),
    createTruck(`ANA-PND-${ts}`),
    createTruck(`ANA-REJ-${ts}`),
  ]);

  // Approve the first truck
  if (approvedId) {
    const { status } = await apiCall(
      "POST",
      `/api/trucks/${approvedId}/approve`,
      adminToken,
      { action: "APPROVE" }
    );
    if (status !== 200) {
      console.warn(`analytics-seed: truck approve failed (${status})`);
    }
  }

  // Reject the third truck
  if (rejectedId) {
    const { status } = await apiCall(
      "POST",
      `/api/trucks/${rejectedId}/approve`,
      adminToken,
      { action: "REJECT", reason: "Analytics E2E test rejection" }
    );
    if (status !== 200) {
      console.warn(`analytics-seed: truck reject failed (${status})`);
    }
  }

  // pendingId stays PENDING (no action taken)
  return { approvedId, pendingId, rejectedId };
}

// S4-3: Replaced duplicate ensureTripForAnalytics() with shared ensureTrip()
// from e2e/shipper/test-utils. This prevents silent divergence if ensureTrip()
// receives bug fixes, and reduces analytics-seed.ts by ~170 lines.
async function ensureTripForAnalytics(
  shipperToken: string,
  carrierToken: string,
  adminToken: string
): Promise<{ tripId: string; loadId: string } | null> {
  try {
    return await ensureTrip(shipperToken, carrierToken, adminToken);
  } catch (e) {
    console.warn(`analytics-seed: ensureTrip failed: ${e}`);
    return null;
  }
}

async function advanceTripToStatus(
  tripId: string,
  targetStatus: string,
  carrierToken: string
): Promise<boolean> {
  const path = ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
  const target = path.findIndex((s) => s === targetStatus);
  if (target < 0) return false;

  for (let i = 0; i <= target; i++) {
    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: path[i] }
    );
    if (status !== 200) {
      console.warn(
        `analytics-seed: advance trip to ${path[i]} failed (${status})`
      );
      return false;
    }
  }
  return true;
}

async function cancelTrip(
  tripId: string,
  adminToken: string
): Promise<boolean> {
  const { status } = await apiCall(
    "POST",
    `/api/trips/${tripId}/cancel`,
    adminToken,
    { reason: "Analytics E2E cancellation" }
  );
  return status === 200;
}

async function uploadPOD(
  loadId: string,
  carrierToken: string
): Promise<boolean> {
  const pdfBytes = Buffer.from(
    "%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
  );
  const boundary = `----AnalyticsE2E${Date.now()}`;
  const CRLF = "\r\n";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="analytics-pod.pdf"${CRLF}` +
        `Content-Type: application/pdf${CRLF}${CRLF}`
    ),
    pdfBytes,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);

  const res = await fetch(`${BASE_URL}/api/loads/${loadId}/pod`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${carrierToken}`,
      "x-client-type": "mobile",
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  return res.ok;
}

// ── Main seed function ────────────────────────────────────────────────────────

export async function seedAnalyticsData(
  tokens: AnalyticsTokens
): Promise<SeedResult> {
  const { adminToken, shipperToken, carrierToken } = tokens;

  // Step 1: Resolve org + user IDs
  const [shipperInfo, carrierInfo] = await Promise.all([
    fetchOrgAndUserId(shipperToken),
    fetchOrgAndUserId(carrierToken),
  ]);

  const shipperOrgId = shipperInfo.orgId ?? "";
  const carrierOrgId = carrierInfo.orgId ?? "";
  const shipperUserId = shipperInfo.userId ?? "";
  const carrierUserId = carrierInfo.userId ?? "";

  if (!shipperOrgId || !carrierOrgId) {
    console.warn("analytics-seed: could not resolve org IDs — skipping seed");
    return emptyResult(
      shipperOrgId,
      carrierOrgId,
      shipperUserId,
      carrierUserId
    );
  }

  // Step 2: Capture baseline counts
  const baseline = await getBaselineCounts(adminToken);

  // Step 3: Create/find analytics corridor
  const corridorId = await createOrFindCorridor(adminToken);

  // Step 4: Apply per-org rate overrides
  await applyOrgRateOverrides(adminToken, shipperOrgId, carrierOrgId);

  // Step 5: Top up wallets
  await topupWallets(adminToken, shipperUserId, carrierUserId);

  // Step 6: Seed trucks
  const seededTrucks = await seedTrucks(adminToken, carrierToken);

  // Step 7a: ASSIGNED trip
  const assignedResult = await ensureTripForAnalytics(
    shipperToken,
    carrierToken,
    adminToken
  );
  const assignedId = assignedResult?.tripId ?? null;

  // Step 7b: IN_TRANSIT trip
  const inTransitResult = await ensureTripForAnalytics(
    shipperToken,
    carrierToken,
    adminToken
  );
  let inTransitId: string | null = null;
  if (inTransitResult) {
    const ok = await advanceTripToStatus(
      inTransitResult.tripId,
      "IN_TRANSIT",
      carrierToken
    );
    inTransitId = ok ? inTransitResult.tripId : null;
  }

  // Step 7c: CANCELLED trip (cancel from ASSIGNED)
  const cancelResult = await ensureTripForAnalytics(
    shipperToken,
    carrierToken,
    adminToken
  );
  let cancelledId: string | null = null;
  if (cancelResult) {
    const ok = await cancelTrip(cancelResult.tripId, adminToken);
    cancelledId = ok ? cancelResult.tripId : null;
  }

  // Step 7d: COMPLETED trip — advance to DELIVERED, POD upload, capture wallet, shipper verify
  const completedResult = await ensureTripForAnalytics(
    shipperToken,
    carrierToken,
    adminToken
  );
  let completedId: string | null = null;
  let completedLoadId: string | null = null;
  let shipperBalanceBefore = -1;
  let carrierBalanceBefore = -1;

  if (completedResult) {
    const advancedToDelivered = await advanceTripToStatus(
      completedResult.tripId,
      "DELIVERED",
      carrierToken
    );

    if (advancedToDelivered) {
      // Upload POD (carrier)
      await uploadPOD(completedResult.loadId, carrierToken);

      // Capture balances BEFORE shipper verify (fee deduction happens on verify)
      const [shipperWallet, carrierWallet] = await Promise.all([
        apiCall("GET", "/api/wallet/balance", shipperToken),
        apiCall("GET", "/api/wallet/balance", carrierToken),
      ]);
      shipperBalanceBefore = Number(
        shipperWallet.data.totalBalance ??
          shipperWallet.data.balance ??
          shipperWallet.data.available ??
          -1
      );
      carrierBalanceBefore = Number(
        carrierWallet.data.totalBalance ??
          carrierWallet.data.balance ??
          carrierWallet.data.available ??
          -1
      );

      // Shipper verifies POD — triggers COMPLETED + fee deduction
      const { status: verifyStatus } = await apiCall(
        "PUT",
        `/api/loads/${completedResult.loadId}/pod`,
        shipperToken
      );

      if (verifyStatus === 200) {
        completedId = completedResult.tripId;
        completedLoadId = completedResult.loadId;
      } else {
        console.warn(`analytics-seed: POD verify returned ${verifyStatus}`);
      }
    }
  }

  return {
    orgIds: { shipperOrgId, carrierOrgId },
    userIds: { shipperUserId, carrierUserId },
    corridorId,
    seededTrucks,
    seededTrips: {
      assignedId,
      inTransitId,
      cancelledId,
      completedId,
    },
    completedLoadId,
    fees: {
      expectedShipperFee: ANALYTICS_EXPECTED_SHIPPER_FEE,
      expectedCarrierFee: ANALYTICS_EXPECTED_CARRIER_FEE,
      expectedRevenue: ANALYTICS_EXPECTED_TOTAL_FEE,
    },
    wallets: {
      shipperBalanceBefore,
      carrierBalanceBefore,
    },
    baseline,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function cleanupAnalyticsData(
  tokens: AnalyticsTokens,
  result: SeedResult
): Promise<void> {
  const { adminToken } = tokens;
  const { shipperOrgId, carrierOrgId } = result.orgIds;

  for (const [orgId, field] of [
    [shipperOrgId, "shipperRatePerKm"],
    [carrierOrgId, "carrierRatePerKm"],
  ] as [string, string][]) {
    if (!orgId) continue;
    await apiCall(
      "PATCH",
      `/api/admin/organizations/${orgId}/rates`,
      adminToken,
      { [field]: null }
    ).catch(() => {});
  }
}

// ── Empty result (for failure paths) ─────────────────────────────────────────

function emptyResult(
  shipperOrgId: string,
  carrierOrgId: string,
  shipperUserId: string,
  carrierUserId: string
): SeedResult {
  return {
    orgIds: { shipperOrgId, carrierOrgId },
    userIds: { shipperUserId, carrierUserId },
    corridorId: null,
    seededTrucks: { approvedId: null, pendingId: null, rejectedId: null },
    seededTrips: {
      assignedId: null,
      inTransitId: null,
      cancelledId: null,
      completedId: null,
    },
    completedLoadId: null,
    fees: {
      expectedShipperFee: ANALYTICS_EXPECTED_SHIPPER_FEE,
      expectedCarrierFee: ANALYTICS_EXPECTED_CARRIER_FEE,
      expectedRevenue: ANALYTICS_EXPECTED_TOTAL_FEE,
    },
    wallets: { shipperBalanceBefore: -1, carrierBalanceBefore: -1 },
    baseline: {
      truckTotal: 0,
      truckApproved: 0,
      truckPending: 0,
      tripTotal: 0,
    },
  };
}
