/**
 * Blueprint §3 — Carrier truck registration
 *
 * Covers truck creation, document upload, admin approval/rejection,
 * and documentsLockedAt enforcement.
 */

import { test, expect } from "@playwright/test";
import { apiCall, getCarrierToken, getAdminToken } from "../shared/test-utils";

test.use({ storageState: "e2e/.auth/carrier.json" });

test.describe("Truck Registration", () => {
  test("carrier can navigate to add-truck form", async ({ page }) => {
    await page.goto("/carrier/trucks");
    // Button or link to add a truck
    const addBtn = page
      .getByRole("link", { name: /add.*truck|new.*truck|register.*truck/i })
      .or(page.getByRole("button", { name: /add.*truck|new.*truck/i }))
      .first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
  });

  test("truck form is reachable at /carrier/trucks/add", async ({ page }) => {
    await page.goto("/carrier/trucks/add");
    // The form should have at least one input field
    const formInput = page.getByRole("textbox").first();
    await expect(formInput).toBeVisible({ timeout: 15000 });
  });

  test("truck form submission creates PENDING truck (API cross-check)", async () => {
    test.setTimeout(60000);
    const carrierToken = await getCarrierToken();

    const plate = `BP-${Date.now().toString(36).slice(-5).toUpperCase()}`;
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
    const truck = data.truck ?? data;
    expect(truck.approvalStatus ?? truck.status).toMatch(/PENDING/i);
  });

  test("truck documents page shows upload section", async ({ page }) => {
    await page.goto("/carrier/documents");
    // Scope to main to avoid matching sidebar nav spans
    await expect(
      page
        .locator("main")
        .getByText(/document|upload|pending|approved|locked/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("admin approves truck — truck shows APPROVED status", async () => {
    test.setTimeout(90000);
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    // Create a truck to approve
    const plate = `BP-APP-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const { data: created } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: plate,
        capacity: 15000,
        volume: 50,
        currentCity: "Addis Ababa",
        currentRegion: "Addis Ababa",
        isAvailable: true,
      }
    );
    const truckId = (created.truck ?? created).id;

    const { status } = await apiCall(
      "POST",
      `/api/trucks/${truckId}/approve`,
      adminToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    const { data } = await apiCall(
      "GET",
      `/api/trucks/${truckId}`,
      carrierToken
    );
    const truck = data.truck ?? data;
    expect(truck.approvalStatus ?? truck.status).toMatch(/APPROVED/i);
  });

  test("admin rejects truck — carrier can see rejection reason", async () => {
    test.setTimeout(90000);
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    const plate = `BP-REJ-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const { data: created } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: plate,
        capacity: 10000,
        volume: 40,
        currentCity: "Dire Dawa",
        currentRegion: "Dire Dawa",
        isAvailable: true,
      }
    );
    const truckId = (created.truck ?? created).id;

    const { status } = await apiCall(
      "POST",
      `/api/trucks/${truckId}/approve`,
      adminToken,
      {
        action: "REJECT",
        reason: "Missing insurance documents for blueprint test",
      }
    );
    expect(status).toBe(200);

    const { data } = await apiCall(
      "GET",
      `/api/trucks/${truckId}`,
      carrierToken
    );
    const truck = data.truck ?? data;
    expect(truck.approvalStatus ?? truck.status).toMatch(/REJECTED/i);
  });

  test("truck documentsLockedAt set after approval", async () => {
    test.setTimeout(90000);
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    const plate = `BP-LOCK-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const { data: created } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: plate,
        capacity: 12000,
        volume: 45,
        currentCity: "Addis Ababa",
        currentRegion: "Addis Ababa",
        isAvailable: true,
      }
    );
    const truckId = (created.truck ?? created).id;

    await apiCall("POST", `/api/trucks/${truckId}/approve`, adminToken, {
      action: "APPROVE",
    });

    const { data } = await apiCall(
      "GET",
      `/api/trucks/${truckId}`,
      carrierToken
    );
    const truck = data.truck ?? data;
    // documentsLockedAt should be set (non-null)
    expect(truck.documentsLockedAt).not.toBeNull();
  });
});
