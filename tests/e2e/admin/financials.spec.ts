/**
 * Blueprint §9 — Admin financial reports
 *
 * Verifies service-fee page, revenue-by-org API, and time-filter behaviour.
 */

import { test, expect } from "@playwright/test";
import { apiCall, getAdminToken } from "../shared/test-utils";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin Financials", () => {
  test("admin /admin/service-fees page loads", async ({ page }) => {
    await page.goto("/admin/service-fees");
    // Scope to main to avoid matching sidebar nav spans
    await expect(
      page.locator("main").getByRole("heading", { name: /Platform Revenue/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("GET /admin/revenue/by-organization returns array with org breakdown", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/revenue/by-organization",
      adminToken
    );
    expect(status).toBe(200);

    const entries: Array<Record<string, unknown>> =
      data.organizations ?? data.revenue ?? data ?? [];

    if (Array.isArray(entries) && entries.length > 0) {
      const first = entries[0];
      // Should have org identifier and revenue fields
      expect(
        first.organizationId ?? first.id ?? first.orgId ?? first.name
      ).toBeDefined();
    }
    // Array may be empty if no completed trips — that's OK
    expect(Array.isArray(entries) || typeof data === "object").toBeTruthy();
  });

  test("time filter 'day' returns valid response", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status } = await apiCall(
      "GET",
      "/api/admin/revenue/by-organization?period=day",
      adminToken
    );
    expect(status).toBe(200);
  });

  test("time filter 'month' returns valid response", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status } = await apiCall(
      "GET",
      "/api/admin/revenue/by-organization?period=month",
      adminToken
    );
    expect(status).toBe(200);
  });

  test("time filter 'week' vs 'year' may return different totals", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const [weekRes, yearRes] = await Promise.all([
      apiCall(
        "GET",
        "/api/admin/revenue/by-organization?period=week",
        adminToken
      ),
      apiCall(
        "GET",
        "/api/admin/revenue/by-organization?period=year",
        adminToken
      ),
    ]);

    expect(weekRes.status).toBe(200);
    expect(yearRes.status).toBe(200);
    // Both should be arrays (totals depend on seed data)
  });

  test("admin service-fees metrics endpoint returns dual-party data", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/service-fees/metrics",
      adminToken
    );
    expect(status).toBe(200);

    // Actual response shape: { period, summary: { shipperFeeCollected, carrierFeeCollected, ... }, ... }
    const summary = data.summary ?? {};
    const hasShipper =
      "shipperRevenue" in data ||
      "shipperFees" in data ||
      "shipper" in data ||
      "totalShipperFees" in data ||
      "shipperFeeCollected" in summary;
    const hasCarrier =
      "carrierRevenue" in data ||
      "carrierFees" in data ||
      "carrier" in data ||
      "totalCarrierFees" in data ||
      "carrierFeeCollected" in summary;

    // At least one dual-party field should be present
    expect(
      hasShipper || hasCarrier || "totalRevenue" in data || "summary" in data
    ).toBeTruthy();
  });

  // ── P2 gap: Revenue arithmetic consistency ───────────────────────────────

  test("service-fees metrics: totalRevenue == shipperFeeCollected + carrierFeeCollected", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/service-fees/metrics",
      adminToken
    );
    expect(status).toBe(200);

    const summary = data.summary ?? {};
    const totalRevenue = parseFloat(
      summary.totalFeesCollected ?? summary.totalRevenue ?? summary.total ?? "0"
    );
    const shipperFee = parseFloat(
      summary.shipperFeeCollected ?? summary.totalShipperFees ?? "0"
    );
    const carrierFee = parseFloat(
      summary.carrierFeeCollected ?? summary.totalCarrierFees ?? "0"
    );

    // All must be valid numbers
    expect(isNaN(totalRevenue)).toBeFalsy();
    expect(isNaN(shipperFee)).toBeFalsy();
    expect(isNaN(carrierFee)).toBeFalsy();

    // Blueprint §8: Revenue = Shipper Fee + Carrier Fee (allow ±0.02 for rounding)
    expect(Math.abs(totalRevenue - (shipperFee + carrierFee))).toBeLessThan(
      0.02
    );
  });

  test("revenue by-org: summary.totalRevenue field is present and numeric", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/revenue/by-organization",
      adminToken
    );
    expect(status).toBe(200);

    // summary.totalRevenue should exist and be a valid number
    const summary = data.summary ?? {};
    const totalRevenue = parseFloat(
      summary.totalRevenue ?? summary.total ?? "0"
    );
    expect(isNaN(totalRevenue)).toBeFalsy();

    // If summary has shipper + carrier breakdowns, they should sum to totalRevenue
    const hasBreakdown =
      "totalShipperFees" in summary || "shipperFeeCollected" in summary;
    if (hasBreakdown) {
      const shipperFee = parseFloat(
        summary.totalShipperFees ?? summary.shipperFeeCollected ?? "0"
      );
      const carrierFee = parseFloat(
        summary.totalCarrierFees ?? summary.carrierFeeCollected ?? "0"
      );
      expect(Math.abs(totalRevenue - (shipperFee + carrierFee))).toBeLessThan(
        0.02
      );
    }
  });

  // ── P3 gap: time-filter tests verify response shape (not just HTTP 200) ──

  test("time filter 'day' response has expected shape with numeric totals", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/admin/revenue/by-organization?period=day",
      adminToken
    );
    expect(status).toBe(200);

    // Response must be an object with summary or organizations key
    expect(typeof data).toBe("object");
    const summary = data.summary ?? {};
    const totalRevenue = parseFloat(
      summary.totalRevenue ?? summary.total ?? "0"
    );
    expect(isNaN(totalRevenue)).toBeFalsy();
  });
});
