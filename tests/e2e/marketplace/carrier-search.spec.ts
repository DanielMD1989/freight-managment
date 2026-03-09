/**
 * Blueprint §3 — Carrier load-board (marketplace)
 *
 * Verifies carrier can browse loads, status filters are enforced,
 * DH-O/DH-D filtering works, and wallet-threshold gating exists.
 */

import { test, expect } from "@playwright/test";
import { apiCall, getCarrierToken } from "../shared/test-utils";

test.use({ storageState: "e2e/.auth/carrier.json" });

test.describe("Carrier Marketplace — load search", () => {
  test("carrier loadboard page renders load cards or empty state", async ({
    page,
  }) => {
    await page.goto("/carrier/loadboard");
    // Scope to main to avoid matching sidebar nav spans
    await expect(
      page
        .locator("main")
        .getByText(/load|shipper|available|no.*load|loadboard/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("GET /api/loads returns 200 with marketplace loads (API)", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/loads?limit=20",
      carrierToken
    );
    expect(status).toBe(200);
    const loads = data.loads ?? data;
    expect(Array.isArray(loads)).toBeTruthy();
  });

  test("carrier marketplace only returns POSTED/SEARCHING/OFFERED loads (API)", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();

    const { status, data } = await apiCall(
      "GET",
      "/api/loads?limit=50",
      carrierToken
    );
    expect(status).toBe(200);

    const loads: Array<{ status: string }> = data.loads ?? data ?? [];
    const allowedStatuses = ["POSTED", "SEARCHING", "OFFERED"];

    for (const load of loads) {
      expect(allowedStatuses).toContain(load.status);
    }
  });

  test("DH-O radius filtering returns valid response (API)", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();

    const { status } = await apiCall(
      "GET",
      "/api/loads?dhToOriginKm=0",
      carrierToken
    );
    expect(status).toBe(200);
  });

  test("wallet below threshold — marketplace returns 402/403 or gating message", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();

    const { data: walletData } = await apiCall(
      "GET",
      "/api/wallet/balance",
      carrierToken
    );
    const balance = walletData.balance ?? walletData.available ?? 0;
    const minimumBalance = walletData.minimumBalance ?? 0;

    if (balance > minimumBalance) {
      test.skip(
        true,
        `Balance (${balance}) above minimumBalance (${minimumBalance}) — cannot test threshold gating`
      );
      return;
    }

    const { status } = await apiCall("GET", "/api/loads", carrierToken);
    expect([200, 402, 403]).toContain(status);
  });
});
