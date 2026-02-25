/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for dispute service — getDisputes, getDispute, createDispute, error propagation
 */
import { disputeService } from "../../src/services/dispute";

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Dispute Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDisputes", () => {
    it("should call GET /api/disputes without params", async () => {
      mockGet.mockResolvedValue({
        data: { disputes: [{ id: "d1" }], pagination: { total: 1 } },
      });

      const result = await disputeService.getDisputes();
      expect(mockGet).toHaveBeenCalledWith("/api/disputes", {
        params: undefined,
      });
      expect(result.disputes).toHaveLength(1);
    });

    it("should pass status filter as params", async () => {
      mockGet.mockResolvedValue({
        data: { disputes: [], pagination: { total: 0 } },
      });

      await disputeService.getDisputes({ status: "OPEN" });
      expect(mockGet).toHaveBeenCalledWith("/api/disputes", {
        params: { status: "OPEN" },
      });
    });

    it("should pass loadId filter as params", async () => {
      mockGet.mockResolvedValue({
        data: { disputes: [], pagination: { total: 0 } },
      });

      await disputeService.getDisputes({ loadId: "l1" });
      expect(mockGet).toHaveBeenCalledWith("/api/disputes", {
        params: { loadId: "l1" },
      });
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Unauthorized"));

      await expect(disputeService.getDisputes()).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  describe("getDispute", () => {
    it("should call GET /api/disputes/:id", async () => {
      mockGet.mockResolvedValue({
        data: { dispute: { id: "d1", type: "DAMAGE" } },
      });

      const result = await disputeService.getDispute("d1");
      expect(mockGet).toHaveBeenCalledWith("/api/disputes/d1");
      expect(result.id).toBe("d1");
    });

    it("should defensive unwrap: response.data.dispute ?? response.data", async () => {
      // Wrapped
      mockGet.mockResolvedValue({
        data: { dispute: { id: "d1", type: "DAMAGE" } },
      });
      const r1 = await disputeService.getDispute("d1");
      expect(r1.id).toBe("d1");

      // Unwrapped
      mockGet.mockResolvedValue({
        data: { id: "d2", type: "OTHER" },
      });
      const r2 = await disputeService.getDispute("d2");
      expect(r2.id).toBe("d2");
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(disputeService.getDispute("d1")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("createDispute", () => {
    it("should call POST /api/disputes with data", async () => {
      const data = {
        loadId: "l1",
        type: "PAYMENT_ISSUE",
        description: "Payment not received",
      };
      mockPost.mockResolvedValue({
        data: { dispute: { id: "d1", ...data, status: "OPEN" } },
      });

      const result = await disputeService.createDispute(data);
      expect(mockPost).toHaveBeenCalledWith("/api/disputes", data);
      expect(result.id).toBe("d1");
    });

    it("should defensive unwrap response", async () => {
      mockPost.mockResolvedValue({
        data: { id: "d2", type: "DAMAGE", status: "OPEN" },
      });

      const result = await disputeService.createDispute({
        loadId: "l1",
        type: "DAMAGE",
        description: "Cargo damaged",
      });
      expect(result.id).toBe("d2");
    });

    it("should include evidence when provided", async () => {
      const data = {
        loadId: "l1",
        type: "DAMAGE",
        description: "Cargo damaged",
        evidence: ["https://example.com/photo1.jpg"],
      };
      mockPost.mockResolvedValue({
        data: { dispute: { id: "d1", ...data } },
      });

      await disputeService.createDispute(data);
      expect(mockPost).toHaveBeenCalledWith("/api/disputes", data);
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Bad request"));

      await expect(
        disputeService.createDispute({
          loadId: "l1",
          type: "OTHER",
          description: "Test",
        })
      ).rejects.toThrow("Bad request");
    });
  });
});
