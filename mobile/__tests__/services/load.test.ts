/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Tests for load service
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

describe("Load Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLoads", () => {
    it("should call GET /api/loads", async () => {
      const mockLoads = {
        loads: [{ id: "1", pickupCity: "Addis Ababa" }],
      };
      mockGet.mockResolvedValue({ data: mockLoads });

      const result = await loadService.getLoads();
      expect(mockGet).toHaveBeenCalledWith("/api/loads", {
        params: undefined,
      });
      expect(result.loads).toHaveLength(1);
    });

    it("should pass query params including myLoads", async () => {
      mockGet.mockResolvedValue({ data: { loads: [] } });

      await loadService.getLoads({ myLoads: true, limit: 5 });
      expect(mockGet).toHaveBeenCalledWith("/api/loads", {
        params: { myLoads: true, limit: 5 },
      });
    });
  });

  describe("getLoad", () => {
    it("should handle unwrapped response", async () => {
      const mockLoad = { id: "1", pickupCity: "Addis Ababa" };
      mockGet.mockResolvedValue({ data: mockLoad });

      const result = await loadService.getLoad("1");
      expect(mockGet).toHaveBeenCalledWith("/api/loads/1");
      expect(result.id).toBe("1");
    });

    it("should handle wrapped response", async () => {
      const mockLoad = { id: "1", pickupCity: "Addis Ababa" };
      mockGet.mockResolvedValue({ data: { load: mockLoad } });

      const result = await loadService.getLoad("1");
      expect(result.id).toBe("1");
    });
  });

  describe("createLoad", () => {
    it("should call POST /api/loads and unwrap", async () => {
      const loadData = {
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: "2026-03-01",
        deliveryDate: "2026-03-03",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Electronics",
      };
      mockPost.mockResolvedValue({
        data: { load: { id: "2", ...loadData } },
      });

      const result = await loadService.createLoad(loadData);
      expect(mockPost).toHaveBeenCalledWith("/api/loads", loadData);
      expect(result.pickupCity).toBe("Addis Ababa");
    });
  });

  describe("getReceivedLoadRequests", () => {
    it("should call GET /api/load-requests with params", async () => {
      const mockData = {
        loadRequests: [
          {
            id: "r1",
            loadId: "l1",
            status: "PENDING",
            carrier: { name: "Test Carrier" },
          },
        ],
        pagination: { limit: 10, offset: 0, total: 1, hasMore: false },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await loadService.getReceivedLoadRequests({
        status: "PENDING",
        limit: 5,
      });
      expect(mockGet).toHaveBeenCalledWith("/api/load-requests", {
        params: { status: "PENDING", limit: 5 },
      });
      expect(result.loadRequests).toHaveLength(1);
      expect(result.loadRequests[0].id).toBe("r1");
    });

    it("should default to empty array when loadRequests key is missing", async () => {
      mockGet.mockResolvedValue({ data: { pagination: {} } });

      const result = await loadService.getReceivedLoadRequests();
      expect(result.loadRequests).toEqual([]);
    });

    it("should call without params when none provided", async () => {
      mockGet.mockResolvedValue({
        data: { loadRequests: [], pagination: {} },
      });

      await loadService.getReceivedLoadRequests();
      expect(mockGet).toHaveBeenCalledWith("/api/load-requests", {
        params: undefined,
      });
    });
  });

  describe("createLoadRequest", () => {
    it("should call POST /api/load-requests", async () => {
      const reqData = { loadId: "l1", truckId: "t1" };
      mockPost.mockResolvedValue({
        data: { request: { id: "r1", ...reqData, status: "PENDING" } },
      });

      const result = await loadService.createLoadRequest(reqData);
      expect(mockPost).toHaveBeenCalledWith("/api/load-requests", reqData);
    });
  });
});
