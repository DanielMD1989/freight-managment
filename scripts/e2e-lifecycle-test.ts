#!/usr/bin/env npx tsx
/**
 * Full-Lifecycle E2E Side-by-Side Test: Web App vs Mobile App
 *
 * Tests all 13 scenarios from Registration → Completed Trips,
 * comparing web (cookie auth) vs mobile (Bearer token auth) at every step.
 *
 * Usage: npx tsx scripts/e2e-lifecycle-test.ts
 *
 * Prerequisites:
 *   - Next.js dev server running on port 3000
 *   - Database seeded with test data (npx tsx scripts/seed-test-data.ts)
 */

const BASE_URL = "http://localhost:3000";
const UNIQUE = Date.now().toString(36); // Unique suffix for test data

// ============================================================================
// STATE — propagated between scenarios
// ============================================================================
interface TestState {
  // Auth tokens
  adminToken: string;
  adminCsrf: string;
  adminCookies: string;
  carrierToken: string;
  carrierCsrf: string;
  carrierCookies: string;
  shipperToken: string;
  shipperCsrf: string;
  shipperCookies: string;

  // New registered user tokens (from Scenario 1)
  newCarrierToken: string;
  newCarrierCsrf: string;
  newCarrierId: string;
  newShipperToken: string;
  newShipperCsrf: string;
  newShipperId: string;

  // Entity IDs
  truck1Id: string; // Created via web
  truck2Id: string; // Created via mobile API
  truck3Id: string; // Created via mobile API (for rejection)
  load1Id: string; // Created via web
  load2Id: string; // Created via mobile API
  posting1Id: string;
  posting2Id: string;
  loadRequestId: string;
  truckRequestId: string;
  trip1Id: string;
  trip2Id: string;

  // Location IDs
  addisId: string;
  direDawaId: string;
  djiboutiId: string;

  // Existing seed data IDs
  seedTruckId: string; // An existing approved truck from seed data
  seedTruck2Id: string;
}

const state: Partial<TestState> = {};

// ============================================================================
// UTILITIES
// ============================================================================
let passed = 0;
let failed = 0;
let skipped = 0;
const errors: string[] = [];

function log(msg: string) {
  console.log(msg);
}

function logScenario(num: number, title: string) {
  log(`\n${"=".repeat(70)}`);
  log(`  SCENARIO ${num}: ${title}`);
  log(`${"=".repeat(70)}\n`);
}

function assert(condition: boolean, msg: string, details?: string) {
  if (condition) {
    passed++;
    log(`  ✓ ${msg}`);
  } else {
    failed++;
    const errMsg = details ? `${msg} — ${details}` : msg;
    errors.push(errMsg);
    log(`  ✗ ${msg}${details ? ` — ${details}` : ""}`);
  }
}

function skip(msg: string, reason: string) {
  skipped++;
  log(`  ⊘ SKIP: ${msg} — ${reason}`);
}

// Extract cookies from Set-Cookie headers
function extractCookies(response: Response): string {
  const setCookies = response.headers.getSetCookie?.() || [];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

// Merge cookies
function mergeCookies(existing: string, newCookies: string): string {
  if (!newCookies) return existing;
  if (!existing) return newCookies;
  const map = new Map<string, string>();
  for (const c of existing.split("; ")) {
    const [k] = c.split("=");
    if (k) map.set(k, c);
  }
  for (const c of newCookies.split("; ")) {
    const [k] = c.split("=");
    if (k) map.set(k, c);
  }
  return Array.from(map.values()).join("; ");
}

// Mobile API helper — Bearer token auth + x-client-type: mobile
async function mobileApi(
  method: string,
  path: string,
  token: string,
  csrfToken?: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "x-client-type": "mobile",
    Authorization: `Bearer ${token}`,
  };
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  return { status: res.status, data };
}

// Web API helper — cookie-based auth + CSRF
async function webApi(
  method: string,
  path: string,
  cookies: string,
  csrfToken?: string,
  body?: Record<string, unknown>
): Promise<{
  status: number;
  data: Record<string, unknown>;
  cookies: string;
}> {
  const headers: Record<string, string> = {
    Cookie: cookies,
  };
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const newCookies = extractCookies(res);
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  return {
    status: res.status,
    data,
    cookies: mergeCookies(cookies, newCookies),
  };
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Login helper — returns { token, csrfToken, cookies, userId }
// Retries on rate limit (429)
async function login(
  email: string,
  password: string,
  asMobile = false
): Promise<{
  token: string;
  csrfToken: string;
  cookies: string;
  userId: string;
  orgId: string;
}> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (asMobile) {
      headers["x-client-type"] = "mobile";
    }
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    if (res.status === 429) {
      const retryData = await res.json();
      const waitSec = Math.max(retryData.retryAfter || 5, 5);
      log(`    ⏳ Rate limited on login ${email}, waiting ${waitSec}s...`);
      await sleep(waitSec * 1000 + 1000);
      continue;
    }
    const data = await res.json();
    const cookies = extractCookies(res);
    return {
      token: data.sessionToken || "",
      csrfToken: data.csrfToken || "",
      cookies,
      userId: data.user?.id || "",
      orgId: data.user?.organizationId || "",
    };
  }
  return { token: "", csrfToken: "", cookies: "", userId: "", orgId: "" };
}

// ============================================================================
// INIT: Login all test users (once)
// ============================================================================
async function initLogins() {
  log("\n  [INIT] Logging in all test users...\n");

  // Login admin (web + mobile)
  const adminWeb = await login("admin@test.com", "password", false);
  state.adminCookies = adminWeb.cookies;
  state.adminCsrf = adminWeb.csrfToken;

  await sleep(500);

  const adminMobile = await login("admin@test.com", "password", true);
  state.adminToken = adminMobile.token;
  // Don't overwrite adminCsrf — mobile login generates a new CSRF token
  // but the cookie still has the web login's token. Web CSRF must match cookie.

  log(`    Admin web:    ${state.adminCookies ? "OK" : "FAIL"}`);
  log(`    Admin mobile: ${state.adminToken ? "OK" : "FAIL"}`);

  await sleep(500);

  // Login carrier (web + mobile)
  const carrierWeb = await login("carrier@test.com", "password", false);
  state.carrierCookies = carrierWeb.cookies;
  state.carrierCsrf = carrierWeb.csrfToken;

  await sleep(500);

  const carrierMobile = await login("carrier@test.com", "password", true);
  state.carrierToken = carrierMobile.token;

  log(`    Carrier web:    ${state.carrierCookies ? "OK" : "FAIL"}`);
  log(`    Carrier mobile: ${state.carrierToken ? "OK" : "FAIL"}`);

  await sleep(500);

  // Login shipper (web + mobile)
  const shipperWeb = await login("shipper@test.com", "password", false);
  state.shipperCookies = shipperWeb.cookies;
  state.shipperCsrf = shipperWeb.csrfToken;

  await sleep(500);

  const shipperMobile = await login("shipper@test.com", "password", true);
  state.shipperToken = shipperMobile.token;

  log(`    Shipper web:    ${state.shipperCookies ? "OK" : "FAIL"}`);
  log(`    Shipper mobile: ${state.shipperToken ? "OK" : "FAIL"}`);
  log("");

  // Verify critical tokens are available
  if (!state.adminCookies && !state.adminToken) {
    log(
      "  FATAL: Cannot login as admin. Rate limits may be active. Try again in 15 minutes."
    );
    process.exit(1);
  }
  if (!state.carrierCookies) {
    log("  FATAL: Cannot login as carrier. Rate limits may be active.");
    process.exit(1);
  }
  if (!state.shipperCookies) {
    log("  FATAL: Cannot login as shipper. Rate limits may be active.");
    process.exit(1);
  }
}

