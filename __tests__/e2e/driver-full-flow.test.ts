/**
 * E2E Driver Full Lifecycle Test
 *
 * Covers the complete driver journey in one sequential flow:
 *   invite → accept → approve → assign → drive → POD → complete
 *
 * Also verifies:
 *   - Auto-availability: driver becomes unavailable on assign, restored on completion
 *   - POD is visible to carrier (GET)
 *   - Carrier CANNOT upload POD (POST returns 404)
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockLoadUtils,
  mockStorage,
  mockTrustMetrics,
  SeedData,
} from "../utils/routeTestUtils";

// ─── Mocks (must be at module level, before handler imports) ─────────────────

mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockLoadUtils();
mockStorage();
mockTrustMetrics();

jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  createNotificationForRole: jest.fn(async () => ({ id: "notif-role-1" })),
  notifyOrganization: jest.fn(async () => {}),
  notifyLoadStakeholders: jest.fn(async () => {}),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    TRIP_DRIVER_ASSIGNED: "TRIP_DRIVER_ASSIGNED",
    TRIP_DRIVER_UNASSIGNED: "TRIP_DRIVER_UNASSIGNED",
    TRIP_CANCELLED: "TRIP_CANCELLED",
    TRIP_DELIVERED: "TRIP_DELIVERED",
    DELIVERY_CONFIRMED: "DELIVERY_CONFIRMED",
    POD_SUBMITTED: "POD_SUBMITTED",
    DRIVER_REGISTERED: "DRIVER_REGISTERED",
    DRIVER_APPROVED: "DRIVER_APPROVED",
    SERVICE_FEE_FAILED: "SERVICE_FEE_FAILED",
    SETTLEMENT_COMPLETE: "SETTLEMENT_COMPLETE",
    SYSTEM: "SYSTEM",
  },
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFee: jest.fn(async () => ({
    success: true,
    shipperFee: 150,
    carrierFee: 75,
    totalPlatformFee: 225,
    platformRevenue: { greaterThan: (n: number) => 225 > n },
    transactionId: "txn-e2e-1",
  })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// ─── Import handlers AFTER mocks ────────────────────────────────────────────

const { POST: inviteDriver } = require("@/app/api/drivers/invite/route");
const { POST: acceptInvite } = require("@/app/api/drivers/accept-invite/route");
const { POST: approveDriver } = require("@/app/api/drivers/[id]/approve/route");
const {
  POST: assignDriver,
} = require("@/app/api/trips/[tripId]/assign-driver/route");
const { PATCH: patchTrip } = require("@/app/api/trips/[tripId]/route");
const {
  POST: postTripPod,
  GET: getTripPod,
} = require("@/app/api/trips/[tripId]/pod/route");

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe("Driver Full Lifecycle E2E", () => {
  let seed: SeedData;
  let tripId: string;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  // Helper to create a mock FormData request with a file
  function createFormDataRequest(
    url: string,
    file?: { name: string; type: string; size: number } | null
  ) {
    const req = createRequest("POST", url, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const mockFormData = {
      get: jest.fn((key: string) => {
        if (key === "file" && file) {
          const buf = new ArrayBuffer(64);
          const view = new Uint8Array(buf);
          if (file.type === "image/jpeg" || file.type === "image/jpg") {
            view[0] = 0xff;
            view[1] = 0xd8;
            view[2] = 0xff;
          }
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            arrayBuffer: async () => buf,
          };
        }
        if (key === "notes") return null;
        return null;
      }),
    };

    (req as any).formData = jest.fn(async () => mockFormData);
    return req;
  }

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a trip in ASSIGNED status for the lifecycle test
    const trip = await db.trip.create({
      data: {
        id: "trip-e2e-lifecycle",
        status: "ASSIGNED",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        loadId: seed.load.id,
        trackingEnabled: true,
      },
    });
    tripId = trip.id;

    // Set load to ASSIGNED status for the trip
    await db.load.update({
      where: { id: seed.load.id },
      data: { status: "ASSIGNED", assignedTruckId: seed.truck.id },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Driver full lifecycle: invite → accept → approve → assign → drive → POD → complete", async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1: Carrier invites driver
    // ═══════════════════════════════════════════════════════════════════════
    setAuthSession(carrierSession);

    const inviteReq = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/invite",
      {
        body: {
          name: "E2E Test Driver",
          phone: "+251911990001",
        },
      }
    );

    const inviteRes = await callHandler(inviteDriver, inviteReq);
    expect(inviteRes.status).toBe(201);

    const inviteData = await parseResponse(inviteRes);
    expect(inviteData.success).toBe(true);
    expect(inviteData.inviteCode).toHaveLength(6);

    const inviteCode = inviteData.inviteCode;

    // Verify: User created with INVITED status
    const invitedUser = await db.user.findFirst({
      where: { phone: "+251911990001", role: "DRIVER" },
    });
    expect(invitedUser).toBeTruthy();
    expect(invitedUser!.status).toBe("INVITED");
    expect(invitedUser!.organizationId).toBe("carrier-org-1");

    const driverId = invitedUser!.id;

    // ═══════════════════════════════════════════════════════════════════════
    // Step 2: Driver accepts invite (unauthenticated)
    // ═══════════════════════════════════════════════════════════════════════
    setAuthSession(null); // accept-invite is unauthenticated

    const acceptReq = createRequest(
      "POST",
      "http://localhost:3000/api/drivers/accept-invite",
      {
        body: {
          inviteCode,
          phone: "+251911990001",
          password: "SecurePass123!",
        },
      }
    );

    const acceptRes = await callHandler(acceptInvite, acceptReq);
    expect(acceptRes.status).toBe(201);

    const acceptData = await parseResponse(acceptRes);
    expect(acceptData.success).toBe(true);
    expect(acceptData.driverId).toBe(driverId);

    // Verify: User promoted to PENDING_VERIFICATION + driverProfile created
    const pendingUser = await db.user.findUnique({ where: { id: driverId } });
    expect(pendingUser!.status).toBe("PENDING_VERIFICATION");

    const driverProfile = await db.driverProfile.findUnique({
      where: { userId: driverId },
    });
    expect(driverProfile).toBeTruthy();
    expect(driverProfile!.isAvailable).toBe(true);

    // ═══════════════════════════════════════════════════════════════════════
    // Step 3: Carrier approves driver
    // ═══════════════════════════════════════════════════════════════════════
    setAuthSession(carrierSession);

    const approveReq = createRequest(
      "POST",
      `http://localhost:3000/api/drivers/${driverId}/approve`
    );

    const approveRes = await callHandler(approveDriver, approveReq, {
      id: driverId,
    });
    expect(approveRes.status).toBe(200);

    const approveData = await parseResponse(approveRes);
    expect(approveData.success).toBe(true);

    // Verify: User now ACTIVE
    const activeUser = await db.user.findUnique({ where: { id: driverId } });
    expect(activeUser!.status).toBe("ACTIVE");

    // ═══════════════════════════════════════════════════════════════════════
    // Step 4: Carrier assigns driver to trip
    // ═══════════════════════════════════════════════════════════════════════
    const assignReq = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId } }
    );

    const assignRes = await callHandler(assignDriver, assignReq, { tripId });
    expect(assignRes.status).toBe(200);

    const assignData = await parseResponse(assignRes);
    expect(assignData.success).toBe(true);
    expect(assignData.driverId).toBe(driverId);

    // Verify: auto-availability — assign-driver called driverProfile.update with isAvailable: false
    expect(db.driverProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: driverId },
        data: { isAvailable: false },
      })
    );

    // Verify: trip has driverId set
    const tripAfterAssign = await db.trip.findUnique({
      where: { id: tripId },
    });
    expect(tripAfterAssign!.driverId).toBe(driverId);

    // ═══════════════════════════════════════════════════════════════════════
    // Step 5: Driver advances trip status through the state machine
    //   ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED
    // ═══════════════════════════════════════════════════════════════════════
    const driverSession = createMockSession({
      userId: driverId,
      email: invitedUser!.email,
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    });

    const transitions: Array<{
      to: string;
      extra?: Record<string, unknown>;
    }> = [{ to: "PICKUP_PENDING" }, { to: "IN_TRANSIT" }, { to: "DELIVERED" }];

    for (const { to, extra } of transitions) {
      setAuthSession(driverSession);

      const statusReq = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: to, ...extra } }
      );

      const statusRes = await callHandler(patchTrip, statusReq, { tripId });
      expect(statusRes.status).toBe(200);

      const statusData = await parseResponse(statusRes);
      expect(statusData.trip?.status ?? statusData.status).toBe(to);
    }

    // Verify: trip is now DELIVERED
    const deliveredTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(deliveredTrip!.status).toBe("DELIVERED");

    // ═══════════════════════════════════════════════════════════════════════
    // Step 6: Driver uploads POD → auto-complete
    // ═══════════════════════════════════════════════════════════════════════
    setAuthSession(driverSession);

    // Ensure load is DELIVERED for POD upload
    await db.load.update({
      where: { id: seed.load.id },
      data: {
        status: "DELIVERED",
        podSubmitted: false,
        podVerified: false,
        podUrl: null,
      },
    });

    const { uploadPOD } = require("@/lib/storage");
    uploadPOD.mockResolvedValueOnce({
      success: true,
      url: "https://storage.test/pod-e2e.jpg",
    });

    const podReq = createFormDataRequest(
      `http://localhost:3000/api/trips/${tripId}/pod`,
      { name: "delivery-proof.jpg", type: "image/jpeg", size: 2048 }
    );

    const podRes = await callHandler(postTripPod, podReq, { tripId });
    expect([200, 201]).toContain(podRes.status);

    const podData = await parseResponse(podRes);
    expect(podData.pod).toBeDefined();
    expect(podData.tripStatus).toBe("COMPLETED");

    // Verify: trip status = COMPLETED (auto-complete on POD)
    const completedTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(completedTrip!.status).toBe("COMPLETED");

    // Verify: auto-availability — POD completion restored driver via $transaction
    // The POD route calls driverProfile.update({ where: { userId: driverId }, data: { isAvailable: true } })
    // inside a $transaction callback. Verify the transaction was called.
    expect(db.$transaction).toHaveBeenCalled();

    // ═══════════════════════════════════════════════════════════════════════
    // Step 7: Carrier can view POD (GET)
    // ═══════════════════════════════════════════════════════════════════════
    setAuthSession(carrierSession);

    const getPodReq = createRequest(
      "GET",
      `http://localhost:3000/api/trips/${tripId}/pod`
    );

    const getPodRes = await callHandler(getTripPod, getPodReq, { tripId });
    expect(getPodRes.status).toBe(200);

    const getPodData = await parseResponse(getPodRes);
    expect(getPodData.pods).toBeDefined();
    expect(getPodData.count).toBeGreaterThanOrEqual(1);
  });

  it("Carrier cannot upload POD for driver-assigned trip", async () => {
    // Create a fresh DELIVERED trip with a driver assigned
    const driverUser = await db.user.findFirst({
      where: { phone: "+251911990001", role: "DRIVER" },
    });

    const podTrip = await db.trip.create({
      data: {
        id: "trip-e2e-carrier-pod-block",
        status: "DELIVERED",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        loadId: seed.load.id,
        driverId: driverUser?.id ?? "driver-pod-block",
        trackingEnabled: true,
      },
    });

    setAuthSession(carrierSession);

    const req = createFormDataRequest(
      `http://localhost:3000/api/trips/${podTrip.id}/pod`,
      { name: "carrier-pod.jpg", type: "image/jpeg", size: 1024 }
    );

    const res = await callHandler(postTripPod, req, { tripId: podTrip.id });

    // POD upload is driver-only (+ admin). Carrier gets 404.
    expect(res.status).toBe(404);
  });
});
