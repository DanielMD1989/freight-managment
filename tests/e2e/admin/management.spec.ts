/**
 * Blueprint §9 — Admin management operations
 *
 * Covers org approval/rejection, truck approval, and user access revocation.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getAdminToken,
  getCarrierToken,
  getShipperToken,
} from "../shared/test-utils";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin Management", () => {
  test("admin can approve shipper org — POST /admin/organizations/:id/verify → 200", async () => {
    test.setTimeout(90000);
    const adminToken = await getAdminToken();
    const shipperToken = await getShipperToken();

    const { data: meData } = await apiCall("GET", "/api/auth/me", shipperToken);
    const orgId = meData.user?.organizationId ?? meData.organizationId;

    if (!orgId) {
      test.skip(true, "Could not determine shipper org ID");
      return;
    }

    // Reset to PENDING first — seeded org is already APPROVED, verify would return 400
    await apiCall(
      "DELETE",
      `/api/admin/organizations/${orgId}/verify`,
      adminToken
    );

    const { status } = await apiCall(
      "POST",
      `/api/admin/organizations/${orgId}/verify`,
      adminToken,
      {}
    );
    expect([200, 204]).toContain(status);
  });

  test("admin can reject carrier org — POST /admin/organizations/:id/reject → 200", async () => {
    test.setTimeout(90000);
    const adminToken = await getAdminToken();

    // Find or create a PENDING org to reject
    const { data } = await apiCall(
      "GET",
      "/api/admin/organizations?limit=10",
      adminToken
    );
    const orgs: Array<{ id: string; verificationStatus?: string }> =
      data.organizations ?? data ?? [];
    const pending = orgs.find((o) => o.verificationStatus === "PENDING");

    if (!pending) {
      test.skip(true, "No PENDING org available to reject");
      return;
    }

    const { status } = await apiCall(
      "POST",
      `/api/admin/organizations/${pending.id}/reject`,
      adminToken,
      { reason: "Blueprint management test rejection" }
    );
    expect([200, 204]).toContain(status);
  });

  test("admin can approve truck — POST /api/trucks/:id/approve {action:APPROVE} → 200", async () => {
    test.setTimeout(120000);
    const adminToken = await getAdminToken();
    const carrierToken = await getCarrierToken();

    // Create a fresh PENDING truck
    const plate = `BP-MGT-${Date.now().toString(36).slice(-5).toUpperCase()}`;
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
  });

  test("admin can revoke dispatcher access — POST /admin/users/:id/revoke → 200", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();

    // Find dispatcher user
    const { data } = await apiCall(
      "GET",
      "/api/admin/users?limit=20",
      adminToken
    );
    const users: Array<{ id: string; role?: string; email?: string }> =
      data.users ?? data ?? [];
    const dispatcher = users.find(
      (u) => u.role === "DISPATCHER" || u.email?.includes("dispatcher")
    );

    if (!dispatcher) {
      test.skip(true, "No dispatcher user found");
      return;
    }

    const { status } = await apiCall(
      "POST",
      `/api/admin/users/${dispatcher.id}/revoke`,
      adminToken,
      { reason: "Blueprint revoke test — will be re-enabled" }
    );
    expect([200, 204]).toContain(status);

    // Re-activate immediately so subsequent tests (and other spec files) are not affected
    await apiCall("PATCH", `/api/admin/users/${dispatcher.id}`, adminToken, {
      status: "ACTIVE",
    });
  });

  test("admin can revoke shipper access — POST /admin/users/:id/revoke → 200", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();
    const shipperToken = await getShipperToken();

    const { data: meData } = await apiCall("GET", "/api/auth/me", shipperToken);
    const userId = meData.user?.id ?? meData.id;

    const { status } = await apiCall(
      "POST",
      `/api/admin/users/${userId}/revoke`,
      adminToken,
      { reason: "Blueprint revoke test" }
    );
    expect([200, 204]).toContain(status);

    // Re-activate immediately so other tests still pass
    await apiCall("PATCH", `/api/admin/users/${userId}`, adminToken, {
      status: "ACTIVE",
    });
  });

  test("admin can revoke carrier access — POST /admin/users/:id/revoke → 200", async () => {
    test.setTimeout(60000);
    const adminToken = await getAdminToken();
    const carrierToken = await getCarrierToken();

    const { data: meData } = await apiCall("GET", "/api/auth/me", carrierToken);
    const userId = meData.user?.id ?? meData.id;

    const { status } = await apiCall(
      "POST",
      `/api/admin/users/${userId}/revoke`,
      adminToken,
      { reason: "Blueprint carrier revoke test" }
    );
    expect([200, 204]).toContain(status);

    // Re-activate immediately
    await apiCall("PATCH", `/api/admin/users/${userId}`, adminToken, {
      status: "ACTIVE",
    });
  });
});
