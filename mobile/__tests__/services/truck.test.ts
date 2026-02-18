/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Tests for truck service
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

describe("Truck Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTrucks", () => {
    it("should call GET /api/trucks", async () => {
      const mockTrucks = { trucks: [{ id: "1", licensePlate: "AA-12345" }] };
      mockGet.mockResolvedValue({ data: mockTrucks });

      const result = await truckService.getTrucks();
      expect(mockGet).toHaveBeenCalledWith("/api/trucks", {
        params: undefined,
      });
      expect(result.trucks).toHaveLength(1);
    });

    it("should pass query params", async () => {
      mockGet.mockResolvedValue({ data: { trucks: [] } });

      await truckService.getTrucks({ status: "AVAILABLE" });
      expect(mockGet).toHaveBeenCalledWith("/api/trucks", {
        params: { status: "AVAILABLE" },
      });
    });
  });

  describe("getTruck", () => {
    it("should call GET /api/trucks/:id with defensive unwrapping", async () => {
      const mockTruck = {
        id: "1",
        licensePlate: "AA-12345",
        truckType: "DRY_VAN",
      };
      mockGet.mockResolvedValue({ data: mockTruck });

      const result = await truckService.getTruck("1");
      expect(mockGet).toHaveBeenCalledWith("/api/trucks/1");
      expect(result.id).toBe("1");
    });

    it("should handle wrapped response", async () => {
      const mockTruck = { id: "1", licensePlate: "AA-12345" };
      mockGet.mockResolvedValue({ data: { truck: mockTruck } });

      const result = await truckService.getTruck("1");
      expect(result.id).toBe("1");
    });
  });

  describe("createTruck", () => {
    it("should call POST /api/trucks", async () => {
      const truckData = {
        licensePlate: "AA-99999",
        truckType: "DRY_VAN",
        capacity: 10000,
      };
      mockPost.mockResolvedValue({
        data: { truck: { id: "2", ...truckData } },
      });

      const result = await truckService.createTruck(truckData);
      expect(mockPost).toHaveBeenCalledWith("/api/trucks", truckData);
      expect(result.licensePlate).toBe("AA-99999");
    });
  });

  describe("updateTruck", () => {
    it("should call PATCH /api/trucks/:id", async () => {
      mockPatch.mockResolvedValue({
        data: { id: "1", licensePlate: "AA-12345", capacity: 15000 },
      });

      const result = await truckService.updateTruck("1", { capacity: 15000 });
      expect(mockPatch).toHaveBeenCalledWith("/api/trucks/1", {
        capacity: 15000,
      });
    });
  });

  describe("deleteTruck", () => {
    it("should call DELETE /api/trucks/:id", async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      await truckService.deleteTruck("1");
      expect(mockDelete).toHaveBeenCalledWith("/api/trucks/1");
    });
  });

  describe("Truck Postings", () => {
    it("should get truck postings via GET /api/truck-postings", async () => {
      mockGet.mockResolvedValue({
        data: { postings: [{ id: "p1", truckId: "1" }] },
      });

      const result = await truckService.getTruckPostings();
      expect(mockGet).toHaveBeenCalledWith("/api/truck-postings", {
        params: undefined,
      });
    });

    it("should create truck posting via POST /api/truck-postings", async () => {
      const postingData = {
        truckId: "1",
        originCityId: "c1",
        availableFrom: "2026-03-01",
        contactName: "Test",
        contactPhone: "0911",
      };
      mockPost.mockResolvedValue({
        data: { id: "p1", ...postingData },
      });

      const result = await truckService.createTruckPosting(postingData);
      expect(mockPost).toHaveBeenCalledWith("/api/truck-postings", postingData);
    });
  });
});
