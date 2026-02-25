/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for organization service — all 7 methods
 */
import { organizationService } from "../../src/services/organization";

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

describe("Organization Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- getOrganization ----

  describe("getOrganization", () => {
    it("should call GET /api/organizations/:id", async () => {
      const mockOrg = { id: "org-1", name: "Test Corp" };
      mockGet.mockResolvedValue({ data: { organization: mockOrg } });

      const result = await organizationService.getOrganization("org-1");
      expect(mockGet).toHaveBeenCalledWith("/api/organizations/org-1");
      expect(result.id).toBe("org-1");
      expect(result.name).toBe("Test Corp");
    });

    it("should handle wrapped { organization } response", async () => {
      const mockOrg = { id: "org-1", name: "Wrapped Corp" };
      mockGet.mockResolvedValue({ data: { organization: mockOrg } });

      const result = await organizationService.getOrganization("org-1");
      expect(result.name).toBe("Wrapped Corp");
    });

    it("should handle unwrapped response", async () => {
      const mockOrg = { id: "org-1", name: "Unwrapped Corp" };
      mockGet.mockResolvedValue({ data: mockOrg });

      const result = await organizationService.getOrganization("org-1");
      expect(result.name).toBe("Unwrapped Corp");
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(
        organizationService.getOrganization("bad-id")
      ).rejects.toThrow("Not found");
    });
  });

  // ---- updateOrganization ----

  describe("updateOrganization", () => {
    it("should call PATCH /api/organizations/:id with data", async () => {
      const updateData = { name: "Updated Corp", city: "Addis Ababa" };
      mockPatch.mockResolvedValue({
        data: { organization: { id: "org-1", ...updateData } },
      });

      const result = await organizationService.updateOrganization(
        "org-1",
        updateData
      );
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/organizations/org-1",
        updateData
      );
      expect(result.name).toBe("Updated Corp");
    });

    it("should handle unwrapped response", async () => {
      const updateData = { contactEmail: "new@test.com" };
      mockPatch.mockResolvedValue({
        data: { id: "org-1", ...updateData },
      });

      const result = await organizationService.updateOrganization(
        "org-1",
        updateData
      );
      expect(result.contactEmail).toBe("new@test.com");
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Forbidden"));

      await expect(
        organizationService.updateOrganization("org-1", { name: "X" })
      ).rejects.toThrow("Forbidden");
    });
  });

  // ---- getMembers ----

  describe("getMembers", () => {
    it("should call GET /api/organizations/:orgId and extract .users", async () => {
      const members = [
        {
          id: "u1",
          email: "a@test.com",
          firstName: "A",
          lastName: "B",
          role: "CARRIER",
        },
      ];
      mockGet.mockResolvedValue({
        data: { organization: { id: "org-1", users: members } },
      });

      const result = await organizationService.getMembers("org-1");
      expect(mockGet).toHaveBeenCalledWith("/api/organizations/org-1");
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("a@test.com");
    });

    it("should handle unwrapped response", async () => {
      const members = [
        {
          id: "u1",
          email: "b@test.com",
          firstName: "B",
          lastName: "C",
          role: "SHIPPER",
        },
      ];
      mockGet.mockResolvedValue({
        data: { id: "org-1", users: members },
      });

      const result = await organizationService.getMembers("org-1");
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("b@test.com");
    });

    it("should default to empty array when .users is missing", async () => {
      mockGet.mockResolvedValue({
        data: { organization: { id: "org-1" } },
      });

      const result = await organizationService.getMembers("org-1");
      expect(result).toEqual([]);
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Server error"));

      await expect(organizationService.getMembers("org-1")).rejects.toThrow(
        "Server error"
      );
    });
  });

  // ---- getInvitations ----

  describe("getInvitations", () => {
    it("should call GET /api/organizations/invitations (flat URL, ignores orgId)", async () => {
      const invitations = [
        {
          id: "inv-1",
          email: "invite@test.com",
          role: "CARRIER",
          status: "PENDING",
          createdAt: "2026-02-01",
        },
      ];
      mockGet.mockResolvedValue({ data: { invitations } });

      const result = await organizationService.getInvitations("org-1");
      // Flat URL — no orgId in path
      expect(mockGet).toHaveBeenCalledWith("/api/organizations/invitations");
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("invite@test.com");
    });

    it("should handle unwrapped response (data is array)", async () => {
      const invitations = [
        {
          id: "inv-2",
          email: "x@test.com",
          role: "SHIPPER",
          status: "PENDING",
          createdAt: "2026-02-01",
        },
      ];
      mockGet.mockResolvedValue({ data: invitations });

      const result = await organizationService.getInvitations("org-1");
      expect(result).toHaveLength(1);
    });

    it("should fall back to data when invitations key is missing (returns {} not [])", async () => {
      // Note: `data.invitations ?? data ?? []` — {} is truthy for ??, so returns {}
      // This documents actual behavior — API should always return { invitations: [] }
      mockGet.mockResolvedValue({ data: {} });

      const result = await organizationService.getInvitations("org-1");
      expect(result).toEqual({});
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Unauthorized"));

      await expect(organizationService.getInvitations("org-1")).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  // ---- inviteMember ----

  describe("inviteMember", () => {
    it("should call POST /api/organizations/invitations with organizationId in body", async () => {
      const inviteData = { email: "new@test.com", role: "CARRIER" };
      mockPost.mockResolvedValue({ data: { id: "inv-1", ...inviteData } });

      await organizationService.inviteMember("org-1", inviteData);
      expect(mockPost).toHaveBeenCalledWith("/api/organizations/invitations", {
        email: "new@test.com",
        role: "CARRIER",
        organizationId: "org-1",
      });
    });

    it("should return response data", async () => {
      mockPost.mockResolvedValue({ data: { id: "inv-1", status: "PENDING" } });

      const result = await organizationService.inviteMember("org-1", {
        email: "x@test.com",
        role: "SHIPPER",
      });
      expect(result).toEqual({ id: "inv-1", status: "PENDING" });
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Conflict"));

      await expect(
        organizationService.inviteMember("org-1", {
          email: "dup@test.com",
          role: "CARRIER",
        })
      ).rejects.toThrow("Conflict");
    });
  });

  // ---- removeMember ----

  describe("removeMember", () => {
    it("should call DELETE /api/organizations/members/:userId (flat URL)", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await organizationService.removeMember("org-1", "user-42");
      expect(mockDelete).toHaveBeenCalledWith(
        "/api/organizations/members/user-42"
      );
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Forbidden"));

      await expect(
        organizationService.removeMember("org-1", "user-42")
      ).rejects.toThrow("Forbidden");
    });
  });

  // ---- cancelInvitation ----

  describe("cancelInvitation", () => {
    it("should call DELETE /api/organizations/invitations/:invitationId (flat URL)", async () => {
      mockDelete.mockResolvedValue({ data: {} });

      await organizationService.cancelInvitation("org-1", "inv-99");
      expect(mockDelete).toHaveBeenCalledWith(
        "/api/organizations/invitations/inv-99"
      );
    });

    it("should propagate errors", async () => {
      mockDelete.mockRejectedValue(new Error("Not found"));

      await expect(
        organizationService.cancelInvitation("org-1", "inv-bad")
      ).rejects.toThrow("Not found");
    });
  });
});
