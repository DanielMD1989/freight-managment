/**
 * Deep Cross-Domain Parity — Admin (and Super Admin)
 *
 * Mirror of e2e/carrier/deep-shipper-parity.spec.ts and
 * e2e/shipper/deep-carrier-parity.spec.ts in the admin direction.
 *
 * Verifies every cross-cutting fix from the recent sprint also holds for
 * admin and super-admin sessions, plus admin-specific contracts (revenue
 * visibility, wallet deposit approval queue, write access to any load).
 *
 * Real DB, real Chromium, real auth. No mocks.
 */

import { test, expect } from "@playwright/test";
import { apiCall, getToken, getAdminToken } from "./test-utils";

let adminToken: string;
let superToken: string;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    adminToken = await getAdminToken();
  } catch {
    /* tests skip */
  }
  try {
    superToken = await getToken("superadmin@test.com");
  } catch {
    /* super admin tests skip */
  }
});

// Helper: create a fresh DRAFT load via the shipper account so we have a
// stable target for admin PATCH parity tests. We use the shipper because
// admin doesn't own loads — admin acts ON loads.
async function createDraftLoadAsShipper(): Promise<string | undefined> {
  let shipperToken: string;
  try {
    shipperToken = await getToken("shipper@test.com");
  } catch {
    return undefined;
  }
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString();
  const res = await apiCall<{ load?: { id: string }; id?: string }>(
    "POST",
    "/api/loads",
    shipperToken,
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow,
      deliveryDate: dayAfter,
      truckType: "DRY_VAN",
      weight: 1000,
      cargoDescription: "Admin parity test load",
      fullPartial: "FULL",
      shipperContactName: "Parity",
      shipperContactPhone: "+251911234567",
      saveAsDraft: true,
    }
  );
  return res.data.load?.id ?? res.data.id;
}