// ============================================================================
// SCENARIO 1: Registration
// ============================================================================
async function scenario1() {
  logScenario(1, "Registration");

  // Register carrier via mobile API
  const carrierEmail = `e2e-carrier-${UNIQUE}@test.com`;
  const carrierRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify({
      email: carrierEmail,
      password: "TestPass123!",
      firstName: "E2E",
      lastName: "Carrier",
      role: "CARRIER",
      companyName: `E2E Carrier ${UNIQUE}`,
      carrierType: "CARRIER_COMPANY",
    }),
  });
  const carrierData = await carrierRes.json();
  if (carrierRes.status === 429) {
    log(
      `    ⏳ Registration rate-limited (3/hour). Carrier registration skipped — using existing test users.`
    );
  } else {
    assert(
      carrierRes.status === 201,
      `Mobile carrier registration returns 201`,
      `Got ${carrierRes.status}: ${JSON.stringify(carrierData).slice(0, 200)}`
    );
    if (carrierData.user?.id) {
      state.newCarrierId = carrierData.user.id;
      log(`    → New carrier ID: ${state.newCarrierId}`);
    }
  }

  // Small delay between registrations to avoid rate limit
  await sleep(200);

  // Register shipper via mobile API
  const shipperEmail = `e2e-shipper-${UNIQUE}@test.com`;
  const shipperRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify({
      email: shipperEmail,
      password: "TestPass123!",
      firstName: "E2E",
      lastName: "Shipper",
      role: "SHIPPER",
      companyName: `E2E Shipper ${UNIQUE}`,
    }),
  });
  const shipperData = await shipperRes.json();
  if (shipperRes.status === 429) {
    log(
      `    ⏳ Registration rate-limited (3/hour). Shipper registration skipped — using existing test users.`
    );
  } else {
    assert(
      shipperRes.status === 201,
      `Mobile shipper registration returns 201`,
      `Got ${shipperRes.status}: ${JSON.stringify(shipperData).slice(0, 200)}`
    );
    if (shipperData.user?.id) {
      state.newShipperId = shipperData.user.id;
      log(`    → New shipper ID: ${state.newShipperId}`);
    }
  }

  // Verify new carrier via admin API (using tokens from initLogins)
  // Check users via admin endpoint
  // Note: Admin users list doesn't include `status` field, but we verify
  // the user exists and was created. Scenario 2 will verify status via the verify endpoint.
  if (state.newCarrierId) {
    const { data: checkData } = await mobileApi(
      "GET",
      `/api/admin/users?search=e2e-carrier-${UNIQUE}`,
      state.adminToken
    );
    const users = (checkData.users || []) as Array<{
      id: string;
      email: string;
      isActive: boolean;
    }>;
    assert(
      users.length > 0 && users[0]?.email?.includes(`e2e-carrier-${UNIQUE}`),
      "Admin API shows new carrier user exists",
      `Found ${users.length} users, email: ${users[0]?.email}`
    );
  }
}

