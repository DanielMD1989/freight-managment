/**
 * Blueprint §9 (P1 gap) — Role-based access control on financial admin endpoints
 *
 * Non-admin roles (DISPATCHER, SHIPPER, CARRIER) must receive 403 when
 * accessing admin-only financial endpoints. These endpoints hold sensitive
 * platform revenue data that only ADMIN / SUPER_ADMIN may see.
 *
 * Endpoints under test:
 *   GET /api/admin/revenue/by-organization
 *   GET /api/admin/service-fees/metrics
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getDispatcherToken,
  getShipperToken,
  getCarrierToken,
  getAdminToken,
} from "../shared/test-utils";

// ── Helper ───────────────────────────────────────────────────────────────────

async function assert403(
  method: "GET" | "POST",
  path: string,
  token: string,
  label: string
) {
  const { status } = await apiCall(method, path, token);
  expect(status, `Expected 403 for ${label} on ${path} but got ${status}`).toBe(
    403
  );
}

// ── DISPATCHER access denials ─────────────────────────────────────────────────

test.describe("Dispatcher — blocked from financial admin endpoints", () => {
  test("dispatcher GET /api/admin/revenue/by-organization returns 403", async () => {
    test.setTimeout(60000);
    const dispatcherToken = await getDispatcherToken();
    await assert403(
      "GET",
      "/api/admin/revenue/by-organization",
      dispatcherToken,
      "dispatcher"
    );
  });

  test("dispatcher GET /api/admin/service-fees/metrics returns 403", async () => {
    test.setTimeout(60000);
    const dispatcherToken = await getDispatcherToken();
    await assert403(
      "GET",
      "/api/admin/service-fees/metrics",
      dispatcherToken,
      "dispatcher"
    );
  });
});

// ── SHIPPER access denials ───────────────────────────────────────────────────

test.describe("Shipper — blocked from financial admin endpoints", () => {
  test("shipper GET /api/admin/revenue/by-organization returns 403", async () => {
    test.setTimeout(60000);
    const shipperToken = await getShipperToken();
    await assert403(
      "GET",
      "/api/admin/revenue/by-organization",
      shipperToken,
      "shipper"
    );
  });

  test("shipper GET /api/admin/service-fees/metrics returns 403", async () => {
    test.setTimeout(60000);
    const shipperToken = await getShipperToken();
    await assert403(
      "GET",
      "/api/admin/service-fees/metrics",
      shipperToken,
      "shipper"
    );
  });
});

// ── CARRIER access denials ───────────────────────────────────────────────────

test.describe("Carrier — blocked from financial admin endpoints", () => {
  test("carrier GET /api/admin/revenue/by-organization returns 403", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();
    await assert403(
      "GET",
      "/api/admin/revenue/by-organization",
      carrierToken,
      "carrier"
    );
  });

  test("carrier GET /api/admin/service-fees/metrics returns 403", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();
    await assert403(
      "GET",
      "/api/admin/service-fees/metrics",
      carrierToken,
      "carrier"
    );
  });
});

// ── ADMIN still has access (sanity check) ────────────────────────────────────

test.describe("Admin — still has access to financial endpoints", () => {
  test("admin GET /api/admin/revenue/by-organization returns 200", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();
    const { status } = await apiCall(
      "GET",
      "/api/admin/revenue/by-organization",
      adminToken
    );
    expect(status).toBe(200);
  });

  test("admin GET /api/admin/service-fees/metrics returns 200", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();
    const { status } = await apiCall(
      "GET",
      "/api/admin/service-fees/metrics",
      adminToken
    );
    expect(status).toBe(200);
  });
});
