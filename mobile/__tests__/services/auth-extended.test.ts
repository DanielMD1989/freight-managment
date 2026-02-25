/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for auth service — extended methods not covered in auth.test.ts:
 *   resetPassword, updateProfile, login error propagation
 */
import { authService } from "../../src/services/auth";

const mockPost = jest.fn();
const mockPatch = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    get: jest.fn(),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn(
    (e: any) => e?.response?.data?.error ?? e?.message ?? "Unknown error"
  ),
}));

describe("Auth Service — Extended", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- resetPassword ----

  describe("resetPassword", () => {
    it("should call POST /api/auth/reset-password with { token, password }", async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      await authService.resetPassword("reset-token-abc", "NewPass123!");
      expect(mockPost).toHaveBeenCalledWith("/api/auth/reset-password", {
        token: "reset-token-abc",
        password: "NewPass123!",
      });
    });

    it("should send 'password' (not 'newPassword') as the field name", async () => {
      mockPost.mockResolvedValue({ data: {} });

      await authService.resetPassword("tok", "pass");
      const [, body] = mockPost.mock.calls[0];
      expect(body).toHaveProperty("password", "pass");
      expect(body).not.toHaveProperty("newPassword");
    });

    it("should propagate errors", async () => {
      mockPost.mockRejectedValue(new Error("Token expired"));

      await expect(
        authService.resetPassword("bad-token", "pass")
      ).rejects.toThrow("Token expired");
    });
  });

  // ---- updateProfile ----

  describe("updateProfile", () => {
    it("should call PATCH /api/user/profile with data", async () => {
      mockPatch.mockResolvedValue({
        data: { user: { id: "u1", firstName: "Jane", lastName: "Doe" } },
      });

      const result = await authService.updateProfile({
        firstName: "Jane",
        lastName: "Doe",
      });
      expect(mockPatch).toHaveBeenCalledWith("/api/user/profile", {
        firstName: "Jane",
        lastName: "Doe",
      });
      expect(result).toEqual({ id: "u1", firstName: "Jane", lastName: "Doe" });
    });

    it("should unwrap user from response (user ?? data)", async () => {
      mockPatch.mockResolvedValue({
        data: { user: { id: "u1", phone: "+251911" } },
      });

      const result = await authService.updateProfile({ phone: "+251911" });
      expect(result).toEqual({ id: "u1", phone: "+251911" });
    });

    it("should handle unwrapped response", async () => {
      mockPatch.mockResolvedValue({
        data: { id: "u1", firstName: "Updated" },
      });

      const result = await authService.updateProfile({ firstName: "Updated" });
      expect(result).toEqual({ id: "u1", firstName: "Updated" });
    });

    it("should handle partial updates (only phone)", async () => {
      mockPatch.mockResolvedValue({
        data: { user: { id: "u1", phone: "+251922" } },
      });

      await authService.updateProfile({ phone: "+251922" });
      expect(mockPatch).toHaveBeenCalledWith("/api/user/profile", {
        phone: "+251922",
      });
    });

    it("should propagate errors", async () => {
      mockPatch.mockRejectedValue(new Error("Validation error"));

      await expect(
        authService.updateProfile({ firstName: "" })
      ).rejects.toThrow("Validation error");
    });
  });

  // ---- login error propagation ----

  describe("login error propagation", () => {
    it("should wrap API errors via getErrorMessage", async () => {
      const axiosError = {
        message: "Request failed",
        response: { data: { error: "Invalid credentials" } },
      };
      mockPost.mockRejectedValue(axiosError);

      await expect(
        authService.login({ email: "bad@test.com", password: "wrong" })
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw Error instance", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      await expect(
        authService.login({ email: "a@b.com", password: "p" })
      ).rejects.toBeInstanceOf(Error);
    });
  });
});
