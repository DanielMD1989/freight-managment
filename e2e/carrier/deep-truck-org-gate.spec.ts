/**
 * Deep Truck Org-Gate E2E Tests — Carrier Portal
 *
 * Tests the browser-visible behaviour of the POST /api/trucks org-gate:
 *   - Describe A: Fresh PENDING org → API returns 403 from browser context.
 *                 Admin approves org → submission succeeds + redirect to pending tab.
 *   - Describe B: Seeded APPROVED carrier (carrier@test.com) happy path.
 *
 * Cross-test state (email, password, orgId) is persisted via a temp JSON file
 * in e2e/.auth/ because Playwright re-evaluates the module for each test in a
 * test.use() describe block (module-level `let` vars are not shared across tests
 * within that describe when storageState is overridden).
 */

import fs from "fs";
import path from "path";
import { test, expect, Page } from "@playwright/test";
import { apiCall, getAdminToken, expectHeading, BASE_URL } from "./test-utils";

// ── Cross-test state file ────────────────────────────────────────────────────

const STATE_FILE = path.join(__dirname, "../.auth/org-gate-state.json");

interface GateState {
  email: string;
  password: string;
  orgId: string;
}

function saveGateState(s: GateState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s), "utf-8");
}

function loadGateState(): GateState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { email: "", password: "", orgId: "" };
  }
}

const ts = Date.now();

// ── Helper: browser login ────────────────────────────────────────────────────

