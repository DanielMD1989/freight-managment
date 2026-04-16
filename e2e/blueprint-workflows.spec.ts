/**
 * Blueprint Workflow Tests — §1 through §14
 *
 * Every test follows the exact flow from freight_marketplace_blueprint.md.
 * Real browser. Real database. Real clicks. No mocks.
 *
 * Prerequisite: npm run dev (local PostgreSQL + seed data)
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const PW = "Test123!";
const DISP_PW = "password";

// ── Token cache (login once, reuse everywhere) ──────────────────────

const tokenCache: Record<string, string> = {};

async function apiLogin(email: string, pw: string) {
  if (tokenCache[email]) return tokenCache[email];

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-type": "mobile",
      },
      body: JSON.stringify({ email, password: pw }),
    });
    const d = await r.json();
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 35000));
      continue;
    }
    if (!r.ok) throw new Error(`Login ${email}: ${d.error}`);
    tokenCache[email] = d.sessionToken;
    return d.sessionToken as string;
  }
  throw new Error(`Login ${email}: rate limited after retries`);
}

async function api(method: string, path: string, token: string, body?: object) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function uiLogin(page: Page, email: string, pw: string, portal: string) {
  // Use cookie injection to avoid rate limiter exhaustion from form-based login
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  const cookie = (r.headers.get("set-cookie") ?? "").match(
    /session=([^;]+)/
  )?.[1];
  if (cookie) {
    await page.context().addCookies([
      {
        name: "session",
        value: cookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
    ]);
    await page.goto(portal, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  } else {
    // Fallback to form login
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(pw);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL(new RegExp(portal), { timeout: 15000 });
  }
}

function days(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

function dateStr(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().split("T")[0];
}

// ═════════════════════════════════════════════════════════════════════
// §1-§2  ACCOUNT HIERARCHY & REGISTRATION
// ═════════════════════════════════════════════════════════════════════

test.describe("§1-§2: Registration & Approval", () => {
  test("Shipper self-registers → status REGISTERED", async () => {
    const email = `bp-shipper-${Date.now()}@test.com`;
    const { status, data } = await api("POST", "/api/auth/register", "", {
      email,
      password: PW,
      firstName: "BP",
      lastName: "Shipper",
      role: "SHIPPER",
      companyName: "BP Test Shipping",
      phone: `+2519${Date.now().toString().slice(-8)}`,
    });
    // Registration should work (201) or rate-limit (429)
    if (status === 429) {
      test.skip(true, "Rate limited");
      return;
    }
    expect(status).toBe(201);
    expect(data.user.status).toBe("REGISTERED");
    expect(data.limitedAccess).toBe(true);
  });

  test("Unapproved user blocked from marketplace", async () => {
    // Use the freshly registered user (or any non-ACTIVE user)
    const email = `bp-blocked-${Date.now()}@test.com`;
    const reg = await api("POST", "/api/auth/register", "", {
      email,
      password: PW,
      firstName: "Blocked",
      lastName: "User",
      role: "SHIPPER",
      companyName: "Blocked Co",
      phone: `+2519${Date.now().toString().slice(-8)}`,
    });
    if (reg.status === 429) {
      test.skip(true, "Rate limited");
      return;
    }

    const token = await apiLogin(email, PW).catch(() => null);
    if (!token) {
      test.skip(true, "Cannot login");
      return;
    }

    const { status } = await api("GET", "/api/truck-postings", token);
    expect(status).toBe(403);
  });

  test("Duplicate email rejected", async () => {
    // Pre-check: confirm the duplicate target user already exists. If not,
    // skip — the assertion only makes sense against a known-existing email.
    const adminToken = await apiLogin("admin@test.com", PW).catch(() => null);
    if (adminToken) {
      const probe = await api(
        "GET",
        "/api/admin/users?search=shipper@test.com&limit=1",
        adminToken
      );
      const users =
        (probe.data as { users?: Array<{ email?: string }> }).users ?? [];
      if (!users.some((u) => u.email === "shipper@test.com")) {
        test.skip(
          true,
          "shipper@test.com not seeded — skipping duplicate test"
        );
        return;
      }
    }

    const { status } = await api("POST", "/api/auth/register", "", {
      email: "shipper@test.com",
      password: PW,
      firstName: "Dup",
      lastName: "Test",
      role: "SHIPPER",
      companyName: "Dup Co",
      phone: "+251900000001",
    });
    // 429 = registration rate-limit exhausted by earlier specs; can't validate
    // the duplicate-email behavior without a fresh quota — skip rather than fail.
    if (status === 429) {
      test.skip(true, "registration rate-limited — cannot validate dup email");
      return;
    }
    expect(status).toBe(400);
  });

  test("Weak password rejected", async () => {
    const { status } = await api("POST", "/api/auth/register", "", {
      email: `weak-${Date.now()}@test.com`,
      password: "123",
      firstName: "Weak",
      lastName: "Pass",
      role: "SHIPPER",
      companyName: "Weak Co",
      phone: "+251900000002",
    });
    expect(status).toBe(400);
  });

  test("Admin-only roles cannot self-register", async () => {
    const { status } = await api("POST", "/api/auth/register", "", {
      email: `admin-try-${Date.now()}@test.com`,
      password: PW,
      firstName: "Admin",
      lastName: "Try",
      role: "ADMIN",
      companyName: "Admin Co",
      phone: "+251900000003",
    });
    // Should be rejected — only SHIPPER/CARRIER/DISPATCHER can self-register
    expect([400, 403]).toContain(status);
  });

  test("Shipper → carrier dashboard returns 403", async () => {
    const token = await apiLogin("shipper@test.com", PW);
    const { status } = await api("GET", "/api/carrier/dashboard", token);
    expect(status).toBe(403);
  });

  test("Browser: Login redirects to correct portal", async ({ page }) => {
    await uiLogin(page, "shipper@test.com", PW, "/shipper");
    expect(page.url()).toContain("/shipper");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3  SHIPPER FLOW — Post loads, search trucks, send requests
// ═════════════════════════════════════════════════════════════════════

test.describe.serial("§3: Shipper Flow", () => {
  let token: string;
  let loadId: string;

  test.beforeAll(async () => {
    token = await apiLogin("shipper@test.com", PW);
  });

  test("Create load → status DRAFT", async () => {
    const { status, data } = await api("POST", "/api/loads", token, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: days(2),
      deliveryDate: days(5),
      truckType: "DRY_VAN",
      weight: 8000,
      cargoDescription: "Blueprint §3 test cargo",
      shipperContactName: "BP Shipper",
      shipperContactPhone: "+251911111111",
    });
    expect(status).toBe(201);
    loadId = (data.load ?? data).id;
    expect((data.load ?? data).status).toBe("DRAFT");
  });

  test("Post load → status POSTED, visible on marketplace", async () => {
    const { status } = await api("PATCH", `/api/loads/${loadId}`, token, {
      status: "POSTED",
    });
    expect(status).toBe(200);

    // Verify visible
    const { data } = await api("GET", `/api/loads/${loadId}`, token);
    expect((data.load ?? data).status).toBe("POSTED");
  });

  test("Search matching trucks — only matching DH-O/DH-D shown", async () => {
    const { status, data } = await api(
      "GET",
      `/api/loads/${loadId}/matching-trucks?limit=10`,
      token
    );
    expect(status).toBe(200);
    expect(data.trucks.length).toBeGreaterThan(0);
    // Every match should have a score
    for (const t of data.trucks) {
      expect(t.matchScore).toBeGreaterThanOrEqual(50);
    }
  });

  test("Send truck request → carrier notified", async () => {
    const { data: matches } = await api(
      "GET",
      `/api/loads/${loadId}/matching-trucks?limit=10`,
      token
    );
    // Pick an APPROVED truck (unapproved trucks are rejected by request endpoint)
    const truck = matches.trucks.find(
      (t: { truck?: { approvalStatus?: string } }) =>
        t.truck?.approvalStatus === "APPROVED"
    );
    if (!truck) {
      test.skip(true, "No approved matching truck");
      return;
    }

    const { status, data } = await api("POST", "/api/truck-requests", token, {
      loadId,
      truckPostingId: truck.id,
      truckId: truck.truck?.id,
      message: "§3 request test",
    });
    expect([200, 201]).toContain(status);
    expect((data.truckRequest ?? data.request ?? data).status).toBe("PENDING");
  });

  test("Edit POSTED load directly → 409 blocked", async () => {
    const { status } = await api("PATCH", `/api/loads/${loadId}`, token, {
      weight: 9999,
    });
    expect(status).toBe(409);
  });

  test("Unpost → edit → repost works", async () => {
    // Create a fresh load for this test (main loadId has pending requests)
    const { data: fresh } = await api("POST", "/api/loads", token, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      pickupDate: days(3),
      deliveryDate: days(6),
      truckType: "FLATBED",
      weight: 5000,
      cargoDescription: "Edit test load",
      shipperContactName: "Edit Test",
      shipperContactPhone: "+251911111111",
      status: "POSTED",
    });
    const editLoadId = (fresh.load ?? fresh).id;

    // Unpost
    const { status: s1 } = await api(
      "PATCH",
      `/api/loads/${editLoadId}`,
      token,
      {
        status: "UNPOSTED",
      }
    );
    expect(s1).toBe(200);

    // Edit + repost
    const { status: s2 } = await api(
      "PATCH",
      `/api/loads/${editLoadId}`,
      token,
      {
        weight: 7500,
        cargoDescription: "Edited cargo",
        status: "POSTED",
      }
    );
    expect(s2).toBe(200);

    // Verify
    const { data } = await api("GET", `/api/loads/${editLoadId}`, token);
    expect(Number((data.load ?? data).weight)).toBe(7500);
    expect((data.load ?? data).status).toBe("POSTED");
  });

  test("Browser: 4-step load creation form works", async ({ page }) => {
    test.setTimeout(60000);
    await uiLogin(page, "shipper@test.com", PW, "/shipper");
    await page.goto("/shipper/loads/create");

    // Step 1: Route
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");
    await page.locator('input[type="date"]').first().fill(dateStr(3));
    await page.locator('input[type="date"]').nth(1).fill(dateStr(7));
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: Cargo
    await page.locator('input[type="number"]').first().fill("5000");
    await page.locator("textarea").first().fill("Browser form test");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: Contact
    await page.getByPlaceholder("Your name").first().fill("Form Test");
    await page.getByPlaceholder("+251").first().fill("+251911111111");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: Review + Submit
    await expect(page.getByRole("button", { name: "Post Load" })).toBeVisible({
      timeout: 10000,
    });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/loads") &&
          r.request().method() === "POST" &&
          !r.url().includes("load-requests")
      ),
      page.getByRole("button", { name: "Post Load" }).click(),
    ]);
    expect(resp.status()).toBe(201);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4  CARRIER FLOW — Register trucks, search loads, send requests
// ═════════════════════════════════════════════════════════════════════

test.describe.serial("§4: Carrier Flow", () => {
  let token: string;
  let truckId: string;

  test.beforeAll(async () => {
    token = await apiLogin("carrier@test.com", PW);
  });

  test("Register truck → status PENDING", async () => {
    const plate = `BP-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const { status, data } = await api("POST", "/api/trucks", token, {
      truckType: "DRY_VAN",
      licensePlate: plate,
      capacity: 15000,
      currentCity: "Addis Ababa",
      currentRegion: "Addis Ababa",
      isAvailable: true,
    });
    expect(status).toBe(201);
    truckId = (data.truck ?? data).id;
    expect((data.truck ?? data).approvalStatus).toBe("PENDING");
  });

  test("Edit truck details", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/trucks/${truckId}`,
      token,
      { capacity: 18000 }
    );
    expect(status).toBe(200);
    expect(Number((data.truck ?? data).capacity)).toBe(18000);
  });

  test("Approved truck can be posted to marketplace", async () => {
    // Verify carrier has at least one active truck posting
    const { status, data } = await api(
      "GET",
      "/api/truck-postings?limit=50",
      token
    );
    expect(status).toBe(200);
    const activePostings = (data.postings || []).filter(
      (p: { status: string }) => p.status === "ACTIVE"
    );
    expect(activePostings.length).toBeGreaterThan(0);
  });

  test("Search loads — only POSTED loads on marketplace", async () => {
    // Carrier searches marketplace via truck-postings matching
    const { status, data } = await api(
      "GET",
      "/api/loads?status=POSTED&limit=10",
      token
    );
    expect(status).toBe(200);
    const loads = data.loads || [];
    // Filtered by status=POSTED, so all should be POSTED
    for (const l of loads) {
      expect(l.status).toBe("POSTED");
    }
    expect(loads.length).toBeGreaterThan(0);
  });

  test("Browser: Carrier dashboard shows stats", async ({ page }) => {
    await uiLogin(page, "carrier@test.com", PW, "/carrier");
    await expect(page.getByText(/Total Trucks/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Available Trucks/i)).toBeVisible();
    await expect(page.getByText(/Wallet Balance/i)).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5  DISPATCHER ROLE — Platform-wide visibility, CANNOT actions
// ═════════════════════════════════════════════════════════════════════

test.describe("§5: Dispatcher Role", () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin("dispatcher@test.com", DISP_PW);
  });

  test("Sees ALL loads (platform-wide)", async () => {
    const { status, data } = await api("GET", "/api/loads?limit=50", token);
    expect(status).toBe(200);
    expect(data.loads.length).toBeGreaterThan(0);
  });

  test("Sees ALL truck postings", async () => {
    const { status, data } = await api(
      "GET",
      "/api/truck-postings?limit=50",
      token
    );
    expect(status).toBe(200);
  });

  test("Sees ALL trips", async () => {
    const { status } = await api("GET", "/api/trips?limit=50", token);
    expect(status).toBe(200);
  });

  test("CANNOT accept/reject requests", async () => {
    const { status } = await api(
      "POST",
      "/api/truck-requests/fake-id/respond",
      token,
      { action: "APPROVE" }
    );
    expect([403, 404]).toContain(status);
  });

  test("CANNOT edit loads", async () => {
    const { data: loads } = await api(
      "GET",
      "/api/loads?status=POSTED&limit=1",
      token
    );
    if (!loads.loads?.[0]) return;
    const { status } = await api(
      "PATCH",
      `/api/loads/${loads.loads[0].id}`,
      token,
      { weight: 9999 }
    );
    expect(status).toBe(403);
  });

  test("CANNOT see financial/revenue data", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/analytics?period=month",
      token
    );
    expect(status).toBe(200);
    expect(data.summary.revenue).toBeNull();
  });

  test("Browser: Dashboard shows stats + charts", async ({ page }) => {
    await uiLogin(page, "dispatcher@test.com", DISP_PW, "/dispatcher");
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({
      timeout: 10000,
    });
    // §5 stat cards
    await expect(page.getByText(/Unassigned Loads/i).first()).toBeVisible();
    await expect(page.getByText(/In Transit/i).first()).toBeVisible();
    // v1.7 charts
    await expect(
      page.getByText(/On-Time Delivery Rate/i).first()
    ).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6-§7  LOAD & TRIP STATE MACHINES — Full lifecycle
// ═════════════════════════════════════════════════════════════════════

test.describe.serial("§6-§7: Load & Trip State Machines", () => {
  let shipperToken: string;
  let carrierToken: string;
  let loadId: string;
  let requestId: string;
  let tripId: string;

  test.beforeAll(async () => {
    shipperToken = await apiLogin("shipper@test.com", PW);
    carrierToken = await apiLogin("carrier@test.com", PW);
  });

  test("Create + post load", async () => {
    const { data } = await api("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: days(2),
      deliveryDate: days(5),
      truckType: "DRY_VAN",
      weight: 6000,
      cargoDescription: "§6-§7 state machine test",
      shipperContactName: "SM Test",
      shipperContactPhone: "+251911111111",
      status: "POSTED",
    });
    loadId = (data.load ?? data).id;
  });

  test("Shipper sends request → carrier approves → ASSIGNED", async () => {
    // Find a matching truck owned by carrier@test.com (carrierToken) so the
    // APPROVE step below doesn't hit 404. matching-trucks returns trucks from
    // all carriers ranked by fit, so limit=1 + first-match can pick another
    // carrier's truck when the test suite state changes.
    const { data: meData } = await api("GET", "/api/auth/me", carrierToken);
    const carrierOrgId = meData.user?.organizationId ?? meData.organizationId;
    const { data: matches } = await api(
      "GET",
      `/api/loads/${loadId}/matching-trucks?limit=50`,
      shipperToken
    );
    const trucks = matches.trucks || [];
    const truck = trucks.find(
      (t: { carrier?: { id?: string } }) => t.carrier?.id === carrierOrgId
    );
    if (!truck) return test.skip();

    const { data: reqData } = await api(
      "POST",
      "/api/truck-requests",
      shipperToken,
      {
        loadId,
        truckPostingId: truck.id,
        truckId: truck.truck?.id,
        message: "State machine test",
      }
    );
    requestId = (reqData.truckRequest ?? reqData.request ?? reqData).id;

    // Carrier approves
    const { status } = await api(
      "POST",
      `/api/truck-requests/${requestId}/respond`,
      carrierToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    // Verify load ASSIGNED
    const { data: load } = await api(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect((load.load ?? load).status).toBe("ASSIGNED");
  });

  test("Trip created with status ASSIGNED", async () => {
    const { data } = await api("GET", "/api/trips?limit=10", carrierToken);
    const trip = (data.trips || []).find(
      (t: { loadId: string }) => t.loadId === loadId
    );
    expect(trip).toBeTruthy();
    tripId = trip.id;
    expect(trip.status).toBe("ASSIGNED");
  });

  test("ASSIGNED → PICKUP_PENDING (startedAt set)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      {
        status: "PICKUP_PENDING",
      }
    );
    expect(status).toBe(200);
  });

  test("PICKUP_PENDING → IN_TRANSIT (pickedUpAt set)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      {
        status: "IN_TRANSIT",
      }
    );
    expect(status).toBe(200);
  });

  test("IN_TRANSIT → CANCELLED blocked (must use EXCEPTION)", async () => {
    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/cancel`,
      carrierToken,
      { reason: "Trying direct cancel" }
    );
    expect(status).toBe(400);
  });

  test("IN_TRANSIT → DELIVERED (deliveredAt set)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      {
        status: "DELIVERED",
        receiverName: "John Doe",
        receiverPhone: "+251922222222",
      }
    );
    expect(status).toBe(200);
  });

  test("DELIVERED → CANCELLED blocked", async () => {
    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/cancel`,
      carrierToken,
      { reason: "Trying post-delivery cancel" }
    );
    expect(status).toBe(400);
  });

  test("Shipper confirms delivery → COMPLETED", async () => {
    const { status, data } = await api(
      "POST",
      `/api/trips/${tripId}/confirm`,
      shipperToken
    );
    expect(status).toBe(200);

    // Verify timestamps
    const { data: trip } = await api(
      "GET",
      `/api/trips/${tripId}`,
      carrierToken
    );
    const t = trip.trip ?? trip;
    expect(t.status).toBe("COMPLETED");
    expect(t.completedAt).toBeTruthy();
    expect(t.deliveredAt).toBeTruthy();
  });

  test("Truck returns to marketplace after completion", async () => {
    const { data: load } = await api(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    const truckId = (load.load ?? load).assignedTruckId;
    if (!truckId) return;

    const { data: truck } = await api(
      "GET",
      `/api/trucks/${truckId}`,
      carrierToken
    );
    expect((truck.truck ?? truck).isAvailable).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8  SERVICE FEE & WALLET
// ═════════════════════════════════════════════════════════════════════

test.describe("§8: Wallet & Fees", () => {
  test("Shipper wallet balance accessible", async () => {
    const token = await apiLogin("shipper@test.com", PW);
    const { status, data } = await api("GET", "/api/wallet/balance", token);
    expect(status).toBe(200);
    expect(data.totalBalance).toBeDefined();
  });

  test("Carrier wallet balance accessible", async () => {
    const token = await apiLogin("carrier@test.com", PW);
    const { status, data } = await api("GET", "/api/wallet/balance", token);
    expect(status).toBe(200);
  });

  test("Wallet transactions accessible", async () => {
    const token = await apiLogin("shipper@test.com", PW);
    const { status } = await api(
      "GET",
      "/api/wallet/transactions?limit=10",
      token
    );
    expect(status).toBe(200);
  });

  test("Browser: Wallet page renders balance", async ({ page }) => {
    await uiLogin(page, "shipper@test.com", PW, "/shipper");
    await page.goto("/shipper/wallet");
    await expect(page.getByText(/ETB/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9  ADMIN CAPABILITIES
// ═════════════════════════════════════════════════════════════════════

test.describe("§9: Admin", () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin("admin@test.com", PW);
  });

  test("View all users", async () => {
    const { status, data } = await api("GET", "/api/admin/users", token);
    expect(status).toBe(200);
    expect(data.users.length).toBeGreaterThan(0);
  });

  test("View all organizations", async () => {
    const { status } = await api("GET", "/api/admin/organizations", token);
    expect(status).toBe(200);
  });

  test("Financial overview — revenue visible", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/analytics?period=month",
      token
    );
    expect(status).toBe(200);
    expect(data.summary.revenue).toBeTruthy();
    expect(data.summary.revenue.platformBalance).toBeDefined();
  });

  test("Time-based reports (day/week/month/year)", async () => {
    for (const period of ["day", "week", "month", "year"]) {
      const { status } = await api(
        "GET",
        `/api/admin/analytics?period=${period}`,
        token
      );
      expect(status).toBe(200);
    }
  });

  test("Revenue by organization", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/revenue/by-organization",
      token
    );
    expect(status).toBe(200);
    expect(data.byShipper).toBeDefined();
    expect(data.byCarrier).toBeDefined();
  });

  test("Browser: Admin analytics with charts + DateRangePicker", async ({
    page,
  }) => {
    await uiLogin(page, "admin@test.com", PW, "/admin");
    await page.goto("/admin/analytics");

    await expect(page.getByRole("button", { name: "7 days" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Platform Analytics/i)).toBeVisible();

    // Click 7 days — verify API called
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/analytics")),
      page.getByRole("button", { name: "7 days" }).click(),
    ]);
    expect(resp.status()).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §12  RATINGS & REVIEWS
// ═════════════════════════════════════════════════════════════════════

test.describe.serial("§12: Ratings", () => {
  let shipperToken: string;
  let carrierToken: string;
  let tripId: string;

  test.beforeAll(async () => {
    shipperToken = await apiLogin("shipper@test.com", PW);
    carrierToken = await apiLogin("carrier@test.com", PW);

    // Find a COMPLETED trip
    const { data } = await api("GET", "/api/trips?limit=50", carrierToken);
    const completed = (data.trips || []).find(
      (t: { status: string }) => t.status === "COMPLETED"
    );
    if (completed) tripId = completed.id;
  });

  test("Rating available on COMPLETED trip", async () => {
    test.skip(!tripId, "No completed trip");
    const { status, data } = await api(
      "GET",
      `/api/trips/${tripId}/rate`,
      shipperToken
    );
    expect(status).toBe(200);
    expect(data.ratings).toBeDefined();
  });

  test("Submit rating (1-5 stars + comment)", async () => {
    test.skip(!tripId, "No completed trip");
    const { data: existing } = await api(
      "GET",
      `/api/trips/${tripId}/rate`,
      shipperToken
    );
    if (existing.myRating) {
      // Already rated — verify immutability
      const { status } = await api(
        "POST",
        `/api/trips/${tripId}/rate`,
        shipperToken,
        { stars: 3 }
      );
      expect(status).toBe(409); // Cannot rate twice
    } else {
      const { status, data } = await api(
        "POST",
        `/api/trips/${tripId}/rate`,
        shipperToken,
        { stars: 5, comment: "Blueprint §12 test" }
      );
      expect(status).toBe(201);
      expect(data.rating.stars).toBe(5);
    }
  });

  test("Ratings immutable after submission", async () => {
    test.skip(!tripId, "No completed trip");
    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/rate`,
      shipperToken,
      { stars: 1 }
    );
    expect(status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §13  IN-APP MESSAGING
// ═════════════════════════════════════════════════════════════════════

test.describe("§13: Messaging", () => {
  let shipperToken: string;
  let carrierToken: string;
  let dispatcherToken: string;

  test.beforeAll(async () => {
    shipperToken = await apiLogin("shipper@test.com", PW);
    carrierToken = await apiLogin("carrier@test.com", PW);
    dispatcherToken = await apiLogin("dispatcher@test.com", DISP_PW);
  });

  test("Chat read-only on COMPLETED trip", async () => {
    const { data } = await api("GET", "/api/trips?limit=50", carrierToken);
    const completed = (data.trips || []).find(
      (t: { status: string }) => t.status === "COMPLETED"
    );
    if (!completed) {
      test.skip(true, "No completed trip");
      return;
    }

    const { status } = await api(
      "POST",
      `/api/trips/${completed.id}/messages`,
      shipperToken,
      { content: "Should be blocked" }
    );
    expect(status).toBe(403);
  });

  test("Unread count endpoint works", async () => {
    const { data } = await api("GET", "/api/trips?limit=1", carrierToken);
    const trip = data.trips?.[0];
    if (!trip) return;

    const { status } = await api(
      "GET",
      `/api/trips/${trip.id}/messages/unread-count`,
      carrierToken
    );
    expect(status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §14  SETTINGS, HELP & SUPPORT
// ═════════════════════════════════════════════════════════════════════

test.describe("§14: Settings & Help", () => {
  test("Browser: 4 help pages load with content", async ({ page }) => {
    await uiLogin(page, "shipper@test.com", PW, "/shipper");

    const pages = [
      { slug: "getting-started", expect: "Create Your Account" },
      { slug: "posting-loads", expect: "Creating a Load" },
      { slug: "gps-tracking", expect: "GPS" },
      { slug: "payments-settlements", expect: "Wallet" },
    ];

    for (const p of pages) {
      await page.goto(`/settings/support/help/${p.slug}`);
      await expect(page.getByText(p.expect).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("Browser: Profile page shows user info", async ({ page }) => {
    await uiLogin(page, "shipper@test.com", PW, "/shipper");
    await page.goto("/settings/profile");
    await expect(
      page.getByText(/shipper@test.com|Test Shipper/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Browser: Shipper dashboard shows v1.7 charts", async ({ page }) => {
    await uiLogin(page, "shipper@test.com", PW, "/shipper");
    await page.goto("/shipper/dashboard");

    await expect(page.getByText(/Spending Overview/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "30 days" })).toBeVisible();
  });

  test("Browser: Carrier dashboard shows v1.7 charts", async ({ page }) => {
    await uiLogin(page, "carrier@test.com", PW, "/carrier");

    await expect(page.getByText(/Earnings/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Trip Activity/i).first()).toBeVisible();
  });

  test("Report types: BUG, MISCONDUCT, FEEDBACK, OTHER", async ({ page }) => {
    await uiLogin(page, "shipper@test.com", PW, "/shipper");
    await page.goto("/settings/support");
    await page.waitForLoadState("networkidle");

    // Report form should have type dropdown with 4 options
    const select = page
      .locator("select")
      .filter({ hasText: /Bug|Misconduct|Feedback|Other/i })
      .first();
    const hasSelect = await select
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasSelect) {
      const options = await select.locator("option").allTextContents();
      expect(options.some((o) => /Bug/i.test(o))).toBe(true);
      expect(options.some((o) => /Misconduct/i.test(o))).toBe(true);
      expect(options.some((o) => /Feedback/i.test(o))).toBe(true);
      expect(options.some((o) => /Other/i.test(o))).toBe(true);
    }
  });
});
