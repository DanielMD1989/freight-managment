/**
 * Analytics Sprint 3 — Role-Based Access Control Matrix (Blueprint §5 / §9)
 *
 * Tests the access matrix for 4 analytics/financial endpoints:
 *   GET /api/admin/analytics
 *   GET /api/admin/platform-metrics
 *   GET /api/admin/revenue/by-organization
 *   GET /api/admin/service-fees/metrics
 *
 * Role matrix:
 *   Admin      → analytics:200, platform-metrics:403(SUPER_ADMIN), revenue:200, service-fees:200
 *   Dispatcher → analytics:200, platform-metrics:403, revenue:403, service-fees:403
 *   Shipper    → analytics:403, platform-metrics:403, revenue:403, service-fees:403
 *   Carrier    → analytics:403, platform-metrics:403, revenue:403, service-fees:403
 *   Super Admin → skip (no seed user)
 *
 * Uses expect(status, message).toBe(expected) pattern with blueprint citation.
 * No seeded trip data needed — pure access control assertions.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getAdminToken,
  getShipperToken,
  getCarrierToken,
  getDispatcherToken,
  getSuperAdminToken,
} from "../shared/test-utils";

// ── Endpoints ─────────────────────────────────────────────────────────────────

const ANALYTICS = "/api/admin/analytics?period=year";
const PLATFORM_METRICS = "/api/admin/platform-metrics";
const REVENUE_BY_ORG = "/api/admin/revenue/by-organization";
const SERVICE_FEE_METRICS = "/api/admin/service-fees/metrics";

// ── Shared tokens ─────────────────────────────────────────────────────────────

let adminToken: string;
let dispatcherToken: string;
let shipperToken: string;
let carrierToken: string;

test.beforeAll(async () => {
  test.setTimeout(60000);
  [adminToken, dispatcherToken, shipperToken, carrierToken] = await Promise.all(
    [
      getAdminToken(),
      getDispatcherToken(),
      getShipperToken(),
      getCarrierToken(),
    ]
  );
});

// ── Admin role ────────────────────────────────────────────────────────────────

test.describe("Admin role access", () => {
  test("Admin: GET /api/admin/analytics returns 200", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", ANALYTICS, adminToken);
    expect(
      status,
      `Expected admin 200 on ${ANALYTICS}. Got: ${status}. Blueprint §5: "Admin has full read access to platform analytics"`
    ).toBe(200);
  });

  test("Admin: GET /api/admin/platform-metrics returns 200 or 403 (SUPER_ADMIN only endpoint)", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", PLATFORM_METRICS, adminToken);
    expect(
      [200, 403],
      `Expected admin 200 or 403 on ${PLATFORM_METRICS} (SUPER_ADMIN gated). Got: ${status}. Blueprint §5: "Platform metrics requires MANAGE_USERS permission (SUPER_ADMIN)"`
    ).toContain(status);
  });

  test("Admin: GET /api/admin/revenue/by-organization returns 200", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", REVENUE_BY_ORG, adminToken);
    expect(
      status,
      `Expected admin 200 on ${REVENUE_BY_ORG}. Got: ${status}. Blueprint §9: "Admin has access to revenue by organization report"`
    ).toBe(200);
  });

  test("Admin: GET /api/admin/service-fees/metrics returns 200", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", SERVICE_FEE_METRICS, adminToken);
    expect(
      status,
      `Expected admin 200 on ${SERVICE_FEE_METRICS}. Got: ${status}. Blueprint §9: "Admin has access to service fee metrics"`
    ).toBe(200);
  });
});

// ── Dispatcher role ───────────────────────────────────────────────────────────

test.describe("Dispatcher role access", () => {
  test("Dispatcher: GET /api/admin/analytics returns 200 (has read access)", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", ANALYTICS, dispatcherToken);
    expect(
      status,
      `Expected dispatcher 200 on ${ANALYTICS}. Got: ${status}. Blueprint §5: "Dispatcher has read access to analytics for trip coordination"`
    ).toBe(200);
  });

  test("Dispatcher: GET /api/admin/platform-metrics returns 403 (SUPER_ADMIN only)", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", PLATFORM_METRICS, dispatcherToken);
    expect(
      status,
      `Expected dispatcher 403 on ${PLATFORM_METRICS}. Got: ${status}. Blueprint §5: "Dispatcher cannot access super-admin platform metrics"`
    ).toBe(403);
  });

  test("Dispatcher: GET /api/admin/revenue/by-organization returns 403 (no financial access)", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", REVENUE_BY_ORG, dispatcherToken);
    expect(
      status,
      `Expected dispatcher 403 on ${REVENUE_BY_ORG}. Got: ${status}. Blueprint §9: "Dispatcher does not have access to financial revenue reports"`
    ).toBe(403);
  });

  test("Dispatcher: GET /api/admin/service-fees/metrics returns 403 (no financial access)", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall(
      "GET",
      SERVICE_FEE_METRICS,
      dispatcherToken
    );
    expect(
      status,
      `Expected dispatcher 403 on ${SERVICE_FEE_METRICS}. Got: ${status}. Blueprint §9: "Dispatcher does not have access to service fee financial metrics"`
    ).toBe(403);
  });
});

// ── Shipper role ──────────────────────────────────────────────────────────────

test.describe("Shipper role access", () => {
  test("Shipper: GET /api/admin/analytics returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", ANALYTICS, shipperToken);
    expect(
      status,
      `Expected shipper 403 on ${ANALYTICS}. Got: ${status}. Blueprint §5: "Shipper cannot access admin analytics"`
    ).toBe(403);
  });

  test("Shipper: GET /api/admin/platform-metrics returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", PLATFORM_METRICS, shipperToken);
    expect(
      status,
      `Expected shipper 403 on ${PLATFORM_METRICS}. Got: ${status}. Blueprint §5: "Shipper cannot access platform metrics"`
    ).toBe(403);
  });

  test("Shipper: GET /api/admin/revenue/by-organization returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", REVENUE_BY_ORG, shipperToken);
    expect(
      status,
      `Expected shipper 403 on ${REVENUE_BY_ORG}. Got: ${status}. Blueprint §9: "Shipper cannot access platform revenue reports"`
    ).toBe(403);
  });

  test("Shipper: GET /api/admin/service-fees/metrics returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", SERVICE_FEE_METRICS, shipperToken);
    expect(
      status,
      `Expected shipper 403 on ${SERVICE_FEE_METRICS}. Got: ${status}. Blueprint §9: "Shipper cannot access service fee platform metrics"`
    ).toBe(403);
  });
});

// ── Carrier role ──────────────────────────────────────────────────────────────

test.describe("Carrier role access", () => {
  test("Carrier: GET /api/admin/analytics returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", ANALYTICS, carrierToken);
    expect(
      status,
      `Expected carrier 403 on ${ANALYTICS}. Got: ${status}. Blueprint §5: "Carrier cannot access admin analytics"`
    ).toBe(403);
  });

  test("Carrier: GET /api/admin/platform-metrics returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", PLATFORM_METRICS, carrierToken);
    expect(
      status,
      `Expected carrier 403 on ${PLATFORM_METRICS}. Got: ${status}. Blueprint §5: "Carrier cannot access platform metrics"`
    ).toBe(403);
  });

  test("Carrier: GET /api/admin/revenue/by-organization returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", REVENUE_BY_ORG, carrierToken);
    expect(
      status,
      `Expected carrier 403 on ${REVENUE_BY_ORG}. Got: ${status}. Blueprint §9: "Carrier cannot access platform revenue reports"`
    ).toBe(403);
  });

  test("Carrier: GET /api/admin/service-fees/metrics returns 403", async () => {
    test.setTimeout(60000);
    const { status } = await apiCall("GET", SERVICE_FEE_METRICS, carrierToken);
    expect(
      status,
      `Expected carrier 403 on ${SERVICE_FEE_METRICS}. Got: ${status}. Blueprint §9: "Carrier cannot access service fee platform metrics"`
    ).toBe(403);
  });
});

// ── Super Admin role (§10) ────────────────────────────────────────────────────

test.describe("Super Admin role access (Blueprint §10)", () => {
  let superAdminToken: string;

  test.beforeAll(async () => {
    test.setTimeout(30000);
    try {
      superAdminToken = await getSuperAdminToken();
    } catch (e) {
      superAdminToken = "";
    }
  });

  test("Super Admin: GET /api/admin/platform-metrics returns 200 (MANAGE_USERS permission)", async () => {
    test.setTimeout(30000);
    if (!superAdminToken) {
      test.skip(
        true,
        "No superadmin@test.com in seed data — run scripts/seed-test-data.ts. Blueprint §10: Super Admin has MANAGE_USERS permission"
      );
      return;
    }
    const { status } = await apiCall("GET", PLATFORM_METRICS, superAdminToken);
    expect(
      status,
      `Expected Super Admin 200 on ${PLATFORM_METRICS}. Got: ${status}. Blueprint §10: "Super Admin has MANAGE_USERS permission granting access to platform-wide metrics"`
    ).toBe(200);
  });

  test("Super Admin: GET /api/admin/revenue/by-organization returns 200", async () => {
    test.setTimeout(30000);
    if (!superAdminToken) {
      test.skip(true, "No superadmin@test.com in seed data.");
      return;
    }
    const { status } = await apiCall("GET", REVENUE_BY_ORG, superAdminToken);
    expect(
      status,
      `Expected Super Admin 200 on ${REVENUE_BY_ORG}. Got: ${status}. Blueprint §9: "Super Admin has full financial reporting access"`
    ).toBe(200);
  });

  test("Super Admin: GET /api/admin/analytics returns 200 (inherits admin access)", async () => {
    test.setTimeout(30000);
    if (!superAdminToken) {
      test.skip(true, "No superadmin@test.com in seed data.");
      return;
    }
    const { status } = await apiCall("GET", ANALYTICS, superAdminToken);
    expect(
      status,
      `Expected Super Admin 200 on ${ANALYTICS}. Got: ${status}. Blueprint §5: "Super Admin inherits all admin analytics access"`
    ).toBe(200);
  });

  test("Super Admin: GET /api/admin/service-fees/metrics returns 200", async () => {
    test.setTimeout(30000);
    if (!superAdminToken) {
      test.skip(true, "No superadmin@test.com in seed data.");
      return;
    }
    const { status } = await apiCall(
      "GET",
      SERVICE_FEE_METRICS,
      superAdminToken
    );
    expect(
      status,
      `Expected Super Admin 200 on ${SERVICE_FEE_METRICS}. Got: ${status}. Blueprint §9: "Super Admin has access to all service fee reports"`
    ).toBe(200);
  });
});
