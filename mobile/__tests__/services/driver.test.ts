/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Tests for driver API calls made by useDrivers hooks.
 *
 * There is no standalone driver service file — the hooks call apiClient
 * directly. This file tests the API calls at the service/transport layer
 * by invoking the hooks' queryFn/mutationFn and verifying the correct
 * HTTP method, URL, params, and body.
 *
 * Mirrors the pattern in services/truck.test.ts.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockPut = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
    put: (...args: any[]) => mockPut(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

// Capture the options passed to useQuery / useMutation so we can call
// their queryFn / mutationFn directly (same approach as the hook tests).
let capturedQueryFn: any = null;
let capturedMutationFn: any = null;

jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    capturedQueryFn = opts.queryFn;
    return { data: undefined, isLoading: true, error: null };
  },
  useMutation: (opts: any) => {
    capturedMutationFn = opts.mutationFn;
    return { mutate: jest.fn(), isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

import {
  useDrivers,
  useDriver,
  useInviteDriver,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
  useAssignDriver,
  useUnassignDriver,
} from "../../src/hooks/useDrivers";

describe("Driver Service (API calls)", () => {
  beforeEach(() => {
    capturedQueryFn = null;
    capturedMutationFn = null;
    jest.clearAllMocks();
  });

  // ── GET /api/drivers ─────────────────────────────────────────────

  describe("GET /api/drivers", () => {
    it("should call GET /api/drivers with params", async () => {
      const mockDrivers = {
        drivers: [
          { id: "d1", firstName: "Test", lastName: "Driver", status: "ACTIVE" },
        ],
        total: 1,
      };
      mockGet.mockResolvedValue({ data: mockDrivers });

      useDrivers({ status: "ACTIVE", limit: 10 });
      const result = await capturedQueryFn();

      expect(mockGet).toHaveBeenCalledWith("/api/drivers", {
        params: { status: "ACTIVE", limit: 10 },
      });
      expect(result.drivers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should call GET /api/drivers with undefined params when none provided", async () => {
      mockGet.mockResolvedValue({ data: { drivers: [], total: 0 } });

      useDrivers();
      await capturedQueryFn();

      expect(mockGet).toHaveBeenCalledWith("/api/drivers", {
        params: undefined,
      });
    });

    it("should pass available filter", async () => {
      mockGet.mockResolvedValue({ data: { drivers: [], total: 0 } });

      useDrivers({ available: "true", status: "ACTIVE" });
      await capturedQueryFn();

      expect(mockGet).toHaveBeenCalledWith("/api/drivers", {
        params: { available: "true", status: "ACTIVE" },
      });
    });
  });

  // ── GET /api/drivers/:id ──────────────────────────────────────────

  describe("GET /api/drivers/:id", () => {
    it("should call GET /api/drivers/:id", async () => {
      const mockDriver = {
        id: "d1",
        firstName: "Test",
        lastName: "Driver",
        status: "ACTIVE",
        driverProfile: { cdlNumber: "CDL-001", isAvailable: true },
      };
      mockGet.mockResolvedValue({ data: mockDriver });

      useDriver("d1");
      const result = await capturedQueryFn();

      expect(mockGet).toHaveBeenCalledWith("/api/drivers/d1");
      expect(result.id).toBe("d1");
    });

    it("should return response.data directly", async () => {
      const data = { id: "d2", firstName: "Jane" };
      mockGet.mockResolvedValue({ data });

      useDriver("d2");
      const result = await capturedQueryFn();
      expect(result).toEqual(data);
    });
  });

  // ── POST /api/drivers/invite ──────────────────────────────────────

  describe("POST /api/drivers/invite", () => {
    it("should call POST /api/drivers/invite with name, phone, email", async () => {
      const responseData = {
        success: true,
        inviteCode: "ABC123",
        driverName: "John Driver",
        phone: "+251911222333",
        expiresAt: "2026-04-24T00:00:00Z",
      };
      mockPost.mockResolvedValue({ data: responseData });

      useInviteDriver();
      const result = await capturedMutationFn({
        name: "John Driver",
        phone: "+251911222333",
        email: "john@test.com",
      });

      expect(mockPost).toHaveBeenCalledWith("/api/drivers/invite", {
        name: "John Driver",
        phone: "+251911222333",
        email: "john@test.com",
      });
      expect(result.inviteCode).toBe("ABC123");
    });

    it("should work without optional email", async () => {
      mockPost.mockResolvedValue({
        data: { success: true, inviteCode: "XYZ789" },
      });

      useInviteDriver();
      await capturedMutationFn({ name: "Driver Two", phone: "+251900000001" });

      expect(mockPost).toHaveBeenCalledWith("/api/drivers/invite", {
        name: "Driver Two",
        phone: "+251900000001",
      });
    });
  });

  // ── POST /api/drivers/:id/approve ─────────────────────────────────

  describe("POST /api/drivers/:id/approve", () => {
    it("should call POST /api/drivers/:id/approve with no body", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      useApproveDriver();
      await capturedMutationFn("d-1");

      expect(mockPost).toHaveBeenCalledWith("/api/drivers/d-1/approve");
    });
  });

  // ── POST /api/drivers/:id/reject ──────────────────────────────────

  describe("POST /api/drivers/:id/reject", () => {
    it("should call POST /api/drivers/:id/reject with reason body", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      useRejectDriver();
      await capturedMutationFn({
        driverId: "d-1",
        reason: "Failed background check",
      });

      expect(mockPost).toHaveBeenCalledWith("/api/drivers/d-1/reject", {
        reason: "Failed background check",
      });
    });

    it("should include only reason in the body", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      useRejectDriver();
      await capturedMutationFn({
        driverId: "d-2",
        reason: "Expired CDL",
      });

      // Verify the body only has { reason }, not { driverId, reason }
      expect(mockPost).toHaveBeenCalledWith("/api/drivers/d-2/reject", {
        reason: "Expired CDL",
      });
    });
  });

  // ── DELETE /api/drivers/:id (suspend) ─────────────────────────────

  describe("DELETE /api/drivers/:id (suspend)", () => {
    it("should call DELETE /api/drivers/:id", async () => {
      mockDelete.mockResolvedValue({
        data: { success: true, message: "Driver suspended" },
      });

      useSuspendDriver();
      await capturedMutationFn("d-1");

      expect(mockDelete).toHaveBeenCalledWith("/api/drivers/d-1");
    });
  });

  // ── POST /api/trips/:id/assign-driver ─────────────────────────────

  describe("POST /api/trips/:id/assign-driver", () => {
    it("should call POST /api/trips/:id/assign-driver with { driverId }", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      useAssignDriver();
      await capturedMutationFn({ tripId: "t-1", driverId: "d-1" });

      expect(mockPost).toHaveBeenCalledWith("/api/trips/t-1/assign-driver", {
        driverId: "d-1",
      });
    });

    it("should only send driverId in body, not tripId", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      useAssignDriver();
      await capturedMutationFn({ tripId: "t-2", driverId: "d-3" });

      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe("/api/trips/t-2/assign-driver");
      expect(body).toEqual({ driverId: "d-3" });
      expect(body).not.toHaveProperty("tripId");
    });
  });

  // ── POST /api/trips/:id/unassign-driver ───────────────────────────

  describe("POST /api/trips/:id/unassign-driver", () => {
    it("should call POST /api/trips/:id/unassign-driver with no body", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      useUnassignDriver();
      await capturedMutationFn("t-1");

      expect(mockPost).toHaveBeenCalledWith("/api/trips/t-1/unassign-driver");
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe("error propagation", () => {
    it("should propagate API errors from GET /api/drivers", async () => {
      const apiError = new Error("Network error");
      mockGet.mockRejectedValue(apiError);

      useDrivers();
      await expect(capturedQueryFn()).rejects.toThrow("Network error");
    });

    it("should propagate API errors from POST /api/drivers/invite", async () => {
      const apiError = new Error("A driver with this phone already exists");
      mockPost.mockRejectedValue(apiError);

      useInviteDriver();
      await expect(
        capturedMutationFn({ name: "Dup", phone: "+251900000000" })
      ).rejects.toThrow("A driver with this phone already exists");
    });

    it("should propagate API errors from DELETE /api/drivers/:id", async () => {
      const apiError = new Error("Driver has active trips");
      mockDelete.mockRejectedValue(apiError);

      useSuspendDriver();
      await expect(capturedMutationFn("d-1")).rejects.toThrow(
        "Driver has active trips"
      );
    });
  });
});
