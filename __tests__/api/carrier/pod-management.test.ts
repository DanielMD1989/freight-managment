/**
 * POD Management API Tests
 *
 * Tests for:
 * - POST /api/loads/[id]/pod (Upload POD)
 * - PUT /api/loads/[id]/pod (Verify POD)
 *
 * Business rules:
 * - Only assigned carrier (or admin) can upload POD
 * - Only shipper who owns the load (or admin) can verify POD
 * - Load must be DELIVERED before POD upload
 * - POD cannot be uploaded twice
 * - POD must be submitted before verification
 * - POD cannot be verified twice
 * - File validation: type (image/PDF only), size (max 10MB)
 * - Auto-settlement triggered on POD verification
 * - Cache invalidated after upload and verify
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
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks
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

// Custom notifications mock with POD-specific types
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    SYSTEM: "SYSTEM",
    POD_SUBMITTED: "POD_SUBMITTED",
    POD_VERIFIED: "POD_VERIFIED",
    SETTLEMENT_COMPLETE: "SETTLEMENT_COMPLETE",
  },
}));

// Custom deductServiceFee mock
const mockDeductServiceFee = jest.fn(async () => ({
  success: true,
  shipperFee: 150.0,
  carrierFee: 75.0,
  totalPlatformFee: 225.0,
  transactionId: "txn-mock-1",
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFee: (...args: unknown[]) => mockDeductServiceFee(...args),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Import handlers AFTER mocks
const { POST, PUT } = require("@/app/api/loads/[id]/pod/route");

describe("POD Management", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  // Helper to create a mock FormData request with a file
  function createFormDataRequest(
    url: string,
    file?: { name: string; type: string; size: number } | null
  ) {
    const req = createRequest("POST", url, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Mock formData() method on the request
    const mockFormData = {
      get: jest.fn((key: string) => {
        if (key === "file" && file) {
          // Create small buffer with correct magic bytes (size is reported via .size)
          const buf = new ArrayBuffer(64);
          const view = new Uint8Array(buf);
          if (file.type === "image/jpeg" || file.type === "image/jpg") {
            view[0] = 0xff;
            view[1] = 0xd8;
          } else if (file.type === "image/png") {
            view[0] = 0x89;
            view[1] = 0x50;
            view[2] = 0x4e;
            view[3] = 0x47;
          } else if (file.type === "application/pdf") {
            view[0] = 0x25; // %
            view[1] = 0x50; // P
            view[2] = 0x44; // D
            view[3] = 0x46; // F
          }
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            arrayBuffer: async () => buf,
          };
        }
        return null;
      }),
    };

    (req as any).formData = jest.fn(async () => mockFormData);
    return req;
  }

  // Helper to set up a DELIVERED load with assigned truck
  async function setupDeliveredLoad(
    loadId: string,
    overrides: Record<string, unknown> = {}
  ) {
    await db.load.update({
      where: { id: loadId },
      data: {
        status: "DELIVERED",
        assignedTruckId: seed.truck.id,
        podSubmitted: false,
        podVerified: false,
        podUrl: null,
        podSubmittedAt: null,
        podVerifiedAt: null,
        settlementStatus: undefined,
        ...overrides,
      },
    });
  }

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
    mockDeductServiceFee.mockResolvedValue({
      success: true,
      shipperFee: 150.0,
      carrierFee: 75.0,
      totalPlatformFee: 225.0,
      transactionId: "txn-mock-1",
    });
    // Reset load to DELIVERED state for each test
    await setupDeliveredLoad(seed.load.id);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/loads/[id]/pod (Upload POD)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /api/loads/[id]/pod - Upload POD", () => {
    // ─── Auth & Access ────────────────────────────────────────────────────

    describe("Auth & Access", () => {
      it("unauthenticated → 401 or 500", async () => {
        setAuthSession(null);

        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect([401, 500]).toContain(res.status);
      });

      it("shipper cannot upload POD → 403", async () => {
        setAuthSession(shipperSession);

        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(403);

        const data = await parseResponse(res);
        expect(data.error).toContain("carrier");
      });

      it("admin can upload POD", async () => {
        setAuthSession(adminSession);

        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(200);
      });
    });

    // ─── Status guards ────────────────────────────────────────────────────

    describe("Status guards", () => {
      it("404 load not found", async () => {
        const req = createFormDataRequest(
          "http://localhost:3000/api/loads/nonexistent/pod",
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: "nonexistent" });
        expect(res.status).toBe(404);
      });

      it("400 load not DELIVERED (e.g. IN_TRANSIT)", async () => {
        await db.load.update({
          where: { id: seed.load.id },
          data: { status: "IN_TRANSIT" },
        });

        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("DELIVERED");
      });

      it("400 POD already submitted", async () => {
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("already submitted");
      });
    });

    // ─── File validation ──────────────────────────────────────────────────

    describe("File validation", () => {
      it("400 no file in formData", async () => {
        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          null
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("required");
      });

      it("400 invalid file type (text/plain)", async () => {
        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "notes.txt", type: "text/plain", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("image");
      });

      it("400 file too large (>10MB)", async () => {
        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "large.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("10MB");
      });
    });

    // ─── Upload success ───────────────────────────────────────────────────

    describe("Upload success", () => {
      it("200 with podUrl, podSubmitted, podSubmittedAt", async () => {
        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 2048 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(200);

        const data = await parseResponse(res);
        expect(data.load.podUrl).toBeDefined();
        expect(data.load.podSubmitted).toBe(true);
        expect(data.load.podSubmittedAt).toBeDefined();
      });

      it("loadEvent POD_SUBMITTED created", async () => {
        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.pdf", type: "application/pdf", size: 4096 }
        );

        await callHandler(POST, req, { id: seed.load.id });

        const events = await db.loadEvent.findMany({
          where: { loadId: seed.load.id, eventType: "POD_SUBMITTED" },
        });
        expect(events.length).toBeGreaterThan(0);
      });
    });

    // ─── Upload failure ───────────────────────────────────────────────────

    describe("Upload failure", () => {
      it("uploadPOD returns {success:false} → 500", async () => {
        // Override the storage mock for this test
        const { uploadPOD } = require("@/lib/storage");
        uploadPOD.mockResolvedValueOnce({ success: false, error: "S3 down" });

        const req = createFormDataRequest(
          `http://localhost:3000/api/loads/${seed.load.id}/pod`,
          { name: "pod.jpg", type: "image/jpeg", size: 1024 }
        );

        const res = await callHandler(POST, req, { id: seed.load.id });
        expect(res.status).toBe(500);

        const data = await parseResponse(res);
        expect(data.error).toContain("Failed");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PUT /api/loads/[id]/pod (Verify POD)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("PUT /api/loads/[id]/pod - Verify POD", () => {
    // ─── Auth & Access ────────────────────────────────────────────────────

    describe("Auth & Access", () => {
      it("unauthenticated → 401 or 500", async () => {
        setAuthSession(null);

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect([401, 500]).toContain(res.status);
      });

      it("carrier cannot verify POD → 403", async () => {
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(403);

        const data = await parseResponse(res);
        expect(data.error).toContain("shipper");
      });

      it("admin can verify POD", async () => {
        setAuthSession(adminSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(200);
      });
    });

    // ─── Status guards ────────────────────────────────────────────────────

    describe("Status guards", () => {
      it("404 load not found", async () => {
        setAuthSession(shipperSession);

        const req = createRequest(
          "PUT",
          "http://localhost:3000/api/loads/nonexistent/pod"
        );

        const res = await callHandler(PUT, req, { id: "nonexistent" });
        expect(res.status).toBe(404);
      });

      it("400 POD not submitted yet", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: false });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("No POD");
      });

      it("400 POD already verified", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, {
          podSubmitted: true,
          podVerified: true,
        });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(400);

        const data = await parseResponse(res);
        expect(data.error).toContain("already verified");
      });
    });

    // ─── Verify success ───────────────────────────────────────────────────

    describe("Verify success", () => {
      it("200 with podVerified and podVerifiedAt", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(200);

        const data = await parseResponse(res);
        expect(data.load.podVerified).toBe(true);
        expect(data.load.podVerifiedAt).toBeDefined();
      });

      it("loadEvent POD_VERIFIED created", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        await callHandler(PUT, req, { id: seed.load.id });

        const events = await db.loadEvent.findMany({
          where: { loadId: seed.load.id, eventType: "POD_VERIFIED" },
        });
        expect(events.length).toBeGreaterThan(0);
      });
    });

    // ─── Auto-settlement (paid) ───────────────────────────────────────────

    describe("Auto-settlement (paid)", () => {
      it("deductServiceFee called and settlementStatus PAID", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(200);

        // Verify deductServiceFee was called
        expect(mockDeductServiceFee).toHaveBeenCalledWith(seed.load.id);

        const data = await parseResponse(res);
        expect(data.settlement.status).toBe("paid");
        expect(data.settlement.shipperFee).toBe(150.0);
        expect(data.settlement.carrierFee).toBe(75.0);

        // Verify load settlementStatus in DB
        const updatedLoad = await db.load.findUnique({
          where: { id: seed.load.id },
        });
        expect(updatedLoad.settlementStatus).toBe("PAID");
      });

      it("SETTLEMENT_COMPLETED loadEvent created with fee amounts", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        await callHandler(PUT, req, { id: seed.load.id });

        const events = await db.loadEvent.findMany({
          where: {
            loadId: seed.load.id,
            eventType: "SETTLEMENT_COMPLETED",
          },
        });
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].metadata).toBeDefined();
      });
    });

    // ─── Auto-settlement (waived) ─────────────────────────────────────────

    describe("Auto-settlement (waived)", () => {
      it("totalPlatformFee=0 → settlementStatus PAID, status paid_waived", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        mockDeductServiceFee.mockResolvedValueOnce({
          success: true,
          shipperFee: 0,
          carrierFee: 0,
          totalPlatformFee: 0,
          transactionId: "txn-waived",
        });

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(200);

        const data = await parseResponse(res);
        expect(data.settlement.status).toBe("paid_waived");

        const updatedLoad = await db.load.findUnique({
          where: { id: seed.load.id },
        });
        expect(updatedLoad.settlementStatus).toBe("PAID");
      });
    });

    // ─── Auto-settlement (failed) ─────────────────────────────────────────

    describe("Auto-settlement (failed)", () => {
      it("deductServiceFee throws → settlementStatus DISPUTE", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        mockDeductServiceFee.mockRejectedValueOnce(
          new Error("Wallet insufficient balance")
        );

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        const res = await callHandler(PUT, req, { id: seed.load.id });
        expect(res.status).toBe(200);

        const data = await parseResponse(res);
        expect(data.settlement.status).toBe("failed");

        const updatedLoad = await db.load.findUnique({
          where: { id: seed.load.id },
        });
        expect(updatedLoad.settlementStatus).toBe("DISPUTE");
      });
    });

    // ─── Cache invalidation ──────────────────────────────────────────────

    describe("Cache invalidation", () => {
      it("CacheInvalidation.load called after verify", async () => {
        setAuthSession(shipperSession);
        await setupDeliveredLoad(seed.load.id, { podSubmitted: true });

        const { CacheInvalidation } = require("@/lib/cache");

        const req = createRequest(
          "PUT",
          `http://localhost:3000/api/loads/${seed.load.id}/pod`
        );

        await callHandler(PUT, req, { id: seed.load.id });

        expect(CacheInvalidation.load).toHaveBeenCalled();
      });
    });
  });
});