async function browserLogin(
  page: Page,
  email: string,
  password: string,
  expectedUrlGlob: string
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Handle rate-limit banner — wait and retry once
  const isRateLimited = await page
    .getByText(/Too many login attempts/i)
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (isRateLimited) {
    await page.waitForTimeout(35000);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  await page.waitForURL(expectedUrlGlob, { timeout: 20000 });
}

// ── Helper: make a truck API call from the browser context ───────────────────
//
// Using page.evaluate() ensures:
//   - The browser's session cookies are automatically included
//   - The CSRF token is fetched from the live app (same origin)
//   - No React form state race conditions

async function postTruckFromBrowserContext(
  page: Page,
  plate: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  return page.evaluate(async (licensePlate: string) => {
    // Fetch the CSRF token from the app (same-origin, cookies included)
    const csrfRes = await fetch("/api/csrf-token", {
      credentials: "include",
    });
    const csrfData = await csrfRes.json().catch(() => ({}));
    const csrfToken =
      (csrfData as Record<string, string>).csrfToken ||
      (csrfData as Record<string, string>).token ||
      "";

    const res = await fetch("/api/trucks", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: JSON.stringify({
        truckType: "FLATBED",
        licensePlate: licensePlate,
        capacity: 10000,
        isAvailable: true,
      }),
    });

    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }, plate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Describe A — PENDING org blocks truck creation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Org gate — PENDING org blocks truck creation", () => {
  // Override the baked carrier.json auth state; tests handle login inline
  test.use({ storageState: { cookies: [], origins: [] } });

  test("B-TRK-ORG-1 — Register fresh carrier; admin activates user (org stays PENDING)", async () => {
    test.setTimeout(30000);

    const email = `carrier.gate.${ts}@example.com`;
    const password = "Test123!";

    // Register
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-type": "mobile",
      },
      body: JSON.stringify({
        email,
        password,
        firstName: "Gate",
        lastName: "Tester",
        role: "CARRIER",
        companyName: `GateCo ${ts}`,
        carrierType: "CARRIER_COMPANY",
      }),
    });
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();

    const freshUserId = regData.user?.id ?? "";
    const orgId = regData.user?.organizationId ?? regData.organizationId ?? "";

    expect(freshUserId).toBeTruthy();
    expect(orgId).toBeTruthy();

    // Persist state for subsequent tests
    saveGateState({ email, password, orgId });

    // Admin activates user → ACTIVE (org intentionally stays PENDING)
    const adminToken = await getAdminToken();
    const activateRes = await apiCall(
      "POST",
      `/api/admin/users/${freshUserId}/verify`,
      adminToken,
      { status: "ACTIVE" }
    );
    expect(activateRes.status).toBe(200);
  });

  test("B-TRK-ORG-2 — Browser context: POST /api/trucks returns 403 (PENDING gate)", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const { email, password, orgId } = loadGateState();
    expect(email).toBeTruthy();
    expect(orgId).toBeTruthy();

    // Browser login as the fresh PENDING-org carrier
    await browserLogin(page, email, password, "**/carrier**");

    // Navigate to the truck add page (page should be accessible)
    await page.goto("/carrier/trucks/add");
    await expectHeading(page, /Register New Truck/);

    // Make the API call from the browser context — cookies auto-included
    const plate = `GATE-${ts.toString(36).slice(-6).toUpperCase()}`;
    const { status, body } = await postTruckFromBrowserContext(page, plate);

    // Org gate must block the request
    expect(status).toBe(403);
    expect((body as { error?: string }).error).toMatch(/approved by an admin/i);

    // Page must still show the add form (no redirect on gate block)
    expect(page.url()).toContain("/carrier/trucks/add");
  });

  test("B-TRK-ORG-3 — Admin approves org → POST /api/trucks returns 201 (gate open)", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const { email, password, orgId } = loadGateState();
    expect(email).toBeTruthy();
    expect(orgId).toBeTruthy();

    // Admin approves the org via API
    const adminToken = await getAdminToken();
    const approveRes = await apiCall(
      "POST",
      `/api/admin/organizations/${orgId}/verify`,
      adminToken
      // route reads only URL param — no body needed
    );
    // Accept 200 (approved) or 400 (already verified — when test is re-run)
    expect([200, 400]).toContain(approveRes.status);

    // Browser login with now-approved org
    await browserLogin(page, email, password, "**/carrier**");

    // Navigate to add form (page must be accessible)
    await page.goto("/carrier/trucks/add");
    await expectHeading(page, /Register New Truck/);

    // Gate is now open — browser-context API call must return 201
    const plate = `GATE2-${ts.toString(36).slice(-5).toUpperCase()}`;
    const { status: gateStatus, body: gateBody } =
      await postTruckFromBrowserContext(page, plate);
    expect(gateStatus).toBe(201);
    expect(
      (gateBody as { truck?: { licensePlate?: string } }).truck?.licensePlate
    ).toBe(plate);

    // Navigate to trucks list and verify the pending tab is present
    await page.goto("/carrier/trucks");
    await expect(page.getByText(/pending/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Describe B — APPROVED carrier (carrier@test.com) happy path
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Org gate — APPROVED carrier (seeded) happy path", () => {
  // Uses default carrier.json storage state (APPROVED org)
  let approvedPlate = "";

  test("B-TRK-ORG-4 — APPROVED carrier: browser-context truck creation returns 201", async ({
    page,
  }) => {
    test.setTimeout(30000);

    approvedPlate = `APPR-${ts.toString(36).slice(-4).toUpperCase()}`;

    await page.goto("/carrier/trucks/add");
    await expectHeading(page, /Register New Truck/);

    // Confirm gate is open for APPROVED carrier via direct browser-context call
    const { status, body } = await postTruckFromBrowserContext(
      page,
      approvedPlate
    );
    expect(status).toBe(201);
    expect(
      (body as { truck?: { licensePlate?: string } }).truck?.licensePlate
    ).toBe(approvedPlate);

    // Navigate to trucks pending tab to confirm the truck was created
    await page.goto(`/carrier/trucks?tab=pending`);
    await expect(page.getByText(/pending/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("B-TRK-ORG-5 — Newly created truck appears in Pending tab", async ({
    page,
  }) => {
    test.setTimeout(30000);

    await page.goto("/carrier/trucks");

    // Click Pending tab (try role-based selectors first)
    const pendingTab = page.getByRole("tab", { name: /pending/i }).first();
    const pendingBtn = page.getByRole("button", { name: /pending/i }).first();

    if (await pendingTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pendingTab.click();
    } else if (
      await pendingBtn.isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await pendingBtn.click();
    } else {
      await page
        .getByText(/^pending$/i)
        .first()
        .click();
    }

    // The plate from B-TRK-ORG-4 should be visible
    if (approvedPlate) {
      await expect(page.getByText(approvedPlate).first()).toBeVisible({
        timeout: 10000,
      });
    } else {
      await expect(page.getByText(/pending/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("B-TRK-ORG-6 — Trucks list renders Approved / Pending / Rejected tabs", async ({
    page,
  }) => {
    test.setTimeout(30000);

    await page.goto("/carrier/trucks");
    await expectHeading(page, /Trucks|Fleet/i);

    // All three tab labels must be present
    await expect(page.getByText(/approved/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/pending/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/rejected/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Click Rejected tab
    const rejectedTab = page.getByRole("tab", { name: /rejected/i }).first();
    const rejectedBtn = page.getByRole("button", { name: /rejected/i }).first();

    if (await rejectedTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejectedTab.click();
    } else if (
      await rejectedBtn.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await rejectedBtn.click();
    }

    // After click — either empty-state message or rejected trucks appear
    const emptyOrList = await Promise.race([
      page
        .getByText(/no rejected|no trucks|empty/i)
        .first()
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByText(/rejected/i)
        .nth(1)
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false),
    ]);
    expect(emptyOrList).toBe(true);
  });
});
