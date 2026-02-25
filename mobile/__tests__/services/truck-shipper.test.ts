/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for truck service — shipper-specific methods + untested posting methods
 */
import { truckService } from "../../src/services/truck";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    delete: (...args: any[]) => mockDelete(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Truck Service — Shipper & Posting Methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- Truck Requests (shipper flow) ----

  describe("createTruckRequest", () => {
    it("should call POST /api/truck-requests with { loadId, truckId, notes?, expiresInHours? }", async () => {
      const reqData = { loadId: "l1", truckId: "t1", notes: "Urgent" };
      mockPost.mockResolvedValue({
        data: {
          request: { id: "tr-1", ...reqData },
          message: "Request created",
        },
      });

      const result = await truckService.createTruckRequest(reqData);
      expect(mockPost).toHaveBeenCalledWith("/api/truck-requests", reqData);
      expect(result).toEqual({
        request: { id: "tr-1", ...reqData },
        message: "Request created",
      });
    });

    it("should return { request, message } shape", async () => {
      mockPost.mockResolvedValue({
        data: { request: { id: "tr-2" }, message: "Done" },
      });

      const result = await truckService.createTruckRequest({
        loadId: "l2",
        truckId: "t2",
      });
      expect(result).toHaveProperty("request");
      expect(result).toHaveProperty("message");
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Truck already requested"));

      await expect(
        truckService.createTruckRequest({ loadId: "l1", truckId: "t1" })
      ).rejects.toThrow("Truck already requested");
    });
  });

  describe("getMyTruckRequests", () => {
    it("should call GET /api/truck-requests with params", async () => {
      mockGet.mockResolvedValue({
        data: { requests: [{ id: "tr-1" }], total: 1 },
      });

      const result = await truckService.getMyTruckRequests({
        status: "PENDING",
        limit: 5,
      });
      expect(mockGet).toHaveBeenCalledWith("/api/truck-requests", {
        params: { status: "PENDING", limit: 5 },
      });
      expect(result.requests).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should call without params", async () => {
      mockGet.mockResolvedValue({ data: { requests: [], total: 0 } });

      await truckService.getMyTruckRequests();
      expect(mockGet).toHaveBeenCalledWith("/api/truck-requests", {
        params: undefined,
      });
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Server error"));

      await expect(truckService.getMyTruckRequests()).rejects.toThrow(
        "Server error"
      );
    });
  });

  describe("cancelTruckRequest", () => {
    it("should call DELETE /api/truck-requests/:id (no cancellation reason)", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await truckService.cancelTruckRequest("tr-1");
      expect(mockDelete).toHaveBeenCalledWith("/api/truck-requests/tr-1");
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Not found"));

      await expect(truckService.cancelTruckRequest("bad-id")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("getReceivedTruckRequests", () => {
    it("should call GET /api/truck-requests with phantom { received: true } param", async () => {
      mockGet.mockResolvedValue({
        data: { requests: [{ id: "tr-1" }], total: 1 },
      });

      const result = await truckService.getReceivedTruckRequests({
        status: "PENDING",
      });
      // Documents: sends received: true — phantom param ignored by API
      expect(mockGet).toHaveBeenCalledWith("/api/truck-requests", {
        params: { status: "PENDING", received: true },
      });
      expect(result.requests).toHaveLength(1);
    });

    it("should merge received: true even with no other params", async () => {
      mockGet.mockResolvedValue({ data: { requests: [], total: 0 } });

      await truckService.getReceivedTruckRequests();
      expect(mockGet).toHaveBeenCalledWith("/api/truck-requests", {
        params: { received: true },
      });
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Forbidden"));

      await expect(truckService.getReceivedTruckRequests()).rejects.toThrow(
        "Forbidden"
      );
    });
  });

  describe("respondToTruckRequest", () => {
    it("should convert APPROVED → APPROVE and send to POST /api/truck-requests/:id/respond", async () => {
      mockPost.mockResolvedValue({ data: { status: "APPROVED" } });

      await truckService.respondToTruckRequest(
        "tr-1",
        "APPROVED",
        "Looks good"
      );
      expect(mockPost).toHaveBeenCalledWith(
        "/api/truck-requests/tr-1/respond",
        { action: "APPROVE", responseNotes: "Looks good" }
      );
    });

    it("should convert REJECTED → REJECT", async () => {
      mockPost.mockResolvedValue({ data: { status: "REJECTED" } });

      await truckService.respondToTruckRequest(
        "tr-1",
        "REJECTED",
        "No capacity"
      );
      expect(mockPost).toHaveBeenCalledWith(
        "/api/truck-requests/tr-1/respond",
        { action: "REJECT", responseNotes: "No capacity" }
      );
    });

    it("should send responseNotes (not notes) as the field name", async () => {
      mockPost.mockResolvedValue({ data: {} });

      await truckService.respondToTruckRequest("tr-1", "APPROVED", "OK");
      const [, body] = mockPost.mock.calls[0];
      expect(body).toHaveProperty("responseNotes", "OK");
      expect(body).not.toHaveProperty("notes");
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Already responded"));

      await expect(
        truckService.respondToTruckRequest("tr-1", "APPROVED")
      ).rejects.toThrow("Already responded");
    });
  });

  // ---- Truck Posting extras ----

  describe("getTruckPosting", () => {
    it("should call GET /api/truck-postings/:id and unwrap", async () => {
      const posting = { id: "tp-1", truckId: "t1", status: "ACTIVE" };
      mockGet.mockResolvedValue({ data: { posting } });

      const result = await truckService.getTruckPosting("tp-1");
      expect(mockGet).toHaveBeenCalledWith("/api/truck-postings/tp-1");
      expect(result.id).toBe("tp-1");
    });

    it("should handle unwrapped response", async () => {
      const posting = { id: "tp-2", status: "ACTIVE" };
      mockGet.mockResolvedValue({ data: posting });

      const result = await truckService.getTruckPosting("tp-2");
      expect(result.id).toBe("tp-2");
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(truckService.getTruckPosting("bad")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("updateTruckPosting", () => {
    it("should call PATCH /api/truck-postings/:id with data and unwrap", async () => {
      const update = { notes: "Updated notes" };
      mockPatch.mockResolvedValue({
        data: { posting: { id: "tp-1", ...update } },
      });

      const result = await truckService.updateTruckPosting(
        "tp-1",
        update as any
      );
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/truck-postings/tp-1",
        update
      );
      expect(result.notes).toBe("Updated notes");
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Forbidden"));

      await expect(
        truckService.updateTruckPosting("tp-1", {} as any)
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("cancelTruckPosting", () => {
    it("should call PATCH /api/truck-postings/:id with { status: 'CANCELLED' }", async () => {
      mockPatch.mockResolvedValue({ data: {} });

      await truckService.cancelTruckPosting("tp-1");
      expect(mockPatch).toHaveBeenCalledWith("/api/truck-postings/tp-1", {
        status: "CANCELLED",
      });
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Already cancelled"));

      await expect(truckService.cancelTruckPosting("tp-1")).rejects.toThrow(
        "Already cancelled"
      );
    });
  });

  describe("duplicateTruckPosting", () => {
    it("should call POST /api/truck-postings/:id/duplicate and unwrap", async () => {
      mockPost.mockResolvedValue({
        data: { posting: { id: "tp-new", status: "ACTIVE" } },
      });

      const result = await truckService.duplicateTruckPosting("tp-1");
      expect(mockPost).toHaveBeenCalledWith(
        "/api/truck-postings/tp-1/duplicate"
      );
      expect(result.id).toBe("tp-new");
    });

    it("should handle unwrapped response", async () => {
      mockPost.mockResolvedValue({
        data: { id: "tp-new2", status: "ACTIVE" },
      });

      const result = await truckService.duplicateTruckPosting("tp-1");
      expect(result.id).toBe("tp-new2");
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Posting not found"));

      await expect(truckService.duplicateTruckPosting("bad")).rejects.toThrow(
        "Posting not found"
      );
    });
  });
});
