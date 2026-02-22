/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Tests for trip service - verifies correct API endpoints
 */
import { tripService } from "../../src/services/trip";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Trip Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTrips", () => {
    it("should call GET /api/trips", async () => {
      mockGet.mockResolvedValue({ data: { trips: [], total: 0 } });

      const result = await tripService.getTrips();
      expect(mockGet).toHaveBeenCalledWith("/api/trips", {
        params: undefined,
      });
    });

    it("should pass query params", async () => {
      mockGet.mockResolvedValue({ data: { trips: [] } });

      await tripService.getTrips({ status: "IN_TRANSIT", limit: 5 });
      expect(mockGet).toHaveBeenCalledWith("/api/trips", {
        params: { status: "IN_TRANSIT", limit: 5 },
      });
    });
  });

  describe("getTrip", () => {
    it("should call GET /api/trips/:id", async () => {
      mockGet.mockResolvedValue({
        data: { trip: { id: "t1", status: "ASSIGNED" } },
      });

      const result = await tripService.getTrip("t1");
      expect(mockGet).toHaveBeenCalledWith("/api/trips/t1");
      expect(result.id).toBe("t1");
    });

    it("should handle unwrapped response", async () => {
      mockGet.mockResolvedValue({ data: { id: "t1", status: "ASSIGNED" } });

      const result = await tripService.getTrip("t1");
      expect(result.id).toBe("t1");
    });
  });

  describe("updateTripStatus", () => {
    it("should call PATCH /api/trips/:id (not /status)", async () => {
      mockPatch.mockResolvedValue({
        data: { trip: { id: "t1", status: "IN_TRANSIT" } },
      });

      const result = await tripService.updateTripStatus("t1", "IN_TRANSIT");
      expect(mockPatch).toHaveBeenCalledWith("/api/trips/t1", {
        status: "IN_TRANSIT",
      });
      expect(result.status).toBe("IN_TRANSIT");
    });

    it("should NOT call /api/trips/:id/status", async () => {
      mockPatch.mockResolvedValue({
        data: { trip: { id: "t1", status: "DELIVERED" } },
      });

      await tripService.updateTripStatus("t1", "DELIVERED");
      expect(mockPatch).not.toHaveBeenCalledWith(
        expect.stringContaining("/status"),
        expect.anything()
      );
    });

    it("should send extra receiver info for DELIVERED status", async () => {
      mockPatch.mockResolvedValue({
        data: { trip: { id: "t1", status: "DELIVERED" } },
      });

      await tripService.updateTripStatus("t1", "DELIVERED", {
        receiverName: "Dawit G.",
        receiverPhone: "+251933333333",
      });
      expect(mockPatch).toHaveBeenCalledWith("/api/trips/t1", {
        status: "DELIVERED",
        receiverName: "Dawit G.",
        receiverPhone: "+251933333333",
      });
    });
  });

  describe("cancelTrip", () => {
    it("should call POST /api/trips/:id/cancel", async () => {
      mockPost.mockResolvedValue({
        data: { trip: { id: "t1", status: "CANCELLED" } },
      });

      const result = await tripService.cancelTrip("t1", "No longer needed");
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t1/cancel", {
        reason: "No longer needed",
      });
      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("uploadPod", () => {
    it("should call POST /api/trips/:id/pod with multipart", async () => {
      mockPost.mockResolvedValue({
        data: { pod: { id: "p1", fileName: "pod.jpg" } },
      });

      const formData = new FormData();
      const result = await tripService.uploadPod("t1", formData);
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t1/pod", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      expect(result.id).toBe("p1");
    });
  });

  describe("getTripPods", () => {
    it("should call GET /api/trips/:id/pod", async () => {
      mockGet.mockResolvedValue({
        data: { pods: [{ id: "p1" }, { id: "p2" }] },
      });

      const result = await tripService.getTripPods("t1");
      expect(mockGet).toHaveBeenCalledWith("/api/trips/t1/pod");
      expect(result).toHaveLength(2);
    });
  });

  describe("confirmDelivery", () => {
    it("should call POST /api/trips/:id/confirm", async () => {
      mockPost.mockResolvedValue({
        data: { trip: { id: "t1", shipperConfirmed: true } },
      });

      const result = await tripService.confirmDelivery("t1", "Looks good");
      expect(mockPost).toHaveBeenCalledWith("/api/trips/t1/confirm", {
        notes: "Looks good",
      });
    });
  });
});
