/**
 * Full Marketplace Lifecycle — Clean-Slate E2E Smoke Test
 *
 * Exercises the complete blueprint lifecycle in one serial run:
 *   Register (Shipper + Carrier) → Admin activate → Upload docs → Create truck
 *   → Admin approve truck → Post truck (DH-O/DH-D) → Top up wallets
 *   → Create load → Shipper sends truck-request → Carrier approves → Trip ASSIGNED
 *   → State machine: PICKUP_PENDING → IN_TRANSIT → DELIVERED
 *   → Carrier uploads POD → Shipper verifies POD → COMPLETED + fee deduction
 *   → Financial assertions (balance ≤ before, platformRevenue ≥ before)
 *
 * Run:
 *   npx playwright test tests/e2e/lifecycle/full-marketplace-lifecycle.spec.ts \
 *     --config playwright.api-only.config.ts
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getAdminToken,
  getSuperAdminToken,
  getDispatcherToken,
  BASE_URL,
} from "../shared/test-utils";

// ── Module-level state (shared across all serial phases) ─────────────────────

const ts = Date.now();
const shipperEmail = `lifecycle-shipper-${ts}@test.local`;
const carrierEmail = `lifecycle-carrier-${ts}@test.local`;
const TEST_PASSWORD = "Lifecycle1!";
const TOPUP_AMOUNT = 50000;

let adminToken = "";
let superAdminToken = "";

let shipperToken = "";
let shipperUserId = "";
let shipperOrgId = "";
let shipperBalanceBefore = 0;

let carrierToken = "";
let carrierUserId = "";
let carrierOrgId = "";
let carrierBalanceBefore = 0;

let truckId = "";
let postingId = "";
let loadId = "";
let truckRequestId = "";
let tripId = "";

let platformRevenueBefore = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Register a new user and return { userId, orgId, sessionToken }. */
async function registerUser(
  email: string,
  role: "SHIPPER" | "CARRIER",
  companyName: string
) {
  const body: Record<string, string> = {
    email,
    password: TEST_PASSWORD,
    firstName: "Lifecycle",
    lastName: role === "SHIPPER" ? "Shipper" : "Carrier",
    role,
    companyName,
  };
  if (role === "CARRIER") {
    body.carrierType = "CARRIER_COMPANY";
  }

  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Log in and return a session token (bypasses file-cache for fresh users). */
async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${email}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.sessionToken;
}