// ─── Universal endpoints reachable from admin ───────────────────────────────
test.describe("PARITY Admin: universal endpoints reachable", () => {
  test("AD-1 — POST /api/auth/login returns csrfToken for admin (commit 222d960)", async ({
    request,
  }) => {
    const res = await request.post("http://localhost:3000/api/auth/login", {
      data: { email: "admin@test.com", password: "Test123!" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("csrfToken");
    expect(typeof body.csrfToken).toBe("string");
  });

  test("AD-2 — PATCH /api/user/profile rejects whitespace name (commit 061e71f)", async () => {
    test.skip(!adminToken, "no admin token");
    const res = await apiCall("PATCH", "/api/user/profile", adminToken, {
      firstName: "   ",
    });
    console.log(`admin PATCH whitespace → ${res.status}`);
    expect([400, 422]).toContain(res.status);
  });

  test("AD-3 — GET /api/notifications valid shape for admin (commit 7553c4f)", async () => {
    test.skip(!adminToken, "no admin token");
    const res = await apiCall<{ notifications?: unknown[] }>(
      "GET",
      "/api/notifications",
      adminToken
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.notifications)).toBe(true);
  });
});

// ─── Admin acting on shipper loads — phone + datetime parity ────────────────
test.describe("PARITY Admin: PATCH /api/loads/[id] inherits both shipper fixes", () => {
  test("AD-4 — admin PATCH rejects invalid shipperContactPhone (commit d013f75)", async () => {
    test.skip(!adminToken, "no admin token");
    const id = await createDraftLoadAsShipper();
    test.skip(!id, "could not create draft load");
    const res = await apiCall("PATCH", `/api/loads/${id}`, adminToken, {
      shipperContactPhone: "not-a-phone",
    });
    console.log(`admin PATCH bad phone → ${res.status}`);
    expect([400, 422]).toContain(res.status);
  });

  test("AD-5 — admin PATCH date-only pickupDate does NOT 500 (commit d013f75)", async () => {
    test.skip(!adminToken, "no admin token");
    const id = await createDraftLoadAsShipper();
    test.skip(!id, "could not create draft load");
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await apiCall("PATCH", `/api/loads/${id}`, adminToken, {
      pickupDate: tomorrow,
    });
    console.log(`admin PATCH date-only → ${res.status}`);
    expect([200, 400, 409]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

// ─── Admin acting on trucks — phone parity (commit d548be5) ─────────────────
test.describe("PARITY Admin: truck PATCH inherits phone fix", () => {
  test("AD-6 — admin PATCH /api/trucks/[id] rejects invalid contactPhone", async () => {
    test.skip(!adminToken, "no admin token");
    // Find any truck on the platform
    const list = await apiCall<{
      trucks?: Array<{ id: string }>;
    }>("GET", "/api/trucks?limit=1", adminToken);
    const truckId = list.data.trucks?.[0]?.id;
    test.skip(!truckId, "no truck found");
    const res = await apiCall("PATCH", `/api/trucks/${truckId}`, adminToken, {
      contactPhone: "not-a-phone",
    });
    console.log(`admin PATCH truck bad phone → ${res.status}`);
    expect([400, 422]).toContain(res.status);
  });
});

// ─── Wallet deposit approval queue (eb68304 + 8e6c6ac) ──────────────────────
test.describe("PARITY Admin: wallet deposits approval queue reachable", () => {
  test("AD-7 — GET /api/admin/wallet-deposits returns valid shape", async () => {
    test.skip(!adminToken, "no admin token");
    const res = await apiCall<{
      deposits?: unknown[];
      pagination?: unknown;
      pendingCount?: number;
    }>("GET", "/api/admin/wallet-deposits?status=PENDING", adminToken);
    console.log(`admin wallet-deposits → ${res.status}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.deposits)).toBe(true);
    expect(res.data).toHaveProperty("pendingCount");
  });
});

// ─── Revenue visibility — admin sees revenue, dispatcher does not ───────────
test.describe("PARITY Admin: financial visibility (Blueprint §10)", () => {
  test("AD-8 — GET /api/admin/analytics returns non-null revenue for ADMIN", async () => {
    test.skip(!adminToken, "no admin token");
    const res = await apiCall<{
      summary?: { revenue?: unknown };
    }>("GET", "/api/admin/analytics", adminToken);
    console.log(`admin analytics → ${res.status}`);
    if (res.status !== 200) {
      console.log("body:", JSON.stringify(res.data).slice(0, 200));
    }
    expect(res.status).toBe(200);
    // Blueprint §10: Admin/SuperAdmin sees revenue
    expect(res.data.summary?.revenue).not.toBeNull();
  });
});

// ─── Member removal endpoint reachable from admin ───────────────────────────
test.describe("PARITY Admin: team member removal endpoint (commit c1dc267)", () => {
  test("AD-9 — DELETE /api/organizations/members/[id] reachable from admin", async () => {
    test.skip(!adminToken, "no admin token");
    const res = await apiCall(
      "DELETE",
      "/api/organizations/members/nonexistent-id",
      adminToken
    );
    console.log(`admin DELETE member → ${res.status}`);
    // Admin doesn't belong to a shipper/carrier org so this hits org-mismatch
    // path. Acceptable: 400/403/404. Never 500.
    expect([400, 401, 403, 404]).toContain(res.status);
  });
});

// ─── SUPER ADMIN parity ─────────────────────────────────────────────────────
test.describe("PARITY Super Admin: extends admin (Blueprint §10)", () => {
  test("SA-1 — super admin login returns csrfToken", async ({ request }) => {
    test.skip(!superToken, "no super admin seed");
    const res = await request.post("http://localhost:3000/api/auth/login", {
      data: { email: "superadmin@test.com", password: "Test123!" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("csrfToken");
  });

  test("SA-2 — super admin GET /api/admin/analytics returns revenue", async () => {
    test.skip(!superToken, "no super admin seed");
    const res = await apiCall<{ summary?: { revenue?: unknown } }>(
      "GET",
      "/api/admin/analytics",
      superToken
    );
    console.log(`super-admin analytics → ${res.status}`);
    expect(res.status).toBe(200);
    expect(res.data.summary?.revenue).not.toBeNull();
  });

  test("SA-3 — super admin can list wallet-deposits", async () => {
    test.skip(!superToken, "no super admin seed");
    const res = await apiCall<{ deposits?: unknown[] }>(
      "GET",
      "/api/admin/wallet-deposits",
      superToken
    );
    console.log(`super-admin wallet-deposits → ${res.status}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.deposits)).toBe(true);
  });

  test("SA-4 — super admin profile whitespace trim", async () => {
    test.skip(!superToken, "no super admin seed");
    const res = await apiCall("PATCH", "/api/user/profile", superToken, {
      firstName: "   ",
    });
    expect([400, 422]).toContain(res.status);
  });

  test("SA-5 — super admin GET /api/notifications", async () => {
    test.skip(!superToken, "no super admin seed");
    const res = await apiCall<{ notifications?: unknown[] }>(
      "GET",
      "/api/notifications",
      superToken
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.notifications)).toBe(true);
  });
});
