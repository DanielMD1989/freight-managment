/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for shipper-specific load operations NOT covered by load.test.ts
 * Focuses on: respondToLoadRequest action mapping, postLoad, updateLoad,
 * deleteLoad, cancelLoadRequest, and edge cases
 */
import { loadService } from "../../src/services/load";

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

describe("Load Service — Shipper Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("respondToLoadRequest", () => {
    it('should convert "APPROVED" to "APPROVE" for API', async () => {
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", status: "APPROVED" } },
      });

      await loadService.respondToLoadRequest("r1", "APPROVED");
      expect(mockPost).toHaveBeenCalledWith(
        "/api/load-requests/r1/respond",
        expect.objectContaining({ action: "APPROVE" })
      );
    });

    it('should convert "REJECTED" to "REJECT" for API', async () => {
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", status: "REJECTED" } },
      });

      await loadService.respondToLoadRequest("r1", "REJECTED");
      expect(mockPost).toHaveBeenCalledWith(
        "/api/load-requests/r1/respond",
        expect.objectContaining({ action: "REJECT" })
      );
    });

    it('should send "responseNotes" (not "notes") to API', async () => {
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", status: "APPROVED" } },
      });

      await loadService.respondToLoadRequest("r1", "APPROVED", "Good truck");
      expect(mockPost).toHaveBeenCalledWith("/api/load-requests/r1/respond", {
        action: "APPROVE",
        responseNotes: "Good truck",
      });
    });

    it("should handle missing notes (undefined)", async () => {
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", status: "REJECTED" } },
      });

      await loadService.respondToLoadRequest("r1", "REJECTED");
      expect(mockPost).toHaveBeenCalledWith("/api/load-requests/r1/respond", {
        action: "REJECT",
        responseNotes: undefined,
      });
    });

    it("should defensive unwrap: response.data.request ?? response.data", async () => {
      // Wrapped response
      const wrappedRequest = { id: "r1", status: "APPROVED" };
      mockPost.mockResolvedValue({ data: { request: wrappedRequest } });

      const result1 = await loadService.respondToLoadRequest("r1", "APPROVED");
      expect(result1.id).toBe("r1");

      // Unwrapped response
      mockPost.mockResolvedValue({ data: { id: "r2", status: "REJECTED" } });

      const result2 = await loadService.respondToLoadRequest("r2", "REJECTED");
      expect(result2.id).toBe("r2");
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Forbidden"));

      await expect(
        loadService.respondToLoadRequest("r1", "APPROVED")
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("postLoad", () => {
    it('should call PATCH /api/loads/:id with { status: "POSTED" }', async () => {
      mockPatch.mockResolvedValue({
        data: { load: { id: "l1", status: "POSTED" } },
      });

      const result = await loadService.postLoad("l1");
      expect(mockPatch).toHaveBeenCalledWith("/api/loads/l1", {
        status: "POSTED",
      });
      expect(result.status).toBe("POSTED");
    });

    it("should defensive unwrap response", async () => {
      // Unwrapped
      mockPatch.mockResolvedValue({ data: { id: "l1", status: "POSTED" } });

      const result = await loadService.postLoad("l1");
      expect(result.id).toBe("l1");
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Bad request"));

      await expect(loadService.postLoad("l1")).rejects.toThrow("Bad request");
    });
  });

  describe("updateLoad", () => {
    it("should call PATCH /api/loads/:id with partial data", async () => {
      const partial = { cargoDescription: "Updated cargo" };
      mockPatch.mockResolvedValue({
        data: { load: { id: "l1", ...partial } },
      });

      const result = await loadService.updateLoad("l1", partial);
      expect(mockPatch).toHaveBeenCalledWith("/api/loads/l1", partial);
      expect(result.cargoDescription).toBe("Updated cargo");
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Not found"));

      await expect(
        loadService.updateLoad("l1", { cargoDescription: "x" } as any)
      ).rejects.toThrow("Not found");
    });
  });

  describe("deleteLoad", () => {
    it("should call DELETE /api/loads/:id", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await loadService.deleteLoad("l1");
      expect(mockDelete).toHaveBeenCalledWith("/api/loads/l1");
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Forbidden"));

      await expect(loadService.deleteLoad("l1")).rejects.toThrow("Forbidden");
    });
  });

  describe("cancelLoadRequest", () => {
    it('should call PATCH /api/load-requests/:id with { status: "CANCELLED" }', async () => {
      mockPatch.mockResolvedValue({ data: {} });

      await loadService.cancelLoadRequest("r1");
      expect(mockPatch).toHaveBeenCalledWith("/api/load-requests/r1", {
        status: "CANCELLED",
      });
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Not found"));

      await expect(loadService.cancelLoadRequest("r1")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("getLoadRequests", () => {
    it("should normalize loadRequests → requests in response", async () => {
      mockGet.mockResolvedValue({
        data: {
          loadRequests: [{ id: "r1" }, { id: "r2" }],
          pagination: { total: 2, limit: 20, offset: 0, hasMore: false },
        },
      });

      const result = await loadService.getLoadRequests("l1");
      expect(mockGet).toHaveBeenCalledWith("/api/load-requests", {
        params: { loadId: "l1" },
      });
      expect(result.requests).toHaveLength(2);
      expect(result.requests[0].id).toBe("r1");
    });

    it("should fall back to requests key when loadRequests is missing", async () => {
      mockGet.mockResolvedValue({
        data: {
          requests: [{ id: "r3" }],
          pagination: { total: 1 },
        },
      });

      const result = await loadService.getLoadRequests("l1");
      expect(result.requests).toHaveLength(1);
    });

    it("should default to empty array when neither key exists", async () => {
      mockGet.mockResolvedValue({
        data: { pagination: { total: 0 } },
      });

      const result = await loadService.getLoadRequests("l1");
      expect(result.requests).toEqual([]);
    });
  });

  describe("createLoadRequest", () => {
    it("should accept optional proposedRate field", async () => {
      const reqData = { loadId: "l1", truckId: "t1", proposedRate: 15000 };
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", ...reqData, status: "PENDING" } },
      });

      const result = await loadService.createLoadRequest(reqData);
      expect(mockPost).toHaveBeenCalledWith("/api/load-requests", reqData);
      expect(result.id).toBe("r1");
    });

    it("should work without proposedRate", async () => {
      const reqData = { loadId: "l1", truckId: "t1" };
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", ...reqData, status: "PENDING" } },
      });

      await loadService.createLoadRequest(reqData);
      expect(mockPost).toHaveBeenCalledWith("/api/load-requests", reqData);
    });
  });
});