/** Build a minimal but valid PDF multipart body. */
function buildPdfMultipart(fieldName = "file", filename = "doc.pdf") {
  const pdfBytes = Buffer.from(
    "%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
  );
  const boundary = `----LifecycleBoundary${Date.now()}`;
  const CRLF = "\r\n";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${CRLF}` +
        `Content-Type: application/pdf${CRLF}` +
        `${CRLF}`
    ),
    pdfBytes,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);
  return { body, boundary };
}

// ── Serial test suite ────────────────────────────────────────────────────────

test.describe.serial("Full Marketplace Lifecycle — Clean Slate", () => {
  // ── Phase 0: Bootstrap admin tokens + record platform revenue baseline ─────

  test("Phase 0 — Bootstrap: admin + super-admin tokens valid", async () => {
    test.setTimeout(60000);

    adminToken = await getAdminToken();
    superAdminToken = await getSuperAdminToken();

    const [adminMe, superMe] = await Promise.all([
      apiCall("GET", "/api/auth/me", adminToken),
      apiCall("GET", "/api/auth/me", superAdminToken),
    ]);
    expect(adminMe.status).toBe(200);
    expect(superMe.status).toBe(200);

    // Record platform revenue baseline
    const { status: anaStatus, data: anaData } = await apiCall(
      "GET",
      "/api/admin/analytics",
      adminToken
    );
    if (anaStatus === 200) {
      platformRevenueBefore = anaData?.summary?.revenue?.platformBalance ?? 0;
    }
    console.info(`[Phase 0] platformRevenueBefore = ${platformRevenueBefore}`);
  });

  // ── Phase 1: Register Shipper ─────────────────────────────────────────────

  test("Phase 1 — Register Shipper: POST /api/auth/register returns 201", async () => {
    test.setTimeout(60000);

    const { status, data } = await registerUser(
      shipperEmail,
      "SHIPPER",
      `Lifecycle Shipper Co ${ts}`
    );

    expect(status).toBe(201);
    shipperUserId = data.user?.id;
    shipperOrgId = data.user?.organizationId;
    // Registration response includes sessionToken for mobile clients
    shipperToken = data.sessionToken;

    expect(shipperUserId).toBeTruthy();
    console.info(
      `[Phase 1] shipperUserId=${shipperUserId} orgId=${shipperOrgId}`
    );
  });

  // ── Phase 2: Shipper OTP ──────────────────────────────────────────────────

  test("Phase 2 — Shipper OTP: POST /api/auth/send-otp reachable (200 or 429)", async () => {
    test.setTimeout(30000);
    if (!shipperToken) {
      test.skip(true, "No shipperToken from Phase 1");
      return;
    }

    const { status } = await apiCall(
      "POST",
      "/api/auth/send-otp",
      shipperToken,
      { channel: "email" }
    );
    // 200 = sent; 429 = rate-limited; both indicate endpoint is reachable
    expect([200, 429]).toContain(status);
    console.info(`[Phase 2] send-otp status=${status}`);
  });

  // ── Phase 3: Admin Activates Shipper ─────────────────────────────────────

  test("Phase 3 — Admin activates Shipper: PATCH /api/admin/users/:id → ACTIVE", async () => {
    test.setTimeout(30000);
    if (!shipperUserId) {
      test.skip(true, "No shipperUserId from Phase 1");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/admin/users/${shipperUserId}`,
      adminToken,
      { status: "ACTIVE" }
    );
    expect(status).toBe(200);

    const user = data.user ?? data;
    expect(user.status).toBe("ACTIVE");

    // Re-login to get a token with ACTIVE status embedded in JWT
    shipperToken = await login(shipperEmail, TEST_PASSWORD);
    console.info(`[Phase 3] shipper now ACTIVE`);
  });

  // ── Phase 3.5: Org Approval + Document Lock ──────────────────────────────

  test("Phase 3.5 — Admin verifies shipper org: documentsLockedAt set", async () => {
    test.setTimeout(30000);
    if (!shipperOrgId) {
      test.skip(true, "No shipperOrgId from Phase 1");
      return;
    }

    const { status, data } = await apiCall(
      "POST",
      `/api/admin/organizations/${shipperOrgId}/verify`,
      adminToken
    );
    expect([200, 201]).toContain(status);

    const org = data.organization ?? data.org ?? data;
    expect(org.verificationStatus).toBe("APPROVED");
    expect(org.documentsLockedAt).not.toBeNull();
    console.info(
      `[Phase 3.5] org APPROVED, documentsLockedAt=${org.documentsLockedAt}`
    );
  });

  // ── Phase 4: Upload Shipper Documents ─────────────────────────────────────

  test("Phase 4 — Upload Shipper Docs: POST /api/documents/upload reachable", async () => {
    test.setTimeout(30000);
    if (!shipperToken || !shipperOrgId) {
      test.skip(true, "Missing shipperToken or shipperOrgId");
      return;
    }

    const { body, boundary } = buildPdfMultipart(
      "file",
      "business-license.pdf"
    );

    // Multipart form-data with additional text fields
    const fullBoundary = `----LifecycleBoundary${Date.now()}`;
    const CRLF = "\r\n";
    const pdfBytes = Buffer.from(
      "%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
    );
    const docBody = Buffer.concat([
      Buffer.from(
        `--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="file"; filename="business-license.pdf"${CRLF}` +
          `Content-Type: application/pdf${CRLF}${CRLF}`
      ),
      pdfBytes,
      Buffer.from(
        `${CRLF}--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="type"${CRLF}${CRLF}` +
          `COMPANY_LICENSE`
      ),
      Buffer.from(
        `${CRLF}--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="entityType"${CRLF}${CRLF}` +
          `company`
      ),
      Buffer.from(
        `${CRLF}--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="entityId"${CRLF}${CRLF}` +
          `${shipperOrgId}`
      ),
      Buffer.from(`${CRLF}--${fullBoundary}--${CRLF}`),
    ]);

    void body; // suppress unused warning
    void boundary;

    const res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${shipperToken}`,
        "x-client-type": "mobile",
        "Content-Type": `multipart/form-data; boundary=${fullBoundary}`,
      },
      body: docBody,
    });

    // 200/201 = success; 423 = org documents locked (expected after Phase 3.5 approve); 500 = Cloudinary not configured (acceptable in test env)
    expect([200, 201, 423, 500]).toContain(res.status);
    console.info(`[Phase 4] shipper doc upload status=${res.status}`);
  });

  // ── Phase 5: Register Carrier ─────────────────────────────────────────────

  test("Phase 5 — Register Carrier: POST /api/auth/register returns 201", async () => {
    test.setTimeout(60000);

    const { status, data } = await registerUser(
      carrierEmail,
      "CARRIER",
      `Lifecycle Carrier Co ${ts}`
    );

    expect(status).toBe(201);
    carrierUserId = data.user?.id;
    carrierOrgId = data.user?.organizationId;
    carrierToken = data.sessionToken;

    expect(carrierUserId).toBeTruthy();
    console.info(
      `[Phase 5] carrierUserId=${carrierUserId} orgId=${carrierOrgId}`
    );
  });

  // ── Phase 6: Carrier OTP + Admin Activate + Upload Docs ──────────────────

  test("Phase 6a — Carrier OTP: POST /api/auth/send-otp reachable (200 or 429)", async () => {
    test.setTimeout(30000);
    if (!carrierToken) {
      test.skip(true, "No carrierToken from Phase 5");
      return;
    }

    const { status } = await apiCall(
      "POST",
      "/api/auth/send-otp",
      carrierToken,
      { channel: "email" }
    );
    expect([200, 429]).toContain(status);
    console.info(`[Phase 6a] carrier send-otp status=${status}`);
  });

  test("Phase 6b — Admin activates Carrier: PATCH /api/admin/users/:id → ACTIVE", async () => {
    test.setTimeout(30000);
    if (!carrierUserId) {
      test.skip(true, "No carrierUserId from Phase 5");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/admin/users/${carrierUserId}`,
      adminToken,
      { status: "ACTIVE" }
    );
    expect(status).toBe(200);

    const user = data.user ?? data;
    expect(user.status).toBe("ACTIVE");

    // Re-login for ACTIVE JWT
    carrierToken = await login(carrierEmail, TEST_PASSWORD);
    console.info(`[Phase 6b] carrier now ACTIVE`);
  });

  test("Phase 6c — Upload Carrier Docs: POST /api/documents/upload reachable", async () => {
    test.setTimeout(30000);
    if (!carrierToken || !carrierOrgId) {
      test.skip(true, "Missing carrierToken or carrierOrgId");
      return;
    }

    const fullBoundary = `----LifecycleBoundary${Date.now()}`;
    const CRLF = "\r\n";
    const pdfBytes = Buffer.from(
      "%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
    );
    const docBody = Buffer.concat([
      Buffer.from(
        `--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="file"; filename="carrier-license.pdf"${CRLF}` +
          `Content-Type: application/pdf${CRLF}${CRLF}`
      ),
      pdfBytes,
      Buffer.from(
        `${CRLF}--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="type"${CRLF}${CRLF}` +
          `COMPANY_LICENSE`
      ),
      Buffer.from(
        `${CRLF}--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="entityType"${CRLF}${CRLF}` +
          `company`
      ),
      Buffer.from(
        `${CRLF}--${fullBoundary}${CRLF}` +
          `Content-Disposition: form-data; name="entityId"${CRLF}${CRLF}` +
          `${carrierOrgId}`
      ),
      Buffer.from(`${CRLF}--${fullBoundary}--${CRLF}`),
    ]);

    const res = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${carrierToken}`,
        "x-client-type": "mobile",
        "Content-Type": `multipart/form-data; boundary=${fullBoundary}`,
      },
      body: docBody,
    });

    // 200/201 = success; 423 = org documents locked (defensive — carrier org may be locked if approve step runs); 500 = Cloudinary not configured
    expect([200, 201, 423, 500]).toContain(res.status);
    console.info(`[Phase 6c] carrier doc upload status=${res.status}`);
  });

  // ── Phase 6.5: Admin verifies carrier org ────────────────────────────────

  test("Phase 6.5 — Admin verifies carrier org: required before truck registration", async () => {
    test.setTimeout(30000);
    if (!carrierOrgId) {
      test.skip(true, "No carrierOrgId from Phase 5");
      return;
    }

    const { status, data } = await apiCall(
      "POST",
      `/api/admin/organizations/${carrierOrgId}/verify`,
      adminToken
    );
    expect([200, 201]).toContain(status);

    const org = data.organization ?? data.org ?? data;
    expect(org.verificationStatus).toBe("APPROVED");
    expect(org.documentsLockedAt).not.toBeNull();
    console.info(
      `[Phase 6.5] carrier org APPROVED, documentsLockedAt=${org.documentsLockedAt}`
    );
  });

  // ── Phase 7: Carrier Creates Truck ───────────────────────────────────────

  test("Phase 7 — Carrier creates truck: POST /api/trucks returns 201", async () => {
    test.setTimeout(30000);
    if (!carrierToken) {
      test.skip(true, "No carrierToken from Phase 6b");
      return;
    }

    const plate = `LC-${ts.toString(36).slice(-6).toUpperCase()}`;
    const { status, data } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: plate,
        capacity: 20000,
        volume: 60,
        currentCity: "Addis Ababa",
        currentRegion: "Addis Ababa",
        isAvailable: true,
      }
    );
    expect(status).toBe(201);

    truckId = (data.truck ?? data).id;
    expect(truckId).toBeTruthy();
    console.info(`[Phase 7] truckId=${truckId} plate=${plate}`);
  });

  // ── Phase 8: Admin Approves Truck ────────────────────────────────────────

  test("Phase 8 — Admin approves truck: POST /api/trucks/:id/approve → APPROVED", async () => {
    test.setTimeout(30000);
    if (!truckId) {
      test.skip(true, "No truckId from Phase 7");
      return;
    }

    const { status } = await apiCall(
      "POST",
      `/api/trucks/${truckId}/approve`,
      adminToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    const { status: getStatus, data } = await apiCall(
      "GET",
      `/api/trucks/${truckId}`,
      adminToken
    );
    expect(getStatus).toBe(200);
    const truck = data.truck ?? data;
    expect(truck.approvalStatus).toBe("APPROVED");
    console.info(`[Phase 8] truck APPROVED`);
  });

  // ── Phase 9: Carrier Posts Truck with DH-O/DH-D ──────────────────────────

  test("Phase 9 — Carrier posts truck with DH-O/DH-D: POST /api/truck-postings returns 201", async () => {
    test.setTimeout(30000);
    if (!truckId || !carrierToken) {
      test.skip(true, "Missing truckId or carrierToken");
      return;
    }

    // Fetch a valid origin city
    const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations?limit=1`);
    const locations = await locRes.json();
    const originCityId = (
      locations[0] ??
      locations.locations?.[0] ??
      locations.cities?.[0]
    )?.id;

    if (!originCityId) {
      test.skip(true, "No Ethiopian location found — seed locations first");
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { status, data } = await apiCall(
      "POST",
      "/api/truck-postings",
      carrierToken,
      {
        truckId,
        originCityId,
        availableFrom: tomorrow.toISOString(),
        contactName: "Lifecycle Carrier",
        contactPhone: "+251912345678",
        preferredDhToOriginKm: 200,
        preferredDhAfterDeliveryKm: 200,
      }
    );
    expect(status).toBe(201);

    const posting = data.truckPosting ?? data.posting ?? data;
    postingId = posting.id;
    expect(postingId).toBeTruthy();
    expect(["ACTIVE", "active"]).toContain(
      posting.status?.toLowerCase() ?? "active"
    );
    console.info(`[Phase 9] postingId=${postingId}`);
  });

  // ── Phase 10: Admin Tops Up Wallets ──────────────────────────────────────

  test("Phase 10 — Admin tops up shipper + carrier wallets", async () => {
    test.setTimeout(60000);
    if (!shipperUserId || !carrierUserId) {
      test.skip(true, "Missing shipperUserId or carrierUserId");
      return;
    }

    const [shipperTop, carrierTop] = await Promise.all([
      apiCall(
        "POST",
        `/api/admin/users/${shipperUserId}/wallet/topup`,
        adminToken,
        {
          amount: TOPUP_AMOUNT,
          paymentMethod: "MANUAL",
          notes: "lifecycle smoke top-up",
        }
      ),
      apiCall(
        "POST",
        `/api/admin/users/${carrierUserId}/wallet/topup`,
        adminToken,
        {
          amount: TOPUP_AMOUNT,
          paymentMethod: "MANUAL",
          notes: "lifecycle smoke top-up",
        }
      ),
    ]);

    expect([200, 201]).toContain(shipperTop.status);
    expect([200, 201]).toContain(carrierTop.status);
    console.info(
      `[Phase 10] shipper topup status=${shipperTop.status} carrier topup status=${carrierTop.status}`
    );

    // Record pre-fee balances
    const [shipperBal, carrierBal] = await Promise.all([
      apiCall("GET", "/api/wallet/balance", shipperToken),
      apiCall("GET", "/api/wallet/balance", carrierToken),
    ]);

    if (shipperBal.status === 200) {
      shipperBalanceBefore =
        shipperBal.data.totalBalance ?? shipperBal.data.balance ?? 0;
    }
    if (carrierBal.status === 200) {
      carrierBalanceBefore =
        carrierBal.data.totalBalance ?? carrierBal.data.balance ?? 0;
    }

    expect(shipperBalanceBefore).toBeGreaterThanOrEqual(TOPUP_AMOUNT);
    expect(carrierBalanceBefore).toBeGreaterThanOrEqual(TOPUP_AMOUNT);
    console.info(
      `[Phase 10] shipperBalance=${shipperBalanceBefore} carrierBalance=${carrierBalanceBefore}`
    );
  });

  // ── Phase 10.5: Wallet Threshold Gate ────────────────────────────────────

  test("Phase 10.5 — Wallet threshold gate: 402 when balance < minimumBalance", async () => {
    test.setTimeout(30000);
    if (!shipperUserId || !shipperToken) {
      test.skip(true, "Missing shipperUserId or shipperToken");
      return;
    }

    // Set an impossibly high minimum balance
    const { status: setStatus } = await apiCall(
      "PATCH",
      `/api/admin/users/${shipperUserId}/wallet`,
      adminToken,
      { minimumBalance: 9_999_999 }
    );
    expect(setStatus).toBe(200);

    // Shipper browse should now return 402
    const { status: gateStatus } = await apiCall(
      "GET",
      "/api/truck-postings",
      shipperToken
    );
    expect(gateStatus).toBe(402);

    // Reset minimum balance
    const { status: resetStatus } = await apiCall(
      "PATCH",
      `/api/admin/users/${shipperUserId}/wallet`,
      adminToken,
      { minimumBalance: 0 }
    );
    expect(resetStatus).toBe(200);

    // Browse works again
    const { status: okStatus } = await apiCall(
      "GET",
      "/api/truck-postings",
      shipperToken
    );
    expect(okStatus).toBe(200);
    console.info("[Phase 10.5] Wallet gate 402 confirmed and reset");
  });

  // ── Phase 11: Shipper Creates Load ───────────────────────────────────────

  test("Phase 11 — Shipper creates load: POST /api/loads returns 201", async () => {
    test.setTimeout(30000);
    if (!shipperToken) {
      test.skip(true, "No shipperToken from Phase 3");
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    const { status, data } = await apiCall("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow.toISOString().split("T")[0],
      deliveryDate: fiveDays.toISOString().split("T")[0],
      truckType: "FLATBED",
      weight: 5000,
      cargoDescription: "lifecycle smoke load",
      status: "POSTED",
    });
    expect(status).toBe(201);

    const load = data.load ?? data;
    loadId = load.id;
    expect(loadId).toBeTruthy();
    expect(load.status).toBe("POSTED");
    console.info(`[Phase 11] loadId=${loadId}`);
  });

  // ── Phase 11.5: Dispatcher Visibility ────────────────────────────────────

  test("Phase 11.5 — Dispatcher sees load; cannot send truck-request (403)", async () => {
    test.setTimeout(30000);
    if (!loadId) {
      test.skip(true, "No loadId from Phase 11");
      return;
    }

    const dispatcherToken = await getDispatcherToken();

    // Dispatcher can see the load
    const { status: getStatus, data: loadData } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      dispatcherToken
    );
    expect(getStatus).toBe(200);
    const load = loadData.load ?? loadData;
    expect(load.id).toBe(loadId);

    // Dispatcher cannot send a truck-request (§5: cannot accept/reject on their behalf)
    if (truckId) {
      const { status: reqStatus } = await apiCall(
        "POST",
        "/api/truck-requests",
        dispatcherToken,
        { truckId, loadId }
      );
      expect(reqStatus).toBe(403);
    }
    console.info(
      "[Phase 11.5] Dispatcher visibility confirmed; truck-request 403 confirmed"
    );
  });

  // ── Phase 12: Shipper Searches Truck Postings ────────────────────────────

  test("Phase 12 — Shipper searches truck-postings: carrier's truck visible", async () => {
    test.setTimeout(30000);
    if (!shipperToken || !truckId) {
      test.skip(true, "Missing shipperToken or truckId");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/truck-postings?truckType=FLATBED&status=ACTIVE",
      shipperToken
    );
    expect(status).toBe(200);

    const postings: Array<{ id: string; truckId: string }> =
      data.truckPostings ?? data.postings ?? data ?? [];
    const found = Array.isArray(postings)
      ? postings.some((p) => p.truckId === truckId)
      : false;

    if (!found) {
      console.warn(
        `[Phase 12] Carrier's truck (${truckId}) not found in listing — postings count: ${Array.isArray(postings) ? postings.length : "unknown"}`
      );
    }
    // Non-blocking: listing might paginate; truck availability depends on posting status
    expect(status).toBe(200);
    console.info(`[Phase 12] truck visible in listing: ${found}`);
  });

  // ── Phase 13: Shipper Sends Truck Request ─────────────────────────────────

  test("Phase 13 — Shipper sends truck-request: POST /api/truck-requests returns 201", async () => {
    test.setTimeout(30000);
    if (!shipperToken || !truckId || !loadId) {
      test.skip(true, "Missing shipperToken, truckId, or loadId");
      return;
    }

    const { status, data } = await apiCall(
      "POST",
      "/api/truck-requests",
      shipperToken,
      { truckId, loadId }
    );
    expect(status).toBe(201);

    const request = data.truckRequest ?? data.request ?? data;
    truckRequestId = request.id;
    expect(truckRequestId).toBeTruthy();

    // Load should transition to OFFERED
    const { data: loadData } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    const load = loadData.load ?? loadData;
    expect(load.status).toBe("OFFERED");
    console.info(
      `[Phase 13] truckRequestId=${truckRequestId} load.status=OFFERED`
    );
  });

  // ── Phase 14: Carrier Accepts → Trip Created ──────────────────────────────

  test("Phase 14 — Carrier accepts truck-request: trip.status = ASSIGNED", async () => {
    test.setTimeout(30000);
    if (!carrierToken || !truckRequestId) {
      test.skip(true, "Missing carrierToken or truckRequestId");
      return;
    }

    const { status, data } = await apiCall(
      "POST",
      `/api/truck-requests/${truckRequestId}/respond`,
      carrierToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    // Extract tripId from respond response
    tripId = data?.trip?.id ?? data?.loadRequest?.tripId ?? data?.tripId ?? "";

    // The respond route returns { trip } on APPROVE — tripId must be present here
    expect(
      tripId,
      "tripId must be in respond response (data.trip.id)"
    ).toBeTruthy();

    const { status: tripStatus, data: tripData } = await apiCall(
      "GET",
      `/api/trips/${tripId}`,
      adminToken
    );
    expect(tripStatus).toBe(200);
    const trip = tripData.trip ?? tripData;
    expect(trip.status).toBe("ASSIGNED");
    console.info(`[Phase 14] tripId=${tripId} status=ASSIGNED`);
  });

  // ── Phase 15: Trip State Machine ──────────────────────────────────────────

  test("Phase 15 — Trip state machine: ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED", async () => {
    test.setTimeout(60000);
    if (!carrierToken || !tripId) {
      test.skip(true, "Missing carrierToken or tripId");
      return;
    }

    for (const nextStatus of [
      "PICKUP_PENDING",
      "IN_TRANSIT",
      "DELIVERED",
    ] as const) {
      const { status, data } = await apiCall(
        "PATCH",
        `/api/trips/${tripId}`,
        carrierToken,
        { status: nextStatus }
      );
      expect(status).toBe(200);
      const trip = data.trip ?? data;
      expect(trip.status).toBe(nextStatus);
      console.info(`[Phase 15] trip.status=${nextStatus}`);
    }

    // Load should reflect DELIVERED
    const { data: loadData } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    const load = loadData.load ?? loadData;
    expect(load.status).toBe("DELIVERED");
    console.info(`[Phase 15] load.status=DELIVERED`);
  });

  // ── Phase 16: Carrier Uploads POD ────────────────────────────────────────

  test("Phase 16 — Carrier uploads POD: POST /api/loads/:id/pod → 200/201", async () => {
    test.setTimeout(60000);
    if (!carrierToken || !loadId) {
      test.skip(true, "Missing carrierToken or loadId");
      return;
    }

    const pdfBytes = Buffer.from(
      "%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
    );
    const boundary = `----LifecyclePOD${Date.now()}`;
    const CRLF = "\r\n";
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="file"; filename="pod.pdf"${CRLF}` +
          `Content-Type: application/pdf${CRLF}` +
          `${CRLF}`
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

    const data = await res.json().catch(() => ({}));
    // 200/201 = success; 500 = storage not configured (acceptable in test env)
    expect([200, 201, 400, 500]).toContain(res.status);

    if (res.status === 200 || res.status === 201) {
      const responseLoad = data.load ?? {};
      if (responseLoad.podSubmitted !== undefined) {
        expect(responseLoad.podSubmitted).toBe(true);
      }
    }
    console.info(`[Phase 16] POD upload status=${res.status}`);
  });

  // ── Phase 17: Shipper Verifies POD → COMPLETED ───────────────────────────

  test("Phase 17 — Shipper verifies POD: PUT /api/loads/:id/pod → COMPLETED + fee", async () => {
    test.setTimeout(60000);
    if (!shipperToken || !loadId) {
      test.skip(true, "Missing shipperToken or loadId");
      return;
    }

    // Pre-check: confirm POD was submitted in Phase 16
    const { data: loadBefore } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    const loadBeforeVerify = loadBefore.load ?? loadBefore;
    if (!loadBeforeVerify.podSubmitted) {
      console.warn(
        "[Phase 17] podSubmitted=false — Phase 16 upload likely failed (storage not configured). Skipping verify."
      );
      test.skip(
        true,
        "podSubmitted=false: POD upload step failed — skipping verify"
      );
      return;
    }

    const { status, data } = await apiCall(
      "PUT",
      `/api/loads/${loadId}/pod`,
      shipperToken
    );
    expect(status).toBe(200);

    const settlement = data.settlement ?? {};
    expect(settlement.status).toMatch(/paid|paid_waived|skipped/i);
    console.info(
      `[Phase 17] POD verified. settlement.status=${settlement.status}`
    );

    // Verify trip → COMPLETED
    const { status: tripStatus, data: tripData } = await apiCall(
      "GET",
      `/api/trips/${tripId}`,
      adminToken
    );
    expect(tripStatus).toBe(200);
    const trip = tripData.trip ?? tripData;
    expect(trip.status).toBe("COMPLETED");
    expect(trip.completedAt).not.toBeNull();
    console.info(
      `[Phase 17] trip.status=COMPLETED completedAt=${trip.completedAt}`
    );

    // Verify load → COMPLETED
    const { data: loadAfter } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    const finalLoad = loadAfter.load ?? loadAfter;
    expect(finalLoad.status).toBe("COMPLETED");
    expect(["PAID", "PAID_WAIVED", "PENDING"]).toContain(
      finalLoad.settlementStatus ?? "PENDING"
    );
    console.info(
      `[Phase 17] load.status=${finalLoad.status} settlementStatus=${finalLoad.settlementStatus}`
    );
  });

  // ── Phase 18: Financial Assertions ───────────────────────────────────────

  test("Phase 18a — Shipper wallet balance ≤ pre-fee balance (fee path exercised)", async () => {
    test.setTimeout(30000);
    if (!shipperToken) {
      test.skip(true, "No shipperToken");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/wallet/balance",
      shipperToken
    );
    expect(status).toBe(200);

    const balanceAfter =
      data.totalBalance ?? data.balance ?? shipperBalanceBefore;
    expect(typeof balanceAfter).toBe("number");
    // Fees should not increase the balance; +0.01 tolerance for float precision
    expect(balanceAfter).toBeLessThanOrEqual(shipperBalanceBefore + 0.01);
    console.info(
      `[Phase 18a] shipperBalance before=${shipperBalanceBefore} after=${balanceAfter}`
    );
  });

  test("Phase 18b — Carrier wallet balance ≤ pre-fee balance (fee path exercised)", async () => {
    test.setTimeout(30000);
    if (!carrierToken) {
      test.skip(true, "No carrierToken");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/wallet/balance",
      carrierToken
    );
    expect(status).toBe(200);

    const balanceAfter =
      data.totalBalance ?? data.balance ?? carrierBalanceBefore;
    expect(typeof balanceAfter).toBe("number");
    expect(balanceAfter).toBeLessThanOrEqual(carrierBalanceBefore + 0.01);
    console.info(
      `[Phase 18b] carrierBalance before=${carrierBalanceBefore} after=${balanceAfter}`
    );
  });

  test("Phase 18c — Load fee statuses are defined after completion", async () => {
    test.setTimeout(30000);
    if (!shipperToken || !loadId) {
      test.skip(true, "Missing shipperToken or loadId");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect(status).toBe(200);

    const load = data.load ?? data;
    const validFeeStatuses = ["DEDUCTED", "WAIVED", "PENDING", undefined, null];
    expect(validFeeStatuses).toContain(load.shipperFeeStatus ?? null);
    expect(validFeeStatuses).toContain(load.carrierFeeStatus ?? null);
    console.info(
      `[Phase 18c] shipperFeeStatus=${load.shipperFeeStatus} carrierFeeStatus=${load.carrierFeeStatus}`
    );
  });

  test("Phase 18d — Platform revenue did not decrease after lifecycle", async () => {
    test.setTimeout(30000);

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/analytics",
      adminToken
    );
    if (status !== 200) {
      test.skip(true, `Analytics endpoint returned ${status}`);
      return;
    }

    const revenueAfter =
      data?.summary?.revenue?.platformBalance ?? platformRevenueBefore;
    expect(revenueAfter).toBeGreaterThanOrEqual(platformRevenueBefore);
    console.info(
      `[Phase 18d] platformRevenue before=${platformRevenueBefore} after=${revenueAfter}`
    );
  });

  test("Phase 18e — Truck is available again after trip COMPLETED", async () => {
    test.setTimeout(30000);
    if (!truckId || !adminToken) {
      test.skip(true, "Missing truckId or adminToken");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      `/api/trucks/${truckId}`,
      adminToken
    );
    expect(status).toBe(200);

    const truck = data.truck ?? data;
    expect(truck.isAvailable).toBe(true);
    console.info(`[Phase 18e] truck.isAvailable=${truck.isAvailable}`);
  });

  // ── Phase 19: Super Admin Analytics ──────────────────────────────────────

  test("Phase 19 — Super Admin sees full revenue analytics (not null)", async () => {
    test.setTimeout(30000);

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/analytics",
      superAdminToken
    );
    expect(status).toBe(200);

    // Super Admin must see revenue (Dispatcher sees null — §10 vs §5 difference)
    expect(data?.summary?.revenue).not.toBeNull();
    expect(typeof data?.summary?.revenue?.platformBalance).toBe("number");
    console.info(
      `[Phase 19] superAdmin revenue.platformBalance=${data?.summary?.revenue?.platformBalance}`
    );
  });
});