// ============================================================================
// SCENARIO 2: Admin User Verification
// ============================================================================
async function scenario2() {
  logScenario(2, "Admin User Verification");

  // Tokens already set from initLogins()
  assert(
    !!state.adminToken || !!state.adminCookies,
    "Admin auth available (token or cookies)"
  );
  assert(!!state.carrierToken, "Carrier mobile login returns sessionToken");
  assert(!!state.carrierCookies, "Carrier web login sets cookies");
  assert(!!state.shipperToken, "Shipper mobile login returns sessionToken");
  assert(!!state.shipperCookies, "Shipper web login sets cookies");

  // Approve new carrier via mobile API (if we registered one)
  if (state.newCarrierId && state.adminToken) {
    const { status, data } = await mobileApi(
      "POST",
      `/api/admin/users/${state.newCarrierId}/verify`,
      state.adminToken,
      state.adminCsrf,
      { status: "ACTIVE" }
    );
    assert(
      status === 200,
      `Admin approves carrier via mobile API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  } else if (state.newCarrierId && state.adminCookies) {
    // Fallback: approve via web API if mobile token unavailable
    const { status, data } = await webApi(
      "POST",
      `/api/admin/users/${state.newCarrierId}/verify`,
      state.adminCookies,
      state.adminCsrf,
      { status: "ACTIVE" }
    );
    assert(
      status === 200,
      `Admin approves carrier via web API (fallback)`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // Approve new shipper via web API
  if (state.newShipperId && state.adminCookies) {
    const { status, data } = await webApi(
      "POST",
      `/api/admin/users/${state.newShipperId}/verify`,
      state.adminCookies,
      state.adminCsrf,
      { status: "ACTIVE" }
    );
    assert(
      status === 200,
      `Admin approves shipper via web API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // Cross-verify: same user data from both auth methods
  const { data: mobileUser } = await mobileApi(
    "GET",
    "/api/auth/me",
    state.carrierToken
  );
  const { data: webUser } = await webApi(
    "GET",
    "/api/auth/me",
    state.carrierCookies
  );

  const mUser = (mobileUser.user || mobileUser) as {
    id?: string;
    role?: string;
  };
  const wUser = (webUser.user || webUser) as { id?: string; role?: string };

  if (mUser.id && wUser.id) {
    assert(
      mUser.id === wUser.id,
      "Same carrier user ID from web and mobile auth",
      `Mobile: ${mUser.id}, Web: ${wUser.id}`
    );
    assert(
      mUser.role === wUser.role,
      "Same carrier role from web and mobile auth"
    );
  }
}

// ============================================================================
// SCENARIO 3: Truck Registration (Carrier)
// ============================================================================
async function scenario3() {
  logScenario(3, "Truck Registration (Carrier)");

  // Create truck 1 via web API (as carrier)
  const truck1Data = {
    truckType: "FLATBED",
    licensePlate: `E2E-FB-${UNIQUE}`,
    capacity: 15000,
    currentCity: "Addis Ababa",
  };
  const { status: s1, data: d1 } = await webApi(
    "POST",
    "/api/trucks",
    state.carrierCookies!,
    state.carrierCsrf,
    truck1Data
  );
  assert(
    s1 === 201,
    `Truck 1 created via web API`,
    `Got ${s1}: ${JSON.stringify(d1).slice(0, 200)}`
  );
  if ((d1.truck as { id?: string })?.id) {
    state.truck1Id = (d1.truck as { id: string }).id;
    log(`    → Truck 1 ID: ${state.truck1Id}`);
  }

  // Create truck 2 via mobile API
  const truck2Data = {
    truckType: "DRY_VAN",
    licensePlate: `E2E-DV-${UNIQUE}`,
    capacity: 20000,
    currentCity: "Dire Dawa",
  };
  const { status: s2, data: d2 } = await mobileApi(
    "POST",
    "/api/trucks",
    state.carrierToken!,
    state.carrierCsrf,
    truck2Data
  );
  assert(
    s2 === 201,
    `Truck 2 created via mobile API`,
    `Got ${s2}: ${JSON.stringify(d2).slice(0, 200)}`
  );
  if ((d2.truck as { id?: string })?.id) {
    state.truck2Id = (d2.truck as { id: string }).id;
    log(`    → Truck 2 ID: ${state.truck2Id}`);
  }

  // Create truck 3 via mobile API (for rejection test)
  const truck3Data = {
    truckType: "REFRIGERATED",
    licensePlate: `E2E-RF-${UNIQUE}`,
    capacity: 10000,
    currentCity: "Mekelle",
  };
  const { status: s3, data: d3 } = await mobileApi(
    "POST",
    "/api/trucks",
    state.carrierToken!,
    state.carrierCsrf,
    truck3Data
  );
  assert(
    s3 === 201,
    `Truck 3 created via mobile API`,
    `Got ${s3}: ${JSON.stringify(d3).slice(0, 200)}`
  );
  if ((d3.truck as { id?: string })?.id) {
    state.truck3Id = (d3.truck as { id: string }).id;
    log(`    → Truck 3 ID: ${state.truck3Id}`);
  }

  // Verify all 3 trucks have PENDING approval status
  const { data: trucksWeb } = await webApi(
    "GET",
    "/api/trucks?myTrucks=true",
    state.carrierCookies!
  );
  const { data: trucksMobile } = await mobileApi(
    "GET",
    "/api/trucks?myTrucks=true",
    state.carrierToken!
  );

  const webTrucks = (trucksWeb.trucks || []) as Array<{
    id: string;
    approvalStatus: string;
  }>;
  const mobileTrucks = (trucksMobile.trucks || []) as Array<{
    id: string;
    approvalStatus: string;
  }>;

  // Find our new trucks in the list
  const newTruckIds = [state.truck1Id, state.truck2Id, state.truck3Id].filter(
    Boolean
  );
  const webNewTrucks = webTrucks.filter((t) => newTruckIds.includes(t.id));
  const mobileNewTrucks = mobileTrucks.filter((t) =>
    newTruckIds.includes(t.id)
  );

  assert(
    webNewTrucks.every((t) => t.approvalStatus === "PENDING"),
    `All new trucks show PENDING via web API`,
    `Statuses: ${webNewTrucks.map((t) => t.approvalStatus).join(", ")}`
  );
  assert(
    mobileNewTrucks.every((t) => t.approvalStatus === "PENDING"),
    `All new trucks show PENDING via mobile API`,
    `Statuses: ${mobileNewTrucks.map((t) => t.approvalStatus).join(", ")}`
  );

  assert(
    webTrucks.length === mobileTrucks.length,
    `Same truck count from web (${webTrucks.length}) and mobile (${mobileTrucks.length})`
  );
}

// ============================================================================
// SCENARIO 4: Admin Truck Approval/Rejection
// ============================================================================
async function scenario4() {
  logScenario(4, "Admin Truck Approval/Rejection");

  // Approve truck 1 via web API (admin)
  if (state.truck1Id) {
    const { status, data } = await webApi(
      "POST",
      `/api/trucks/${state.truck1Id}/approve`,
      state.adminCookies!,
      state.adminCsrf,
      { action: "APPROVE" }
    );
    assert(
      status === 200,
      `Truck 1 approved via web API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // Approve truck 2 via mobile API (admin) — with fallback to web if token unavailable
  if (state.truck2Id) {
    if (state.adminToken) {
      const { status, data } = await mobileApi(
        "POST",
        `/api/trucks/${state.truck2Id}/approve`,
        state.adminToken,
        state.adminCsrf,
        { action: "APPROVE" }
      );
      assert(
        status === 200,
        `Truck 2 approved via mobile API`,
        `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
      );
    } else {
      const { status, data } = await webApi(
        "POST",
        `/api/trucks/${state.truck2Id}/approve`,
        state.adminCookies!,
        state.adminCsrf,
        { action: "APPROVE" }
      );
      assert(
        status === 200,
        `Truck 2 approved via web API (mobile token unavailable)`,
        `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
      );
    }
  }

  // Reject truck 3 via mobile API (admin) — with fallback
  if (state.truck3Id) {
    if (state.adminToken) {
      const { status, data } = await mobileApi(
        "POST",
        `/api/trucks/${state.truck3Id}/approve`,
        state.adminToken,
        state.adminCsrf,
        {
          action: "REJECT",
          reason: "E2E test rejection - missing documentation",
        }
      );
      assert(
        status === 200,
        `Truck 3 rejected via mobile API`,
        `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
      );
    } else {
      const { status, data } = await webApi(
        "POST",
        `/api/trucks/${state.truck3Id}/approve`,
        state.adminCookies!,
        state.adminCsrf,
        {
          action: "REJECT",
          reason: "E2E test rejection - missing documentation",
        }
      );
      assert(
        status === 200,
        `Truck 3 rejected via web API (mobile token unavailable)`,
        `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
      );
    }
  }

  // Verify approval statuses from carrier perspective
  const { data: trucksData } = await mobileApi(
    "GET",
    "/api/trucks?myTrucks=true",
    state.carrierToken!
  );
  const trucks = (trucksData.trucks || []) as Array<{
    id: string;
    approvalStatus: string;
  }>;

  if (state.truck1Id) {
    const t1 = trucks.find((t) => t.id === state.truck1Id);
    assert(
      t1?.approvalStatus === "APPROVED",
      `Truck 1 shows APPROVED`,
      `Got: ${t1?.approvalStatus}`
    );
  }
  if (state.truck2Id) {
    const t2 = trucks.find((t) => t.id === state.truck2Id);
    assert(
      t2?.approvalStatus === "APPROVED",
      `Truck 2 shows APPROVED`,
      `Got: ${t2?.approvalStatus}`
    );
  }
  if (state.truck3Id) {
    const t3 = trucks.find((t) => t.id === state.truck3Id);
    assert(
      t3?.approvalStatus === "REJECTED",
      `Truck 3 shows REJECTED`,
      `Got: ${t3?.approvalStatus}`
    );
  }
}

// ============================================================================
// SCENARIO 5: Load Creation (Shipper)
// ============================================================================
async function scenario5() {
  logScenario(5, "Load Creation (Shipper)");

  const futureDate1 = new Date(
    Date.now() + 3 * 24 * 60 * 60 * 1000
  ).toISOString();
  const futureDate2 = new Date(
    Date.now() + 6 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Create load 1 via web API (shipper)
  const load1Data = {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    truckType: "FLATBED",
    weight: 12000,
    cargoDescription: "E2E test load 1 - construction materials",
    pickupDate: futureDate1,
    deliveryDate: futureDate2,
    status: "POSTED",
    fullPartial: "FULL",
    bookMode: "REQUEST",
  };
  const { status: s1, data: d1 } = await webApi(
    "POST",
    "/api/loads",
    state.shipperCookies!,
    state.shipperCsrf,
    load1Data
  );
  assert(
    s1 === 201,
    `Load 1 created via web API`,
    `Got ${s1}: ${JSON.stringify(d1).slice(0, 200)}`
  );
  if ((d1.load as { id?: string })?.id) {
    state.load1Id = (d1.load as { id: string }).id;
    log(`    → Load 1 ID: ${state.load1Id}`);
  }

  // Create load 2 via mobile API (shipper)
  const load2Data = {
    pickupCity: "Dire Dawa",
    deliveryCity: "Djibouti",
    truckType: "DRY_VAN",
    weight: 18000,
    cargoDescription: "E2E test load 2 - agricultural exports",
    pickupDate: futureDate1,
    deliveryDate: futureDate2,
    status: "POSTED",
    fullPartial: "FULL",
    bookMode: "REQUEST",
  };
  const { status: s2, data: d2 } = await mobileApi(
    "POST",
    "/api/loads",
    state.shipperToken!,
    state.shipperCsrf,
    load2Data
  );
  assert(
    s2 === 201,
    `Load 2 created via mobile API`,
    `Got ${s2}: ${JSON.stringify(d2).slice(0, 200)}`
  );
  if ((d2.load as { id?: string })?.id) {
    state.load2Id = (d2.load as { id: string }).id;
    log(`    → Load 2 ID: ${state.load2Id}`);
  }

  // Verify both loads visible from carrier's marketplace view
  const { data: loadsWeb } = await webApi(
    "GET",
    "/api/loads?status=POSTED",
    state.carrierCookies!
  );
  const { data: loadsMobile } = await mobileApi(
    "GET",
    "/api/loads?status=POSTED",
    state.carrierToken!
  );

  const webLoads = (loadsWeb.loads || []) as Array<{ id: string }>;
  const mobileLoads = (loadsMobile.loads || []) as Array<{ id: string }>;

  if (state.load1Id) {
    assert(
      webLoads.some((l) => l.id === state.load1Id),
      `Load 1 visible on web marketplace`
    );
    assert(
      mobileLoads.some((l) => l.id === state.load1Id),
      `Load 1 visible on mobile marketplace`
    );
  }
  if (state.load2Id) {
    assert(
      webLoads.some((l) => l.id === state.load2Id),
      `Load 2 visible on web marketplace`
    );
    assert(
      mobileLoads.some((l) => l.id === state.load2Id),
      `Load 2 visible on mobile marketplace`
    );
  }

  assert(
    webLoads.length === mobileLoads.length,
    `Same POSTED load count from web (${webLoads.length}) and mobile (${mobileLoads.length})`
  );
}

// ============================================================================
// SCENARIO 6: Truck Posting (Carrier)
// ============================================================================
async function scenario6() {
  logScenario(6, "Truck Posting (Carrier)");

  // Get location IDs via mobile API
  const { data: locData } = await mobileApi(
    "GET",
    "/api/ethiopian-locations",
    state.carrierToken!
  );
  const locations = (locData.locations || []) as Array<{
    id: string;
    name: string;
  }>;

  state.addisId = locations.find((l) => l.name === "Addis Ababa")?.id || "";
  state.direDawaId = locations.find((l) => l.name === "Dire Dawa")?.id || "";
  state.djiboutiId = locations.find((l) => l.name === "Djibouti")?.id || "";

  assert(!!state.addisId, `Addis Ababa location found`, `ID: ${state.addisId}`);
  assert(
    !!state.direDawaId,
    `Dire Dawa location found`,
    `ID: ${state.direDawaId}`
  );

  const now = new Date().toISOString();
  const weekLater = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Post truck 1 via web API (carrier)
  if (state.truck1Id && state.addisId) {
    const { status, data } = await webApi(
      "POST",
      "/api/truck-postings",
      state.carrierCookies!,
      state.carrierCsrf,
      {
        truckId: state.truck1Id,
        originCityId: state.addisId,
        destinationCityId: state.direDawaId,
        availableFrom: now,
        availableTo: weekLater,
        contactName: "E2E Driver 1",
        contactPhone: "+251900000001",
        fullPartial: "FULL",
      }
    );
    assert(
      status === 201,
      `Truck 1 posted via web API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
    if (data.id) {
      state.posting1Id = data.id as string;
      log(`    → Posting 1 ID: ${state.posting1Id}`);
    }
  }

  // Post truck 2 via mobile API (carrier)
  if (state.truck2Id && state.direDawaId) {
    const { status, data } = await mobileApi(
      "POST",
      "/api/truck-postings",
      state.carrierToken!,
      state.carrierCsrf,
      {
        truckId: state.truck2Id,
        originCityId: state.direDawaId,
        availableFrom: now,
        availableTo: weekLater,
        contactName: "E2E Driver 2",
        contactPhone: "+251900000002",
        fullPartial: "FULL",
      }
    );
    assert(
      status === 201,
      `Truck 2 posted via mobile API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
    if (data.id) {
      state.posting2Id = data.id as string;
      log(`    → Posting 2 ID: ${state.posting2Id}`);
    }
  }

  // Verify postings visible from shipper's perspective
  const { data: postingsWeb } = await webApi(
    "GET",
    "/api/truck-postings?status=ACTIVE",
    state.shipperCookies!
  );
  const { data: postingsMobile } = await mobileApi(
    "GET",
    "/api/truck-postings?status=ACTIVE",
    state.shipperToken!
  );

  const webPostings = (postingsWeb.postings ||
    postingsWeb.truckPostings ||
    []) as Array<{ id: string }>;
  const mobilePostings = (postingsMobile.postings ||
    postingsMobile.truckPostings ||
    []) as Array<{ id: string }>;

  assert(
    webPostings.length === mobilePostings.length,
    `Same ACTIVE posting count from web (${webPostings.length}) and mobile (${mobilePostings.length})`
  );

  // Verify rejected truck cannot be posted
  if (state.truck3Id && state.addisId) {
    const { status: rejStatus, data: rejData } = await mobileApi(
      "POST",
      "/api/truck-postings",
      state.carrierToken!,
      state.carrierCsrf,
      {
        truckId: state.truck3Id,
        originCityId: state.addisId,
        availableFrom: now,
        contactName: "Rejected Driver",
        contactPhone: "+251900000003",
      }
    );
    assert(
      rejStatus === 403,
      `Rejected truck cannot be posted (expect 403)`,
      `Got ${rejStatus}: ${JSON.stringify(rejData).slice(0, 200)}`
    );
  }
}

// ============================================================================
// SCENARIO 7: Matching — Load Requests + Truck Requests
// ============================================================================
async function scenario7() {
  logScenario(7, "Matching — Load Requests + Truck Requests");

  // We need approved trucks with active postings + posted loads
  // Use the seed data trucks (already APPROVED with active postings) for reliable matching

  // Get seed trucks
  const { data: trucksData } = await mobileApi(
    "GET",
    "/api/trucks?myTrucks=true&approvalStatus=APPROVED&hasActivePosting=true",
    state.carrierToken!
  );
  const seedTrucks = (trucksData.trucks || []) as Array<{
    id: string;
    licensePlate: string;
    hasActivePosting: boolean;
    approvalStatus: string;
  }>;
  const approvedPostedTrucks = seedTrucks.filter(
    (t) => t.approvalStatus === "APPROVED" && t.hasActivePosting
  );

  if (approvedPostedTrucks.length >= 2) {
    state.seedTruckId = approvedPostedTrucks[0].id;
    state.seedTruck2Id = approvedPostedTrucks[1].id;
    log(
      `    Using seed trucks: ${approvedPostedTrucks[0].licensePlate}, ${approvedPostedTrucks[1].licensePlate}`
    );
  } else {
    skip(
      "Load/truck requests",
      "Need at least 2 approved trucks with active postings"
    );
    return;
  }

  // 7A — Carrier requests shipper's load (via mobile API)
  if (state.load1Id && state.seedTruckId) {
    const { status, data } = await mobileApi(
      "POST",
      "/api/load-requests",
      state.carrierToken!,
      state.carrierCsrf,
      {
        loadId: state.load1Id,
        truckId: state.seedTruckId,
        expiresInHours: 24,
        notes: "E2E test load request from carrier",
      }
    );
    assert(
      status === 201,
      `7A: Carrier creates load request via mobile API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
    if ((data.loadRequest as { id?: string })?.id) {
      state.loadRequestId = (data.loadRequest as { id: string }).id;
      log(`    → Load request ID: ${state.loadRequestId}`);
    }
  }

  // Verify shipper sees the pending load request
  if (state.loadRequestId) {
    const { data: webReqs } = await webApi(
      "GET",
      "/api/load-requests?status=PENDING",
      state.shipperCookies!
    );
    const { data: mobileReqs } = await mobileApi(
      "GET",
      "/api/load-requests?status=PENDING",
      state.shipperToken!
    );

    const webLoadReqs = (webReqs.loadRequests || []) as Array<{
      id: string;
      status: string;
    }>;
    const mobileLoadReqs = (mobileReqs.loadRequests || []) as Array<{
      id: string;
      status: string;
    }>;

    assert(
      webLoadReqs.some((r) => r.id === state.loadRequestId),
      `Shipper sees load request via web API`
    );
    assert(
      mobileLoadReqs.some((r) => r.id === state.loadRequestId),
      `Shipper sees load request via mobile API`
    );
  }

  // 7B — Shipper requests carrier's truck (via web API)
  if (state.load2Id && state.seedTruck2Id) {
    const { status, data } = await webApi(
      "POST",
      "/api/truck-requests",
      state.shipperCookies!,
      state.shipperCsrf,
      {
        loadId: state.load2Id,
        truckId: state.seedTruck2Id,
        expiresInHours: 24,
        notes: "E2E test truck request from shipper",
      }
    );
    assert(
      status === 201,
      `7B: Shipper creates truck request via web API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
    if ((data.request as { id?: string })?.id) {
      state.truckRequestId = (data.request as { id: string }).id;
      log(`    → Truck request ID: ${state.truckRequestId}`);
    }
  }

  // Verify carrier sees the pending truck request
  if (state.truckRequestId) {
    const { data: webReqs } = await webApi(
      "GET",
      "/api/truck-requests?status=PENDING",
      state.carrierCookies!
    );
    const { data: mobileReqs } = await mobileApi(
      "GET",
      "/api/truck-requests?status=PENDING",
      state.carrierToken!
    );

    const webTruckReqs = (webReqs.requests || []) as Array<{
      id: string;
      status: string;
    }>;
    const mobileTruckReqs = (mobileReqs.requests || []) as Array<{
      id: string;
      status: string;
    }>;

    assert(
      webTruckReqs.some((r) => r.id === state.truckRequestId),
      `Carrier sees truck request via web API`
    );
    assert(
      mobileTruckReqs.some((r) => r.id === state.truckRequestId),
      `Carrier sees truck request via mobile API`
    );
  }
}

// ============================================================================
// SCENARIO 8: Request Approval → Trip Creation
// ============================================================================
async function scenario8() {
  logScenario(8, "Request Approval → Trip Creation");

  // 8A — Shipper approves carrier's load request (via web API)
  if (state.loadRequestId) {
    const { status, data } = await webApi(
      "POST",
      `/api/load-requests/${state.loadRequestId}/respond`,
      state.shipperCookies!,
      state.shipperCsrf,
      { action: "APPROVE" }
    );
    assert(
      status === 200,
      `8A: Shipper approves load request via web API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );

    if ((data.trip as { id?: string })?.id) {
      state.trip1Id = (data.trip as { id: string }).id;
      log(`    → Trip 1 ID: ${state.trip1Id}`);
    }

    // Verify load is now ASSIGNED
    if ((data.load as { status?: string })?.status) {
      assert(
        (data.load as { status: string }).status === "ASSIGNED",
        `Load 1 status changed to ASSIGNED`,
        `Got: ${(data.load as { status: string }).status}`
      );
    }
  }

  // 8B — Carrier approves shipper's truck request (via mobile API)
  if (state.truckRequestId) {
    const { status, data } = await mobileApi(
      "POST",
      `/api/truck-requests/${state.truckRequestId}/respond`,
      state.carrierToken!,
      state.carrierCsrf,
      { action: "APPROVE" }
    );
    assert(
      status === 200,
      `8B: Carrier approves truck request via mobile API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );

    if ((data.trip as { id?: string })?.id) {
      state.trip2Id = (data.trip as { id: string }).id;
      log(`    → Trip 2 ID: ${state.trip2Id}`);
    }

    // Verify load is now ASSIGNED
    if ((data.load as { status?: string })?.status) {
      assert(
        (data.load as { status: string }).status === "ASSIGNED",
        `Load 2 status changed to ASSIGNED`,
        `Got: ${(data.load as { status: string }).status}`
      );
    }
  }

  // Verify both trips visible from both perspectives
  const { data: carrierTripsWeb } = await webApi(
    "GET",
    "/api/trips",
    state.carrierCookies!
  );
  const { data: carrierTripsMobile } = await mobileApi(
    "GET",
    "/api/trips",
    state.carrierToken!
  );
  const { data: shipperTripsWeb } = await webApi(
    "GET",
    "/api/trips",
    state.shipperCookies!
  );
  const { data: shipperTripsMobile } = await mobileApi(
    "GET",
    "/api/trips",
    state.shipperToken!
  );

  const cwTrips = (carrierTripsWeb.trips || []) as Array<{
    id: string;
    status: string;
  }>;
  const cmTrips = (carrierTripsMobile.trips || []) as Array<{
    id: string;
    status: string;
  }>;
  const swTrips = (shipperTripsWeb.trips || []) as Array<{
    id: string;
    status: string;
  }>;
  const smTrips = (shipperTripsMobile.trips || []) as Array<{
    id: string;
    status: string;
  }>;

  assert(
    cwTrips.length === cmTrips.length,
    `Carrier sees same trip count: web (${cwTrips.length}) vs mobile (${cmTrips.length})`
  );
  assert(
    swTrips.length === smTrips.length,
    `Shipper sees same trip count: web (${swTrips.length}) vs mobile (${smTrips.length})`
  );

  if (state.trip1Id) {
    assert(
      cwTrips.some((t) => t.id === state.trip1Id && t.status === "ASSIGNED"),
      `Trip 1 visible to carrier as ASSIGNED`
    );
    assert(
      swTrips.some((t) => t.id === state.trip1Id && t.status === "ASSIGNED"),
      `Trip 1 visible to shipper as ASSIGNED`
    );
  }
}

// ============================================================================
// SCENARIO 9: Trip Lifecycle (ASSIGNED → DELIVERED)
// ============================================================================
async function scenario9() {
  logScenario(9, "Trip Lifecycle (ASSIGNED → DELIVERED)");

  if (!state.trip1Id) {
    skip("Trip lifecycle", "No trip created from scenario 8");
    return;
  }

  // 9A — ASSIGNED → PICKUP_PENDING (via web API as carrier)
  {
    const { status, data } = await webApi(
      "PATCH",
      `/api/trips/${state.trip1Id}`,
      state.carrierCookies!,
      state.carrierCsrf,
      { status: "PICKUP_PENDING" }
    );
    assert(
      status === 200,
      `9A: Trip → PICKUP_PENDING via web API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // 9B — PICKUP_PENDING → IN_TRANSIT (via mobile API as carrier)
  {
    const { status, data } = await mobileApi(
      "PATCH",
      `/api/trips/${state.trip1Id}`,
      state.carrierToken!,
      state.carrierCsrf,
      { status: "IN_TRANSIT" }
    );
    assert(
      status === 200,
      `9B: Trip → IN_TRANSIT via mobile API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // 9C — IN_TRANSIT → DELIVERED (via mobile API as carrier)
  {
    const { status, data } = await mobileApi(
      "PATCH",
      `/api/trips/${state.trip1Id}`,
      state.carrierToken!,
      state.carrierCsrf,
      {
        status: "DELIVERED",
        receiverName: "E2E Test Receiver",
        receiverPhone: "+251900000099",
      }
    );
    assert(
      status === 200,
      `9C: Trip → DELIVERED via mobile API`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // 9D — Negative test: DELIVERED → IN_TRANSIT should fail
  {
    const { status, data } = await mobileApi(
      "PATCH",
      `/api/trips/${state.trip1Id}`,
      state.carrierToken!,
      state.carrierCsrf,
      { status: "IN_TRANSIT" }
    );
    assert(
      status === 400,
      `9D: Invalid transition DELIVERED→IN_TRANSIT returns 400`,
      `Got ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  // Verify shipper sees the same status via both platforms
  const { data: webTrip } = await webApi(
    "GET",
    `/api/trips/${state.trip1Id}`,
    state.shipperCookies!
  );
  const { data: mobileTrip } = await mobileApi(
    "GET",
    `/api/trips/${state.trip1Id}`,
    state.shipperToken!
  );

  const wTrip = (webTrip.trip || {}) as { status?: string };
  const mTrip = (mobileTrip.trip || {}) as { status?: string };

  assert(
    wTrip.status === "DELIVERED",
    `Web shows trip as DELIVERED`,
    `Got: ${wTrip.status}`
  );
  assert(
    mTrip.status === "DELIVERED",
    `Mobile shows trip as DELIVERED`,
    `Got: ${mTrip.status}`
  );
  assert(wTrip.status === mTrip.status, `Web and mobile show same trip status`);

  // Also advance trip 2 to DELIVERED for POD testing
  if (state.trip2Id) {
    await mobileApi(
      "PATCH",
      `/api/trips/${state.trip2Id}`,
      state.carrierToken!,
      state.carrierCsrf,
      { status: "PICKUP_PENDING" }
    );
    await mobileApi(
      "PATCH",
      `/api/trips/${state.trip2Id}`,
      state.carrierToken!,
      state.carrierCsrf,
      { status: "IN_TRANSIT" }
    );
    const { status } = await mobileApi(
      "PATCH",
      `/api/trips/${state.trip2Id}`,
      state.carrierToken!,
      state.carrierCsrf,
      {
        status: "DELIVERED",
        receiverName: "E2E Test Receiver 2",
        receiverPhone: "+251900000098",
      }
    );
    assert(
      status === 200,
      `Trip 2 also advanced to DELIVERED`,
      `Got ${status}`
    );
  }
}

// ============================================================================
// SCENARIO 10: POD Upload & Verification
// ============================================================================
async function scenario10() {
  logScenario(10, "POD Upload & Verification");

  if (!state.trip1Id) {
    skip("POD upload", "No trip created from scenario 8");
    return;
  }

  // Upload POD via mobile API (multipart form data)
  const formData = new FormData();
  // Create a test file
  const testFileContent = "E2E Test POD Document - Proof of Delivery";
  const testFile = new Blob([testFileContent], { type: "image/jpeg" });
  formData.append("file", testFile, "e2e-pod-test.jpg");
  formData.append("notes", "E2E test POD upload");

  const podRes = await fetch(`${BASE_URL}/api/trips/${state.trip1Id}/pod`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.carrierToken}`,
      "x-client-type": "mobile",
    },
    body: formData,
  });
  const podData = await podRes.json();
  assert(
    podRes.status === 200,
    `POD uploaded via mobile API`,
    `Got ${podRes.status}: ${JSON.stringify(podData).slice(0, 200)}`
  );

  // Verify POD visible from both platforms
  const { data: webPod } = await webApi(
    "GET",
    `/api/trips/${state.trip1Id}/pod`,
    state.shipperCookies!
  );
  const { data: mobilePod } = await mobileApi(
    "GET",
    `/api/trips/${state.trip1Id}/pod`,
    state.carrierToken!
  );

  const webPods = (webPod.pods || []) as Array<{ id: string }>;
  const mobilePods = (mobilePod.pods || []) as Array<{ id: string }>;

  assert(
    webPods.length > 0,
    `Shipper can see POD via web API`,
    `Count: ${webPods.length}`
  );
  assert(
    mobilePods.length > 0,
    `Carrier can see POD via mobile API`,
    `Count: ${mobilePods.length}`
  );
  assert(
    webPods.length === mobilePods.length,
    `Same POD count from both platforms`
  );
}

// ============================================================================
// SCENARIO 11: Settlement & Wallet
// ============================================================================
async function scenario11() {
  logScenario(11, "Settlement & Wallet");

  // Check carrier wallet via mobile API
  const { status: cs, data: carrierWalletMobile } = await mobileApi(
    "GET",
    "/api/wallet/transactions",
    state.carrierToken!
  );
  assert(
    cs === 200,
    `Carrier wallet transactions accessible via mobile API`,
    `Got ${cs}`
  );

  // Check carrier wallet via web API
  const { status: cw, data: carrierWalletWeb } = await webApi(
    "GET",
    "/api/wallet/transactions",
    state.carrierCookies!
  );
  assert(
    cw === 200,
    `Carrier wallet transactions accessible via web API`,
    `Got ${cw}`
  );

  // Check shipper wallet via mobile API
  const { status: ss, data: shipperWalletMobile } = await mobileApi(
    "GET",
    "/api/wallet/transactions",
    state.shipperToken!
  );
  assert(
    ss === 200,
    `Shipper wallet transactions accessible via mobile API`,
    `Got ${ss}`
  );

  // Check shipper wallet via web API
  const { status: sw, data: shipperWalletWeb } = await webApi(
    "GET",
    "/api/wallet/transactions",
    state.shipperCookies!
  );
  assert(
    sw === 200,
    `Shipper wallet transactions accessible via web API`,
    `Got ${sw}`
  );

  // Compare transaction counts (should be same from both platforms)
  const carrierMobileTxs = (
    (carrierWalletMobile.transactions || []) as unknown[]
  ).length;
  const carrierWebTxs = ((carrierWalletWeb.transactions || []) as unknown[])
    .length;
  const shipperMobileTxs = (
    (shipperWalletMobile.transactions || []) as unknown[]
  ).length;
  const shipperWebTxs = ((shipperWalletWeb.transactions || []) as unknown[])
    .length;

  assert(
    carrierMobileTxs === carrierWebTxs,
    `Carrier transaction count matches: mobile (${carrierMobileTxs}) vs web (${carrierWebTxs})`
  );
  assert(
    shipperMobileTxs === shipperWebTxs,
    `Shipper transaction count matches: mobile (${shipperMobileTxs}) vs web (${shipperWebTxs})`
  );
}

// ============================================================================
// SCENARIO 12: Notifications
// ============================================================================
async function scenario12() {
  logScenario(12, "Notifications");

  // Get carrier notifications via mobile API
  const { status: cs, data: carrierNotifMobile } = await mobileApi(
    "GET",
    "/api/notifications",
    state.carrierToken!
  );
  assert(
    cs === 200,
    `Carrier notifications accessible via mobile API`,
    `Got ${cs}`
  );

  // Get carrier notifications via web API
  const { status: cw, data: carrierNotifWeb } = await webApi(
    "GET",
    "/api/notifications",
    state.carrierCookies!
  );
  assert(
    cw === 200,
    `Carrier notifications accessible via web API`,
    `Got ${cw}`
  );

  const mobileNotifs = (carrierNotifMobile.notifications || []) as Array<{
    id: string;
    type: string;
    isRead: boolean;
  }>;
  const webNotifs = (carrierNotifWeb.notifications || []) as Array<{
    id: string;
    type: string;
    isRead: boolean;
  }>;

  assert(
    mobileNotifs.length === webNotifs.length,
    `Carrier notification count matches: mobile (${mobileNotifs.length}) vs web (${webNotifs.length})`
  );

  const mobileUnread = carrierNotifMobile.unreadCount as number;
  const webUnread = carrierNotifWeb.unreadCount as number;
  assert(
    mobileUnread === webUnread,
    `Carrier unread count matches: mobile (${mobileUnread}) vs web (${webUnread})`
  );

  // Check for expected notification types (from truck approval, load request approval, etc.)
  const notifTypes = new Set(mobileNotifs.map((n) => n.type));
  log(`    Carrier notification types: ${[...notifTypes].join(", ")}`);

  // Mark one notification as read via mobile API
  if (mobileNotifs.length > 0 && !mobileNotifs[0].isRead) {
    const notifId = mobileNotifs[0].id;
    const { status: readStatus } = await mobileApi(
      "PUT",
      `/api/notifications/${notifId}/read`,
      state.carrierToken!,
      state.carrierCsrf
    );
    assert(
      readStatus === 200,
      `Mark notification as read via mobile API`,
      `Got ${readStatus}`
    );

    // Verify unread count decremented
    const { data: afterRead } = await mobileApi(
      "GET",
      "/api/notifications",
      state.carrierToken!
    );
    const newUnread = afterRead.unreadCount as number;
    assert(
      newUnread === mobileUnread - 1,
      `Unread count decremented after marking read`,
      `Before: ${mobileUnread}, After: ${newUnread}`
    );
  }

  // Check shipper notifications
  const { data: shipperNotifMobile } = await mobileApi(
    "GET",
    "/api/notifications",
    state.shipperToken!
  );
  const { data: shipperNotifWeb } = await webApi(
    "GET",
    "/api/notifications",
    state.shipperCookies!
  );

  const shipperMobileNotifs = (shipperNotifMobile.notifications ||
    []) as Array<{ type: string }>;
  const shipperWebNotifs = (shipperNotifWeb.notifications || []) as Array<{
    type: string;
  }>;

  assert(
    shipperMobileNotifs.length === shipperWebNotifs.length,
    `Shipper notification count matches: mobile (${shipperMobileNotifs.length}) vs web (${shipperWebNotifs.length})`
  );
}

// ============================================================================
// SCENARIO 13: Ethiopian Locations (Source of Truth)
// ============================================================================
async function scenario13() {
  logScenario(13, "Ethiopian Locations (Source of Truth)");

  // Get locations via mobile API
  const { status: ms, data: mobileLoc } = await mobileApi(
    "GET",
    "/api/ethiopian-locations",
    state.carrierToken!
  );
  assert(ms === 200, `Locations accessible via mobile API`, `Got ${ms}`);

  // Get locations via web API (shipper context)
  const { status: ws, data: webLoc } = await webApi(
    "GET",
    "/api/ethiopian-locations",
    state.shipperCookies!
  );
  assert(ws === 200, `Locations accessible via web API`, `Got ${ws}`);

  const mobileLocations = (mobileLoc.locations || []) as Array<{
    id: string;
    name: string;
    region: string;
    latitude: number;
    longitude: number;
  }>;
  const webLocations = (webLoc.locations || []) as Array<{
    id: string;
    name: string;
    region: string;
    latitude: number;
    longitude: number;
  }>;

  assert(
    mobileLocations.length === webLocations.length,
    `Same location count: mobile (${mobileLocations.length}) vs web (${webLocations.length})`
  );

  assert(
    (mobileLoc.count as number) === (webLoc.count as number),
    `Same count field: mobile (${mobileLoc.count}) vs web (${webLoc.count})`
  );

  // Verify exact same IDs
  const mobileIds = new Set(mobileLocations.map((l) => l.id));
  const webIds = new Set(webLocations.map((l) => l.id));
  const idsMatch =
    mobileIds.size === webIds.size &&
    [...mobileIds].every((id) => webIds.has(id));
  assert(idsMatch, `Exact same location IDs from both platforms`);

  // Verify exact same names
  const mobileNames = mobileLocations.map((l) => l.name).sort();
  const webNames = webLocations.map((l) => l.name).sort();
  assert(
    JSON.stringify(mobileNames) === JSON.stringify(webNames),
    `Exact same location names from both platforms`,
    `Mobile: ${mobileNames.join(", ")} | Web: ${webNames.join(", ")}`
  );

  // Verify coordinates match
  let coordsMatch = true;
  for (const mLoc of mobileLocations) {
    const wLoc = webLocations.find((w) => w.id === mLoc.id);
    if (
      wLoc &&
      (String(mLoc.latitude) !== String(wLoc.latitude) ||
        String(mLoc.longitude) !== String(wLoc.longitude))
    ) {
      coordsMatch = false;
      log(
        `    ⚠ Coordinate mismatch for ${mLoc.name}: mobile (${mLoc.latitude},${mLoc.longitude}) vs web (${wLoc.latitude},${wLoc.longitude})`
      );
    }
  }
  assert(coordsMatch, `Coordinates match for all locations`);

  log(
    `\n  Locations verified: ${mobileLocations.map((l) => l.name).join(", ")}`
  );
}

// ============================================================================
// SUMMARY
// ============================================================================
function printSummary() {
  log(`\n${"=".repeat(70)}`);
  log(`  E2E LIFECYCLE TEST SUMMARY`);
  log(`${"=".repeat(70)}\n`);

  log(`  Passed:  ${passed}`);
  log(`  Failed:  ${failed}`);
  log(`  Skipped: ${skipped}`);
  log(`  Total:   ${passed + failed + skipped}\n`);

  if (errors.length > 0) {
    log(`  FAILURES:`);
    for (const err of errors) {
      log(`    ✗ ${err}`);
    }
    log("");
  }

  if (failed === 0) {
    log(`  🎉 ALL TESTS PASSED — Web and Mobile platforms are in sync!\n`);
  } else {
    log(`  ⚠ ${failed} test(s) failed — see details above\n`);
  }

  log(`${"=".repeat(70)}\n`);
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  log(`\n${"=".repeat(70)}`);
  log(`  FULL-LIFECYCLE E2E SIDE-BY-SIDE TEST`);
  log(`  Web App (cookie auth) vs Mobile App (Bearer token auth)`);
  log(`  Test run: ${UNIQUE}`);
  log(`${"=".repeat(70)}\n`);

  try {
    // Verify server is running
    const healthCheck = await fetch(
      `${BASE_URL}/api/ethiopian-locations`
    ).catch(() => null);
    if (!healthCheck || healthCheck.status >= 500) {
      log(
        "ERROR: Next.js server not running on port 3000. Start with: npm run dev"
      );
      process.exit(1);
    }

    // Init: login all users once (before scenarios)
    await initLogins();

    await scenario1(); // Registration
    await scenario2(); // Admin User Verification
    await scenario3(); // Truck Registration
    await scenario4(); // Admin Truck Approval/Rejection
    await scenario5(); // Load Creation
    await scenario6(); // Truck Posting
    await scenario7(); // Matching — Load/Truck Requests
    await scenario8(); // Request Approval → Trip Creation
    await scenario9(); // Trip Lifecycle
    await scenario10(); // POD Upload
    await scenario11(); // Settlement & Wallet
    await scenario12(); // Notifications
    await scenario13(); // Ethiopian Locations

    printSummary();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    log(`\nFATAL ERROR: ${error}`);
    if (error instanceof Error) {
      log(error.stack || "");
    }
    printSummary();
    process.exit(1);
  }
}

main();
